from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

SEED_QUESTIONS: List[Dict[str, Any]] = [
    # ==========================================
    # UNIT 1: FOUNDATIONS OF QUANTUM MECHANICS
    # ==========================================

    # 1. quantum-computation-overview
    {
        "type": "mcq",
        "topic_slug": "quantum-computation-overview",
        "concept": "DiVincenzo Criteria",
        "difficulty": "easy",
        "tags": ["quantum-computation-overview", "introduction", "basics"],
        "prompt": "Which of DiVincenzo's criteria specifies the requirement for long coherence times relative to gate operation times?",
        "options": [
            {"id": "opt_a", "text": "Decoherence time must be significantly longer than gate execution time"},
            {"id": "opt_b", "text": "Qubits must travel at optical speeds"},
            {"id": "opt_c", "text": "Physical qubits must operate without cooling"},
            {"id": "opt_d", "text": "Every quantum gate must be non-reversible"}
        ],
        "correct_answer": "opt_a",
        "explanation": "DiVincenzo's 3rd criterion mandates long relevant decoherence times, allowing thousands of coherent gate operations before quantum information degrades.",
        "xp_reward": 10,
        "time_limit_seconds": 45
    },
    {
        "type": "true_false",
        "topic_slug": "quantum-computation-overview",
        "concept": "Quantum Speedup",
        "difficulty": "easy",
        "tags": ["quantum-computation-overview", "introduction"],
        "prompt": "True or False: Quantum computers replace classical computers by executing all classical algorithms faster.",
        "options": [
            {"id": "true", "text": "True"},
            {"id": "false", "text": "False"}
        ],
        "correct_answer": "false",
        "explanation": "Quantum computers offer asymptotic speedups for specific mathematical problems (e.g. factoring, unstructured search, chemistry simulation), not generic serial task acceleration.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },

    # 2. review-linear-algebra
    {
        "type": "mcq",
        "topic_slug": "review-linear-algebra",
        "concept": "Linear Independence & Span",
        "difficulty": "medium",
        "tags": ["review-linear-algebra", "linear-algebra"],
        "prompt": "Given the computational basis states |0⟩ = [1, 0]ᵀ and |1⟩ = [0, 1]ᵀ, what is the dimension of the vector space spanned by them?",
        "options": [
            {"id": "opt_a", "text": "Dimension 2 (Complex 2D Hilbert Space ℂ²)"},
            {"id": "opt_b", "text": "Dimension 1"},
            {"id": "opt_c", "text": "Dimension 4"},
            {"id": "opt_d", "text": "Infinite Dimension"}
        ],
        "correct_answer": "opt_a",
        "explanation": "|0⟩ and |1⟩ form an orthonormal basis for the 2-dimensional complex vector space ℂ².",
        "xp_reward": 15,
        "time_limit_seconds": 180
    },
    {
        "type": "fill_blank",
        "topic_slug": "review-linear-algebra",
        "concept": "Vector Magnitude",
        "difficulty": "easy",
        "tags": ["review-linear-algebra", "norm"],
        "prompt": "For vector v = (3, 4), what is its magnitude |v| = √(3² + 4²)?",
        "options": [],
        "correct_answer": ["5", "5.0"],
        "explanation": "|v| = √(3² + 4²) = √(9 + 16) = √25 = 5.",
        "xp_reward": 10,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "review-linear-algebra",
        "concept": "Determinant & Inverse",
        "difficulty": "medium",
        "tags": ["review-linear-algebra", "determinant"],
        "prompt": "For a 2x2 matrix A = [[a, b], [c, d]], under what condition does the matrix inverse A⁻¹ exist?",
        "options": [
            {"id": "opt_a", "text": "det(A) = ad - bc ≠ 0 (Non-zero determinant)"},
            {"id": "opt_b", "text": "det(A) = ad + bc = 0"},
            {"id": "opt_c", "text": "a + d = 0 (Zero trace)"},
            {"id": "opt_d", "text": "All entries must be positive"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The matrix inverse A⁻¹ exists if and only if det(A) = ad - bc ≠ 0 (non-singular matrix).",
        "xp_reward": 15,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "review-linear-algebra",
        "concept": "Eigenvalues & Eigenvectors",
        "difficulty": "hard",
        "tags": ["review-linear-algebra", "eigenvalues"],
        "prompt": "What is the defining equation for an eigenvector x and eigenvalue λ of matrix A?",
        "options": [
            {"id": "opt_a", "text": "Ax = λx"},
            {"id": "opt_b", "text": "Ax = x/λ"},
            {"id": "opt_c", "text": "A + x = λI"},
            {"id": "opt_d", "text": "det(A) = λx"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Ax = λx state that matrix A transforms eigenvector x by scaling it by eigenvalue λ without changing its direction.",
        "xp_reward": 20,
        "time_limit_seconds": 180
    },

    # 3. dirac-notation
    {
        "type": "mcq",
        "topic_slug": "dirac-notation",
        "concept": "Bra-Ket Duality",
        "difficulty": "medium",
        "tags": ["dirac-notation", "bra-ket"],
        "prompt": "If ket |ψ⟩ = [α, β]ᵀ with complex numbers α and β, what is its dual bra ⟨ψ|?",
        "options": [
            {"id": "opt_a", "text": "[α*, β*] (Row vector of complex conjugates)"},
            {"id": "opt_b", "text": "[α, β] (Row vector without conjugate)"},
            {"id": "opt_c", "text": "[-α, -β]ᵀ"},
            {"id": "opt_d", "text": "[1/α, 1/β]"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The dual bra ⟨ψ| is the Hermitian conjugate (conjugate transpose) of ket |ψ⟩: ⟨ψ| = (|ψ⟩)† = [α*, β*].",
        "xp_reward": 15,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "dirac-notation",
        "concept": "Inner Product & Orthogonality",
        "difficulty": "easy",
        "tags": ["dirac-notation", "inner-product"],
        "prompt": "What is the value of the inner product ⟨0|1⟩ for the computational basis states |0⟩ = [1, 0]ᵀ and |1⟩ = [0, 1]ᵀ?",
        "options": [
            {"id": "opt_a", "text": "0 (Orthogonal states — no overlap)"},
            {"id": "opt_b", "text": "1 (Identical states — perfect overlap)"},
            {"id": "opt_c", "text": "1/√2"},
            {"id": "opt_d", "text": "-1"}
        ],
        "correct_answer": "opt_a",
        "explanation": "⟨0|1⟩ = [1, 0] · [0, 1]ᵀ = 1·0 + 0·1 = 0. Orthogonal states have zero inner product.",
        "xp_reward": 10,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "dirac-notation",
        "concept": "Outer Product Operator",
        "difficulty": "medium",
        "tags": ["dirac-notation", "outer-product"],
        "prompt": "What 2x2 matrix is produced by the outer product |0⟩⟨0| of the basis ket |0⟩ = [1, 0]ᵀ?",
        "options": [
            {"id": "opt_a", "text": "[[1, 0], [0, 0]] (Projection operator onto |0⟩)"},
            {"id": "opt_b", "text": "[[0, 1], [1, 0]]"},
            {"id": "opt_c", "text": "[[0, 0], [0, 1]]"},
            {"id": "opt_d", "text": "[[1, 1], [1, 1]]"}
        ],
        "correct_answer": "opt_a",
        "explanation": "|0⟩⟨0| = [1, 0]ᵀ · [1, 0] = [[1·1, 1·0], [0·1, 0·0]] = [[1, 0], [0, 0]].",
        "xp_reward": 15,
        "time_limit_seconds": 180
    },

    # 4. hilbert-spaces-inner-product
    {
        "type": "mcq",
        "topic_slug": "hilbert-spaces-inner-product",
        "concept": "Inner Product Orthogonality",
        "difficulty": "medium",
        "tags": ["hilbert-spaces-inner-product", "orthogonality"],
        "prompt": "What is the inner product ⟨0|1⟩ of the computational basis states |0⟩ and |1⟩?",
        "options": [
            {"id": "opt_a", "text": "0 (Orthonormal states — zero overlap)"},
            {"id": "opt_b", "text": "1"},
            {"id": "opt_c", "text": "i"},
            {"id": "opt_d", "text": "1/2"}
        ],
        "correct_answer": "opt_a",
        "explanation": "⟨0|1⟩ = [1, 0] · [0, 1]ᵀ = 1·0 + 0·1 = 0, proving computational basis states are mutually orthogonal.",
        "xp_reward": 15,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "hilbert-spaces-inner-product",
        "concept": "Inner Product Axioms & Norm",
        "difficulty": "medium",
        "tags": ["hilbert-spaces-inner-product", "norm"],
        "prompt": "How is the norm (length) ||x|| of a state vector x defined in a Hilbert space?",
        "options": [
            {"id": "opt_a", "text": "||x|| = √(⟨x|x⟩) (Square root of inner product with itself)"},
            {"id": "opt_b", "text": "||x|| = ⟨x|x⟩²"},
            {"id": "opt_c", "text": "||x|| = ⟨x|y⟩"},
            {"id": "opt_d", "text": "||x|| = det(x)"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The norm ||x|| is defined via the inner product as ||x|| = √(⟨x|x⟩). A normalized quantum state satisfies ⟨ψ|ψ⟩ = 1.",
        "xp_reward": 15,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "hilbert-spaces-inner-product",
        "concept": "Quantum Measurement Probability",
        "difficulty": "hard",
        "tags": ["hilbert-spaces-inner-product", "probability"],
        "prompt": "For a quantum system in state |ψ⟩, what physical quantity does |⟨ϕ|ψ⟩|² represent?",
        "options": [
            {"id": "opt_a", "text": "The probability of measuring basis state |ϕ⟩"},
            {"id": "opt_b", "text": "The energy eigenvalue of the state"},
            {"id": "opt_c", "text": "The phase velocity of the wavefunction"},
            {"id": "opt_d", "text": "The matrix determinant of the operator"}
        ],
        "correct_answer": "opt_a",
        "explanation": "According to Born's rule, |⟨ϕ|ψ⟩|² gives the transition probability of observing basis state |ϕ⟩ when the system is prepared in state |ψ⟩.",
        "xp_reward": 20,
        "time_limit_seconds": 180
    },

    # 5. unitary-hermitian-matrices
    {
        "type": "multi_correct",
        "topic_slug": "unitary-hermitian-matrices",
        "concept": "Properties of Unitary Matrices",
        "difficulty": "hard",
        "tags": ["unitary-hermitian-matrices", "matrices"],
        "prompt": "Which properties hold true for any Unitary matrix U? (Select all that apply)",
        "options": [
            {"id": "opt_a", "text": "U^dagger * U = I (Preserves vector norm)"},
            {"id": "opt_b", "text": "All eigenvalues have absolute value equal to 1 (|lambda| = 1)"},
            {"id": "opt_c", "text": "Inverse U^(-1) equals Hermitian adjoint U^dagger"},
            {"id": "opt_d", "text": "Eigenvalues are always strictly real numbers"}
        ],
        "correct_answer": ["opt_a", "opt_b", "opt_c"],
        "explanation": "Unitary matrices preserve inner products (norm=1), have complex eigenvalues on the unit circle |lambda|=1, and satisfy U^(-1) = U^dagger. Hermitian matrices have strictly real eigenvalues.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 6. outer-product-tensor-product
    {
        "type": "mcq",
        "topic_slug": "outer-product-tensor-product",
        "concept": "Projection Operators",
        "difficulty": "medium",
        "tags": ["outer-product-tensor-product", "projection"],
        "prompt": "What matrix operator is formed by the outer product |0><0|?",
        "options": [
            {"id": "opt_a", "text": "[[1, 0], [0, 0]] (Projector onto |0> state)"},
            {"id": "opt_b", "text": "[[0, 1], [1, 0]]"},
            {"id": "opt_c", "text": "[[0, 0], [0, 1]]"},
            {"id": "opt_d", "text": "[[1, 0], [0, 1]]"}
        ],
        "correct_answer": "opt_a",
        "explanation": "|0><0| = [1, 0]^T * [1, 0] = [[1*1, 1*0], [0*1, 0*0]] = [[1, 0], [0, 0]].",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 7. postulates-quantum-mechanics
    {
        "type": "mcq",
        "topic_slug": "postulates-quantum-mechanics",
        "concept": "Born Rule Postulate",
        "difficulty": "medium",
        "tags": ["postulates-quantum-mechanics", "born-rule"],
        "prompt": "According to Quantum Postulate 3 (Measurement), if a state |psi> = a|0> + b|1> is measured, what is the probability of obtaining result |0>?",
        "options": [
            {"id": "opt_a", "text": "|a|^2"},
            {"id": "opt_b", "text": "a"},
            {"id": "opt_c", "text": "|a|^2 + |b|^2"},
            {"id": "opt_d", "text": "2*a"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The Born rule states that measurement yields outcome i with probability P(i) = |<i|psi>|^2 = |a|^2.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 8. stern-gerlach-experiment
    {
        "type": "mcq",
        "topic_slug": "stern-gerlach-experiment",
        "concept": "Quantization of Angular Momentum",
        "difficulty": "easy",
        "tags": ["stern-gerlach-experiment", "spin"],
        "prompt": "What key physical phenomenon did the Stern-Gerlach experiment prove by passing silver atoms through an inhomogeneous magnetic field?",
        "options": [
            {"id": "opt_a", "text": "Spatial quantization of intrinsic electron spin (Spin-1/2)"},
            {"id": "opt_b", "text": "Wave-particle duality of light"},
            {"id": "opt_c", "text": "Continuous deflection angles of atomic dipoles"},
            {"id": "opt_d", "text": "Superluminal signal transmission"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The beam split cleanly into two discrete spots (spin-up and spin-down), proving quantized intrinsic angular momentum (spin 1/2).",
        "xp_reward": 10,
        "time_limit_seconds": 45
    },

    # 9. qubits-bloch-sphere
    {
        "type": "bloch_sphere",
        "topic_slug": "qubits-bloch-sphere",
        "concept": "Bloch Sphere States",
        "difficulty": "medium",
        "tags": ["qubits-bloch-sphere", "qubits", "bloch-sphere"],
        "prompt": "Which point on the Bloch sphere (theta, phi) corresponds to state (|0> + i|1>)/sqrt(2)?",
        "options": [
            {"id": "opt_y_plus", "text": "Theta = pi/2, Phi = pi/2 (+Y axis)"},
            {"id": "opt_x_plus", "text": "Theta = pi/2, Phi = 0 (+X axis)"},
            {"id": "opt_z_plus", "text": "Theta = 0, Phi = 0 (+Z axis)"},
            {"id": "opt_y_minus", "text": "Theta = pi/2, Phi = 3pi/2 (-Y axis)"}
        ],
        "correct_answer": "opt_y_plus",
        "explanation": "State (|0> + i|1>)/sqrt(2) lies on the equator of the Bloch sphere at theta = pi/2 with relative phase phi = pi/2 (+Y axis).",
        "xp_reward": 15,
        "time_limit_seconds": 60
    },

    # ==========================================
    # UNIT 2: QUANTUM CIRCUITS & ALGORITHMIC BUILDING BLOCKS
    # ==========================================

    # 10. circuit-model-quantum-computing
    {
        "type": "mcq",
        "topic_slug": "circuit-model-quantum-computing",
        "concept": "Circuit Depth & Width",
        "difficulty": "easy",
        "tags": ["circuit-model-quantum-computing", "circuit-model"],
        "prompt": "In the circuit model of quantum computing, what does 'circuit depth' represent?",
        "options": [
            {"id": "opt_a", "text": "The longest path of sequential gate operations from input to output"},
            {"id": "opt_b", "text": "The total number of physical qubits (width)"},
            {"id": "opt_c", "text": "The cryostat operating temperature"},
            {"id": "opt_d", "text": "The length of classical copper wires"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Circuit depth measures the number of discrete time steps required to execute the circuit when non-overlapping gates run in parallel.",
        "xp_reward": 10,
        "time_limit_seconds": 45
    },

    # 11. quantum-gates-circuits
    {
        "type": "match",
        "topic_slug": "quantum-gates-circuits",
        "concept": "Core Quantum Gates",
        "difficulty": "medium",
        "tags": ["quantum-gates-circuits", "quantum-gates", "gates"],
        "prompt": "Match each quantum gate to its corresponding operation:",
        "options": [
            {"id": "left_h", "text": "Hadamard (H)"},
            {"id": "left_x", "text": "Pauli-X"},
            {"id": "left_z", "text": "Pauli-Z"},
            {"id": "left_cx", "text": "CNOT"}
        ],
        "correct_answer": {
            "Hadamard (H)": "Creates equal superposition",
            "Pauli-X": "Bit-flip (NOT gate)",
            "Pauli-Z": "Phase-flip (|1> -> -|1>)",
            "CNOT": "Flips target qubit if control is |1>"
        },
        "explanation": "H maps Z basis to X basis, X flips bits, Z flips phase, and CNOT executes controlled bit flips.",
        "xp_reward": 15,
        "time_limit_seconds": 90
    },

    # 12. qiskit-programming
    {
        "type": "fill_blank",
        "topic_slug": "qiskit-programming",
        "concept": "Qiskit Circuit Creation",
        "difficulty": "easy",
        "tags": ["qiskit-programming", "qiskit", "code"],
        "prompt": "What method call on a Qiskit QuantumCircuit instance 'qc' applies a Hadamard gate to qubit index 0? (e.g. qc.h(0))",
        "options": [],
        "correct_answer": ["qc.h(0)", "h(0)"],
        "explanation": "In Qiskit SDK, `qc.h(0)` appends a Hadamard gate targeting qubit index 0.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },

    # 13. entanglement-bell-states
    {
        "type": "arrange_steps",
        "topic_slug": "entanglement-bell-states",
        "concept": "Bell State Preparation",
        "difficulty": "hard",
        "tags": ["entanglement-bell-states", "bell-states", "entanglement"],
        "prompt": "Arrange the steps in order to construct the Bell state Phi+ = (|00> + |11>)/sqrt(2):",
        "options": [
            {"id": "step_1", "text": "Initialize two qubits in ground state |00>"},
            {"id": "step_2", "text": "Apply Hadamard (H) gate to Qubit 0"},
            {"id": "step_3", "text": "Apply CNOT gate with Qubit 0 as control and Qubit 1 as target"},
            {"id": "step_4", "text": "Output state is maximally entangled Bell state Phi+"}
        ],
        "correct_answer": ["step_1", "step_2", "step_3", "step_4"],
        "explanation": "|00> -> H(q0) gives (|0>+|1>)/sqrt(2)|0> -> CNOT(q0, q1) gives (|00>+|11>)/sqrt(2).",
        "xp_reward": 20,
        "time_limit_seconds": 90
    },

    # 14. quantum-teleportation
    {
        "type": "mcq",
        "topic_slug": "quantum-teleportation",
        "concept": "Teleportation Classical Communication",
        "difficulty": "medium",
        "tags": ["quantum-teleportation", "teleportation"],
        "prompt": "How many classical bits must Alice transmit to Bob in the Quantum Teleportation protocol to reconstruct an unknown state |psi>?",
        "options": [
            {"id": "opt_2", "text": "2 Classical Bits"},
            {"id": "opt_1", "text": "1 Classical Bit"},
            {"id": "opt_0", "text": "0 Bits (Instantaneous without communication)"},
            {"id": "opt_inf", "text": "Infinite Bits"}
        ],
        "correct_answer": "opt_2",
        "explanation": "Alice measures her two qubits in the Bell basis, yielding 2 classical bits. Bob uses these 2 bits to select Pauli X and/or Z corrections.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 15. superdense-coding
    {
        "type": "mcq",
        "topic_slug": "superdense-coding",
        "concept": "Information Capacity",
        "difficulty": "medium",
        "tags": ["superdense-coding"],
        "prompt": "In Superdense Coding, how many classical bits of information can be transmitted by sending 1 qubit through an entangled channel?",
        "options": [
            {"id": "opt_a", "text": "2 Classical Bits"},
            {"id": "opt_b", "text": "1 Classical Bit"},
            {"id": "opt_c", "text": "4 Classical Bits"},
            {"id": "opt_d", "text": "0.5 Classical Bits"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Superdense coding uses 1 pre-shared Bell pair so sending 1 single qubit transmits 2 classical bits of information.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # ==========================================
    # UNIT 3: QUANTUM ALGORITHMS & ORACLES
    # ==========================================

    # 16. phase-kickback-parallelism
    {
        "type": "mcq",
        "topic_slug": "phase-kickback-parallelism",
        "concept": "Phase Kickback Mechanism",
        "difficulty": "medium",
        "tags": ["phase-kickback-parallelism", "phase-kickback"],
        "prompt": "What condition causes the eigenvalue phase of an oracle target qubit |y> to 'kick back' onto the control register in quantum algorithms?",
        "options": [
            {"id": "opt_a", "text": "Target qubit is prepared in an eigenstate of the oracle operator (e.g. |- >)"},
            {"id": "opt_b", "text": "Control qubit is measured before applying gate"},
            {"id": "opt_c", "text": "All qubits are in ground state |0>"},
            {"id": "opt_d", "text": "Target qubit is disconnected"}
        ],
        "correct_answer": "opt_a",
        "explanation": "When U|y> = e^(i*phi)|y>, applying controlled-U transfers the phase factor e^(i*phi) directly onto the control qubit state.",
        "xp_reward": 15,
        "time_limit_seconds": 50
    },

    # 17. no-cloning-theorem
    {
        "type": "mcq",
        "topic_slug": "no-cloning-theorem",
        "concept": "No-Cloning Proof",
        "difficulty": "medium",
        "tags": ["no-cloning-theorem", "no-cloning"],
        "prompt": "Why is it mathematically impossible to create a unitary quantum operator U that copies an arbitrary unknown qubit state |psi> onto a target state |0>?",
        "options": [
            {"id": "opt_a", "text": "Unitary evolution is linear: U(|a>+|b>)|0> != U|a>|0> + U|b>|0> if copying"},
            {"id": "opt_b", "text": "Qubits are too small to copy"},
            {"id": "opt_c", "text": "Energy conservation forbids copying"},
            {"id": "opt_d", "text": "Classical memories are faster"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The linearity of unitary operators forbids U(|psi>|0>) = |psi>|psi> for non-orthogonal arbitrary states |psi>.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 18. deutsch-jozsa-algorithm
    {
        "type": "mcq",
        "topic_slug": "deutsch-jozsa-algorithm",
        "concept": "Quantum Speedup",
        "difficulty": "medium",
        "tags": ["deutsch-jozsa-algorithm", "deutsch-jozsa", "algorithms"],
        "prompt": "How many oracle queries does the Deutsch-Jozsa algorithm require to determine if an n-bit Boolean function is constant or balanced?",
        "options": [
            {"id": "opt_1", "text": "Exactly 1 query"},
            {"id": "opt_n", "text": "n queries"},
            {"id": "opt_exp", "text": "2^(n-1) + 1 queries"},
            {"id": "opt_sqrt", "text": "sqrt(2^n) queries"}
        ],
        "correct_answer": "opt_1",
        "explanation": "Deutsch-Jozsa uses quantum parallelism and constructive interference to solve the problem in a single query.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 19. bernstein-vazirani-algorithm
    {
        "type": "mcq",
        "topic_slug": "bernstein-vazirani-algorithm",
        "concept": "Secret Bitstring Recovery",
        "difficulty": "medium",
        "tags": ["bernstein-vazirani-algorithm", "algorithms"],
        "prompt": "For an oracle f(x) = s * x (mod 2) with a hidden n-bit string 's', how many queries does Bernstein-Vazirani need to retrieve 's'?",
        "options": [
            {"id": "opt_1", "text": "1 Query"},
            {"id": "opt_n", "text": "n Queries"},
            {"id": "opt_2n", "text": "2^n Queries"},
            {"id": "opt_sq", "text": "sqrt(n) Queries"}
        ],
        "correct_answer": "opt_1",
        "explanation": "Bernstein-Vazirani determines all n bits of hidden string 's' in 1 query, whereas classical algorithms require n queries.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 20. grovers-search-algorithm
    {
        "type": "mcq",
        "topic_slug": "grovers-search-algorithm",
        "concept": "Grover Complexity",
        "difficulty": "medium",
        "tags": ["grovers-search-algorithm", "grovers-algorithm", "grover"],
        "prompt": "What is the query complexity of Grover's search algorithm for finding a target item in an unsorted database of N items?",
        "options": [
            {"id": "opt_sqrt", "text": "O(sqrt(N))"},
            {"id": "opt_n", "text": "O(N)"},
            {"id": "opt_log", "text": "O(log N)"},
            {"id": "opt_n2", "text": "O(N^2)"}
        ],
        "correct_answer": "opt_sqrt",
        "explanation": "Grover's algorithm achieves a quadratic speedup of O(sqrt(N)) queries compared to classical O(N) linear search.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # ==========================================
    # UNIT 4: QUANTUM FOURIER TRANSFORM & FAULT TOLERANCE
    # ==========================================

    # 21. quantum-fourier-transform
    {
        "type": "mcq",
        "topic_slug": "quantum-fourier-transform",
        "concept": "QFT Complexity",
        "difficulty": "hard",
        "tags": ["quantum-fourier-transform", "qft"],
        "prompt": "What is the gate complexity to implement QFT on n qubits?",
        "options": [
            {"id": "opt_n2", "text": "O(n^2) Gates"},
            {"id": "opt_2n", "text": "O(2^n) Gates"},
            {"id": "opt_n", "text": "O(n) Gates"},
            {"id": "opt_nlog", "text": "O(n log n) Gates"}
        ],
        "correct_answer": "opt_n2",
        "explanation": "Quantum Fourier Transform runs in O(n^2) gates on a quantum computer, exponentially faster than classical Fast Fourier Transform O(n * 2^n).",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 22. quantum-phase-estimation
    {
        "type": "mcq",
        "topic_slug": "quantum-phase-estimation",
        "concept": "QPE Architecture",
        "difficulty": "hard",
        "tags": ["quantum-phase-estimation", "qpe"],
        "prompt": "In Quantum Phase Estimation (QPE) for a unitary U with eigenvector |u> and eigenvalue e^(2pi*i*theta), what operation is applied to the counting register right before final measurement?",
        "options": [
            {"id": "opt_iqft", "text": "Inverse Quantum Fourier Transform (QFT^dagger)"},
            {"id": "opt_qft", "text": "Standard QFT"},
            {"id": "opt_grover", "text": "Grover Diffusion"},
            {"id": "opt_cnot", "text": "CNOT Ladder"}
        ],
        "correct_answer": "opt_iqft",
        "explanation": "Inverse QFT converts the phase information stored in the superposition of the counting register into binary computational basis state |2^t * theta>.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 23. shors-factoring-algorithm
    {
        "type": "multi_correct",
        "topic_slug": "shors-factoring-algorithm",
        "concept": "Cryptographic Vulnerabilities",
        "difficulty": "hard",
        "tags": ["shors-factoring-algorithm", "shors-algorithm", "shor"],
        "prompt": "Which public-key ciphers are vulnerable to polynomial-time cracking by Shor's Algorithm? (Select all)",
        "options": [
            {"id": "opt_rsa", "text": "RSA (RSA-2048)"},
            {"id": "opt_ecc", "text": "Elliptic Curve Digital Signature (ECDSA)"},
            {"id": "opt_dh", "text": "Diffie-Hellman Key Exchange"},
            {"id": "opt_kyber", "text": "CRYSTALS-Kyber (Lattice-Based PQC)"}
        ],
        "correct_answer": ["opt_rsa", "opt_ecc", "opt_dh"],
        "explanation": "Shor's algorithm efficiently solves prime factorization and discrete logarithms in polynomial time, breaking RSA, ECC, and DH. Kyber is post-quantum secure.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 24. quantum-error-correction-gottesman-knill
    {
        "type": "mcq",
        "topic_slug": "quantum-error-correction-gottesman-knill",
        "concept": "Gottesman-Knill Theorem",
        "difficulty": "hard",
        "tags": ["quantum-error-correction-gottesman-knill", "error-correction"],
        "prompt": "According to the Gottesman-Knill theorem, which quantum circuits can be efficiently simulated classically in polynomial time?",
        "options": [
            {"id": "opt_a", "text": "Circuits composed strictly of Clifford group gates (H, S, CNOT) initialized in computational basis"},
            {"id": "opt_b", "text": "Circuits containing T gates (pi/8 gates)"},
            {"id": "opt_c", "text": "All quantum circuits without exception"},
            {"id": "opt_d", "text": "Circuits with depth greater than 1000"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Clifford gates preserve stabilizer states and can be efficiently simulated classically in O(n^2) polynomial time.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 25. surface-codes-fault-tolerance
    {
        "type": "mcq",
        "topic_slug": "surface-codes-fault-tolerance",
        "concept": "2D Surface Codes",
        "difficulty": "hard",
        "tags": ["surface-codes-fault-tolerance", "surface-codes"],
        "prompt": "Why are 2D Surface Codes widely considered the leading candidate for physical fault-tolerant quantum computing?",
        "options": [
            {"id": "opt_a", "text": "High fault-tolerance error threshold (~1%) and strictly 2D nearest-neighbor qubit connectivity"},
            {"id": "opt_b", "text": "They do not require any ancilla qubits"},
            {"id": "opt_c", "text": "They eliminate physical decoherence completely"},
            {"id": "opt_d", "text": "They run without quantum error syndrome measurements"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Surface codes achieve a high fault-tolerance threshold of ~1% and only require 2D grid nearest-neighbor coupling available in superconducting architectures.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # ==========================================
    # UNIT 5: QUANTUM MACHINE LEARNING & ADVANCED TOPICS
    # ==========================================

    # 26. quantum-machine-learning-overview
    {
        "type": "mcq",
        "topic_slug": "quantum-machine-learning-overview",
        "concept": "Barren Plateaus in QML",
        "difficulty": "hard",
        "tags": ["quantum-machine-learning-overview", "qml"],
        "prompt": "What is a 'Barren Plateau' in the context of training Parameterized Quantum Circuits (PQCs) in QML?",
        "options": [
            {"id": "opt_a", "text": "Exponential vanishing of cost function gradients as the number of qubits increases"},
            {"id": "opt_b", "text": "Overheating of the quantum hardware processor"},
            {"id": "opt_c", "text": "Running out of classical memory"},
            {"id": "opt_d", "text": "Exact convergence to the global minimum in 1 step"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Barren plateaus cause cost function gradients to vanish exponentially in Hilbert space size O(2^n), making gradient-based optimization intractable for deep random ansatzes.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 27. quantum-data-encoding
    {
        "type": "mcq",
        "topic_slug": "quantum-data-encoding",
        "concept": "Amplitude Encoding vs Basis Encoding",
        "difficulty": "medium",
        "tags": ["quantum-data-encoding", "data-encoding"],
        "prompt": "How many classical continuous numbers can Amplitude Encoding store in a normalized n-qubit quantum state vector?",
        "options": [
            {"id": "opt_2n", "text": "2^n numbers (Exponential capacity)"},
            {"id": "opt_n", "text": "n numbers"},
            {"id": "opt_2", "text": "2 numbers"},
            {"id": "opt_n2", "text": "n^2 numbers"}
        ],
        "correct_answer": "opt_2n",
        "explanation": "Amplitude encoding maps an N-dimensional normalized classical vector (N = 2^n) onto the 2^n amplitudes of an n-qubit state.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 28. hamiltonian-encoding
    {
        "type": "mcq",
        "topic_slug": "hamiltonian-encoding",
        "concept": "Trotterization",
        "difficulty": "hard",
        "tags": ["hamiltonian-encoding"],
        "prompt": "Why is Suzuki-Trotter decomposition used when simulating non-commuting Hamiltonian terms e^(-i * (A + B) * t)?",
        "options": [
            {"id": "opt_a", "text": "Because e^(A+B) != e^A * e^B for non-commuting operators [A, B] != 0"},
            {"id": "opt_b", "text": "To convert quantum gates to classical AND gates"},
            {"id": "opt_c", "text": "To increase cryostat efficiency"},
            {"id": "opt_d", "text": "To make all Hamiltonians non-Hermitian"}
        ],
        "correct_answer": "opt_a",
        "explanation": "By the Baker-Campbell-Hausdorff formula, non-commuting operators require Trotter discretization e^(-i(A+B)t) approx (e^(-iAt/n) e^(-iBt/n))^n.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # 29. swap-test
    {
        "type": "mcq",
        "topic_slug": "swap-test",
        "concept": "State Fidelity Measurement",
        "difficulty": "medium",
        "tags": ["swap-test", "fidelity"],
        "prompt": "In the SWAP Test protocol, what measurement probability of the ancilla qubit in state |0> indicates two state vectors |psi> and |phi> are identical?",
        "options": [
            {"id": "opt_100", "text": "P(|0>) = 1.0 (100% probability for identical states)"},
            {"id": "opt_50", "text": "P(|0>) = 0.5"},
            {"id": "opt_0", "text": "P(|0>) = 0.0"},
            {"id": "opt_75", "text": "P(|0>) = 0.75"}
        ],
        "correct_answer": "opt_100",
        "explanation": "P(|0>) = 1/2 + 1/2*|<psi|phi>|^2. If states are identical (|<psi|phi>|=1), P(|0>) = 1/2 + 1/2 = 1.0.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 30. q-means-clustering
    {
        "type": "mcq",
        "topic_slug": "q-means-clustering",
        "concept": "Quantum Distance Estimation",
        "difficulty": "hard",
        "tags": ["q-means-clustering", "qml"],
        "prompt": "What quantum subroutine enables Q-means clustering to calculate distances between data vectors and cluster centroids with polynomial speedup?",
        "options": [
            {"id": "opt_a", "text": "SWAP Test & Quantum Matrix Multiplication / Phase Estimation"},
            {"id": "opt_b", "text": "Classical brute force sorting"},
            {"id": "opt_c", "text": "Classical gradient descent"},
            {"id": "opt_d", "text": "Classical Monte Carlo sampling"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Q-means estimates vector overlaps using quantum subroutines (SWAP test and amplitude estimation) in time O(poly(k, log N)).",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },

    # ==========================================
    # QUANTUM COMMUNICATION ROADMAP QUIZZES
    # ==========================================

    # 1. qcomm-foundations-recap
    {
        "type": "mcq",
        "topic_slug": "qcomm-foundations-recap",
        "concept": "Superposition",
        "difficulty": "easy",
        "tags": ["qcomm-foundations-recap", "superposition"],
        "prompt": "Which of the following best describes superposition?",
        "options": [
            {"id": "opt_a", "text": "(a) The qubit is secretly 0 or 1, we just don't know which"},
            {"id": "opt_b", "text": "(b) The qubit is in a genuine combination of 0 and 1 until measured"},
            {"id": "opt_c", "text": "(c) The qubit is both 0 and 1 permanently, even after measurement"},
            {"id": "opt_d", "text": "(d) Superposition only applies to entangled qubits"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Superposition represents a genuine linear combination of states alpha|0> + beta|1> prior to measurement collapse.",
        "xp_reward": 10,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-foundations-recap",
        "concept": "No-Signaling Theorem",
        "difficulty": "medium",
        "tags": ["qcomm-foundations-recap", "no-signaling"],
        "prompt": "Why can't entanglement be used to send information instantaneously between two distant parties?",
        "options": [
            {"id": "opt_a", "text": "Measuring an entangled qubit gives a random outcome; correlation only becomes apparent once results are compared over a classical channel limited by the speed of light"},
            {"id": "opt_b", "text": "Entanglement breaks down if qubits are separated by more than 1 meter"},
            {"id": "opt_c", "text": "Entangled qubits can only transmit video files, not bits"},
            {"id": "opt_d", "text": "Measuring an entangled qubit instantly collapses the entire universe"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Measuring an entangled qubit gives a random outcome; the correlation only becomes apparent once the two parties compare results over a classical channel, which is limited by the speed of light. No usable information is transmitted by the act of measurement alone (the no-signaling theorem).",
        "xp_reward": 15,
        "time_limit_seconds": 60
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-foundations-recap",
        "concept": "Bell States",
        "difficulty": "easy",
        "tags": ["qcomm-foundations-recap", "bell-states"],
        "prompt": "The Bell state (|00⟩ + |11⟩)/√2 is called:",
        "options": [
            {"id": "opt_a", "text": "|Ψ⁺⟩  (|Psi+⟩ — Psi Plus)"},
            {"id": "opt_b", "text": "|Φ⁺⟩  (|Phi+⟩ — Phi Plus)"},
            {"id": "opt_c", "text": "|Φ⁻⟩  (|Phi-⟩ — Phi Minus)"},
            {"id": "opt_d", "text": "|Ψ⁻⟩  (|Psi-⟩ — Psi Minus)"}
        ],
        "correct_answer": "opt_b",
        "explanation": "|Φ⁺⟩ = (|00⟩ + |11⟩)/√2 is the canonical symmetric Bell state (Phi Plus).",
        "xp_reward": 10,
        "time_limit_seconds": 180
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-foundations-recap",
        "concept": "Non-Separable States",
        "difficulty": "medium",
        "tags": ["qcomm-foundations-recap", "entanglement"],
        "prompt": "What does it mean for a two-qubit state to be 'non-separable'?",
        "options": [
            {"id": "opt_a", "text": "It cannot be written as a tensor product of two single-qubit states |a> tensor |b> — the qubits' properties are only defined jointly"},
            {"id": "opt_b", "text": "The two qubits are physically glued together and cannot be separated"},
            {"id": "opt_c", "text": "The state can easily be factored into two independent single-qubit states"},
            {"id": "opt_d", "text": "It means the state has zero energy"}
        ],
        "correct_answer": "opt_a",
        "explanation": "It cannot be written as a tensor product of two single-qubit states |a> tensor |b> — the qubits' properties are only defined jointly, not individually.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-foundations-recap",
        "concept": "Born Rule Probability",
        "difficulty": "easy",
        "tags": ["qcomm-foundations-recap", "born-rule"],
        "prompt": "If |psi> = (sqrt(3)/2)|0> + (1/2)|1>, what is the probability of measuring |1>?",
        "options": [
            {"id": "opt_a", "text": "25% (1/4)"},
            {"id": "opt_b", "text": "75% (3/4)"},
            {"id": "opt_c", "text": "50% (1/2)"},
            {"id": "opt_d", "text": "100% (1)"}
        ],
        "correct_answer": "opt_a",
        "explanation": "|1/2|^2 = 1/4 = 25%.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },

    # 2. qcomm-no-cloning-theorem
    {
        "type": "mcq",
        "topic_slug": "qcomm-no-cloning-theorem",
        "concept": "No-Cloning Theorem",
        "difficulty": "medium",
        "tags": ["qcomm-no-cloning-theorem", "no-cloning"],
        "prompt": "The No-Cloning Theorem follows most directly from which fundamental property of quantum operations?",
        "options": [
            {"id": "opt_a", "text": "Unitarity"},
            {"id": "opt_b", "text": "Linearity of quantum operators"},
            {"id": "opt_c", "text": "Hermiticity"},
            {"id": "opt_d", "text": "Normalization"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Linearity forbids a unitary copier from acting on superpositions without creating cross-terms that contradict the target tensor product.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-no-cloning-theorem",
        "concept": "Known State Copying",
        "difficulty": "medium",
        "tags": ["qcomm-no-cloning-theorem", "known-state"],
        "prompt": "Does the No-Cloning Theorem forbid creating a new qubit in the SAME KNOWN state as an existing one (e.g. preparing two qubits both in |0>)?",
        "options": [
            {"id": "opt_a", "text": "Yes, no qubit can ever be created in the same state"},
            {"id": "opt_b", "text": "No — no-cloning only forbids copying an arbitrary UNKNOWN state. If you know the state, you can prepare as many as you like from scratch"},
            {"id": "opt_c", "text": "Yes, unless the qubit is entangled with an ancilla"},
            {"id": "opt_d", "text": "Only in superconducting hardware"}
        ],
        "correct_answer": "opt_b",
        "explanation": "No-cloning forbids universal copiers for unknown states. Known states can be prepared repeatedly.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-no-cloning-theorem",
        "concept": "Cryptographic Consequences",
        "difficulty": "easy",
        "tags": ["qcomm-no-cloning-theorem", "security"],
        "prompt": "Which of the following is a direct cryptographic consequence of the No-Cloning Theorem?",
        "options": [
            {"id": "opt_a", "text": "Quantum computers cannot be networked over fiber"},
            {"id": "opt_b", "text": "An eavesdropper cannot silently copy a qubit to inspect it later without disturbing it"},
            {"id": "opt_c", "text": "Entangled states decay instantly"},
            {"id": "opt_d", "text": "Classical bits cannot be transmitted over quantum channels"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Because Eve cannot clone an unknown qubit, any interception attempt inevitably disturbs the state, revealing her presence.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },

    # 3. qcomm-teleportation-protocol
    {
        "type": "mcq",
        "topic_slug": "qcomm-teleportation-protocol",
        "concept": "Classical Communication",
        "difficulty": "easy",
        "tags": ["qcomm-teleportation-protocol", "teleportation"],
        "prompt": "How many classical bits must Alice send to Bob to complete the Quantum Teleportation protocol?",
        "options": [
            {"id": "opt_a", "text": "0 classical bits"},
            {"id": "opt_b", "text": "1 classical bit"},
            {"id": "opt_c", "text": "2 classical bits"},
            {"id": "opt_d", "text": "4 classical bits"}
        ],
        "correct_answer": "opt_c",
        "explanation": "Alice's Bell-basis measurement produces 1 of 4 outcomes, requiring 2 classical bits so Bob knows which correction operator to apply.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-teleportation-protocol",
        "concept": "No-Cloning Compliance",
        "difficulty": "medium",
        "tags": ["qcomm-teleportation-protocol", "no-cloning"],
        "prompt": "Why doesn't quantum teleportation violate the No-Cloning Theorem?",
        "options": [
            {"id": "opt_a", "text": "Alice's original qubit state is destroyed (collapses) during her Bell-basis measurement, so two copies never exist at once"},
            {"id": "opt_b", "text": "Teleportation only works for classical bits"},
            {"id": "opt_c", "text": "Bob gets an imperfect clone with 50% fidelity"},
            {"id": "opt_d", "text": "It does violate no-cloning, making quantum mechanics inconsistent"}
        ],
        "correct_answer": "opt_a",
        "explanation": "The original state is destroyed upon measurement, ensuring exactly 1 copy exists overall.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-teleportation-protocol",
        "concept": "Pre-shared Resource",
        "difficulty": "easy",
        "tags": ["qcomm-teleportation-protocol", "entanglement"],
        "prompt": "What resource must Alice and Bob share BEFORE teleportation can begin?",
        "options": [
            {"id": "opt_a", "text": "A shared classical secret key"},
            {"id": "opt_b", "text": "An entangled Bell pair"},
            {"id": "opt_c", "text": "A quantum computer with 100 qubits"},
            {"id": "opt_d", "text": "A quantum repeater node"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Teleportation consumes one pre-shared entangled Bell pair to transfer the unknown state.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },

    # 4. qcomm-superdense-coding
    {
        "type": "mcq",
        "topic_slug": "qcomm-superdense-coding",
        "concept": "Encoding Operations",
        "difficulty": "medium",
        "tags": ["qcomm-superdense-coding", "encoding"],
        "prompt": "To send the classical bits '11' using Superdense Coding, which gate(s) does Alice apply to her half of the Bell pair?",
        "options": [
            {"id": "opt_a", "text": "I (Identity)"},
            {"id": "opt_b", "text": "X (Pauli-X)"},
            {"id": "opt_c", "text": "Z (Pauli-Z)"},
            {"id": "opt_d", "text": "XZ (or iY)"}
        ],
        "correct_answer": "opt_d",
        "explanation": "Encoding 11 requires applying both X and Z gates (XZ = iY) to transform |Phi+> into |Psi->.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-superdense-coding",
        "concept": "Inverse Relation",
        "difficulty": "medium",
        "tags": ["qcomm-superdense-coding", "comparison"],
        "prompt": "Superdense Coding is best described as the:",
        "options": [
            {"id": "opt_a", "text": "Same protocol as teleportation"},
            {"id": "opt_b", "text": "Classical analog of teleportation"},
            {"id": "opt_c", "text": "Operational inverse of teleportation"},
            {"id": "opt_d", "text": "Method for cloning qubits"}
        ],
        "correct_answer": "opt_c",
        "explanation": "Superdense coding converts 1 transmitted qubit + 1 Bell pair into 2 classical bits; teleportation converts 2 classical bits + 1 Bell pair into 1 transmitted qubit.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 5. qcomm-qkd-bb84-protocol
    {
        "type": "mcq",
        "topic_slug": "qcomm-qkd-bb84-protocol",
        "concept": "Basis Sifting",
        "difficulty": "medium",
        "tags": ["qcomm-qkd-bb84-protocol", "qkd"],
        "prompt": "In the BB84 QKD protocol, roughly what fraction of Alice's transmitted bits survive the sifting step?",
        "options": [
            {"id": "opt_a", "text": "~100%"},
            {"id": "opt_b", "text": "~75%"},
            {"id": "opt_c", "text": "~50%"},
            {"id": "opt_d", "text": "~25%"}
        ],
        "correct_answer": "opt_c",
        "explanation": "Since Alice and Bob choose randomly between 2 bases, their bases match by chance roughly 50% of the time.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-qkd-bb84-protocol",
        "concept": "Public Sifting Information",
        "difficulty": "medium",
        "tags": ["qcomm-qkd-bb84-protocol", "sifting"],
        "prompt": "What exactly do Alice and Bob reveal publicly over the classical channel during BB84 sifting?",
        "options": [
            {"id": "opt_a", "text": "Only which BASIS they used for each qubit — never the actual bit values"},
            {"id": "opt_b", "text": "Both their basis choices and raw bit values"},
            {"id": "opt_c", "text": "Only the first 10 bits of the secret key"},
            {"id": "opt_d", "text": "Their private RSA key pairs"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Revealing basis choices allows matching without disclosing the secret bit outcomes.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 6. qcomm-qkd-e91-protocol
    {
        "type": "mcq",
        "topic_slug": "qcomm-qkd-e91-protocol",
        "concept": "Bell Inequality Security",
        "difficulty": "hard",
        "tags": ["qcomm-qkd-e91-protocol", "bell-test"],
        "prompt": "Ekert's E91 QKD protocol proves cryptographic security primarily through which mechanism?",
        "options": [
            {"id": "opt_a", "text": "RSA public key encryption"},
            {"id": "opt_b", "text": "Violation of a Bell (CHSH) inequality"},
            {"id": "opt_c", "text": "The Born rule alone"},
            {"id": "opt_d", "text": "Classical Hamming codes"}
        ],
        "correct_answer": "opt_b",
        "explanation": "E91 uses non-matching measurement setting results to test for CHSH inequality violation, verifying non-local quantum correlations.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-qkd-e91-protocol",
        "concept": "Monogamy of Entanglement",
        "difficulty": "medium",
        "tags": ["qcomm-qkd-e91-protocol", "monogamy"],
        "prompt": "Which principle explains why an eavesdropper cannot be secretly entangled with a maximally entangled Alice-Bob pair?",
        "options": [
            {"id": "opt_a", "text": "No-Cloning Theorem"},
            {"id": "opt_b", "text": "Monogamy of Entanglement"},
            {"id": "opt_c", "text": "Heisenberg Uncertainty Principle"},
            {"id": "opt_d", "text": "Quantum Phase Kickback"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Monogamy of entanglement dictates that if two qubits are maximally entangled, neither can share any entanglement with a third system.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 7. qcomm-quantum-repeaters
    {
        "type": "mcq",
        "topic_slug": "qcomm-quantum-repeaters",
        "concept": "Entanglement Swapping",
        "difficulty": "hard",
        "tags": ["qcomm-quantum-repeaters", "repeaters"],
        "prompt": "Entanglement Swapping in a Quantum Repeater relies on which core quantum operation at the intermediate node?",
        "options": [
            {"id": "opt_a", "text": "BB84 sifting"},
            {"id": "opt_b", "text": "Bell-basis joint measurement"},
            {"id": "opt_c", "text": "Superdense coding encoding gates"},
            {"id": "opt_d", "text": "Shor's period finding"}
        ],
        "correct_answer": "opt_b",
        "explanation": "The intermediate node performs a Bell-basis measurement on two qubits, entangling the distant outer nodes.",
        "xp_reward": 20,
        "time_limit_seconds": 60
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-quantum-repeaters",
        "concept": "Classical Repeater Limitation",
        "difficulty": "medium",
        "tags": ["qcomm-quantum-repeaters", "classical-vs-quantum"],
        "prompt": "Why can't a classical-style 'measure and re-transmit' repeater be used for quantum signals?",
        "options": [
            {"id": "opt_a", "text": "Measuring a qubit collapses its superposition, destroying quantum info, and no-cloning prevents making a copy to re-transmit"},
            {"id": "opt_b", "text": "Classical repeaters are too expensive to build"},
            {"id": "opt_c", "text": "Fiber optics only allow light to travel in one direction"},
            {"id": "opt_d", "text": "Classical repeaters operate above absolute zero"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Measurement destroys superpositions, and no-cloning prevents copying quantum signals for re-transmission.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 8. qcomm-quantum-networks
    {
        "type": "mcq",
        "topic_slug": "qcomm-quantum-networks",
        "concept": "Network Payload",
        "difficulty": "easy",
        "tags": ["qcomm-quantum-networks", "payload"],
        "prompt": "The primary 'payload' carried across a quantum internet link is:",
        "options": [
            {"id": "opt_a", "text": "Encrypted classical files"},
            {"id": "opt_b", "text": "Quantum states / Entanglement"},
            {"id": "opt_c", "text": "Streaming video"},
            {"id": "opt_d", "text": "Post-quantum cryptographic keys only"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Quantum networks route quantum state vector information and entanglement resources between nodes.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-quantum-networks",
        "concept": "Blind Quantum Computing",
        "difficulty": "medium",
        "tags": ["qcomm-quantum-networks", "quantum-internet"],
        "prompt": "Which application allows a client to execute quantum computations on a remote server without revealing the program or inputs to the server?",
        "options": [
            {"id": "opt_a", "text": "Superdense Coding"},
            {"id": "opt_b", "text": "Blind Quantum Computing"},
            {"id": "opt_c", "text": "BB84 Protocol"},
            {"id": "opt_d", "text": "Entanglement Purification"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Blind Quantum Computing leverages network entanglement so a client can delegate computation confidentially.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 9. qcomm-satellite-qkd-micius
    {
        "type": "mcq",
        "topic_slug": "qcomm-satellite-qkd-micius",
        "concept": "Micius Satellite",
        "difficulty": "easy",
        "tags": ["qcomm-satellite-qkd-micius", "satellite"],
        "prompt": "Micius was launched by which country, and in what year?",
        "options": [
            {"id": "opt_a", "text": "USA, 2016"},
            {"id": "opt_b", "text": "China, 2016"},
            {"id": "opt_c", "text": "China, 2020"},
            {"id": "opt_d", "text": "EU, 2016"}
        ],
        "correct_answer": "opt_b",
        "explanation": "Micius (QUESS) was launched by China in August 2016.",
        "xp_reward": 10,
        "time_limit_seconds": 30
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-satellite-qkd-micius",
        "concept": "Free Space Advantage",
        "difficulty": "medium",
        "tags": ["qcomm-satellite-qkd-micius", "free-space"],
        "prompt": "Why does free-space transmission through near-vacuum outperform optical fiber for very long distances?",
        "options": [
            {"id": "opt_a", "text": "Near-vacuum propagation above the atmosphere avoids exponential fiber glass absorption loss"},
            {"id": "opt_b", "text": "Photons travel faster than light in space"},
            {"id": "opt_c", "text": "Satellites do not experience gravity"},
            {"id": "opt_d", "text": "Space lasers produce infinite energy"}
        ],
        "correct_answer": "opt_a",
        "explanation": "Space vacuum exhibits negligible attenuation compared to optical fiber glass loss (~0.2 dB/km).",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },

    # 10. qcomm-quantum-safe-pqc-vs-qkd
    {
        "type": "mcq",
        "topic_slug": "qcomm-quantum-safe-pqc-vs-qkd",
        "concept": "QKD vs PQC",
        "difficulty": "medium",
        "tags": ["qcomm-quantum-safe-pqc-vs-qkd", "pqc"],
        "prompt": "How does Quantum Key Distribution (QKD) differ fundamentally from Post-Quantum Cryptography (PQC)?",
        "options": [
            {"id": "opt_a", "text": "QKD relies on laws of quantum physics, whereas PQC relies on mathematical computational hardness"},
            {"id": "opt_b", "text": "PQC requires quantum hardware, while QKD runs on standard laptops"},
            {"id": "opt_c", "text": "QKD has been broken by Shor's algorithm"},
            {"id": "opt_d", "text": "PQC cannot be used over classical networks"}
        ],
        "correct_answer": "opt_a",
        "explanation": "QKD offers physics-proven security based on quantum laws; PQC uses classical mathematical hardness assumptions (e.g. lattice problems).",
        "xp_reward": 15,
        "time_limit_seconds": 45
    },
    {
        "type": "mcq",
        "topic_slug": "qcomm-quantum-safe-pqc-vs-qkd",
        "concept": "PQC Algorithms",
        "difficulty": "medium",
        "tags": ["qcomm-quantum-safe-pqc-vs-qkd", "lattices"],
        "prompt": "Which mathematical structure forms the basis for NIST-standardized Post-Quantum Cryptography algorithms like CRYSTALS-Kyber?",
        "options": [
            {"id": "opt_a", "text": "Lattice-based problems (e.g., Learning With Errors)"},
            {"id": "opt_b", "text": "Simple RSA prime factoring"},
            {"id": "opt_c", "text": "Discrete logarithm over small finite fields"},
            {"id": "opt_d", "text": "Classical Caesar ciphers"}
        ],
        "correct_answer": "opt_a",
        "explanation": "CRYSTALS-Kyber and Dilithium rely on the hardness of high-dimensional lattice math problems.",
        "xp_reward": 15,
        "time_limit_seconds": 45
    }
]

# Questions for the 53 roadmap topics the list above never covered (every quantum-ML topic
# plus the maths and physics foundations) -- without them those sprint and practice quizzes
# had nothing to draw from. See services/quiz_seed_gaps.py.
from services.quiz_seed_gaps import GAP_QUESTIONS  # noqa: E402

SEED_QUESTIONS = SEED_QUESTIONS + GAP_QUESTIONS


async def seed_quiz_questions(db: AsyncIOMotorDatabase):
    """
    Seeds questions into the 'quiz_questions' collection.
    Clears old legacy questions to guarantee zero cross-topic out-of-portion fallbacks.
    """
    print("Seeding catalog of strictly portion-aligned quiz questions across all 30 Quantum Roadmap topics...")
    await db.quiz_questions.delete_many({})
    now = datetime.utcnow()
    count = 0
    for q in SEED_QUESTIONS:
        q_doc = dict(q)
        q_doc["created_at"] = now
        await db.quiz_questions.update_one(
            {"prompt": q["prompt"], "topic_slug": q["topic_slug"]},
            {"$set": q_doc},
            upsert=True
        )
        count += 1
    print(f"Successfully seeded {count} strictly portion-aligned quiz questions covering all 30 roadmap topics.")
