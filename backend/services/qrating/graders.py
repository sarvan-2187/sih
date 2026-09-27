"""Server-side graders for Q-Rating tasks.

A rating is only worth something if the verdict cannot be forged, so nothing
here trusts the client: the learner sends a circuit or a program, the server
runs it and decides. Hidden tests and expected states never leave this process.

Every grader takes (task, submission) and returns the same envelope:

    {verdict, score, detail}

with verdict one of VERDICTS. `score` is the task's full points on `accepted`
and 0 otherwise - partial credit would make the rating math ambiguous about
what "solved" means.

Task shape (see task_seed.py for real examples):

    {
      "slug": "bell-state",
      "pillar": "simulation" | "algorithmic" | "hardware",
      "points": 300,
      "grader": { ... pillar-specific spec ... }
    }
"""

import json
import math
from typing import Any, Dict, List, Optional, Sequence

import numpy as np
from qiskit.quantum_info import Statevector

from services.code_execution_service import code_execution_service
from services.qiskit_service import qiskit_service

ACCEPTED = "accepted"
WRONG_ANSWER = "wrong_answer"
CONSTRAINT_VIOLATED = "constraint_violated"
RUNTIME_ERROR = "runtime_error"
TIMEOUT = "timeout"
INVALID_SUBMISSION = "invalid_submission"

VERDICTS = (ACCEPTED, WRONG_ANSWER, CONSTRAINT_VIOLATED, RUNTIME_ERROR, TIMEOUT,
            INVALID_SUBMISSION)

# Circuits this size are already far past anything a 90-minute task needs, and
# refusing them keeps one pathological submission from stalling a live round.
MAX_QUBITS = 12
MAX_GATES = 400

DEFAULT_CODE_TIMEOUT_SECONDS = 10


def _result(verdict: str, points: int, detail: str, **extra: Any) -> Dict[str, Any]:
    out = {"verdict": verdict, "score": points if verdict == ACCEPTED else 0,
           "detail": detail}
    out.update(extra)
    return out


# --- circuit helpers --------------------------------------------------------

def _build_circuit(submission: Dict[str, Any]):
    """Turn a submission into a Qiskit circuit.

    Accepts either {"qasm": "..."} or {"gates": [...], "num_qubits": n} - the
    two shapes the existing playgrounds already produce. Raises ValueError with
    a learner-readable message; callers turn that into INVALID_SUBMISSION.
    """
    qasm = submission.get("qasm")
    if qasm:
        gates = qiskit_service.qasm2_to_gates(qasm)
        num_qubits = 0
        for gate in gates:
            for key in ("target", "control"):
                idx = gate.get(key)
                if isinstance(idx, int):
                    num_qubits = max(num_qubits, idx + 1)
        num_qubits = max(num_qubits, int(submission.get("num_qubits") or 0), 1)
    else:
        gates = submission.get("gates")
        if gates is None:
            raise ValueError("Submission needs either a qasm string or a gates array.")
        num_qubits = int(submission.get("num_qubits") or 0)
        if num_qubits <= 0:
            raise ValueError("Submission needs num_qubits.")

    if num_qubits > MAX_QUBITS:
        raise ValueError("Circuits are limited to %d qubits." % MAX_QUBITS)
    if len(gates) > MAX_GATES:
        raise ValueError("Circuits are limited to %d gates." % MAX_GATES)

    return qiskit_service.build_qiskit_circuit(gates, num_qubits), gates, num_qubits


def _ideal_statevector(qc) -> np.ndarray:
    """Statevector of the circuit with measurements stripped."""
    return np.asarray(Statevector.from_instruction(
        qc.remove_final_measurements(inplace=False)).data)


def _fidelity(a: np.ndarray, b: np.ndarray) -> float:
    """|<a|b>|^2, and 0.0 for a dimension mismatch (wrong qubit count)."""
    if a.shape != b.shape:
        return 0.0
    return float(abs(np.vdot(a, b)) ** 2)


def _counts_to_distribution(counts: Dict[str, int]) -> Dict[str, float]:
    total = sum(counts.values()) or 1
    return {key.replace(" ", ""): value / total for key, value in counts.items()}


def _total_variation_distance(p: Dict[str, float], q: Dict[str, float]) -> float:
    """Half the L1 distance between two distributions: 0 identical, 1 disjoint."""
    keys = set(p) | set(q)
    return 0.5 * sum(abs(p.get(k, 0.0) - q.get(k, 0.0)) for k in keys)


def _check_constraints(qc, gates: Sequence[Dict[str, Any]],
                       spec: Dict[str, Any]) -> Optional[str]:
    """Reason the circuit breaks the task's budget, or None if it is within it.

    Budgets are the whole point of several tasks - a correct circuit that needs
    twice the allowed depth has not solved the problem it was set.
    """
    max_gates = spec.get("max_gates")
    if max_gates is not None and len(gates) > max_gates:
        return "Used %d gates; the limit is %d." % (len(gates), max_gates)

    max_depth = spec.get("max_depth")
    if max_depth is not None and qc.depth() > max_depth:
        return "Circuit depth is %d; the limit is %d." % (qc.depth(), max_depth)

    max_two_qubit = spec.get("max_two_qubit_gates")
    if max_two_qubit is not None:
        used = sum(1 for inst in qc.data if inst.operation.num_qubits == 2)
        if used > max_two_qubit:
            return "Used %d two-qubit gates; the limit is %d." % (used, max_two_qubit)

    allowed = spec.get("allowed_gates")
    if allowed:
        allowed_set = {name.lower() for name in allowed}
        used_names = {inst.operation.name.lower() for inst in qc.data}
        forbidden = sorted(used_names - allowed_set - {"measure", "barrier"})
        if forbidden:
            return "These gates are not allowed on this task: %s." % ", ".join(forbidden)

    return None
