"""Round 1 task bank tests.

The point of this file is narrow and important: prove that a correct answer to
each seeded task is actually graded ACCEPTED, and that serving a task to a
learner does not leak the answer. A task whose reference solution fails its own
grader would punish every learner who solved it correctly.
"""

import pytest

from services.qrating import graders as g
from services.qrating.task_seed import (ROUND_1_TASKS, public_task,
                                        _ref_grover_iterations,
                                        _ref_measure_one_probability)

BY_SLUG = {task["slug"]: task for task in ROUND_1_TASKS}

GHZ_GATES = [
    {"name": "H", "target": 0},
    {"name": "CNOT", "target": 1, "control": 0},
    {"name": "CNOT", "target": 2, "control": 1},
]

REFERENCE_SUBMISSIONS = {
    "ghz-three-qubit": {"gates": GHZ_GATES, "num_qubits": 3},
    "grover-iterations": {"source_code":
        "import math\n"
        "def grover_iterations(num_qubits, marked):\n"
        "    return int(math.floor((math.pi / 4) * math.sqrt((2 ** num_qubits) / marked)))\n"},
    "single-qubit-amplitudes": {"source_code":
        "import math\n"
        "M = {\n"
        "    'I': ((1, 0), (0, 1)),\n"
        "    'X': ((0, 1), (1, 0)),\n"
        "    'Z': ((1, 0), (0, -1)),\n"
        "    'H': ((2 ** -0.5, 2 ** -0.5), (2 ** -0.5, -(2 ** -0.5))),\n"
        "    'S': ((1, 0), (0, 1j)),\n"
        "    'T': ((1, 0), (0, complex(math.cos(math.pi / 4), math.sin(math.pi / 4)))),\n"
        "}\n"
        "def measure_one_probability(gates):\n"
        "    a, b = complex(1), complex(0)\n"
        "    for name in gates:\n"
        "        (w, x), (y, z) = M[name.upper()]\n"
        "        a, b = w * a + x * b, y * a + z * b\n"
        "    return round(abs(b) ** 2, 6)\n"},
    "ghz-on-real-silicon": {"gates": GHZ_GATES, "num_qubits": 3},
}


def test_the_bank_is_a_complete_round():
    assert len(ROUND_1_TASKS) == 4
    assert [t["pillar"] for t in ROUND_1_TASKS] == [
        "simulation", "algorithmic", "algorithmic", "hardware"]
    # Points rise with difficulty, so the standings reward the harder tasks.
    assert [t["points"] for t in ROUND_1_TASKS] == sorted(t["points"] for t in ROUND_1_TASKS)
    assert len({t["slug"] for t in ROUND_1_TASKS}) == 4


@pytest.mark.parametrize("slug", list(REFERENCE_SUBMISSIONS))
def test_the_reference_solution_is_accepted(slug):
    out = g.grade(BY_SLUG[slug], REFERENCE_SUBMISSIONS[slug])
    assert out["verdict"] == g.ACCEPTED, "%s: %s" % (slug, out["detail"])
    assert out["score"] == BY_SLUG[slug]["points"]


def test_every_algorithmic_task_has_hidden_tests_with_a_public_example():
    for task in ROUND_1_TASKS:
        if task["pillar"] != "algorithmic":
            continue
        tests = task["grader"]["tests"]
        assert len(tests) >= 8, task["slug"]
        assert any(case.get("public") for case in tests), task["slug"]
        assert any(not case.get("public") for case in tests), task["slug"]


def test_hidden_expectations_match_the_reference_solutions():
    # The table is generated from these, so this guards against the generator
    # being rewired to something that no longer agrees.
    for case in BY_SLUG["grover-iterations"]["grader"]["tests"]:
        assert case["expected"] == _ref_grover_iterations(*case["args"])
    for case in BY_SLUG["single-qubit-amplitudes"]["grader"]["tests"]:
        assert case["expected"] == _ref_measure_one_probability(*case["args"])


def test_known_grover_values():
    # Independent of the reference: hand-checked results.
    assert _ref_grover_iterations(2, 1) == 1
    assert _ref_grover_iterations(10, 1) == 25
    # Every item marked, so no rotation is needed at all.
    assert _ref_grover_iterations(6, 64) == 0


def test_known_amplitude_values():
    assert _ref_measure_one_probability(["X"]) == 1.0
    assert _ref_measure_one_probability(["H", "Z", "H"]) == 1.0
    assert _ref_measure_one_probability([]) == 0.0
    # H T H = (1 - cos 45) / 2, the value a probability-only approach cannot reach.
    assert _ref_measure_one_probability(["H", "T", "H"]) == pytest.approx(0.146447, abs=1e-6)
    # T twice is S, so these must agree.
    assert (_ref_measure_one_probability(["H", "T", "T", "H"])
            == _ref_measure_one_probability(["H", "S", "H"]))


def test_serving_a_task_never_leaks_the_answer():
    for task in ROUND_1_TASKS:
        served = public_task(task)
        assert "grader" not in served and "difficulty" not in served
        blob = repr(served)
        assert "expected" not in blob and "tests" not in blob
        assert "expected_qasm" not in blob
        # The statement and the budget still have to be there.
        assert served["statement_md"] and served["title"] and served["points"]


def test_served_budgets_match_what_the_grader_enforces():
    served = public_task(BY_SLUG["ghz-on-real-silicon"])
    spec = BY_SLUG["ghz-on-real-silicon"]["grader"]
    assert served["constraints"]["max_two_qubit_gates"] == spec["max_two_qubit_gates"]
    assert served["constraints"]["max_depth"] == spec["max_depth"]
    assert served["constraints"]["min_fidelity"] == spec["min_fidelity"]


def test_the_hardware_task_actually_rejects_a_wasteful_circuit():
    # Correct on paper, over the two-qubit budget: the whole point of the pillar.
    wasteful = {"gates": GHZ_GATES + [{"name": "CNOT", "target": 2, "control": 1}] * 2,
                "num_qubits": 3}
    out = g.grade(BY_SLUG["ghz-on-real-silicon"], wasteful)
    assert out["verdict"] == g.CONSTRAINT_VIOLATED


def test_the_simulation_task_rejects_the_long_way_round():
    padded = GHZ_GATES + [{"name": "X", "target": 0}] * 2
    out = g.grade(BY_SLUG["ghz-three-qubit"], {"gates": padded, "num_qubits": 3})
    assert out["verdict"] == g.CONSTRAINT_VIOLATED
