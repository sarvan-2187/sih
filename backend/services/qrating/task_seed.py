"""Seeded Q-Rating task bank - Round 1.

Hidden-test expectations are DERIVED from the reference solutions below rather
than typed out by hand. A mistyped expected value would mark correct submissions
wrong and corrupt every rating in the round, so the reference solution is the
single source of truth and the test table is generated from it.

Nothing in this module is ever sent to a client: routers/qrating.py serves tasks
through public_task(), which strips graders, hidden tests and reference answers.

Difficulty ratings are initial guesses. calibrate_difficulty() moves them toward
reality after each round, so they only have to be roughly right.
"""

import math
from typing import Any, Dict, List

SIMULATION = "simulation"
ALGORITHMIC = "algorithmic"
HARDWARE = "hardware"

GHZ3_QASM = """OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
h q[0];
cx q[0],q[1];
cx q[1],q[2];
"""


# --- reference solutions (server-side only) ---------------------------------

def _ref_grover_iterations(num_qubits: int, marked: int) -> int:
    """Optimal Grover iterations for `marked` targets in a 2**num_qubits space."""
    n = 2 ** num_qubits
    return int(math.floor((math.pi / 4.0) * math.sqrt(n / marked)))


_GATE_MATRICES = {
    "I": ((1, 0), (0, 1)),
    "X": ((0, 1), (1, 0)),
    "Z": ((1, 0), (0, -1)),
    "H": ((1 / math.sqrt(2), 1 / math.sqrt(2)), (1 / math.sqrt(2), -1 / math.sqrt(2))),
    "S": ((1, 0), (0, 1j)),
    "T": ((1, 0), (0, complex(math.cos(math.pi / 4), math.sin(math.pi / 4)))),
}


def _ref_measure_one_probability(gate_names: List[str]) -> float:
    """Probability of measuring 1 after applying `gate_names` to |0>."""
    amp0, amp1 = complex(1), complex(0)
    for name in gate_names:
        (a, b), (c, d) = _GATE_MATRICES[name.upper()]
        amp0, amp1 = a * amp0 + b * amp1, c * amp0 + d * amp1
    return round(abs(amp1) ** 2, 6)


def _cases(reference, inputs, public_count=1) -> List[Dict[str, Any]]:
    """Build a hidden-test table by running the reference over `inputs`.

    The first `public_count` cases are marked public, so a failure on them can
    name the input in the verdict; the rest are reported by number only.
    """
    return [
        {"args": list(args), "expected": reference(*args), "public": i < public_count}
        for i, args in enumerate(inputs)
    ]


# --- the task bank ----------------------------------------------------------

_Q1 = {
    "slug": "ghz-three-qubit",
    "pillar": SIMULATION,
    "title": "Share a secret between three qubits",
    "points": 300,
    "difficulty": 1100,
    "statement_md": (
        "Build a 3-qubit circuit that leaves the register in the GHZ state\n\n"
        "    (|000> + |111>) / sqrt(2)\n\n"
        "so that measuring any one qubit instantly decides the other two.\n\n"
        "Start from |000>. You have at most 4 gates - there is no credit for\n"
        "getting there the long way."
    ),
    "examples": [
        {"label": "Two-qubit warm-up (a Bell pair)",
         "detail": "h q[0]; cx q[0],q[1];  ->  (|00> + |11>)/sqrt(2)"},
    ],
    "grader": {
        "kind": "statevector",
        "num_qubits": 3,
        "expected_qasm": GHZ3_QASM,
        "min_fidelity": 0.99,
        "max_gates": 4,
    },
}

_Q2 = {
    "slug": "grover-iterations",
    "pillar": ALGORITHMIC,
    "title": "How long should Grover run?",
    "points": 500,
    "difficulty": 1350,
    "statement_md": (
        "Grover search rotates the state toward the marked items, and it\n"
        "OVERSHOOTS if you keep going. Given num_qubits (so the search space is\n"
        "2**num_qubits) and marked (how many items the oracle flags), return the\n"
        "optimal number of Grover iterations.\n\n"
        "Write a function:\n\n"
        "    def grover_iterations(num_qubits, marked):\n"
        "        ...\n\n"
        "Return an integer. The classic result is floor((pi/4) * sqrt(N/M))."
    ),
    "examples": [
        {"label": "grover_iterations(2, 1)", "detail": "returns 1"},
        {"label": "grover_iterations(10, 1)", "detail": "returns 25"},
    ],
    "grader": {
        "entry_point": "grover_iterations",
        "timeout_seconds": 8,
        "tests": _cases(_ref_grover_iterations, [
            (2, 1), (3, 1), (4, 1), (10, 1), (4, 4), (8, 3),
            (16, 1), (20, 7), (6, 64), (30, 1),
        ]),
    },
}

_Q3 = {
    "slug": "single-qubit-amplitudes",
    "pillar": ALGORITHMIC,
    "title": "Track one qubit by hand",
    "points": 800,
    "difficulty": 1700,
    "statement_md": (
        "A single qubit starts at |0>. Apply the given gates in order and return\n"
        "the probability of measuring 1, rounded to 6 decimal places.\n\n"
        "Write a function:\n\n"
        "    def measure_one_probability(gates):\n"
        "        ...\n\n"
        "gates is a list of names from I, X, Z, H, S, T. S and T are phase gates -\n"
        "they change nothing measurable on their own, but they matter the moment\n"
        "another H follows, so you cannot get away with tracking probabilities\n"
        "alone. You need the amplitudes."
    ),
    "examples": [
        {"label": "measure_one_probability(['X'])", "detail": "returns 1.0"},
        {"label": "measure_one_probability(['H'])", "detail": "returns 0.5"},
        {"label": "measure_one_probability(['H', 'S', 'H'])", "detail": "returns 0.5"},
    ],
    "grader": {
        "entry_point": "measure_one_probability",
        "timeout_seconds": 8,
        "tests": _cases(_ref_measure_one_probability, [
            (["X"],), ([],), (["H"],), (["H", "H"],), (["H", "Z", "H"],),
            (["H", "S", "H"],), (["H", "T", "H"],), (["H", "T", "T", "H"],),
            (["X", "H", "S", "S", "H"],), (["H", "S", "T", "H", "X"],),
            (["I", "I", "X", "I"],), (["H", "T", "H", "T", "H"],),
        ]),
    },
}

_Q4 = {
    "slug": "ghz-on-real-silicon",
    "pillar": HARDWARE,
    "title": "Make GHZ survive a real device",
    "points": 1000,
    "difficulty": 1900,
    "statement_md": (
        "Same target state as Q1 - but this time it is measured through a device\n"
        "noise model with T1/T2 relaxation, depolarising error and readout error.\n\n"
        "Every two-qubit gate is roughly an order of magnitude noisier than a\n"
        "single-qubit gate, and every extra layer of depth is more time for the\n"
        "state to decay. A circuit that is algebraically perfect and needlessly\n"
        "deep will FAIL here. That is the lesson.\n\n"
        "Budget: at most 2 two-qubit gates, depth at most 4. Your sampled\n"
        "distribution needs 0.90 Hellinger fidelity against the ideal GHZ.\n\n"
        "Once you pass you can optionally re-run the same circuit on real\n"
        "hardware for a badge - it will not change your score."
    ),
    "examples": [
        {"label": "Why the budget is tight",
         "detail": "Routing GHZ through SWAP gates is correct on paper and lands "
                   "near 0.30 fidelity once noise is applied."},
    ],
    "grader": {
        "kind": "noisy_counts",
        "num_qubits": 3,
        "expected_qasm": GHZ3_QASM,
        "shots": 8192,
        "min_ideal_fidelity": 0.99,
        "min_fidelity": 0.90,
        "max_two_qubit_gates": 2,
        "max_depth": 4,
    },
}

ROUND_1_TASKS: List[Dict[str, Any]] = [_Q1, _Q2, _Q3, _Q4]

# What a client is allowed to see. Everything omitted here is the reason a
# verdict cannot be forged.
_PUBLIC_TASK_FIELDS = ("slug", "pillar", "title", "points", "statement_md", "examples")


def public_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """Strip a task down to what is safe to send to a learner mid-round."""
    out = {key: task.get(key) for key in _PUBLIC_TASK_FIELDS}
    spec = task.get("grader", {})
    # Budgets have to be visible - they are part of the problem statement.
    out["constraints"] = {
        key: spec[key]
        for key in ("num_qubits", "max_gates", "max_depth", "max_two_qubit_gates",
                    "allowed_gates", "min_fidelity")
        if key in spec
    }
    if spec.get("entry_point"):
        out["entry_point"] = spec["entry_point"]
    return out
