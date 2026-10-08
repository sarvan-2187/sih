import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { PageHero, PageShell } from '@/components/explorer';
import { ArrowLeft, BookOpen, ExternalLink, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MermaidDiagram } from '@/components/MermaidDiagram';
const GateCard = ({ 
  title, 
  symbol, 
  description, 
  matrix, 
  attributes, 
  gateCode, 
  numQubits = 1 
}: { 
  title: string, 
  symbol: string, 
  description: React.ReactNode, 
  matrix: string, 
  attributes: {label: string, value: string}[],
  gateCode: string | null,
  numQubits?: number
}) => {
  const navigate = useNavigate();

  const handleTryGate = () => {
    if (!gateCode) return;
    
    const gates = [{
      id: `${gateCode}-${Date.now()}`,
      name: gateCode,
      target: numQubits === 1 ? 0 : 1,
      control: numQubits > 1 ? 0 : undefined,
      step: 0,
    }];
    
    sessionStorage.setItem('qrious_playground_algorithm_transfer', JSON.stringify({
      qubits: Math.max(2, numQubits),
      cbits: Math.max(2, numQubits),
      gates,
      timestamp: Date.now(),
      context: title.trim().endsWith('Gate') ? title : `${title} Gate`
    }));
    navigate('/playground/gates');
  };

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 mb-8 transition-all duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
         <h3 className="text-xl font-bold flex items-center gap-3 text-slate-800 dark:text-slate-100">
           <span className="w-12 h-12 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xl font-mono border border-emerald-200 dark:border-emerald-800/50">
             {symbol}
           </span>
           {title}
         </h3>
         {/* TEMP(Qrious) */ false && gateCode && (
           <button 
             onClick={handleTryGate} 
             className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
           >
             <ExternalLink className="w-4 h-4" /> Try in Playground
           </button>
         )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
           <div className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed space-y-4">
             {description}
           </div>
           
           <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-white/5 overflow-x-auto">
              <span className="text-slate-400 dark:text-zinc-500 text-[10px] uppercase tracking-wider font-sans font-semibold mb-3 block">Unitary Matrix</span>
              <pre className="text-emerald-600 dark:text-emerald-400 font-mono text-sm leading-relaxed">
{matrix}
              </pre>
           </div>
         </div>
  
         <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-3 border-b border-slate-100 dark:border-white/10 pb-2">Quick Info</h4>
            <div className="flex flex-col gap-3">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-white/5 pb-2 last:border-0">
                  <span className="text-slate-500 dark:text-zinc-500">{attr.label}</span>
                  <span className="font-medium text-slate-800 dark:text-zinc-200 text-right ml-4">{attr.value}</span>
                </div>
              ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default function QuantumLibrary() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <button
            onClick={() => navigate(-1)}
            className="flex w-fit items-center gap-2 text-sm text-emerald-500 transition-colors hover:text-emerald-600"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        }
        title="Quantum Gate Library"
        subtitle="A comprehensive reference for quantum logic gates, unitary matrices, and transformations."
      />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Main Content */}
          <div className="xl:col-span-3">
            
            <section id="intro" className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <BookOpen className="w-6 h-6 text-emerald-500" /> Classical vs. Quantum Gates
              </h2>
              <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed space-y-4">
                <p>
                  In classical computing, a <strong>logical gate</strong> (like AND, OR, NOT) takes one or more binary inputs (0 or 1) and produces a binary output. Most classical gates are <em>irreversible</em>—meaning you cannot always determine the input just by looking at the output (e.g., if an AND gate outputs 0, the input could have been 00, 01, or 10).
                </p>
                <p>
                  A <strong>quantum gate</strong> operates on qubits. Because quantum mechanics must preserve probability amplitudes, all quantum logic gates (except measurement) are <em>strictly reversible</em>. Mathematically, a quantum gate is represented by a <strong>Unitary Matrix</strong> <code className="bg-slate-100 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 px-1 rounded">U</code> where <code className="bg-slate-100 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 px-1 rounded">U†U = I</code>. Applying a gate corresponds to rotating the qubit's state vector on the Bloch Sphere.
                </p>
              </div>
            </section>

            <h2 id="single-qubit" className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-4">
              Single Qubit Gates
            </h2>

            <GateCard
              title="Pauli-X (Quantum NOT)"
              symbol="X"
              gateCode="X"
              description={
                <>
                  <p>The X gate flips the state of a qubit. It maps <code>|0⟩</code> to <code>|1⟩</code> and <code>|1⟩</code> to <code>|0⟩</code>.</p>
                  <p>Geometrically, it corresponds to a rotation of π radians (180°) around the X-axis on the Bloch Sphere.</p>
                </>
              }
              matrix={`[ 0  1 ]\n[ 1  0 ]`}
              attributes={[
                { label: 'Qubits', value: '1' },
                { label: 'Axis of Rotation', value: 'X-axis' },
                { label: 'Angle', value: 'π (180°)' },
                { label: 'Self-Inverse', value: 'Yes (XX = I)' }
              ]}
            />

            <GateCard
              title="Pauli-Y"
              symbol="Y"
              gateCode="Y"
              description={
                <>
                  <p>The Y gate equates to a rotation around the Y-axis of the Bloch sphere by π radians.</p>
                  <p>It maps <code>|0⟩</code> to <code>i|1⟩</code> and <code>|1⟩</code> to <code>-i|0⟩</code>. It is a combination of X and Z gates with a global phase factor.</p>
                </>
              }
              matrix={`[ 0 -i ]\n[ i  0 ]`}
              attributes={[
                { label: 'Qubits', value: '1' },
                { label: 'Axis of Rotation', value: 'Y-axis' },
                { label: 'Angle', value: 'π (180°)' },
                { label: 'Self-Inverse', value: 'Yes' }
              ]}
            />

            <GateCard
              title="Pauli-Z (Phase Flip)"
              symbol="Z"
              gateCode="Z"
              description={
                <>
                  <p>The Z gate acts as a phase flip. It leaves the basis state <code>|0⟩</code> unchanged, but maps <code>|1⟩</code> to <code>-|1⟩</code>.</p>
                  <p>It represents a rotation around the Z-axis by π radians. This is a purely quantum phenomenon as it changes the phase of the state without affecting the probability of measuring 0 or 1.</p>
                </>
              }
              matrix={`[ 1  0 ]\n[ 0 -1 ]`}
              attributes={[
                { label: 'Qubits', value: '1' },
                { label: 'Axis of Rotation', value: 'Z-axis' },
                { label: 'Angle', value: 'π (180°)' },
                { label: 'Self-Inverse', value: 'Yes' }
              ]}
            />

            <GateCard
              title="Hadamard"
              symbol="H"
              gateCode="H"
              description={
                <>
                  <p>The Hadamard gate is one of the most important quantum gates. It creates a <strong>superposition</strong>.</p>
                  <p>When applied to <code>|0⟩</code>, it creates a state where measuring 0 or 1 are equally likely. Mathematically, it maps <code>|0⟩</code> to <code>(|0⟩ + |1⟩)/√2</code> (the <code>|+⟩</code> state).</p>
                </>
              }
              matrix={`1/√2 * [  1   1 ]\n       [  1  -1 ]`}
              attributes={[
                { label: 'Qubits', value: '1' },
                { label: 'Axis of Rotation', value: 'X+Z diagonal' },
                { label: 'Angle', value: 'π (180°)' },
                { label: 'Self-Inverse', value: 'Yes' }
              ]}
            />

            <GateCard
              title="Phase (S)"
              symbol="S"
              gateCode="S"
              description={
                <>
                  <p>The S gate applies a π/2 (90°) phase shift to the <code>|1⟩</code> state.</p>
                  <p>It is essentially a "square root" of the Z gate (meaning applying two S gates is equivalent to one Z gate). It maps <code>|1⟩</code> to <code>i|1⟩</code>.</p>
                </>
              }
              matrix={`[ 1  0 ]\n[ 0  i ]`}
              attributes={[
                { label: 'Qubits', value: '1' },
                { label: 'Axis of Rotation', value: 'Z-axis' },
                { label: 'Angle', value: 'π/2 (90°)' },
                { label: 'Self-Inverse', value: 'No (S† = Sdg)' }
              ]}
            />

            <GateCard
              title="T Gate"
              symbol="T"
              gateCode="T"
              description={
                <>
                  <p>The T gate applies a π/4 (45°) phase shift. It is the "fourth root" of the Z gate.</p>
                  <p>The T gate is critical for universal quantum computing, as it provides the non-Clifford operation required to approximate any quantum state.</p>
                </>
              }
              matrix={`[ 1    0    ]\n[ 0  e^(iπ/4) ]`}
              attributes={[
                { label: 'Qubits', value: '1' },
                { label: 'Axis of Rotation', value: 'Z-axis' },
                { label: 'Angle', value: 'π/4 (45°)' },
                { label: 'Self-Inverse', value: 'No (T† = Tdg)' }
              ]}
            />

            <h2 id="multi-qubit" className="text-2xl font-bold mt-16 mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-4">
              Multi-Qubit Gates
            </h2>

            <GateCard
              title="Controlled-NOT (CNOT)"
              symbol="CX"
              gateCode="CNOT"
              numQubits={2}
              description={
                <>
                  <p>The CNOT gate acts on two qubits: a <em>control</em> and a <em>target</em>.</p>
                  <p>It applies a Pauli-X (NOT) on the target qubit if and only if the control qubit is in the state <code>|1⟩</code>. It is the primary gate used to create <strong>quantum entanglement</strong> (e.g., creating Bell states).</p>
                </>
              }
              matrix={`[ 1  0  0  0 ]\n[ 0  1  0  0 ]\n[ 0  0  0  1 ]\n[ 0  0  1  0 ]`}
              attributes={[
                { label: 'Qubits', value: '2' },
                { label: 'Type', value: 'Controlled' },
                { label: 'Creates Entanglement', value: 'Yes' },
                { label: 'Self-Inverse', value: 'Yes' }
              ]}
            />

            <GateCard
              title="SWAP"
              symbol="SWAP"
              gateCode="SWAP"
              numQubits={2}
              description={
                <>
                  <p>The SWAP gate simply exchanges the states of two qubits.</p>
                  <p>It is useful in quantum hardware with limited connectivity, allowing qubits to be moved physically adjacent to one another by swapping states along a chain.</p>
                </>
              }
              matrix={`[ 1  0  0  0 ]\n[ 0  0  1  0 ]\n[ 0  1  0  0 ]\n[ 0  0  0  1 ]`}
              attributes={[
                { label: 'Qubits', value: '2' },
                { label: 'Equivalent', value: '3 CNOTs' },
                { label: 'Creates Entanglement', value: 'No' },
                { label: 'Self-Inverse', value: 'Yes' }
              ]}
            />

            <GateCard
              title="Toffoli (CCX)"
              symbol="CCX"
              gateCode={null} // Toffoli might require 3 qubits in playground, keeping null to just show theory
              numQubits={3}
              description={
                <>
                  <p>The Toffoli gate is a <em>controlled-controlled-NOT</em> gate.</p>
                  <p>It flips the target qubit if and only if both control qubits are <code>|1⟩</code>. It is a universal classical reversible gate, meaning any classical computation can be built using only Toffoli gates.</p>
                </>
              }
              matrix={`[ 1 0 0 0 0 0 0 0 ]\n[ 0 1 0 0 0 0 0 0 ]\n[ 0 0 1 0 0 0 0 0 ]\n[ 0 0 0 1 0 0 0 0 ]\n[ 0 0 0 0 1 0 0 0 ]\n[ 0 0 0 0 0 1 0 0 ]\n[ 0 0 0 0 0 0 0 1 ]\n[ 0 0 0 0 0 0 1 0 ]`}
              attributes={[
                { label: 'Qubits', value: '3' },
                { label: 'Type', value: 'Doubly-Controlled' },
                { label: 'Universality', value: 'Universal for Classical Reversible' },
                { label: 'Self-Inverse', value: 'Yes' }
              ]}
            />

            <h2 id="transforms" className="text-2xl font-bold mt-16 mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-4">
              Advanced Transforms
            </h2>

            <GateCard
              title="Quantum Fourier Transform"
              symbol="QFT"
              gateCode="QFT"
              numQubits={3} // E.g., a 3-qubit QFT
              description={
                <>
                  <p>The QFT is the quantum analogue of the discrete Fourier transform. It transforms a quantum state in the computational basis into the Fourier basis (the phase basis).</p>
                  <p>It is a vital subroutine in Shor's Algorithm (for factoring large numbers) and Quantum Phase Estimation.</p>
                </>
              }
              matrix={`1/√N * Σ e^(2πi*j*k/N) |k⟩⟨j|`}
              attributes={[
                { label: 'Qubits', value: 'Variable (N)' },
                { label: 'Usage', value: "Shor's Algorithm, Phase Estimation" },
                { label: 'Self-Inverse', value: 'No (Use IQFT)' }
              ]}
            />

            <GateCard
              title="Inverse Quantum Fourier Transform"
              symbol="IQFT"
              gateCode="IQFT"
              numQubits={3}
              description={
                <>
                  <p>The IQFT undoes the operation of the QFT. Because all quantum circuits are reversible, simply applying the inverse (adjoint) of the QFT matrix brings the phase-encoded information back into measurable basis states.</p>
                  <p>It is the final step in Quantum Phase Estimation, translating the estimated phase back into binary so it can be measured as an integer.</p>
                </>
              }
              matrix={`1/√N * Σ e^(-2πi*j*k/N) |j⟩⟨k|`}
              attributes={[
                { label: 'Qubits', value: 'Variable (N)' },
                { label: 'Usage', value: 'Phase Estimation, Period Finding' },
                { label: 'Self-Inverse', value: 'No (Use QFT)' }
              ]}
            />
            <h2 id="measurement" className="text-2xl font-bold mt-16 mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-4">
              Quantum States & Measurement
            </h2>

            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 mb-8 text-slate-600 dark:text-zinc-400 text-sm leading-relaxed space-y-6">
              
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">State Vectors & Amplitudes</h3>
                <p>
                  A quantum state is mathematically represented as a <strong>State Vector</strong> in a complex Hilbert space. For a single qubit, the state is written as a superposition of the basis states: <code>|ψ⟩ = α|0⟩ + β|1⟩</code>. 
                  Here, <code>α</code> and <code>β</code> are complex numbers called <strong>Probability Amplitudes</strong>. 
                </p>
                <p className="mt-2">
                  Unlike classical probabilities which must be positive numbers between 0 and 1, amplitudes can be negative or even imaginary. This allows for quantum interference, where amplitudes can cancel each other out!
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Measurement & The Born Rule</h3>
                <p>
                  When we measure a qubit, the superposition "collapses" into one of the classical basis states (0 or 1). We can never observe the complex amplitudes directly. 
                  According to the <strong>Born Rule</strong>, the probability of measuring a specific state is the <em>absolute square</em> of its amplitude.
                </p>
                <p className="mt-2">
                  Probability of measuring 0 = <code>|α|²</code> <br/>
                  Probability of measuring 1 = <code>|β|²</code>
                </p>
                <p className="mt-2">
                  Because the probabilities must sum to 100%, we have the normalization condition: <code>|α|² + |β|² = 1</code>.
                </p>

                <MermaidDiagram 
                  className="mt-6 border border-slate-100 dark:border-white/5 rounded-xl bg-slate-50 dark:bg-zinc-950 p-4"
                  chart={`
                    graph LR
                        A["|0> (Initial State)"] --> B["U (Quantum Gates)"]
                        B --> C["Superposition State"]
                        C -->|Measurement| D{"Collapse"}
                        D -->|Probability a^2| E["0 (Classical Bit)"]
                        D -->|Probability b^2| F["1 (Classical Bit)"]
                  `}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/10">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Why Do We Need "Shots"?</h3>
                <p>
                  Because measuring a quantum state collapses it into a single classical string (e.g., measuring <code>01</code>), a single execution of a circuit only gives you one data point. It does <em>not</em> give you the probabilities!
                </p>
                <p className="mt-2">
                  To discover the underlying probability distribution (the `|α|²` and `|β|²`), you must run the exact same circuit many times. Each execution is called a <strong>Shot</strong>. 
                  If you run a circuit with 1,024 shots, and measure `0` 512 times and `1` 512 times, you can infer that the probability distribution is ~50/50.
                </p>

                <MermaidDiagram 
                  className="mt-6 border border-slate-100 dark:border-white/5 rounded-xl bg-slate-50 dark:bg-zinc-950 p-4"
                  chart={`
                    flowchart TD
                        A[Start Circuit Execution] --> B[Apply Gates]
                        B --> C[Measure Qubits]
                        C --> D[Record Single Binary Outcome]
                        D --> E{Shot Count Reached?}
                        E -- No --> A
                        E -- Yes --> F[Aggregate Results]
                        F --> G[Probability Distribution Histogram]
                  `}
                />
              </div>

            </div>

          </div>

          {/* Sticky Sidebar Navigation */}
          <div className="hidden xl:block xl:col-span-1">
            <div className={cn(
              "sticky top-8 p-6 rounded-2xl border shadow-sm",
              theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
            )}>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-slate-500 dark:text-zinc-500">Contents</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#intro" className="text-slate-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Classical vs Quantum</a></li>
                <li><a href="#single-qubit" className="text-slate-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Single Qubit Gates</a></li>
                <li className="pl-4"><a href="#single-qubit" className="text-slate-500 dark:text-zinc-500 hover:text-emerald-500 transition-colors">Pauli X, Y, Z</a></li>
                <li className="pl-4"><a href="#single-qubit" className="text-slate-500 dark:text-zinc-500 hover:text-emerald-500 transition-colors">Hadamard, Phase, T</a></li>
                <li><a href="#multi-qubit" className="text-slate-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Multi-Qubit Gates</a></li>
                <li className="pl-4"><a href="#multi-qubit" className="text-slate-500 dark:text-zinc-500 hover:text-emerald-500 transition-colors">CNOT & SWAP</a></li>
                <li className="pl-4"><a href="#multi-qubit" className="text-slate-500 dark:text-zinc-500 hover:text-emerald-500 transition-colors">Toffoli (CCX)</a></li>
                <li><a href="#transforms" className="text-slate-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Transforms (QFT)</a></li>
                <li><a href="#measurement" className="text-slate-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">States & Measurement</a></li>
              </ul>
              
              <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <Zap className="w-4 h-4" />
                  <span className="font-semibold text-sm">Interactive Sandbox</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
                  Use the <strong>"Try in Playground"</strong> buttons on each gate to immediately see them applied in a live circuit sandbox!
                </p>
              </div>
            </div>
          </div>

        </div>
    </PageShell>
  );
}
