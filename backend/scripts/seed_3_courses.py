import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from database import connect_to_mongo, get_db

SYSTEM_EDUCATOR_UID = "system_educator_qrious"

THREE_COURSES = [
    # -------------------------------------------------------------
    # COURSE 1: Recorded Video & PDF Lecture Masterclass
    # -------------------------------------------------------------
    {
        "title": "Quantum Computing 101: Fundamentals & Circuit Mechanics",
        "description": "Master qubits, superposition, Bloch sphere representation, and circuit gates with pre-recorded video lectures, PDF slide decks, study notes, and cheatsheets.",
        "category": "CS",
        "level": "Beginner",
        "duration": "4 Hours",
        "tags": ["Recorded Videos", "PDF Notes", "PDF Slide Decks", "Cheatsheets"],
        "format": "recorded",
        "modules": [
            {
                "title": "Module 1: Foundations of Quantum Information",
                "order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1: Introduction to Qubits & Superposition",
                        "order": 1,
                        "resources": [
                            {
                                "title": "1.1 What is a Qubit? Classical Bits vs Quantum Superposition",
                                "description": "Learn the fundamental differences between classical 0/1 bits and quantum two-state superposition states.",
                                "resource_type": "video",
                                "url": "https://www.youtube.com/watch?v=g_IaVepNDT4",
                                "filename": "qubits_superposition_overview.mp4"
                            },
                            {
                                "title": "1.2 Quantum Probability Amplitudes & State Vector Math",
                                "description": "Mathematical derivation of quantum state vectors |ψ⟩ = α|0⟩ + β|1⟩ and Born's probability rule.",
                                "resource_type": "video",
                                "url": "https://www.youtube.com/watch?v=F_Riqjdh2oM",
                                "filename": "probability_amplitudes.mp4"
                            },
                            {
                                "title": "Qubits & Superposition — Study Notes.pdf",
                                "description": "A concise, visual introduction to the qubit, superposition, measurement, and practical context — designed for undergraduate learners.",
                                "resource_type": "notes",
                                "url": "http://127.0.0.1:8000/slides/qubits_superposition_notes.pdf",
                                "filename": "qubits_superposition_notes.pdf"
                            },
                            {
                                "title": "Quantum Computing — At a Glance Cheatsheet.pdf",
                                "description": "At a glance reference cheatsheet covering Qubits, Superposition, Entanglement, Measurement, Gates, and Foundations.",
                                "resource_type": "cheatsheet",
                                "url": "http://127.0.0.1:8000/slides/quantum_foundations_cheatsheet.pdf",
                                "filename": "quantum_foundations_cheatsheet.pdf"
                            }
                        ]
                    },
                    {
                        "title": "Lesson 2: The Bloch Sphere & Single-Qubit Rotations",
                        "order": 2,
                        "resources": [
                            {
                                "title": "2.1 Visualizing Single Qubit States on the Bloch Sphere",
                                "description": "Geometric mapping of a qubit state onto the 3D unit Bloch sphere using spherical coordinates θ and φ.",
                                "resource_type": "video",
                                "url": "https://www.youtube.com/watch?v=90za6mazNps",
                                "filename": "bloch_sphere_visualization.mp4"
                            },
                            {
                                "title": "Bloch Sphere Geometry Lecture Slide Deck.pdf",
                                "description": "Complete slide deck covering latitude θ, phase angle φ, single-qubit rotation gates, and reference states.",
                                "resource_type": "ppt",
                                "url": "http://127.0.0.1:8000/slides/bloch_sphere_geometry_deck.pdf",
                                "filename": "bloch_sphere_geometry_deck.pdf"
                            }
                        ]
                    }
                ]
            }
        ]
    },

    # -------------------------------------------------------------
    # COURSE 2: Hands-On Interactive Quantum Gate Lab
    # -------------------------------------------------------------
    {
        "title": "Interactive Quantum Circuit Lab & Gate Playground",
        "description": "Hands-on interactive quantum lab course. Build, simulate, and debug quantum circuits directly inside your lesson slides using embedded gate playgrounds.",
        "category": "Hardware",
        "level": "Intermediate",
        "duration": "3 Hours",
        "tags": ["Interactive Labs", "Gate Playground", "Circuit Building", "Statevector Analysis"],
        "format": "recorded",
        "modules": [
            {
                "title": "Module 1: Interactive Bell State & Entanglement Lab",
                "order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1: Constructing the |Φ+⟩ Bell State",
                        "order": 1,
                        "resources": [
                            {
                                "title": "🧪 Interactive Lab: Build a Bell State (|Φ+⟩)",
                                "description": "Task: Place a Hadamard gate (H) on Qubit 0 to create equal superposition, then place a CNOT (CX) gate controlled on Qubit 0 targeting Qubit 1. Run simulation to verify statevector [0.707, 0, 0, 0.707].",
                                "resource_type": "interactive_lab",
                                "url": "interactive_lab_bell_state",
                                "filename": "bell_state_lab.json"
                            }
                        ]
                    },
                    {
                        "title": "Lesson 2: Quantum Teleportation Protocol Lab",
                        "order": 2,
                        "resources": [
                            {
                                "title": "🧪 Interactive Lab: Quantum Teleportation Circuit Challenge",
                                "description": "Task: Construct the 3-qubit quantum teleportation protocol. Entangle Qubits 1 and 2, perform Bell measurement on Qubits 0 and 1, and apply conditional Pauli X/Z corrections on Qubit 2.",
                                "resource_type": "interactive_lab",
                                "url": "interactive_lab_teleportation",
                                "filename": "teleportation_lab.json"
                            }
                        ]
                    }
                ]
            },
            {
                "title": "Module 2: Quantum Oracle & Search Algorithm Labs",
                "order": 2,
                "lessons": [
                    {
                        "title": "Lesson 1: Deutsch-Jozsa Oracle Circuit Lab",
                        "order": 1,
                        "resources": [
                            {
                                "title": "🧪 Interactive Lab: Balanced vs Constant Oracle Simulation",
                                "description": "Task: Build a 2-qubit Deutsch algorithm circuit. Place H gates on both input and ancilla qubits, insert a CNOT oracle, and measure the input qubit to determine function parity.",
                                "resource_type": "interactive_lab",
                                "url": "interactive_lab_deutsch",
                                "filename": "deutsch_oracle_lab.json"
                            }
                        ]
                    }
                ]
            }
        ]
    },

    # -------------------------------------------------------------
    # COURSE 3: Live Interactive Masterclass & Cohort Sessions
    # -------------------------------------------------------------
    {
        "title": "Quantum Machine Learning & Algorithms: Live Cohort Masterclass",
        "description": "Live instructor-led quantum cohort. Join weekly interactive live lecture sessions, participate in real-time Q&A, and access archived live recordings.",
        "category": "Electrical",
        "level": "Advanced",
        "duration": "6 Weeks",
        "tags": ["Live Sessions", "Cohort Classes", "Interactive Q&A", "Live Recordings"],
        "format": "live",
        "modules": [
            {
                "title": "Module 1: Variational Quantum Algorithms & QML",
                "order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1: Live Class - Variational Quantum Eigensolver (VQE)",
                        "order": 1,
                        "resources": [
                            {
                                "title": "🔴 Live Session: VQE Hamiltonian Minimization Masterclass",
                                "description": "Live interactive lecture covering parameter optimization, ansatz design, and energy expectation value calculation.",
                                "resource_type": "video",
                                "url": "https://www.youtube.com/watch?v=A78Ez6dSWvA",
                                "filename": "vqe_live_masterclass.mp4"
                            },
                            {
                                "title": "VQE Live Lecture Slides & Code Templates.pdf",
                                "description": "PDF slides from live session with Qiskit VQE code examples.",
                                "resource_type": "ppt",
                                "url": "https://qrious-quantum.s3.amazonaws.com/materials/vqe-live-slides.pdf",
                                "filename": "vqe_live_slides.pdf"
                            }
                        ]
                    }
                ]
            }
        ]
    }
]

async def seed():
    print("Connecting to MongoDB...")
    await connect_to_mongo()
    db = get_db()
    if db is None:
        print("Error: Could not connect to database")
        return

    print("Clearing old course records...")
    await db.resources.drop()
    await db.lessons.drop()
    await db.modules.drop()
    await db.courses.drop()
    await db.live_sessions.drop()

    for c_data in THREE_COURSES:
        course_doc = {
            "title": c_data["title"],
            "description": c_data["description"],
            "category": c_data["category"],
            "level": c_data["level"],
            "duration": c_data["duration"],
            "tags": c_data["tags"],
            "owner_uid": SYSTEM_EDUCATOR_UID,
            "status": "published",
            "format": c_data["format"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        res = await db.courses.insert_one(course_doc)
        course_id = res.inserted_id
        print(f"Created Course [{c_data['format'].upper()}]: '{c_data['title']}' (ID: {course_id})")

        # If live course, seed live sessions
        if c_data["format"] == "live":
            session1 = {
                "course_id": course_id,
                "title": "Live Masterclass 1: Variational Circuit Architecture & Ansatz Tuning",
                "scheduled_at": datetime.now(timezone.utc).isoformat(),
                "status": "scheduled",
                "room_name": f"live-room-qml-masterclass-01",
                "created_by": SYSTEM_EDUCATOR_UID
            }
            session2 = {
                "course_id": course_id,
                "title": "Live Masterclass 2: Quantum Support Vector Classifiers (QSVC) Archive",
                "scheduled_at": datetime.now(timezone.utc).isoformat(),
                "status": "recording_ready",
                "room_name": f"live-room-qml-masterclass-02",
                "created_by": SYSTEM_EDUCATOR_UID
            }
            await db.live_sessions.insert_many([session1, session2])
            print("  -> Seeded 2 Live Sessions (Scheduled & Recording Ready)")

        for m_data in c_data["modules"]:
            mod_doc = {
                "course_id": course_id,
                "title": m_data["title"],
                "order": m_data["order"]
            }
            mod_res = await db.modules.insert_one(mod_doc)
            module_id = mod_res.inserted_id

            for l_data in m_data["lessons"]:
                les_doc = {
                    "module_id": module_id,
                    "title": l_data["title"],
                    "order": l_data["order"]
                }
                les_res = await db.lessons.insert_one(les_doc)
                lesson_id = les_res.inserted_id

                for r_data in l_data["resources"]:
                    res_doc = {
                        "lesson_id": lesson_id,
                        "resource_type": r_data["resource_type"],
                        "title": r_data["title"],
                        "description": r_data["description"],
                        "filename": r_data["filename"],
                        "b2_key": r_data["url"],
                        "uploaded_by": SYSTEM_EDUCATOR_UID,
                        "uploaded_at": datetime.now(timezone.utc),
                        "status": "confirmed"
                    }
                    await db.resources.insert_one(res_doc)

    print("\nSuccessfully seeded exactly 3 courses in MongoDB representing recorded, lab, and live modalities!")

if __name__ == "__main__":
    asyncio.run(seed())
