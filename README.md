# QRIOUS: Quantum-Ready Intelligent Online Upskilling & Simulation

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Qiskit](https://img.shields.io/badge/Qiskit-Quantum-6929C4?logo=qiskit&logoColor=white)](https://www.ibm.com/quantum/qiskit)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Docker](https://img.shields.io/badge/Docker-Microservices-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Qrious%20Code-FFD21E?logo=huggingface&logoColor=black)](https://huggingface.co/sarvan-2187/qrious-code-1.0)

> [!NOTE]
> **Qrious Code v2.0 - model training in progress.**
> Our in-house quantum coding assistant model is being retrained. Meanwhile, **Qrious Code v1.0 is already live and in use** on the platform.
> The v1.0 weights (`model.safetensors`) are hosted in a separate location, not in this repo, see [`.gitignore`](./.gitignore) (`llm_service/qrious-code-1.0/model.safetensors`).
> Download the model from **Hugging Face: [https://huggingface.co/sarvan-2187/qrious-code-1.0](https://huggingface.co/sarvan-2187/qrious-code-1.0)**

**Qrious is one web platform for learning quantum computing end to end.** Learn a concept, build the circuit, run it on a simulator or real quantum hardware, ask an AI tutor when stuck, and track progress with quizzes, badges and streaks. Nothing to install: it all runs in the browser.

**Links:** [GitHub](https://github.com/sarvan-2187/sih) · [Live Prototype](https://prototype.qriouslabs.in)

![Qrious Landing Page](assets/images/landing.png)

---

## Contents

- [What's inside](#whats-inside)
- [Architecture at a glance](#architecture-at-a-glance)
- [How the key pieces work](#how-the-key-pieces-work)
- [Qrious Code (AI coding assistant)](#qrious-code-ai-coding-assistant)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Run it locally](#run-it-locally)

---

## What's inside

| Module | What it does |
|---|---|
| **Learn** | Courses, roadmaps, video + PDF lessons, pre/post quizzes, badges and streaks |
| **Gates Playground** | Drag-and-drop circuit builder with a live Bloch sphere (Qiskit + Aer, OpenQASM import/export) |
| **AI Tutor** | Doubt-solving chat grounded in verified quantum material (RAG), so it doesn't make things up |
| **Qrious Code** | AI coding assistant that writes and explains Qiskit / OpenQASM and can apply code straight into your circuit |
| **qStudio** | Turn your notes/PDFs into mind maps, flashcards, study guides, podcasts, slides, narrated videos and Manim animations, and ask questions with cited answers |
| **qBook** | Jupyter-style notebook in the browser: run real Python/Qiskit cell by cell |
| **QRoute** | Build a circuit once and send it to real quantum hardware: IBM, IonQ, qBraid, IQM |
| **Learning Path Optimizer** | Uses QAOA (a quantum algorithm) to pick what you should study next |
| **Qplanner & Q-Rating** | Study planner and skill rating, with analytics in your profile |

---

## Architecture at a glance

![Qrious Architecture](assets/images/current-architecture.png)

Qrious is built from **one frontend, one main API, and a few small helper services**. The frontend never runs heavy logic itself: simulation, AI and rendering all happen on the backend.

```mermaid
flowchart LR
    classDef user fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef core fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef svc fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef ext fill:#ede9fe,stroke:#6d28d9,color:#4c1d95

    U["Student / Educator<br/>(browser)"]:::user
    FE["Frontend<br/>React + TypeScript"]:::user

    subgraph BE["Main API — FastAPI"]
        API["Auth · Courses · Quizzes<br/>Simulation · AI Tutor"]:::core
    end

    subgraph MS["Helper services (Docker)"]
        QS["qStudio<br/>video · audio · slides · animation"]:::svc
        NB["qBook<br/>notebook kernels"]:::svc
        IQ["IQM service<br/>quantum hardware bridge"]:::svc
    end

    DATA[("MongoDB · ChromaDB<br/>Backblaze B2 · Firebase")]:::ext
    QCM["Qrious Code v1.0<br/>in-house coding model"]:::ext
    AI["LLM providers<br/>Groq · Gemini · Mistral · …"]:::ext
    QPU["Quantum hardware<br/>IBM · IonQ · qBraid · IQM"]:::ext

    U --> FE --> API
    FE -. "live code execution" .-> NB
    API --> QS & NB & IQ
    API --> DATA
    API --> QCM
    API --> AI
    API --> QPU
    IQ --> QPU
```
*green = user-facing · blue = main API · red = Docker helper service · purple = external*

**Why split it up?** Each helper service needs heavy or conflicting dependencies (Chromium + ffmpeg + Manim for video, live Jupyter kernels for notebooks, a separate Qiskit version for IQM). Keeping them in their own containers keeps the main API light and stable.

---

## How the key pieces work

### 1. Simulating a circuit

```mermaid
sequenceDiagram
    participant S as Student
    participant FE as Frontend
    participant API as FastAPI
    participant Q as Qiskit Aer

    S->>FE: Drag gates onto the canvas
    FE->>API: POST /simulate (circuit / OpenQASM)
    API->>Q: Run (ideal, or opt-in realistic noise)
    Q-->>API: Counts · probabilities · statevector
    API-->>FE: Results
    FE-->>S: Histogram + Bloch sphere
```

### 2. AI that doesn't make things up (RAG)

Every answer from the AI Tutor and qStudio Q&A comes from **retrieved course material**, not the model's memory, and every citation is checked against what was actually retrieved.

```mermaid
flowchart LR
    classDef a fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef b fill:#ede9fe,stroke:#6d28d9,color:#4c1d95
    classDef c fill:#dcfce7,stroke:#15803d,color:#14532d

    Q["Question"]:::c --> R["Search sources<br/>keyword + meaning"]:::a
    R --> RR["Rerank<br/>best matches first"]:::a
    RR --> G{"Relevant<br/>enough?"}:::a
    G -- no --> N["'Not enough info'<br/>(no guessing)"]:::c
    G -- yes --> L["LLM writes answer<br/>from sources only"]:::b
    L --> A["Answer + verified citations"]:::c
```

### 3. Two AI paths: our own model + a failover gateway

Coding help runs on **our own model, Qrious Code v1.0**. Everything else (tutor, qStudio, slides) goes through one AI Gateway, so no feature depends on a single vendor: if one provider is rate-limited or down, the gateway moves to the next one automatically.

```mermaid
flowchart LR
    classDef a fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef b fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef c fill:#ede9fe,stroke:#6d28d9,color:#4c1d95
    classDef m fill:#fef3c7,stroke:#b45309,color:#78350f

    QC["Qrious Code panel"]:::a --> M1["Qrious Code v1.0<br/>in-house model · live"]:::m

    F["Tutor · qStudio · Slides"]:::a --> GW["AI Gateway<br/>retry · backoff · failover"]:::b
    GW --> P1["Groq"]:::c
    GW --> P2["Gemini"]:::c
    GW --> P3["Mistral"]:::c
    GW --> P4["NVIDIA · Kimi · Z.AI"]:::c
```

### 4. Long jobs (video / animation rendering)

Rendering takes minutes, so it runs in the background. The API starts the job and replies right away, and the frontend checks the status.

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant QS as qStudio service
    participant DB as MongoDB + B2

    FE->>API: Generate video
    API->>QS: Start job (background)
    API-->>FE: Job queued
    QS->>QS: Script → voice → slides/Manim → ffmpeg
    QS->>DB: Save MP4 + mark ready
    loop every ~3s
        FE->>API: Status?
        API-->>FE: processing / ready
    end
```

### 5. Running on real quantum hardware (QRoute)

```mermaid
flowchart LR
    classDef a fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef b fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef c fill:#ede9fe,stroke:#6d28d9,color:#4c1d95

    C["Your circuit"]:::a --> QR["QRoute<br/>one interface, many vendors"]:::b
    QR --> IBM["IBM Quantum"]:::c
    QR --> IONQ["IonQ"]:::c
    QR --> QB["qBraid"]:::c
    QR --> IQM["IQM Resonance<br/>(via iqm_service)"]:::c
```

### 6. Picking what to study next (QAOA)

A classical filter first narrows ~93 roadmap topics down to at most 12 weak, unlocked ones. A small QAOA circuit then picks the best set that fits your study time. If anything fails, a classical greedy method takes over, so you always get an answer.

---

## Qrious Code (AI coding assistant)

Qrious Code is the cat-shaped launcher in the bottom-right of every page. Ask a quantum question, or have it write and explain Qiskit / OpenQASM code, then apply that code straight into the circuit you're working on.

| Version | Status | Where to get it |
|---|---|---|
| **Qrious Code v1.0** | Live, already in use | Weights hosted separately, not in this repo (see [`.gitignore`](./.gitignore)) · [Hugging Face](https://huggingface.co/sarvan-2187/qrious-code-1.0) |
| **Qrious Code v2.0** | Training in progress | Coming soon |

```mermaid
flowchart LR
    classDef a fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef b fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef c fill:#ede9fe,stroke:#6d28d9,color:#4c1d95
    classDef d fill:#fef3c7,stroke:#b45309,color:#78350f,stroke-dasharray: 4 3

    U["Qrious Code panel"]:::a --> API["FastAPI"]:::b
    API --> M1["Qrious Code v1.0<br/>live · in use"]:::c
    API -.-> M2["Qrious Code v2.0<br/>training…"]:::d
    M1 --> OUT["Qiskit / OpenQASM<br/>→ applied to your circuit"]:::a
```

---

## Tech stack

| Layer | Tools |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Shadcn UI, Magic UI, React Three Fiber |
| **Backend** | FastAPI (Python, async) |
| **Quantum** | Qiskit, Qiskit Aer, OpenQASM, QAOA; IBM / IonQ / qBraid / IQM hardware |
| **AI** | LangChain, multi-provider AI gateway (Groq, Gemini, Mistral, NVIDIA, Kimi, Z.AI), Qrious Code model |
| **RAG** | ChromaDB, BAAI/bge-small-en-v1.5 embeddings, BM25, cross-encoder reranker |
| **Media** | Manim, edge-tts, Playwright, ffmpeg |
| **Data & Auth** | MongoDB Atlas, Firebase Auth, Backblaze B2 (presigned URLs) |
| **Infra** | Docker / docker compose |

---

## Repository layout

```
├── frontend/           React app (all UI)
├── backend/            Main FastAPI API: auth, courses, simulation, AI tutor, RAG, QRoute
│   └── scripts/        Admin + seed scripts (run from backend/: python -m scripts.<name>)
├── qstudio_service/    Docker: video / audio / slides / Manim rendering
├── notebook_service/   Docker: qBook Jupyter kernels (WebSocket)
├── iqm_service/        Docker: IQM Resonance hardware bridge
├── llm_service/        Qrious Code model (weights hosted separately, git-ignored)
├── assets/             README images + architecture diagrams (assets/diagrams/)
└── docker-compose.yml  Runs all three Docker services together
```

---

## Run it locally

**You need:** Node.js, Python 3.9+, a MongoDB instance, Firebase credentials. Docker is only needed for the optional services.

```bash
# 1. Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev

# 2. Backend (new terminal)
cd backend
python -m venv venv
.\venv\Scripts\Activate        # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload

# 3. Optional: qStudio + qBook + IQM services (from repo root)
#    first copy each service's .env.example → .env and fill it in
docker compose up --build -d
```

| Service | Port | Needed for |
|---|---|---|
| `qstudio_service` | 8080 | Video / audio / slides / animation |
| `notebook_service` | 8081 | qBook notebooks |
| `iqm_service` | 8082 | IQM hardware in QRoute |

Each service has its own `.env.example`. Service-specific guides: [`qstudio_service/DEPLOYMENT.md`](./qstudio_service/DEPLOYMENT.md) · [`iqm_service/DEPLOYMENT.md`](./iqm_service/DEPLOYMENT.md)
