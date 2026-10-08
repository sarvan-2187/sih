import jsPDF from 'jspdf';

export interface SlideContent {
  slideNumber: number;
  title: string;
  subtitle?: string;
  bullets?: string[];
  boxes?: { title: string; text: string }[];
  highlightBox?: string;
  stats?: { value: string; label: string; sub: string }[];
}

export interface TopicSlideDeckContent {
  topicTitle: string;
  unit: string;
  slides: SlideContent[];
}

export const TOPIC_1_SLIDES_DECK: TopicSlideDeckContent = {
  topicTitle: 'Quantum Computation: History & Overview',
  unit: 'Unit 1: Quantum Foundations',
  slides: [
    {
      slideNumber: 1,
      title: 'Quantum Computation:\nHistory & Overview',
      subtitle: 'A journey through one of the most transformative ideas in modern science — from Planck\'s quantum theory to Google\'s quantum supremacy.',
      bullets: [
        'Domain Scope: Computer Science • Quantum Mechanics • Technology',
        'Paradigm: Transitioning from classical binary logic to complex state vector spaces',
        'Goal: Understanding the fundamental principles, historical milestones, and future applications'
      ]
    },
    {
      slideNumber: 2,
      title: 'What Is Quantum Computation?',
      subtitle: 'A computing paradigm grounded in the principles of quantum mechanics.',
      bullets: [
        'Qubit Foundation: Instead of classical bits (0 or 1), quantum systems use qubits.',
        'Superposition: Qubits exist in linear combinations α|0⟩ + β|1⟩ with |α|² + |β|² = 1.',
        'Parallel Exploration: Quantum computers evaluate vast solution spaces simultaneously for exponential speedups.'
      ],
      boxes: [
        { title: 'Cryptography', text: 'Shor\'s factoring algorithm & Quantum Key Distribution (BB84)' },
        { title: 'Drug Discovery', text: 'Simulating complex molecular & chemical interactions at scale' },
        { title: 'Optimization', text: 'Solving combinatorial logistics and financial portfolio optimization' },
        { title: 'AI & ML', text: 'Accelerating tensor evaluations and quantum neural networks' },
        { title: 'Material Science', text: 'Designing room-temperature superconductors & novel batteries' }
      ]
    },
    {
      slideNumber: 3,
      title: 'Milestones in Quantum Computing',
      subtitle: 'From theory to reality — over a century of breakthroughs.',
      boxes: [
        { title: '1900 • Max Planck', text: 'Introduces Quantum Theory & energy quantization (E = hν).' },
        { title: '1920s • Formalization', text: 'Heisenberg, Schrödinger & Dirac formalize quantum mechanics & bra-ket algebra.' },
        { title: '1981 • Richard Feynman', text: 'Proposes quantum computers to simulate physical quantum systems.' },
        { title: '1985 • David Deutsch', text: 'Defines the Universal Quantum Computer & quantum circuit model.' },
        { title: '1994 • Peter Shor', text: 'Formulates Shor\'s Algorithm for factoring integers in polynomial time.' },
        { title: '1996 • Lov Grover', text: 'Publishes Grover\'s Search Algorithm offering quadratic database speedup.' },
        { title: '2019 • Quantum Supremacy', text: 'Google\'s 53-qubit Sycamore processor solves a target problem in 200 seconds.' },
        { title: 'Today • Hardware Era', text: 'IBM, Google, Microsoft & IonQ advance fault-tolerant quantum roadmaps.' }
      ]
    },
    {
      slideNumber: 4,
      title: 'Classical vs. Quantum Computing',
      subtitle: 'The Fundamental Difference',
      bullets: [
        'Information Unit: Bits (strictly 0 or 1) vs Qubits (0, 1, or superposition α|0⟩ + β|1⟩).',
        'Execution Model: Sequential processing vs Parallel quantum superposition states.',
        'Efficiency: Classical computers scale exponentially in effort; quantum offers polynomial or exponential speedups.',
        'Stability: Classical hardware is mature & noise-resistant; qubits require decoherence isolation.'
      ],
      highlightBox: 'A quantum computer with just 300 qubits could represent more states simultaneously than there are atoms in the observable universe (2³⁰⁰ ≈ 10⁹⁰).'
    },
    {
      slideNumber: 5,
      title: 'The Four Pillars of Quantum Computing',
      subtitle: 'Core physical principles powering quantum information processing.',
      boxes: [
        { title: '1. Qubits', text: 'The fundamental unit of quantum information — the quantum analog of the classical bit.' },
        { title: '2. Superposition', text: 'A qubit exists in multiple states simultaneously until measured, enabling parallel computation.' },
        { title: '3. Entanglement', text: 'Two qubits become intrinsically linked — measuring one instantly determines the other, regardless of distance.' },
        { title: '4. Interference', text: 'Quantum states amplify correct answers and cancel incorrect ones, steering computation toward the right solution.' }
      ]
    },
    {
      slideNumber: 6,
      title: 'Inside a Quantum Computer',
      subtitle: 'A complex stack of specialized hardware components working in concert.',
      boxes: [
        { title: '1. Quantum Processor (QPU)', text: 'Houses physical qubits (superconducting loops or ion traps) and performs gate operations.' },
        { title: '2. Quantum Gates', text: 'Manipulate qubit state vectors, acting as physical analogs to classical logic gates.' },
        { title: '3. Cryogenic Cooling', text: 'Dilution refrigerators maintain near absolute-zero temperatures (~15 mK) for stability.' },
        { title: '4. Control Electronics', text: 'Translates classical software instructions into microwave/laser pulses.' }
      ]
    },
    {
      slideNumber: 7,
      title: 'Why Quantum Computing Is a Game-Changer',
      subtitle: 'Unlocking computational dimensions previously considered intractable.',
      stats: [
        { value: '2ⁿ', label: 'Parallel States', sub: 'n qubits represent 2ⁿ states simultaneously' },
        { value: '~15mK', label: 'Operating Temp', sub: 'Colder than outer space for qubit stability' },
        { value: '2019', label: 'Supremacy Year', sub: 'Google Sycamore solved task in 200 seconds' },
        { value: '1000+', label: 'Qubit Roadmap', sub: 'IBM target for fault-tolerant systems' }
      ],
      highlightBox: 'Quantum computers offer exponential speedups for optimization, molecular simulation, and database search — with transformative potential for AI and scientific discovery.'
    },
    {
      slideNumber: 8,
      title: 'The Hard Problems We Must Solve',
      subtitle: 'Profound engineering hurdles before quantum scaling can be realized reliably.',
      boxes: [
        { title: 'Decoherence', text: 'Qubits lose their fragile quantum state through environmental thermal noise and radiation.' },
        { title: 'Error Rates', text: 'Current physical qubits have high gate error rates, requiring fault-tolerant surface codes.' },
        { title: 'Hardware Cost', text: 'Cryogenic dilution refrigerators and sub-nanosecond pulse control systems are costly.' },
        { title: 'Scalability', text: 'Interconnecting thousands of high-fidelity physical qubits remains an active challenge.' }
      ]
    },
    {
      slideNumber: 9,
      title: 'Real-World Applications',
      subtitle: 'Poised to disrupt industries where classical computers hit physical limits.',
      boxes: [
        { title: 'Drug Discovery', text: 'Simulate molecular interactions at quantum precision, accelerating pharmaceutical development.' },
        { title: 'Financial Modeling', text: 'Optimize portfolios, detect fraud, and model market risk with unprecedented speed.' },
        { title: 'Cybersecurity', text: 'Break RSA encryption via Shor\'s algorithm and deploy quantum-safe post-quantum cryptography.' },
        { title: 'Logistics & Optimization', text: 'Solve complex global supply chain routing and scheduling problems intractable classically.' }
      ]
    },
    {
      slideNumber: 10,
      title: 'The Road Ahead',
      subtitle: 'Quantum computing is still in its infancy — but the roadmap is ambitious.',
      boxes: [
        { title: 'Fault-Tolerant Systems', text: 'Error-corrected logical qubits enabling reliable, large-scale long-depth circuits.' },
        { title: 'Quantum Internet', text: 'Entanglement-based networks for ultra-secure unhackable global quantum communication.' },
        { title: 'Quantum Cloud', text: 'Commercial cloud access to QPUs via IBM Quantum, AWS Braket, and Azure Quantum.' },
        { title: 'Advanced Algorithms', text: 'New hybrid quantum-classical algorithms unlocking unimagined applications.' }
      ],
      highlightBox: 'Key Takeaway: Quantum computing harnesses superposition, entanglement, and interference to solve problems beyond classical reach — but significant engineering challenges remain before widespread adoption.'
    }
  ]
};

export const TOPIC_2_SLIDES_DECK: TopicSlideDeckContent = {
  topicTitle: 'Review of Linear Algebra',
  unit: 'Unit 1: Quantum Foundations',
  slides: [
    {
      slideNumber: 1,
      title: 'Review of Linear Algebra',
      subtitle: 'A concise journey through vectors, matrices, and the mathematical structures that power modern computing, AI, and engineering.',
      bullets: [
        'Domain Scope: Mathematics • Computer Science • Engineering • Quantum Computing',
        'Core Focus: Vectors, matrices, linear transformations, and systems of linear equations',
        'Goal: Establishing the linear algebra foundation required for quantum mechanics and state vector manipulations'
      ]
    },
    {
      slideNumber: 2,
      title: 'What is Linear Algebra?',
      subtitle: 'The mathematical branch studying vectors, matrices, and linear equations — the language of high-dimensional structure.',
      boxes: [
        { title: 'Computer Science', text: 'Algorithms, computer graphics, and complex data structures' },
        { title: 'Artificial Intelligence', text: 'Neural networks, tensor operations, and model optimization' },
        { title: 'Data Science', text: 'Dimensionality reduction, PCA, and high-dimensional statistics' },
        { title: 'Quantum Computing', text: 'State vectors, Hilbert spaces, and unitary operators' }
      ]
    },
    {
      slideNumber: 3,
      title: 'Scalars & Vectors',
      subtitle: 'Fundamental quantities of vector space mathematics.',
      bullets: [
        'Scalar: A quantity with magnitude only — a single real number (e.g. Temp: 98.6°F, Mass: 5 kg, Time: 12 s).',
        'Vector: A quantity with magnitude and direction — an ordered list of numbers (e.g. Velocity, Force, Displacement).',
        'Example Vector: v = (3, 4)',
        'Magnitude Calculation: |v| = √(3² + 4²) = √25 = 5'
      ],
      highlightBox: 'Key Takeaway: Vectors represent state direction and length in space. In quantum mechanics, quantum states |ψ⟩ are unit-norm state vectors.'
    },
    {
      slideNumber: 4,
      title: 'Vector Operations',
      subtitle: 'Three core operations forming the backbone of vector algebra.',
      boxes: [
        { title: 'Vector Addition', text: 'Add corresponding components tip-to-tail. Example: (2, 3) + (4, 1) = (6, 4).' },
        { title: 'Scalar Multiplication', text: 'Multiply every component by a scalar value. Example: 3 · (2, 1) = (6, 3).' },
        { title: 'Dot Product', text: 'Multiply corresponding components and sum: (2, 3) · (4, 5) = 8 + 15 = 23.' }
      ],
      highlightBox: 'Key Properties: The dot product is commutative and distributive; vector addition is associative.'
    },
    {
      slideNumber: 5,
      title: 'Matrices & Structural Types',
      subtitle: 'Rectangular arrangements of numbers encoding linear transformations compactly.',
      bullets: [
        'Definition: A matrix organizes m rows and n columns of numbers to represent linear maps.',
        'Example 2×2 Matrix: A = [[1, 2], [3, 4]]'
      ],
      boxes: [
        { title: 'Row & Column', text: 'Single row [1, 2] or single column [[1], [3]] matrix structures.' },
        { title: 'Square Matrix', text: 'n × n dimension matrix (equal rows and columns).' },
        { title: 'Identity Matrix (I)', text: 'Square matrix with diagonal 1s and off-diagonal 0s.' },
        { title: 'Zero & Diagonal', text: 'Zero matrix (all 0s) and Diagonal matrix (non-zeros only on main diagonal).' }
      ]
    },
    {
      slideNumber: 6,
      title: 'Matrix Operations',
      subtitle: 'Manipulating matrices for linear transformations.',
      boxes: [
        { title: 'Addition & Subtraction', text: 'Add or subtract corresponding entries. Matrices must share identical dimensions.' },
        { title: 'Scalar Multiplication', text: 'Multiply every matrix entry uniformly by a scalar factor.' },
        { title: 'Matrix Multiplication', text: 'Dot product of rows with columns. Requires inner dimensions to match: (m×n) · (n×p) = (m×p).' },
        { title: 'Transpose (Aᵀ)', text: 'Flip rows into columns. Example: A = [[1, 2], [3, 4]] ⟹ Aᵀ = [[1, 3], [2, 4]].' }
      ]
    },
    {
      slideNumber: 7,
      title: 'Determinant & Matrix Inverse',
      subtitle: 'Measuring transformation scaling and reversing linear operations.',
      bullets: [
        'Determinant det(A): For 2×2 matrix A = [[a, b], [c, d]], det(A) = ad - bc.',
        'Meaning: Single scalar measuring area/volume scaling factor and invertibility.',
        'Matrix Inverse A⁻¹: Exists only if det(A) ≠ 0. Satisfies A · A⁻¹ = I.',
        'Solving Linear Systems: Ax = b ⟹ x = A⁻¹b.'
      ],
      highlightBox: 'Invertibility Rule: A matrix is invertible (non-singular) if and only if its determinant is non-zero (det(A) ≠ 0).'
    },
    {
      slideNumber: 8,
      title: 'Systems of Linear Equations',
      subtitle: 'Solving Ax = b where A is the coefficient matrix, x is the unknown vector, and b is the result vector.',
      boxes: [
        { title: '1. Substitution', text: 'Solve one equation for a variable and substitute into others.' },
        { title: '2. Elimination', text: 'Combine equations to cancel variables systematically.' },
        { title: '3. Matrix Inverse', text: 'Compute x = A⁻¹b directly when A is non-singular.' },
        { title: '4. Gaussian Elimination', text: 'Row reduction to row echelon form — the workhorse of computational linear algebra.' }
      ]
    },
    {
      slideNumber: 9,
      title: 'Eigenvalues & Eigenvectors',
      subtitle: 'The intrinsic invariant axes of linear transformations: Ax = λx.',
      bullets: [
        'Eigenvector (x): Non-zero vector whose direction is unchanged when transformed by matrix A.',
        'Eigenvalue (λ): The scaling factor by which the eigenvector is stretched or compressed.',
        'Eigen-equation: Ax = λx',
        'Applications: Quantum Computing, Machine Learning, Face Recognition, Principal Component Analysis (PCA).'
      ],
      stats: [
        { value: 'Ax = λx', label: 'Eigen Equation', sub: 'Matrix transformation acts as scalar scaling' },
        { value: 'det(A-λI)=0', label: 'Characteristic Eq', sub: 'Roots yield matrix eigenvalues λ' },
        { value: 'PCA', label: 'Dimensionality', sub: 'Principal Component Analysis via eigenvectors' },
        { value: 'Observable', label: 'Quantum Measurement', sub: 'Hermitian operators have real eigenvalues' }
      ]
    },
    {
      slideNumber: 10,
      title: 'Why Linear Algebra Matters',
      subtitle: 'The mathematical foundation of quantum mechanics and modern technology.',
      boxes: [
        { title: 'Vectors & Matrices', text: 'Fundamental data structures encoding state and operator logic.' },
        { title: 'Operations & Inverses', text: 'Essential algebraic tools for transforming states and solving linear systems.' },
        { title: 'Eigenanalysis', text: 'Unlocking energy levels, measurement observables, and data patterns.' },
        { title: 'Modern Applications', text: 'Powering AI, neural networks, quantum computing, computer graphics, and physics simulations.' }
      ],
      highlightBox: 'Key Takeaway: Linear Algebra is not just abstract math — it is the operating system of modern technology. Every neural network, quantum simulation, and recommendation engine runs on these foundations.'
    }
  ]
};

export const TOPIC_3_SLIDES_DECK: TopicSlideDeckContent = {
  topicTitle: 'Dirac Notation & State Vectors',
  unit: 'Unit 1: Quantum Foundations',
  slides: [
    {
      slideNumber: 1,
      title: 'Dirac Notation & State Vectors',
      subtitle: 'A mathematical language for the quantum world — compact, elegant, and powerful.',
      bullets: [
        'Domain Scope: Quantum Computing • Quantum Mechanics • Mathematics',
        'Core Focus: Bra-ket algebra, Hilbert space state vectors, inner and outer products',
        'Goal: Master the standard mathematical formalism used across all quantum algorithms and quantum circuit design'
      ]
    },
    {
      slideNumber: 2,
      title: 'What Is Dirac Notation?',
      subtitle: 'Introduced by Paul Dirac in the 1930s as the standard shorthand for quantum mechanics.',
      boxes: [
        { title: 'Compact', text: 'Replaces bulky matrix expressions with clean symbolic forms' },
        { title: 'Universal', text: 'The lingua franca of quantum algorithms and circuit design' },
        { title: 'Efficient', text: 'Simplifies operations on qubits and quantum gates' }
      ]
    },
    {
      slideNumber: 3,
      title: 'State Vectors: Describing Quantum States',
      subtitle: 'A state vector captures the complete physical state of a quantum system in Hilbert space.',
      bullets: [
        'Ket |ψ⟩: Column vector representing state in complex vector space (Hilbert space).',
        'Basis State |0⟩ = [1, 0]ᵀ (corresponding to classical bit 0).',
        'Basis State |1⟩ = [0, 1]ᵀ (corresponding to classical bit 1).'
      ],
      highlightBox: 'Computational Basis: |0⟩ and |1⟩ form the orthonormal basis for a single qubit state space ℂ².'
    },
    {
      slideNumber: 4,
      title: 'Bra and Ket: Two Sides of the Same Coin',
      subtitle: 'Ket (column vector) and Bra (conjugate transpose row vector).',
      boxes: [
        { title: 'Ket |ψ⟩ — Column Vector', text: '|ψ⟩ = [α, β]ᵀ  and  |0⟩ = [1, 0]ᵀ' },
        { title: 'Bra ⟨ψ| — Conjugate Transpose', text: '⟨ψ| = [α*, β*]  and  ⟨0| = [1, 0] (Hermitian conjugate row vector)' }
      ]
    },
    {
      slideNumber: 5,
      title: 'The Inner Product: Measuring Overlap',
      subtitle: 'Quantifies how much two quantum states overlap: ⟨ϕ|ψ⟩.',
      bullets: [
        'Inner Product ⟨ϕ|ψ⟩: Complex scalar encoding state similarity and transition probability.',
        'Identical States: ⟨0|0⟩ = 1 (perfect overlap).',
        'Orthogonal States: ⟨0|1⟩ = 0 (no overlap, perfectly distinguishable).'
      ],
      highlightBox: 'Orthogonality: Orthogonal states are perfectly distinguishable — measuring one will never yield the other.'
    },
    {
      slideNumber: 6,
      title: 'The Outer Product: Building Operators',
      subtitle: 'Outer product |ψ⟩⟨ϕ| produces a matrix acting as a linear operator.',
      boxes: [
        { title: 'Projection Operators', text: '|0⟩⟨0| = [[1, 0], [0, 0]] — isolates specific basis components' },
        { title: 'Quantum Gates', text: 'Unitary transformations manipulating qubit state vectors' },
        { title: 'Density Matrices', text: 'ρ = ∑ pᵢ |ψᵢ⟩⟨ψᵢ| — describes mixed quantum states and noise' }
      ]
    },
    {
      slideNumber: 7,
      title: 'Superposition: More Than One State at Once',
      subtitle: 'Linear combinations of computational basis states.',
      bullets: [
        'General Form: |ψ⟩ = α|0⟩ + β|1⟩',
        'Probability Amplitudes: α, β ∈ ℂ satisfying normalization |α|² + |β|² = 1.',
        'Equal Superposition: |ψ⟩ = (|0⟩ + |1⟩)/√2 gives a 50/50 chance of measuring 0 or 1.'
      ]
    },
    {
      slideNumber: 8,
      title: 'Measurement: Collapse of the State',
      subtitle: 'Probabilistic, irreversible transformation upon observation.',
      bullets: [
        'Superposition: |ψ⟩ = α|0⟩ + β|1⟩',
        'Measurement Outcome: Yields 0 with probability |α|² or 1 with probability |β|².',
        'State Collapse: Once measured, the wavefunction collapses to the observed basis state (|0⟩ or |1⟩).'
      ],
      highlightBox: 'Fundamental Departure: Quantum measurement is inherently probabilistic and irreversible — destroying superposition upon measurement.'
    },
    {
      slideNumber: 9,
      title: 'Where Dirac Notation Powers Real Applications',
      subtitle: 'Essential formalism powering quantum technology.',
      boxes: [
        { title: 'Circuits & Algorithms', text: 'Expressing gate sequences in Shor\'s and Grover\'s algorithms' },
        { title: 'Teleportation & Cryptography', text: 'Describing entanglement, Bell states, and QKD protocols' },
        { title: 'Quantum ML & Error Correction', text: 'Encoding quantum data and surface codes against decoherence' }
      ]
    },
    {
      slideNumber: 10,
      title: 'Key Takeaways',
      subtitle: 'The conceptual framework of quantum computing.',
      boxes: [
        { title: '01. Bra ⟨| and Ket |⟩', text: 'Row and column vectors forming the backbone of quantum notation' },
        { title: '02. State Vectors', text: '|ψ⟩ fully describes a quantum system in Hilbert space' },
        { title: '03. Inner & Outer Products', text: 'Measure state overlap (inner) and construct operators (outer)' },
        { title: '04. Superposition & Measurement', text: 'Qubits exist in linear combinations until measurement collapses them' }
      ],
      highlightBox: 'Key Takeaway: Dirac notation is not just shorthand — it is the conceptual framework that makes quantum computing readable, teachable, and computable.'
    }
  ]
};

export const TOPIC_4_SLIDES_DECK: TopicSlideDeckContent = {
  topicTitle: 'Hilbert Spaces & Inner Products',
  unit: 'Unit 1: Quantum Foundations',
  slides: [
    {
      slideNumber: 1,
      title: 'Hilbert Spaces & Inner Products',
      subtitle: 'The mathematical language of quantum mechanics — where vectors, geometry, and probability converge to describe the quantum world.',
      bullets: [
        'Domain Scope: Quantum Mechanics • Hilbert Spaces • Vector Geometry',
        'Core Focus: Complete vector spaces, inner product axioms, orthogonality, and state normalization',
        'Goal: Understanding the rigorous geometric and probabilistic foundation of quantum states and observables'
      ]
    },
    {
      slideNumber: 2,
      title: 'What Is a Hilbert Space?',
      subtitle: 'A complete vector space equipped with an inner product, generalizing Euclidean geometry to higher dimensions.',
      boxes: [
        { title: 'Quantum States', text: 'Every quantum state is a unit-norm state vector in a Hilbert space.' },
        { title: 'Mathematical Backbone', text: 'Enables probability calculations, transition amplitudes, and measurements.' },
        { title: 'Qubit Representation', text: 'ℂ² is the 2-dimensional complex Hilbert space of a single qubit.' }
      ]
    },
    {
      slideNumber: 3,
      title: 'Four Defining Properties',
      subtitle: 'Axiomatic foundation of Hilbert spaces.',
      boxes: [
        { title: '1. Vector Addition', text: 'The sum of any two vectors stays within the space.' },
        { title: '2. Scalar Multiplication', text: 'Multiplying by a complex scalar yields another valid vector.' },
        { title: '3. Inner Product', text: 'Measures angles, lengths, and orthogonality between state vectors.' },
        { title: '4. Completeness', text: 'Every Cauchy sequence converges to a limit within the space.' }
      ],
      highlightBox: 'Key Examples: ℝ², ℝ³, and ℂ² — the two-dimensional complex Hilbert space representing a single qubit.'
    },
    {
      slideNumber: 4,
      title: 'Representing Quantum States',
      subtitle: 'State vectors and computational basis vectors.',
      bullets: [
        'State Vector |ψ⟩: Encodes the state of a quantum system.',
        'Basis Vectors: |0⟩ = [1, 0]ᵀ  and  |1⟩ = [0, 1]ᵀ.',
        'Superposition: |ψ⟩ = α|0⟩ + β|1⟩  with normalization constraint |α|² + |β|² = 1.'
      ],
      highlightBox: 'Normalization Constraint: Ensures total probability of all possible measurement outcomes equals 1.'
    },
    {
      slideNumber: 5,
      title: 'The Inner Product',
      subtitle: 'Mapping two vectors to a complex number ⟨ϕ|ψ⟩.',
      boxes: [
        { title: 'Notation ⟨ϕ|ψ⟩', text: 'The "bra-ket" or Dirac inner product notation.' },
        { title: 'Self-overlap ⟨0|0⟩ = 1', text: 'A state vector is perfectly aligned with itself.' },
        { title: 'Orthogonality ⟨0|1⟩ = 0', text: 'Computational basis states are mutually orthogonal.' }
      ]
    },
    {
      slideNumber: 6,
      title: 'Three Axioms of the Inner Product',
      subtitle: 'Mathematical constraints governing ⟨x|y⟩.',
      boxes: [
        { title: '1. Positivity', text: '⟨x|x⟩ ≥ 0, with equality ⟨x|x⟩ = 0 if and only if x = 0. Guarantees non-negative norm.' },
        { title: '2. Conjugate Symmetry', text: '⟨x|y⟩ = ⟨y|x⟩*. Swapping vector order yields the complex conjugate.' },
        { title: '3. Linearity', text: '⟨x|ay + bz⟩ = a⟨x|y⟩ + b⟨x|z⟩. Linear in second argument, antilinear in first.' }
      ]
    },
    {
      slideNumber: 7,
      title: 'Orthogonality',
      subtitle: 'Two vectors are orthogonal when their inner product vanishes: ⟨x|y⟩ = 0.',
      boxes: [
        { title: 'State Distinguishability', text: 'Orthogonal states can be distinguished by measurement with 100% certainty.' },
        { title: 'Measurement Basis', text: 'Orthogonal bases define valid physical quantum measurement outcomes.' },
        { title: 'Algorithm Design', text: 'Quantum algorithms exploit orthogonality for quantum interference & speedup.' }
      ],
      highlightBox: 'Orthogonal Basis: Basis states satisfy |0⟩ ⊥ |1⟩, meaning they are perfectly distinguishable.'
    },
    {
      slideNumber: 8,
      title: 'Norm & Normalization',
      subtitle: 'Vector length defined via inner product: ||x|| = √(⟨x|x⟩).',
      bullets: [
        'Norm Definition: ||x|| = √(⟨x|x⟩).',
        'Normalized Quantum State: ⟨ψ|ψ⟩ = 1.',
        'State Normalization: Any non-zero vector is normalized by dividing by its norm: |ψ_norm⟩ = |ψ⟩ / ||ψ||.'
      ],
      highlightBox: 'Probability Law: ||ψ||² = 1 ensures that the sum of probabilities of all measurement outcomes equals 1.'
    },
    {
      slideNumber: 9,
      title: 'Hilbert Spaces in Quantum Computing',
      subtitle: 'Underpinning every layer of quantum information science.',
      boxes: [
        { title: 'Qubits & Gates', text: 'Qubits live in ℂ²; quantum gates are unitary operators on Hilbert space.' },
        { title: 'Algorithms & Teleportation', text: 'Shor\'s and Grover\'s algorithms rely on interference in Hilbert space.' },
        { title: 'Cryptography & Error Correction', text: 'BB84 and surface codes exploit orthogonality and entanglement.' },
        { title: 'Quantum Machine Learning', text: 'Variational quantum circuits optimize states in high-dimensional Hilbert space.' }
      ]
    },
    {
      slideNumber: 10,
      title: 'Key Takeaways',
      subtitle: 'Summary of Hilbert Space Foundations.',
      boxes: [
        { title: '01. Complete Inner Product Space', text: 'A Hilbert space is a complete vector space with an inner product.' },
        { title: '02. States Are Vectors', text: 'Quantum states are unit vectors satisfying ⟨ψ|ψ⟩ = 1.' },
        { title: '03. Inner Product = Probability', text: '|⟨ϕ|ψ⟩|² gives probability of measuring state |ϕ⟩ when system is in |ψ⟩.' },
        { title: '04. Orthogonality = Distinguishability', text: 'Orthogonal states are perfectly distinguishable by measurement.' },
        { title: '05. Foundation of QC', text: 'From qubits to error correction, Hilbert spaces are indispensable.' }
      ]
    }
  ]
};

export const QCOMM_FOUNDATIONS_RECAP_SLIDES_DECK: TopicSlideDeckContent = {
  topicTitle: 'Foundations Recap: Qubits, Superposition & Entanglement',
  unit: 'Unit 2: Quantum Communication',
  slides: [
    {
      slideNumber: 1,
      title: 'Foundations Recap: Qubits, Superposition & Entanglement',
      subtitle: 'A visual review of the three core concepts that power quantum computation — and why they matter.',
      bullets: [
        'Domain Scope: Quantum Computing • Quantum Communication',
        'Core Focus: Qubits, Superposition, Entanglement, and measurement collapse',
        'Goal: Establishing why quantum communication requires these core non-classical resources'
      ]
    },
    {
      slideNumber: 2,
      title: 'The Three Pillars of Quantum Computing',
      subtitle: 'Quantum computing is built on three fundamental concepts enabling non-classical advantages.',
      boxes: [
        { title: 'Qubits', text: 'The basic unit of quantum information — capable of existing in more than one state at a time.' },
        { title: 'Superposition', text: 'A qubit can exist in a combination of states simultaneously, enabling quantum parallelism.' },
        { title: 'Entanglement', text: 'Two or more qubits become correlated so that the state of one instantly affects the other.' }
      ]
    },
    {
      slideNumber: 3,
      title: 'What is a Qubit?',
      subtitle: 'The fundamental unit of quantum information.',
      bullets: [
        'Qubit (Quantum Bit): Unlike classical 0 or 1 bits, qubits exist in linear combinations.',
        'Basis States: |0⟩ = [1, 0]ᵀ  and  |1⟩ = [0, 1]ᵀ.',
        'Physical Implementations: Trapped ions, superconducting circuits, photons, and quantum dots.'
      ]
    },
    {
      slideNumber: 4,
      title: 'Classical Bit vs. Qubit',
      subtitle: 'Comparing classical vs quantum information paradigms.',
      boxes: [
        { title: 'Classical Bit', text: 'Either 0 or 1 • Binary deterministic • No superposition or entanglement • Used in classical PCs' },
        { title: 'Quantum Qubit', text: '0, 1, or linear combination • Described by amplitudes • Supports superposition & entanglement' }
      ]
    },
    {
      slideNumber: 5,
      title: 'Superposition',
      subtitle: 'Allowing a qubit to exist in multiple states at the same time.',
      bullets: [
        'General State: |ψ⟩ = α|0⟩ + β|1⟩',
        'Normalization: |α|² + |β|² = 1',
        'Equal Superposition: |ψ⟩ = (|0⟩ + |1⟩)/√2 gives 50/50 probability.',
        'Quantum Parallelism: Many computational paths explored simultaneously.'
      ]
    },
    {
      slideNumber: 6,
      title: 'Measurement of a Qubit',
      subtitle: 'Wavefunction collapse upon observation.',
      bullets: [
        'Before Measurement: Superposition state |ψ⟩ = α|0⟩ + β|1⟩.',
        'After Measurement: Superposition collapses to definite basis state |0⟩ or |1⟩.',
        'Irreversibility: Quantum measurement is probabilistic and irreversible — destroying superposition.'
      ]
    },
    {
      slideNumber: 7,
      title: 'Entanglement',
      subtitle: 'Strong non-local correlations between qubits.',
      boxes: [
        { title: 'Strong Correlations', text: 'Measurement outcomes are perfectly correlated.' },
        { title: 'Shared State', text: 'Bell state |Φ⁺⟩ = (|00⟩ + |11⟩)/√2 cannot be factored into independent qubits.' },
        { title: 'Non-Local', text: 'Quantum correlations persist regardless of physical distance.' }
      ]
    },
    {
      slideNumber: 8,
      title: 'Applications of Entanglement',
      subtitle: 'The engine behind quantum technologies.',
      boxes: [
        { title: 'Quantum Teleportation', text: 'Transfer unknown quantum states using shared Bell pairs' },
        { title: 'Quantum Cryptography', text: 'Unbreakable communication via BB84 and E91 protocols' },
        { title: 'Quantum Networks', text: 'Connect quantum processors across distances' },
        { title: 'Error Correction', text: 'Protect quantum data from decoherence via entangled codes' }
      ]
    },
    {
      slideNumber: 9,
      title: 'Why These Concepts Matter',
      subtitle: 'Capabilities far beyond classical computing.',
      boxes: [
        { title: 'Faster Solutions', text: 'Exponential speedups for factoring, database search, and physics simulation.' },
        { title: 'Secure Communication', text: 'QKD guarantees eavesdropping detection via quantum laws.' },
        { title: 'Advanced Simulations', text: 'Model complex molecules, materials, and chemical reactions with high fidelity.' }
      ]
    },
    {
      slideNumber: 10,
      title: 'Key Takeaways',
      subtitle: 'Summary of Foundations Recap.',
      boxes: [
        { title: '01. Qubit', text: 'The basic unit of quantum information existing in combinations of |0⟩ and |1⟩.' },
        { title: '02. Superposition', text: 'Qubits occupy multiple states simultaneously via complex amplitudes.' },
        { title: '03. Measurement', text: 'Collapses the qubit to a definite state with probability determined by amplitudes.' },
        { title: '04. Entanglement', text: 'Creates strong non-local correlations between qubits.' }
      ],
      highlightBox: 'Key Takeaway: These three concepts — qubits, superposition, and entanglement — form the complete foundation of quantum computation and communication.'
    }
  ]
};

export const QCOMM_NO_CLONING_THEOREM_SLIDES_DECK: TopicSlideDeckContent = {
  topicTitle: 'The No-Cloning Theorem',
  unit: 'Unit 2: Quantum Communication',
  slides: [
    {
      slideNumber: 1,
      title: 'The No-Cloning Theorem',
      subtitle: 'An arbitrary, unknown quantum state cannot be copied exactly.',
      bullets: [
        'Domain Scope: Quantum Mechanics • Quantum Information Theory',
        'Core Focus: Fundamental impossibility of cloning unknown quantum states',
        'Goal: Understanding the mathematical proof and physical consequences of the No-Cloning Theorem'
      ]
    },
    {
      slideNumber: 2,
      title: 'What is the No-Cloning Theorem?',
      subtitle: 'An arbitrary, unknown quantum state cannot be copied exactly.',
      boxes: [
        { title: 'Why It Matters', text: 'Protects quantum information and underlies the physical security of quantum cryptography (QKD).' },
        { title: 'Consequences', text: 'Prevents perfect eavesdropping and enforces fundamental limits on quantum information replication.' }
      ]
    },
    {
      slideNumber: 3,
      title: 'Classical vs Quantum Copying',
      subtitle: 'Comparing classical string duplication vs quantum state non-clonability.',
      bullets: [
        'Classical Bits: Can be copied perfectly (e.g., 101100 → 101100) leaving the original unchanged.',
        'Quantum Qubits: Unknown quantum states |ψ⟩ cannot be universally cloned without disturbance.',
        'Cloning Impossibility: Creating |ψ⟩|ψ⟩ from an arbitrary unknown state |ψ⟩ and blank target |0⟩ is forbidden by physics.'
      ]
    },
    {
      slideNumber: 4,
      title: 'Formal Statement',
      subtitle: 'Mathematical formulation of universal cloning impossibility.',
      bullets: [
        'Hypothetical Universal Cloner: Suppose unitary U implements U|ψ⟩|0⟩ = |ψ⟩|ψ⟩ for all unknown states |ψ⟩.',
        'No Unitary Transformation: No universal unitary operation U can perform this transformation for all possible |ψ⟩.'
      ],
      highlightBox: 'Crucial Distinction: Statement applies to arbitrary unknown states — not about preparing known states from classical descriptions.'
    },
    {
      slideNumber: 5,
      title: 'Proof Sketch & Contradiction',
      subtitle: 'Linearity and unitarity forbid universal cloning.',
      boxes: [
        { title: '1. Assume Universal Cloner', text: 'Suppose U clones |ψ⟩ and |φ⟩: U|ψ⟩|0⟩ = |ψ⟩|ψ⟩ and U|φ⟩|0⟩ = |φ⟩|φ⟩.' },
        { title: '2. Inner Product Preserved', text: 'Unitarity requires preserving inner products: ⟨ψ|φ⟩ = ⟨ψ|φ⟩².' },
        { title: '3. Conclude Contradiction', text: '⟨ψ|φ⟩ = ⟨ψ|φ⟩² holds only when ⟨ψ|φ⟩ = 0 or 1. Thus a universal cloner cannot exist.' }
      ],
      highlightBox: 'Proof Summary: Linearity and unitarity imply inner products must be preserved, proving universal cloners are mathematically impossible.'
    },
    {
      slideNumber: 6,
      title: 'Concrete Example',
      subtitle: 'Failure of cloning on a simple superposition state.',
      bullets: [
        'Superposition Input: Take |ψ⟩ = (|0⟩ + |1⟩)/√2.',
        'Cloner Target: A perfect copier must produce (|0⟩ + |1⟩)/√2 ⊗ (|0⟩ + |1⟩)/√2.',
        'Linearity Violation: Quantum operations are linear; U((|0⟩+|1⟩)/√2)|0⟩ = (|00⟩+|11⟩)/√2 ≠ |ψ⟩|ψ⟩.',
        'Conclusion: Perfect cloning fails even for basic superposition states.'
      ]
    },
    {
      slideNumber: 7,
      title: 'Practical Implications',
      subtitle: 'Shaping quantum technologies.',
      boxes: [
        { title: 'Quantum Security', text: 'Guarantees eavesdroppers cannot copy unknown qubits perfectly in QKD.' },
        { title: 'Secure Communication', text: 'Quantum channels detect interception because measurement or cloning attempts disturb states.' },
        { title: 'Error Correction', text: 'Quantum error correction uses encoded redundancy (entanglement) rather than copying unknown qubits.' }
      ]
    },
    {
      slideNumber: 8,
      title: 'Allowed and Disallowed Actions',
      subtitle: 'What quantum mechanics permits vs forbids.',
      bullets: [
        'Disallowed: Universal perfect cloning of arbitrary unknown states.',
        'Allowed (Known States): Preparing multiple copies of a known state (re-preparing |ψ⟩ if classical description is known).',
        'Allowed (Approximate): Approximate cloning machines can produce imperfect copies with bounded fidelity.',
        'Measurement: Measuring generally collapses the state and prevents faithful duplication.'
      ]
    },
    {
      slideNumber: 9,
      title: 'Applications & Connections',
      subtitle: 'No-cloning in quantum protocols.',
      boxes: [
        { title: 'QKD Protocols', text: 'BB84 & E91 rely on no-cloning to detect eavesdropping instantly.' },
        { title: 'Quantum Teleportation', text: 'Transfers unknown states using entanglement & classical comms without cloning.' },
        { title: 'Quantum Networks', text: 'Repeaters use entanglement swapping & encoding rather than signal duplication.' }
      ]
    },
    {
      slideNumber: 10,
      title: 'Summary & Takeaways',
      subtitle: 'Key lessons from the No-Cloning Theorem.',
      boxes: [
        { title: '01. Impossibility', text: 'Unknown quantum states cannot be perfectly copied.' },
        { title: '02. Mathematical Origin', text: 'Derives directly from linearity and unitary quantum evolution.' },
        { title: '03. Information Security', text: 'Underlies QKD security and sets fundamental limits for quantum processing.' },
        { title: '04. Known vs Unknown', text: 'Known states can be re-prepared; approximate cloning is imperfect.' }
      ],
      highlightBox: 'Key Takeaway: The No-Cloning Theorem is not a technical limitation — it is a fundamental property of quantum nature that makes quantum cryptography secure.'
    }
  ]
};

export const generateLessonPdf = (topicTitle: string, topicSlug: string, materialType: string = 'PDF Slide Deck') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const isNoCloning = topicSlug === 'qcomm-no-cloning-theorem';
  const isQcommRecap = topicSlug === 'qcomm-foundations-recap';
  const isTopic4 = topicSlug === 'hilbert-spaces-inner-product';
  const isTopic3 = topicSlug === 'dirac-notation';
  const isTopic2 = topicSlug === 'review-linear-algebra';
  const isTopic1 = topicSlug === 'quantum-computation-overview';
  const deck = isNoCloning ? QCOMM_NO_CLONING_THEOREM_SLIDES_DECK : isQcommRecap ? QCOMM_FOUNDATIONS_RECAP_SLIDES_DECK : isTopic4 ? TOPIC_4_SLIDES_DECK : isTopic3 ? TOPIC_3_SLIDES_DECK : isTopic2 ? TOPIC_2_SLIDES_DECK : isTopic1 ? TOPIC_1_SLIDES_DECK : {
    topicTitle,
    unit: 'Quantum Computing Series',
    slides: TOPIC_1_SLIDES_DECK.slides
  };

  deck.slides.forEach((slide, idx) => {
    if (idx > 0) {
      doc.addPage('a4', 'landscape');
    }

    const pageWidth = doc.internal.pageSize.width; // 297mm
    const pageHeight = doc.internal.pageSize.height; // 210mm

    // Background Top Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent Line
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 28, pageWidth, 2.5, 'F');

    // Top Header Branding
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('QUANTLMS • QUANTUM ACADEMY', 15, 10);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(deck.topicTitle, 15, 18);

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Slide ${slide.slideNumber} of ${deck.slides.length}  •  ${materialType}`, pageWidth - 15, 18, { align: 'right' });

    let y = 42;

    // Slide Title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);

    const titleLines = slide.title.split('\n');
    titleLines.forEach(line => {
      doc.text(line, 15, y);
      y += 8;
    });

    // Slide Subtitle
    if (slide.subtitle) {
      y += 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const subLines = doc.splitTextToSize(slide.subtitle, 260);
      doc.text(subLines, 15, y);
      y += subLines.length * 5 + 6;
    }

    // Render Stats (Slide 7 style)
    if (slide.stats) {
      const colWidth = 62;
      slide.stats.forEach((st, sIdx) => {
        const x = 15 + sIdx * (colWidth + 8);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, colWidth, 32, 3, 3, 'FD');

        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(st.value, x + 8, y + 10);

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(st.label, x + 8, y + 18);

        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const subLines = doc.splitTextToSize(st.sub, colWidth - 16);
        doc.text(subLines, x + 8, y + 23);
      });
      y += 40;
    }

    // Render Bullets if present
    if (slide.bullets && slide.bullets.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);

      slide.bullets.forEach(b => {
        const bLines = doc.splitTextToSize(`•  ${b}`, 265);
        doc.text(bLines, 18, y);
        y += bLines.length * 5 + 2;
      });
      y += 4;
    }

    // Render Boxes/Cards Grid
    if (slide.boxes && slide.boxes.length > 0) {
      const isGrid = slide.boxes.length >= 4;
      const boxWidth = isGrid ? 130 : 265;
      const boxHeight = 22;

      slide.boxes.forEach((bx, bIdx) => {
        let x = 15;
        let curY = y;

        if (isGrid) {
          x = (bIdx % 2 === 0) ? 15 : 150;
          curY = y + Math.floor(bIdx / 2) * (boxHeight + 5);
        } else {
          curY = y + bIdx * (boxHeight + 5);
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, curY, boxWidth, boxHeight, 2.5, 2.5, 'FD');

        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(bx.title, x + 5, curY + 6);

        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const bTextLines = doc.splitTextToSize(bx.text, boxWidth - 10);
        doc.text(bTextLines, x + 5, curY + 12);
      });

      if (isGrid) {
        y += Math.ceil(slide.boxes.length / 2) * (boxHeight + 5) + 4;
      } else {
        y += slide.boxes.length * (boxHeight + 5) + 4;
      }
    }

    // Render Highlight Box (Slide 4, 7, 10)
    if (slide.highlightBox) {
      const boxY = Math.min(y, 165);
      doc.setFillColor(236, 253, 245); // emerald-50
      doc.setDrawColor(16, 185, 129); // emerald-500
      doc.roundedRect(15, boxY, 267, 18, 3, 3, 'FD');

      doc.setTextColor(6, 95, 70); // emerald-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);

      const hLines = doc.splitTextToSize(slide.highlightBox, 255);
      doc.text(hLines, 20, boxY + 7);
    }

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Quantum Computation: History & Overview • Verified Qrious Educational Content', 15, pageHeight - 6);
    doc.text(`Page ${idx + 1} of ${deck.slides.length}`, pageWidth - 15, pageHeight - 6, { align: 'right' });
  });

  const fileName = `${topicSlug}_slide_deck.pdf`;
  doc.save(fileName);
};
