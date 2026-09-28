"""Q-Rating grader tests.

These are the tests that matter most in the whole feature: a grader that says
"accepted" when it should not corrupts every rating in that round.
"""

import pytest

from services.qrating import graders as g

BELL = [{"name": "H", "target": 0}, {"name": "CNOT", "target": 1, "control": 0}]
BELL_QASM = """OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
h q[0];
cx q[0],q[1];
"""


def sim_task(**spec):
    base = {"num_qubits": 2, "expected_qasm": BELL_QASM, "min_fidelity": 0.99}
    base.update(spec)
    return {"slug": "bell", "pillar": "simulation", "points": 300, "grader": base}


# --- simulation pillar ------------------------------------------------------

def test_correct_bell_circuit_is_accepted():
    out = g.grade(sim_task(), {"gates": BELL, "num_qubits": 2})
    assert out["verdict"] == g.ACCEPTED and out["score"] == 300
    assert out["fidelity"] == pytest.approx(1.0, abs=1e-6)


def test_the_same_circuit_as_qasm_is_accepted():
    out = g.grade(sim_task(), {"qasm": BELL_QASM})
    assert out["verdict"] == g.ACCEPTED


def test_wrong_circuit_is_rejected_and_scores_nothing():
    out = g.grade(sim_task(), {"gates": [{"name": "H", "target": 0}], "num_qubits": 2})
    assert out["verdict"] == g.WRONG_ANSWER and out["score"] == 0
    assert out["fidelity"] < 0.99


def test_global_phase_does_not_change_the_verdict():
    # Z on both qubits of a Bell state is a global phase: physically the same state.
    phased = BELL + [{"name": "Z", "target": 0}, {"name": "Z", "target": 1}]
    assert g.grade(sim_task(), {"gates": phased, "num_qubits": 2})["verdict"] == g.ACCEPTED


def test_right_state_on_the_wrong_number_of_qubits_is_rejected():
    out = g.grade(sim_task(), {"gates": BELL, "num_qubits": 3})
    assert out["verdict"] == g.WRONG_ANSWER


def test_correct_but_over_budget_is_a_constraint_violation_not_a_wrong_answer():
    # Four redundant Xs cancel out, so the state is still right - but the task
    # asked for it in at most 2 gates.
    padded = BELL + [{"name": "X", "target": 0}] * 4
    out = g.grade(sim_task(max_gates=2), {"gates": padded, "num_qubits": 2})
    assert out["verdict"] == g.CONSTRAINT_VIOLATED
    assert "gates" in out["detail"]


def test_depth_budget_is_enforced():
    deep = BELL + [{"name": "H", "target": 0}] * 10
    out = g.grade(sim_task(max_depth=3), {"gates": deep, "num_qubits": 2})
    assert out["verdict"] == g.CONSTRAINT_VIOLATED


def test_disallowed_gate_is_rejected_even_when_the_state_is_right():
    out = g.grade(sim_task(allowed_gates=["h", "cx"]),
                  {"gates": BELL + [{"name": "Y", "target": 0},
                                    {"name": "Y", "target": 0}], "num_qubits": 2})
    assert out["verdict"] == g.CONSTRAINT_VIOLATED


def test_expected_state_can_be_given_as_amplitudes():
    root_half = 0.7071067811865476
    task = {"pillar": "simulation", "points": 300,
            "grader": {"num_qubits": 2,
                       "expected_state": [root_half, 0, 0, root_half]}}
    assert g.grade(task, {"gates": BELL, "num_qubits": 2})["verdict"] == g.ACCEPTED


def test_counts_mode_accepts_a_distribution_match():
    task = sim_task(kind="counts", max_tvd=0.01)
    assert g.grade(task, {"gates": BELL, "num_qubits": 2})["verdict"] == g.ACCEPTED
    # Same measurement statistics, different state (no entanglement) still passes
    # counts-mode grading - which is why tasks that care about the state use
    # fidelity mode instead.
    task_fidelity = sim_task()
    flipped = [{"name": "H", "target": 0}, {"name": "X", "target": 1}]
    assert g.grade(task_fidelity, {"gates": flipped, "num_qubits": 2})["verdict"] == g.WRONG_ANSWER


def test_malformed_submissions_are_rejected_without_crashing():
    for bad in ({}, {"gates": BELL}, {"qasm": "not qasm at all"},
                {"gates": [{"name": "NOPE", "target": 0}], "num_qubits": 2}):
        out = g.grade(sim_task(), bad)
        assert out["verdict"] in (g.INVALID_SUBMISSION, g.RUNTIME_ERROR)
        assert out["score"] == 0


def test_oversized_circuits_are_refused():
    out = g.grade(sim_task(), {"gates": BELL, "num_qubits": 64})
    assert out["verdict"] == g.INVALID_SUBMISSION
    out = g.grade(sim_task(), {"gates": [{"name": "H", "target": 0}] * 500, "num_qubits": 2})
    assert out["verdict"] == g.INVALID_SUBMISSION


def test_unknown_pillar_is_reported_not_raised():
    assert g.grade({"pillar": "telepathy", "points": 10}, {})["verdict"] == g.RUNTIME_ERROR


# --- algorithmic pillar -----------------------------------------------------

def algo_task(**spec):
    base = {
        "entry_point": "count_h_gates",
        "timeout_seconds": 10,
        "tests": [
            {"args": [["h", "x", "h"]], "expected": 2, "public": True},
            {"args": [[]], "expected": 0},
            {"args": [["x", "cx"]], "expected": 0},
        ],
    }
    base.update(spec)
    return {"slug": "count-h", "pillar": "algorithmic", "points": 500, "grader": base}


CORRECT = "def count_h_gates(gates):\n    return sum(1 for g in gates if g == 'h')\n"


def test_correct_program_passes_every_hidden_test():
    out = g.grade(algo_task(), {"source_code": CORRECT})
    assert out["verdict"] == g.ACCEPTED and out["score"] == 500
    assert out["tests_passed"] == out["tests_total"] == 3


def test_wrong_program_is_a_wrong_answer():
    out = g.grade(algo_task(), {"source_code": "def count_h_gates(gates):\n    return 99\n"})
    assert out["verdict"] == g.WRONG_ANSWER and out["score"] == 0


def test_a_public_test_failure_names_the_case_but_a_hidden_one_does_not():
    # Right on the public case, wrong on an empty list -> hidden failure.
    sneaky = "def count_h_gates(gates):\n    return 2 if gates else 7\n"
    hidden = g.grade(algo_task(), {"source_code": sneaky})
    assert hidden["verdict"] == g.WRONG_ANSWER
    assert "hidden test" in hidden["detail"]
    assert "7" not in hidden["detail"]  # never leak the expected value

    public = g.grade(algo_task(), {"source_code": "def count_h_gates(gates):\n    return 0\n"})
    assert public["verdict"] == g.WRONG_ANSWER
    assert "count_h_gates" in public["detail"]


def test_int_and_float_answers_are_treated_as_equal():
    out = g.grade(algo_task(), {"source_code":
                                "def count_h_gates(gates):\n"
                                "    return float(sum(1 for g in gates if g == 'h'))\n"})
    assert out["verdict"] == g.ACCEPTED


def test_an_exception_is_a_runtime_error_not_a_wrong_answer():
    out = g.grade(algo_task(), {"source_code":
                                "def count_h_gates(gates):\n    return gates[99]\n"})
    assert out["verdict"] == g.RUNTIME_ERROR
    assert "IndexError" in out["detail"]


def test_a_missing_entry_point_says_so():
    out = g.grade(algo_task(), {"source_code": "def something_else(x):\n    return x\n"})
    assert out["verdict"] == g.RUNTIME_ERROR
    assert "count_h_gates" in out["detail"]


def test_an_infinite_loop_times_out():
    task = algo_task(timeout_seconds=3)
    out = g.grade(task, {"source_code":
                         "def count_h_gates(gates):\n    while True:\n        pass\n"})
    assert out["verdict"] == g.TIMEOUT


def test_the_sandbox_still_blocks_filesystem_and_process_access():
    for hostile in ("import os\ndef count_h_gates(g):\n    return 2\n",
                    "def count_h_gates(g):\n    return open('x').read()\n"):
        out = g.grade(algo_task(), {"source_code": hostile})
        assert out["verdict"] == g.RUNTIME_ERROR
        assert out["score"] == 0


def test_a_submission_cannot_forge_a_passing_result():
    # The harness hides its payload behind a per-submission nonce, so printing a
    # plausible-looking result does not get you a pass.
    forger = (
        "def count_h_gates(gates):\n    return 0\n"
        "print('QR0000000000000000:[{\"ok\": true, \"value\": 2}, "
        "{\"ok\": true, \"value\": 0}, {\"ok\": true, \"value\": 0}]')\n"
    )
    assert g.grade(algo_task(), {"source_code": forger})["verdict"] != g.ACCEPTED


def test_empty_submission_is_rejected():
    assert g.grade(algo_task(), {"source_code": "   "})["verdict"] == g.INVALID_SUBMISSION


# --- hardware-aware pillar --------------------------------------------------
# Thresholds below are calibrated against the synthetic noise model actually
# used by qiskit_service: a minimal Bell pair lands near 0.965 fidelity, and it
# falls off steadily with two-qubit count (about 0.86 by 21 CNOTs).

def hw_task(**spec):
    base = {"num_qubits": 2, "expected_qasm": BELL_QASM, "shots": 8192,
            "min_fidelity": 0.93, "min_ideal_fidelity": 0.99}
    base.update(spec)
    return {"slug": "bell-on-metal", "pillar": "hardware", "points": 1000, "grader": base}


CNOT = {"name": "CNOT", "target": 1, "control": 0}


def test_a_shallow_correct_circuit_survives_the_noise_model():
    out = g.grade(hw_task(), {"gates": BELL, "num_qubits": 2})
    assert out["verdict"] == g.ACCEPTED and out["score"] == 1000
    assert out["fidelity"] >= 0.93
    assert out["two_qubit_gates"] == 1 and out["depth"] == 2


def test_a_logically_correct_but_needlessly_deep_circuit_fails_on_noise():
    # 20 extra CNOTs cancel in pairs, so this is still a perfect Bell state in
    # theory - and that is exactly the point of the pillar.
    out = g.grade(hw_task(), {"gates": BELL + [CNOT] * 20, "num_qubits": 2})
    assert out["verdict"] == g.WRONG_ANSWER
    assert out["ideal_fidelity"] == pytest.approx(1.0, abs=1e-6)
    assert out["fidelity"] < 0.93
    assert "shallower" in out["detail"]


def test_a_wrong_circuit_is_rejected_before_noise_is_considered():
    out = g.grade(hw_task(), {"gates": [{"name": "H", "target": 0}], "num_qubits": 2})
    assert out["verdict"] == g.WRONG_ANSWER
    assert "without noise" in out["detail"]
    # Rejected on logic, so no noisy run happened and no fidelity was reported.
    assert "fidelity" not in out


def test_the_two_qubit_budget_is_enforced_before_running():
    out = g.grade(hw_task(max_two_qubit_gates=1),
                  {"gates": BELL + [CNOT] * 2, "num_qubits": 2})
    assert out["verdict"] == g.CONSTRAINT_VIOLATED
    assert "two-qubit" in out["detail"]


def test_hardware_grader_reports_the_numbers_a_learner_needs():
    out = g.grade(hw_task(), {"gates": BELL, "num_qubits": 2})
    assert set(["fidelity", "ideal_fidelity", "depth", "two_qubit_gates"]) <= set(out)
