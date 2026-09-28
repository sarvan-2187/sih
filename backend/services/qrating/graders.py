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
        # qasm2_to_gates returns {gates, num_qubits, num_cbits} - the register
        # width declared in the QASM is authoritative, so take it from there.
        parsed = qiskit_service.qasm2_to_gates(qasm)
        gates = parsed["gates"]
        num_qubits = int(parsed["num_qubits"])
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

    # num_cbits=0 on purpose: run_simulation() strips final measurements and
    # calls measure_all(), which appends its own register. Leaving the default
    # register in place would make counts keys look like "00 00" (two registers)
    # and nothing would ever match the expected bitstrings.
    qc = qiskit_service.build_qiskit_circuit(gates, num_qubits, num_cbits=0)
    return qc, gates, num_qubits


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


def _reference_state(spec: Dict[str, Any]) -> np.ndarray:
    """Target statevector for a task.

    Either derived from the author's reference circuit (`expected_qasm`, the
    preferred form - one source of truth) or given literally as amplitudes
    (`expected_state`, for targets that are awkward to express as a circuit).
    """
    expected_qasm = spec.get("expected_qasm")
    if expected_qasm:
        parsed = qiskit_service.qasm2_to_gates(expected_qasm)
        qc = qiskit_service.build_qiskit_circuit(parsed["gates"], int(parsed["num_qubits"]))
        return _ideal_statevector(qc)

    raw = spec.get("expected_state")
    if raw is None:
        raise ValueError("Task grader spec has neither expected_qasm nor expected_state.")
    amplitudes = []
    for value in raw:
        if isinstance(value, dict):
            amplitudes.append(complex(value.get("real", 0.0), value.get("imag", 0.0)))
        elif isinstance(value, (list, tuple)):
            amplitudes.append(complex(value[0], value[1]))
        else:
            amplitudes.append(complex(value))
    return np.asarray(amplitudes, dtype=complex)


def _distribution(state: np.ndarray) -> Dict[str, float]:
    """Ideal measurement distribution of a statevector, keyed by bitstring."""
    num_qubits = max(1, int(math.log2(len(state))))
    probs = np.abs(state) ** 2
    return {
        format(i, "0%db" % num_qubits): float(p)
        for i, p in enumerate(probs) if p > 1e-12
    }


def _hellinger_fidelity(p: Dict[str, float], q: Dict[str, float]) -> float:
    """Standard hardware-benchmarking fidelity between two distributions."""
    keys = set(p) | set(q)
    overlap = sum(math.sqrt(p.get(k, 0.0) * q.get(k, 0.0)) for k in keys)
    return float(min(1.0, overlap ** 2))


# --- simulation pillar ------------------------------------------------------

def grade_simulation(task: Dict[str, Any], submission: Dict[str, Any]) -> Dict[str, Any]:
    """Did the learner build a circuit that produces the target state?

    Graded on exact (noiseless) behaviour: state fidelity for tasks with a
    definite target state, or distribution distance for tasks that only pin down
    what you should measure.
    """
    points = int(task.get("points", 0))
    spec = task.get("grader", {})

    try:
        qc, gates, num_qubits = _build_circuit(submission)
    except ValueError as exc:
        return _result(INVALID_SUBMISSION, points, str(exc))
    except Exception as exc:
        return _result(INVALID_SUBMISSION, points, "Could not read this circuit: %s" % exc)

    expected_qubits = spec.get("num_qubits")
    if expected_qubits is not None and num_qubits != int(expected_qubits):
        return _result(WRONG_ANSWER, points,
                       "This task is on %s qubits; your circuit uses %d."
                       % (expected_qubits, num_qubits))

    violation = _check_constraints(qc, gates, spec)
    if violation:
        return _result(CONSTRAINT_VIOLATED, points, violation)

    try:
        target = _reference_state(spec)
        actual = _ideal_statevector(qc)
    except Exception as exc:
        return _result(RUNTIME_ERROR, points, "Simulation failed: %s" % exc)

    if spec.get("kind") == "counts":
        max_tvd = float(spec.get("max_tvd", 0.05))
        distance = _total_variation_distance(_distribution(actual), _distribution(target))
        if distance <= max_tvd:
            return _result(ACCEPTED, points,
                           "Measurement distribution matches (distance %.4f)." % distance,
                           distance=round(distance, 4))
        return _result(WRONG_ANSWER, points,
                       "Measurement distribution is off (distance %.4f, allowed %.4f)."
                       % (distance, max_tvd), distance=round(distance, 4))

    # Global phase is physically unobservable, and |<a|b>|^2 already ignores it.
    min_fidelity = float(spec.get("min_fidelity", 0.99))
    fidelity = _fidelity(target, actual)
    if fidelity >= min_fidelity:
        return _result(ACCEPTED, points, "State fidelity %.4f." % fidelity,
                       fidelity=round(fidelity, 4))
    return _result(WRONG_ANSWER, points,
                   "State fidelity %.4f; %.4f required." % (fidelity, min_fidelity),
                   fidelity=round(fidelity, 4))


# --- algorithmic pillar -----------------------------------------------------

_HARNESS = '''
# --- Q-Rating harness (appended by the server) ---
def __qr_main():
    import json as __qr_json
    __qr_tests = __qr_json.loads({tests_literal})
    __qr_out = []
    for __qr_case in __qr_tests:
        try:
            __qr_value = {entry_point}(*__qr_case["args"])
            __qr_out.append({{"ok": True, "value": __qr_value}})
        except Exception as __qr_exc:
            __qr_out.append({{"ok": False, "error": "%s: %s" % (type(__qr_exc).__name__, __qr_exc)}})
    print("{nonce}" + __qr_json.dumps(__qr_out))

__qr_main()
'''


def _normalise(value: Any) -> Any:
    """Compare 1 and 1.0 as equal, and lists and tuples as equal.

    Learners return whatever their language gives them; a rating should not turn
    on int-vs-float. Floats are rounded to 6dp so accumulated error in a correct
    algorithm does not read as a wrong answer.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, int):
        return float(value) if not isinstance(value, bool) else value
    if isinstance(value, (list, tuple)):
        return [_normalise(item) for item in value]
    if isinstance(value, dict):
        return {key: _normalise(item) for key, item in sorted(value.items())}
    return value


def _values_match(expected: Any, actual: Any) -> bool:
    return _normalise(expected) == _normalise(actual)


def grade_algorithmic(task: Dict[str, Any], submission: Dict[str, Any],
                      nonce: Optional[str] = None) -> Dict[str, Any]:
    """Run the learner's program against hidden tests.

    All tests run in ONE subprocess: the harness is appended to the submitted
    source and the whole file goes through code_execution_service, which already
    AST-validates against filesystem, network and process access. One process per
    submission rather than per test keeps a live round responsive.

    The harness prints its payload behind a per-submission `nonce` the learner's
    code cannot see (it is defined after their code has already run, and the
    sandbox blocks the imports needed to go looking for it), so a submission
    cannot fake a passing result by printing one.
    """
    points = int(task.get("points", 0))
    spec = task.get("grader", {})
    source = submission.get("source_code") or submission.get("source") or ""
    if not source.strip():
        return _result(INVALID_SUBMISSION, points, "Submission is empty.")

    entry_point = spec.get("entry_point")
    tests: List[Dict[str, Any]] = spec.get("tests") or []
    if not entry_point or not tests:
        return _result(RUNTIME_ERROR, points, "This task has no hidden tests configured.")

    if nonce is None:
        import secrets
        nonce = "QR" + secrets.token_hex(8) + ":"

    cases = [{"args": list(case.get("args", []))} for case in tests]
    program = source + "\n" + _HARNESS.format(
        tests_literal=repr(json.dumps(cases)),
        entry_point=entry_point,
        nonce=nonce,
    )

    timeout = int(spec.get("timeout_seconds", DEFAULT_CODE_TIMEOUT_SECONDS))
    run = code_execution_service.execute_code(program, timeout_seconds=timeout)

    if run.get("exit_code") == 124:
        return _result(TIMEOUT, points, run.get("stderr") or "Execution timed out.")

    stdout = run.get("stdout") or ""
    marker = stdout.rfind(nonce)
    if marker == -1:
        # No payload: the program crashed, was blocked, or never defined the
        # entry point. The learner needs the real reason, not "wrong answer".
        reason = (run.get("stderr") or "").strip() or "Program produced no result."
        if entry_point not in source:
            reason = "Could not find a function named %s(). %s" % (entry_point, reason)
        return _result(RUNTIME_ERROR, points, reason.strip()[:2000])

    try:
        results = json.loads(stdout[marker + len(nonce):].splitlines()[0])
    except Exception:
        return _result(RUNTIME_ERROR, points, "Could not read the result of your program.")

    passed = 0
    for index, (case, outcome) in enumerate(zip(tests, results), start=1):
        if not outcome.get("ok"):
            return _result(RUNTIME_ERROR, points,
                           "Test %d raised %s" % (index, outcome.get("error")),
                           tests_passed=passed, tests_total=len(tests))
        if not _values_match(case.get("expected"), outcome.get("value")):
            # Sample tests are public, so naming one is not a leak; hidden ones
            # are reported by number only.
            if case.get("public"):
                detail = ("Test %d failed: %s(%s) returned %r, expected %r."
                          % (index, entry_point,
                             ", ".join(repr(a) for a in case.get("args", [])),
                             outcome.get("value"), case.get("expected")))
            else:
                detail = "Failed on hidden test %d of %d." % (index, len(tests))
            return _result(WRONG_ANSWER, points, detail,
                           tests_passed=passed, tests_total=len(tests))
        passed += 1

    if passed != len(tests):
        return _result(WRONG_ANSWER, points, "Only %d of %d tests reported a result."
                       % (passed, len(tests)), tests_passed=passed, tests_total=len(tests))

    return _result(ACCEPTED, points, "Passed all %d tests." % len(tests),
                   tests_passed=passed, tests_total=len(tests))


# --- hardware-aware pillar --------------------------------------------------

def grade_hardware(task: Dict[str, Any], submission: Dict[str, Any]) -> Dict[str, Any]:
    """Would this circuit still work on real silicon?

    Two things have to hold, and the order matters:

      1. the circuit is logically correct (ideal statevector matches the target),
         so a noise-robust but wrong circuit cannot pass;
      2. its sampled distribution survives a realistic noise model well enough,
         within the task's two-qubit-gate and depth budget.

    Noise comes from qiskit_service.run_simulation(noisy=True), whose synthetic
    model already carries T1/T2 relaxation, depolarising and readout error. Note
    that call returns an IDEAL statevector and NOISY counts - the counts are the
    only part that degrades, which is exactly the signal wanted here.
    """
    points = int(task.get("points", 0))
    spec = task.get("grader", {})

    try:
        qc, gates, num_qubits = _build_circuit(submission)
    except ValueError as exc:
        return _result(INVALID_SUBMISSION, points, str(exc))
    except Exception as exc:
        return _result(INVALID_SUBMISSION, points, "Could not read this circuit: %s" % exc)

    expected_qubits = spec.get("num_qubits")
    if expected_qubits is not None and num_qubits != int(expected_qubits):
        return _result(WRONG_ANSWER, points,
                       "This task is on %s qubits; your circuit uses %d."
                       % (expected_qubits, num_qubits))

    violation = _check_constraints(qc, gates, spec)
    if violation:
        return _result(CONSTRAINT_VIOLATED, points, violation)

    try:
        target = _reference_state(spec)
        ideal = _ideal_statevector(qc)
    except Exception as exc:
        return _result(RUNTIME_ERROR, points, "Simulation failed: %s" % exc)

    ideal_fidelity = _fidelity(target, ideal)
    min_ideal = float(spec.get("min_ideal_fidelity", 0.99))
    if ideal_fidelity < min_ideal:
        return _result(WRONG_ANSWER, points,
                       "Circuit is not correct even without noise (fidelity %.4f)."
                       % ideal_fidelity, ideal_fidelity=round(ideal_fidelity, 4))

    shots = int(spec.get("shots", 4096))
    try:
        run = qiskit_service.run_simulation(qc, shots=shots, noisy=True)
    except Exception as exc:
        return _result(RUNTIME_ERROR, points, "Noisy simulation failed: %s" % exc)

    noisy = _counts_to_distribution(run.get("counts") or {})
    fidelity = _hellinger_fidelity(_distribution(target), noisy)
    min_fidelity = float(spec.get("min_fidelity", 0.80))

    two_qubit_gates = sum(1 for inst in qc.data if inst.operation.num_qubits == 2)
    extra = {
        "fidelity": round(fidelity, 4),
        "ideal_fidelity": round(ideal_fidelity, 4),
        "depth": qc.depth(),
        "two_qubit_gates": two_qubit_gates,
    }

    if fidelity >= min_fidelity:
        return _result(ACCEPTED, points,
                       "Survived the noise model: fidelity %.4f, depth %d, %d two-qubit gates."
                       % (fidelity, qc.depth(), two_qubit_gates), **extra)
    return _result(WRONG_ANSWER, points,
                   "Correct in theory, but noise fidelity is %.4f and %.2f is required - "
                   "try a shallower circuit with fewer two-qubit gates."
                   % (fidelity, min_fidelity), **extra)


# --- dispatch ---------------------------------------------------------------

GRADERS = {
    "simulation": grade_simulation,
    "algorithmic": grade_algorithmic,
    "hardware": grade_hardware,
}


def grade(task: Dict[str, Any], submission: Dict[str, Any]) -> Dict[str, Any]:
    """Grade a submission against its task. Never raises - a grader crash would
    otherwise cost a learner a submission during a live round."""
    grader = GRADERS.get(task.get("pillar"))
    if grader is None:
        return _result(RUNTIME_ERROR, int(task.get("points", 0)),
                       "Unknown task pillar: %r" % task.get("pillar"))
    try:
        return grader(task, submission)
    except Exception as exc:  # pragma: no cover - defensive
        return _result(RUNTIME_ERROR, int(task.get("points", 0)),
                       "Grader error: %s" % exc)
