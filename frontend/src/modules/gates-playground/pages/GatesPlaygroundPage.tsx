import React, { useState, useEffect, useRef } from 'react';
import { DndContext } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CircuitCanvas } from '../components/CircuitCanvas';
import { useCircuitState } from '../hooks/useCircuitState';
import { useSimulationApi } from '../hooks/useSimulationApi';
import { HistogramChart } from '../components/HistogramChart';
import { MonacoEditorPanel } from '../components/MonacoEditorPanel';
import { ExecutionConsole } from '../components/ExecutionConsole';
import { StatevectorTable } from '../components/StatevectorTable';
import { GateTray } from '../components/GateTray';
import { CircuitCopilotSidebar } from '../components/CircuitCopilotSidebar';
import { useQriousCodeCircuit } from '@/features/qrious-code/QriousCode';
import { SchrodingerLauncher } from '../components/SchrodingerLauncher';
import { CatOverlay } from '../components/CatOverlay';
import type { CircuitContext } from '../hooks/useAiTutorApi';
import { useSidebar } from '@/components/ui/sidebar';
import { DebuggerPanel } from '../components/DebuggerPanel';
import { gatesToQasm, gatesToQiskit, qiskitToGates } from '../utils/qasmParser';
import { useCodeExecutionApi } from '../hooks/useCodeExecutionApi';
import { useQasmApi } from '../hooks/useQasmApi';
import { useQuantumExecuteApi } from '../hooks/useQuantumExecuteApi';
import { LanguageSelector } from '../components/LanguageSelector';
import type { Language } from '../components/LanguageSelector';
import { useAlgorithmApi } from '../../algorithm-explorer/hooks/useAlgorithmApi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { COPILOT_WIDTH } from '../constants/layout';

const QASM_SYNC_DEBOUNCE_MS = 400;
import { FaPlay, FaTrash, FaBug, FaSave, FaFolderOpen, FaDownload, FaUndo, FaRedo, FaExternalLinkAlt, FaSatelliteDish, FaBookOpen } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { qasmToGates } from '../utils/qasmParser';
import { SHORTCUTS, isEditableTarget } from '../utils/playgroundShortcuts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FaKeyboard } from 'react-icons/fa';

// Legacy per-page Circuit Copilot launcher + Schrodinger's-cat animation. Superseded by the
// app-wide Qrious Code panel (header button, see features/qrious-code). Switched off rather
// than deleted so it can be restored after the demo: set this to true.
const LEGACY_CIRCUIT_COPILOT_UI = false;

const QISKIT_BOILERPLATE = `from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator

# Create registers
q = QuantumRegister(2, 'q')
c = ClassicalRegister(2, 'c')
qc = QuantumCircuit(q, c)

# Build your circuit
qc.h(q[0])         # Hadamard on qubit 0
qc.cx(q[0], q[1])  # CNOT (entangle)
qc.measure(q, c)   # Measure all

# Run simulation
simulator = AerSimulator()
result = simulator.run(qc, shots=1024).result()
counts = result.get_counts()
print("Counts:", counts)
`;

interface GatesPlaygroundPageProps {
  initialQasm?: string;
  isEmbedded?: boolean;
}

const GatesPlaygroundPage: React.FC<GatesPlaygroundPageProps> = ({ initialQasm, isEmbedded = false }) => {
  const { 
    qubits, setQubits, cbits, setCbits, gates, addGate, setGates, qasm, updateQasm, updateGate, removeGate, expandMacroGate,
    commitHistory, undo, redo, historyIndex
  } = useCircuitState(2);
  
  const { simulate, result: simResult, loading: simLoading, clearResult } = useSimulationApi();
  const { loading: execLoading } = useCodeExecutionApi();
  const { exportQasm, importQasm } = useQasmApi();
  const { executeQuantum, debugQuantum, loading: quantumLoading } = useQuantumExecuteApi();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('openqasm2');
  const [pythonCode, setPythonCode] = useState(QISKIT_BOILERPLATE);
  const { getAlgorithm } = useAlgorithmApi();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugTrace, setDebugTrace] = useState<any[] | null>(null);
  const [qasmError, setQasmError] = useState<string | null>(null);
  const [selectedGateToPlace, setSelectedGateToPlace] = useState<string | null>(null);
  const [algorithmContext, setAlgorithmContext] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const { setOpen: setMainSidebarOpen } = useSidebar();
  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [isCatInCopilot, setIsCatInCopilot] = useState(false);
  const [copilotWidth, setCopilotWidth] = useState(COPILOT_WIDTH);


  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const gateAAnchorRef = useRef<HTMLDivElement | null>(null);
  const gateBAnchorRef = useRef<HTMLDivElement | null>(null);
  const copilotCatAnchorRef = useRef<HTMLDivElement | null>(null);

  const toggleAiTutor = () => {
    if (!aiTutorOpen) {
      setMainSidebarOpen(false);
      setAiTutorOpen(true);
    } else {
      setMainSidebarOpen(true);
      setAiTutorOpen(false);
      setIsCatInCopilot(false);
    }
  };

  const closeAiTutor = () => {
    setMainSidebarOpen(true);
    setAiTutorOpen(false);
    setIsCatInCopilot(false);
  };


  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from sessionStorage on mount
  useEffect(() => {
    const loadSavedState = () => {
      try {
        const transferData = sessionStorage.getItem('qrious_playground_algorithm_transfer');
        if (transferData) {
          const parsed = JSON.parse(transferData);
          setGates(parsed.gates || []);
          setQubits(parsed.qubits || 2);
          setCbits(parsed.cbits || 2);
          if (parsed.context) {
            setAlgorithmContext(parsed.context);
          }
          // Overwrite the standard save slot so React strict mode double-mounts
          // don't immediately revert to the old saved circuit.
          sessionStorage.setItem('qrious_playground_saved_circuit', JSON.stringify({
            gates: parsed.gates || [],
            qubits: parsed.qubits || 2,
            cbits: parsed.cbits || 2,
            timestamp: Date.now()
          }));
          sessionStorage.removeItem('qrious_playground_algorithm_transfer');
          return;
        }

        const savedData = sessionStorage.getItem('qrious_playground_saved_circuit');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          setGates(parsed.gates || []);
          setQubits(parsed.qubits || 2);
          setCbits(parsed.cbits || 2);
          if (parsed.qasm) updateQasm(parsed.qasm);
        }
      } catch (err) {
        console.error('Failed to load saved circuit', err);
      }
    };
    
    const algorithmSlug = searchParams.get('algorithm');
    if (algorithmSlug) {
      getAlgorithm(algorithmSlug).then((alg) => {
        if (alg.example_circuit) {
          setGates(alg.example_circuit.gates || []);
          setQubits(alg.example_circuit.num_qubits || 2);
          setCbits(alg.example_circuit.num_cbits || 2);
          setAlgorithmContext(alg.name);
        }
      }).catch(err => {
        console.error('Failed to load algorithm circuit from URL param', err);
        loadSavedState(); // fallback
      });
    } else {
      loadSavedState();
    }
  }, [searchParams, getAlgorithm]);

  const handleUndo = () => {
    const prev = undo();
    if (prev) isQasmEdit.current = true; // prevent automatic QASM sync triggering
  };

  const handleRedo = () => {
    const next = redo();
    if (next) isQasmEdit.current = true;
  };

  // Save Handler — language-aware
  const handleSave = () => {
    try {
      if (selectedLanguage === 'openqasm2') {
        const savedData = { qasm, gates, qubits, cbits, timestamp: Date.now() };
        sessionStorage.setItem('qrious_playground_saved_circuit', JSON.stringify(savedData));
      } else {
        sessionStorage.setItem('qrious_playground_saved_python', pythonCode);
      }
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to save', err);
    }
  };

  // Export Handler — .qasm for QASM, .py for Qiskit
  // Hands the current circuit to QRoute, which owns every real-hardware
  // provider. It travels as OpenQASM in router state — the interchange format
  // both pages already round-trip through — rather than by moving either page:
  // /qroute and /qroute/jobs/:id keep their URLs, so the links in job-completion
  // emails (backend/services/qroute_notifier.py) keep resolving.
  //
  // Always QASM, whatever the editor is currently showing: `gates` is the
  // source of truth in every language mode, and providers only take QASM.
  const handleSendToHardware = () => {
    navigate('/qroute', { state: { qasm: qasm || gatesToQasm(gates, qubits, cbits) } });
  };

  const handleExport = () => {
    let content: string;
    let filename: string;
    if (selectedLanguage === 'openqasm2') {
      content = qasm || gatesToQasm(gates, qubits, cbits);
      filename = `circuit_${Date.now()}.qasm`;
    } else {
      content = pythonCode;
      filename = `circuit_${Date.now()}.py`;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Handler (file upload)
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      if (selectedLanguage === 'openqasm2') {
        // QASM import: sync to gates as before
        isQasmEdit.current = true;
        updateQasm(content);
        try {
          const parsed = qasmToGates(content);
          setGates(parsed.gates);
          setQubits(parsed.numQubits);
          setCbits(parsed.numCbits);
          setQasmError(null);
        } catch (err) {
          console.error('Local QASM parse error', err);
        }
      } else {
        // Python import: just load into the python editor
        setPythonCode(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddQubit = () => setQubits(q => Math.min(8, q + 1));
  const handleRemoveQubit = () => {
    setQubits(q => {
      const nextQ = Math.max(1, q - 1);
      setGates(prev => prev.filter(g => g.target < nextQ && (g.control === undefined || g.control < nextQ)));
      return nextQ;
    });
  };
  const handleAddCbit = () => setCbits(c => Math.min(8, c + 1));
  const handleRemoveCbit = () => {
    setCbits(c => {
      const nextC = Math.max(0, c - 1);
      setGates(prev => prev.filter(g => g.name !== 'MEASURE' || g.target < nextC));
      return nextC;
    });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSave();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      if (e.key === 'Escape') {
        setSelectedGateToPlace(null);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handleAddQubit(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleRemoveQubit(); return; }
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handleAddCbit(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleRemoveCbit(); return; }
      }

      const keyStr = [
        e.ctrlKey || e.metaKey ? 'ctrl+' : '',
        e.altKey ? 'alt+' : '',
        e.shiftKey ? 'shift+' : '',
        e.key.toLowerCase()
      ].join('');

      const matched = SHORTCUTS[keyStr];
      if (matched) {
        e.preventDefault();
        setSelectedGateToPlace(prev => prev === matched.gate ? null : matched.gate);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, qasm, gates, qubits, cbits]);

  const [execResult, setExecResult] = useState<{ stdout: string; stderr: string; exitCode: number | null }>({
    stdout: '',
    stderr: '',
    exitCode: null
  });

  const isQasmEdit = React.useRef(false);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bi-directional Sync: Gates -> Code
  useEffect(() => {
    if (selectedLanguage === 'cirq') return;

    if (isQasmEdit.current) {
      isQasmEdit.current = false;
      return;
    }

    if (selectedLanguage === 'openqasm2') {
      updateQasm(gatesToQasm(gates, qubits, cbits));
      setQasmError(null);

      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      exportTimerRef.current = setTimeout(() => {
        exportQasm(gates, qubits, cbits, 'openqasm2')
          .then((authoritativeQasm) => updateQasm(authoritativeQasm))
          .catch(() => { /* keep local preview */ });
      }, QASM_SYNC_DEBOUNCE_MS);
    } else if (selectedLanguage === 'qiskit') {
      setPythonCode(gatesToQiskit(gates, qubits, cbits));
      setQasmError(null);

      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      exportTimerRef.current = setTimeout(() => {
        exportQasm(gates, qubits, cbits, 'qiskit')
          .then((authoritativeCode) => setPythonCode(authoritativeCode))
          .catch(() => { /* keep local preview */ });
      }, QASM_SYNC_DEBOUNCE_MS);
    }

    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, [gates, qubits, cbits, selectedLanguage]);

  const handleQasmChange = (value: string | undefined) => {
    isQasmEdit.current = true;
    const newQasm = value || '';
    updateQasm(newQasm);

    if (importTimerRef.current) clearTimeout(importTimerRef.current);
    importTimerRef.current = setTimeout(() => {
      importQasm(newQasm, 'openqasm2')
        .then(({ gates: parsedGates, numQubits, numCbits }) => {
          setQasmError(null);
          setGates(parsedGates);
          if (numQubits !== qubits) setQubits(numQubits);
          if (numCbits !== cbits) setCbits(numCbits);
          commitHistory(parsedGates, numQubits, numCbits, newQasm);
        })
        .catch((err: any) => {
          setQasmError(err.response?.data?.detail || err.message || 'Invalid OpenQASM 2.0');
        });
    }, QASM_SYNC_DEBOUNCE_MS);
  };

  const handleQiskitChange = (value: string | undefined) => {
    isQasmEdit.current = true;
    const newCode = value || '';
    setPythonCode(newCode);

    if (importTimerRef.current) clearTimeout(importTimerRef.current);
    importTimerRef.current = setTimeout(() => {
      importQasm(newCode, 'qiskit')
        .then(({ gates: parsedGates, numQubits, numCbits }) => {
          setQasmError(null);
          setGates(parsedGates);
          if (numQubits !== qubits) setQubits(numQubits);
          if (numCbits !== cbits) setCbits(numCbits);
          commitHistory(parsedGates, numQubits, numCbits, qasm);
        })
        .catch(() => {
          try {
            const res = qiskitToGates(newCode);
            setQasmError(null);
            setGates(res.gates);
            if (res.numQubits !== qubits) setQubits(res.numQubits);
            if (res.numCbits !== cbits) setCbits(res.numCbits);
            commitHistory(res.gates, res.numQubits, res.numCbits, qasm);
          } catch (err: any) {
            setQasmError('Invalid Qiskit Python code');
          }
        });
    }, QASM_SYNC_DEBOUNCE_MS);
  };

  const validateEmptyCircuit = () => {
    if (gates.length === 0) {
      import('sonner').then(module => {
        module.toast.error("No gates in the circuit. Add at least one gate before running or debugging.");
      });
      return false;
    }
    return true;
  };

  const handleRun = async () => {
    if (selectedLanguage === 'cirq') return;
    if (!validateEmptyCircuit()) return;

    setDebugTrace(null);

    try {
      // Simulate circuit graphically (histogram / statevector) for both openqasm2 and qiskit
      await simulate(qubits, cbits, gates);

      if (selectedLanguage === 'openqasm2') {
        const result = await executeQuantum('openqasm2', qasm, 1024);
        if (result.success && result.results) {
          const { counts, executionTime } = result.results;
          const countsStr = Object.entries(counts)
            .map(([k, v]) => `  '${k}': ${v}`)
            .join('\n');
          setExecResult({
            stdout: `Execution successful! (${executionTime.toFixed(0)} ms)\nCounts:\n${countsStr || '  (none)'}`,
            stderr: '',
            exitCode: 0,
          });
        } else {
          setExecResult({ stdout: '', stderr: result.error ?? 'Execution failed', exitCode: 1 });
        }
      } else {
        // Qiskit Python mode — run the python code
        const result = await executeQuantum('qiskit', pythonCode, 1024);
        if (result.success && result.results) {
          const { counts, executionTime } = result.results;
          const countsStr = Object.entries(counts)
            .map(([k, v]) => `  '${k}': ${v}`)
            .join('\n');
          setExecResult({
            stdout: `Execution successful! (${executionTime.toFixed(0)} ms)\nCounts:\n${countsStr || '  (none — check your code prints/measures)'}`,
            stderr: '',
            exitCode: 0,
          });
        } else {
          const errLine = result.errorLine ? ` (line ${result.errorLine})` : '';
          setExecResult({ stdout: '', stderr: `${result.error ?? 'Execution failed'}${errLine}`, exitCode: 1 });
        }
      }
    } catch (err: any) {
      console.error(err);
      setExecResult({ stdout: '', stderr: err.message || 'Execution failed', exitCode: 1 });
    }
  };

  const handleDebugRun = async () => {
    if (selectedLanguage === 'cirq') return;
    if (!validateEmptyCircuit()) return;

    if (isDebugMode) {
      setIsDebugMode(false);
      setDebugTrace(null);
      return;
    }

    // Use the correct code for the active language
    const codeToDebug = selectedLanguage === 'openqasm2' ? qasm : pythonCode;
    setIsDebugMode(true);
    setDebugTrace(null);

    const result = await debugQuantum(selectedLanguage, codeToDebug);
    if (result.success && result.trace) {
      setDebugTrace(result.trace);
      const summary = result.trace
        .map(s => `Step ${s.step} (ln ${s.line}): ${s.operation}`)
        .join('\n');
      setExecResult({ stdout: `Debug trace (${result.trace.length} steps):\n${summary}`, stderr: '', exitCode: 0 });
      setTimeout(() => {
        document.getElementById('debug-panel-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const errLine = result.errorLine ? ` (line ${result.errorLine})` : '';
      setExecResult({ stdout: '', stderr: `${result.error ?? 'Debug failed'}${errLine}`, exitCode: 1 });
    }
  };

  const handleClear = () => {
    setGates([]);
    clearResult();
    setDebugTrace(null);
    setExecResult({ stdout: '', stderr: '', exitCode: null });
    commitHistory([], qubits, cbits, '');
  };

  const placeGate = (name: string, qubitIndex: number, stepIndex: number) => {
    let controlQubit: number | undefined = undefined;
    if (['CNOT', 'CZ', 'CP', 'CY', 'SWAP', 'CTRL'].includes(name.toUpperCase())) {
      controlQubit = qubitIndex > 0 ? qubitIndex - 1 : qubitIndex + 1;
      // Ensure control doesn't exceed available qubits
      if (controlQubit !== undefined && controlQubit >= qubits) {
        controlQubit = undefined; // Need at least 2 qubits
      }
    }

    addGate({
      id: `${name}-${Date.now()}`,
      name: name.toUpperCase() === 'CTRL' ? 'CNOT' : name, // default CTRL to CNOT
      target: qubitIndex,
      control: controlQubit,
      step: stepIndex
    });
    
    // Clear selection after placing
    setSelectedGateToPlace(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const { name, type } = active.data.current as any;
    const { qubitIndex, stepIndex } = over.data.current as any;

    if (type === 'new_gate') {
      placeGate(name, qubitIndex, stepIndex);
    }
  };

  const currentCircuitContext: CircuitContext = {
    qasm,
    qubits,
    cbits,
    gateCount: gates.length,
    selectedGate: selectedGateToPlace,
    executionResult: simResult || execResult,
    executionError: execResult.stderr || qasmError,
  };

  // Applies AI-suggested OpenQASM back into the circuit (shared by Qrious Code).
  const applyAiCode = (code: string) => {
    isQasmEdit.current = true;
    updateQasm(code);
    try {
      const parsed = qasmToGates(code);
      setGates(parsed.gates);
      if (parsed.numQubits !== qubits) setQubits(parsed.numQubits);
      if (parsed.numCbits !== cbits) setCbits(parsed.numCbits);
      setQasmError(null);
    } catch (err) {
      console.error('Failed to parse AI suggested QASM', err);
    }
  };

  // Lets the global Qrious Code panel see this circuit and apply code into it.
  useQriousCodeCircuit(currentCircuitContext, applyAiCode);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className={cn("flex flex-row w-full bg-qp-bg text-qp-text font-sans", isEmbedded ? "h-auto overflow-visible" : "h-[calc(100vh-3.5rem)] overflow-hidden")}>
      <div tabIndex={-1} className={cn("flex flex-1 min-w-0 flex-col font-sans outline-none bg-qp-bg text-qp-text", isEmbedded ? "h-auto overflow-visible" : "h-full overflow-auto custom-scrollbar")}>
        
        {/* Algorithm Context Banner */}
        <AnimatePresence>
          {algorithmContext && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <FaExternalLinkAlt size={12} />
                <span>Exploring: <strong className="text-emerald-300">{algorithmContext}</strong></span>
              </div>
              <button 
                onClick={() => setAlgorithmContext(null)}
                className="text-emerald-400/70 hover:text-emerald-400 p-1"
              >
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Bar Wrapper */}
        <div className="pt-4 px-6 pb-2 shrink-0 z-10 w-full flex items-center">
          <div className="flex-1 min-w-0 flex items-center justify-between bg-qp-card border border-qp-border rounded-2xl p-2.5 shadow-xl gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[10px] text-qp-text/70 uppercase tracking-wider font-semibold leading-none">Qubits</span>
                    <div className="flex items-center gap-1 bg-qp-card border border-qp-border rounded-lg p-0.5 shadow-sm">
                      <button onClick={handleRemoveQubit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-qp-hover text-qp-text transition-colors text-xs font-bold leading-none" title="Remove Qubit (Ctrl+Down)">-</button>
                      <span className="w-3 text-center text-xs font-medium leading-none">{qubits}</span>
                      <button onClick={handleAddQubit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-qp-hover text-qp-text transition-colors text-xs font-bold leading-none" title="Add Qubit (Ctrl+Up)">+</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-center mr-2 pr-4 border-r border-qp-border">
                    <span className="text-[10px] text-qp-text/70 uppercase tracking-wider font-semibold leading-none">Cbits</span>
                    <div className="flex items-center gap-1 bg-qp-card border border-qp-border rounded-lg p-0.5 shadow-sm">
                      <button onClick={handleRemoveCbit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-qp-hover text-qp-text transition-colors text-xs font-bold leading-none" title="Remove Cbit (Alt+Down)">-</button>
                      <span className="w-3 text-center text-xs font-medium leading-none">{cbits}</span>
                      <button onClick={handleAddCbit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-qp-hover text-qp-text transition-colors text-xs font-bold leading-none" title="Add Cbit (Alt+Up)">+</button>
                    </div>
                  </div>
                  <GateTray 
                    selectedGateToPlace={selectedGateToPlace} 
                    onSelectGate={(name) => setSelectedGateToPlace(prev => prev === name ? null : name)} 
                  />
                </div>
                
                <div className="flex shrink-0 items-center gap-3">
                  {isEmbedded ? (
                    <div className="flex items-center gap-2 bg-qp-secondary/50 p-1.5 rounded-xl border border-qp-border">
                      <button 
                        onClick={handleRun}
                        disabled={simLoading || execLoading || quantumLoading || selectedLanguage === 'cirq'}
                        title="Run code simulation"
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-md transition-all active:scale-95 whitespace-nowrap",
                          (simLoading || execLoading || quantumLoading) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <FaPlay className="w-2.5 h-2.5 shrink-0" />
                        {simLoading || execLoading || quantumLoading ? 'Running...' : 'Run'}
                      </button>

                      <button 
                        onClick={handleDebugRun}
                        disabled={selectedLanguage === 'cirq' || quantumLoading}
                        title="Debug code with step-by-step trace"
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-xs border shadow-sm whitespace-nowrap",
                          isDebugMode 
                            ? "bg-purple-950/60 text-purple-200 border-purple-600" 
                            : "bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border"
                        )}
                      >
                        <FaBug className="w-3 h-3 text-purple-400" /> Debug
                      </button>

                      <button 
                        onClick={handleUndo} 
                        disabled={historyIndex <= 0}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm disabled:opacity-30 disabled:hover:bg-qp-card active:scale-95 whitespace-nowrap"
                        title="Undo (Ctrl+Z)"
                      >
                        <FaUndo className="w-2.5 h-2.5" /> Undo
                      </button>

                      <button 
                        onClick={handleRedo} 
                        disabled={historyIndex >= 100}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm disabled:opacity-30 disabled:hover:bg-qp-card active:scale-95 whitespace-nowrap"
                        title="Redo (Ctrl+Y)"
                      >
                        <FaRedo className="w-2.5 h-2.5" /> Redo
                      </button>

                      <button 
                        onClick={handleClear} 
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-destructive hover:text-destructive border-qp-border shadow-sm whitespace-nowrap"
                        title="Clear Circuit"
                      >
                        <FaTrash className="w-3 h-3" /> Clear
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 shrink-0 bg-qp-secondary/50 p-1.5 rounded-xl border border-qp-border">
                      <button onClick={handleSave} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm active:scale-95 whitespace-nowrap">
                        <FaSave className="w-3 h-3 text-emerald-400" /> {saveStatus || 'Save'}
                      </button>
                      <button onClick={handleClear} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text-muted hover:text-qp-text border-qp-border shadow-sm whitespace-nowrap">
                        <FaTrash className="w-3 h-3" /> Clear
                      </button>
                      <button onClick={handleDebugRun} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm whitespace-nowrap">
                        <FaBug className="w-3 h-3" /> Debug
                      </button>
                      <button onClick={handleImportClick} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm active:scale-95 whitespace-nowrap">
                        <FaFolderOpen className="w-3 h-3 text-amber-400" /> Import
                      </button>
                      <button onClick={handleRun} className="flex items-center justify-center gap-1.5 px-3 py-1 bg-qp-card text-qp-text rounded-lg font-medium transition-all text-xs shadow-sm border border-qp-border whitespace-nowrap">
                        <FaPlay className="w-2.5 h-2.5 shrink-0" /> Run
                      </button>
                      <button onClick={handleSendToHardware} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm whitespace-nowrap">
                        <FaSatelliteDish className="w-3 h-3 text-emerald-400" /> Real Hardware
                      </button>
                      <button onClick={handleExport} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm whitespace-nowrap">
                        <FaDownload className="w-3 h-3 text-blue-400" /> Export
                      </button>
                      <button onClick={handleUndo} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm whitespace-nowrap">
                        <FaUndo className="w-2.5 h-2.5" /> Undo
                      </button>
                      <button onClick={handleRedo} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-qp-text border-qp-border shadow-sm whitespace-nowrap">
                        <FaRedo className="w-2.5 h-2.5" /> Redo
                      </button>
                      <button
                        onClick={() => navigate('/quantum-library')}
                        className="col-span-3 flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all text-xs border bg-qp-card hover:bg-qp-hover text-emerald-500 border-qp-border shadow-sm active:scale-95 whitespace-nowrap"
                        title="Quantum Gate Library Reference"
                      >
                        <FaBookOpen className="w-3 h-3" /> Library
                      </button>
                    </div>
                  )}

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept=".qasm,.txt" 
                    className="hidden" 
                    onChange={handleFileImport} 
                  />
                </div>
              </div>
            </div>

            {/* Main Workspace Grid */}
            <div className="grid grid-cols-12 gap-4 px-6 pb-12 bg-qp-bg">
               
               {/* Top Left: Circuit Canvas (col span 8, row span 1) */}
               <div className="col-span-8 row-span-1 h-[380px] rounded-2xl border flex flex-col overflow-hidden shadow-xl transition-colors bg-qp-card border-qp-border min-h-0">
                 <div className="flex-1 relative overflow-auto custom-scrollbar">
                   <CircuitCanvas 
                     qubits={qubits} 
                     cbits={cbits} 
                     gates={gates} 
                     addGate={addGate} 
                     updateGate={updateGate} 
                     removeGate={removeGate} 
                     expandMacroGate={expandMacroGate}
                     selectedGateToPlace={selectedGateToPlace}
                     onPlaceGate={placeGate}
                   />
                 </div>
               </div>
               
               {/* Top Right: Monaco Editor (col span 4, row span 1) */}
               <div className="col-span-4 row-span-1 h-[380px] rounded-2xl border flex flex-col overflow-hidden shadow-xl transition-colors bg-qp-card border-qp-border min-h-0">
                  <div className="px-3 py-2 flex items-center justify-between border-b bg-qp-secondary border-qp-border z-10 relative shrink-0">
                    <LanguageSelector
                      selectedLanguage={selectedLanguage}
                      onLanguageChange={(lang) => {
                        setSelectedLanguage(lang);
                        setQasmError(null);
                        setExecResult({ stdout: '', stderr: '', exitCode: null });
                        setDebugTrace(null);
                        if (lang === 'qiskit') {
                          setPythonCode(gatesToQiskit(gates, qubits, cbits));
                        } else if (lang === 'openqasm2') {
                          updateQasm(gatesToQasm(gates, qubits, cbits));
                        }
                      }}
                    />
                  </div>
                  {qasmError && (
                    <div className="px-4 py-2 text-[11px] font-mono text-destructive bg-destructive/10 border-b border-qp-border shrink-0 truncate" title={qasmError}>
                      {qasmError}
                    </div>
                  )}
                  <div className="flex-1 bg-transparent relative -mt-1 min-h-0">
                    <MonacoEditorPanel
                      code={selectedLanguage === 'openqasm2' ? qasm : pythonCode}
                      onChange={
                        selectedLanguage === 'openqasm2'
                          ? handleQasmChange
                          : selectedLanguage === 'qiskit'
                          ? handleQiskitChange
                          : (v) => { if (v !== undefined) setPythonCode(v); }
                      }
                      language={selectedLanguage === 'qiskit' || selectedLanguage === 'cirq' ? 'python' : 'qasm'}
                    />
                  </div>
                </div>
      
               {/* Bottom Left: Histogram (col span 4, row span 1) */}
               <div className="col-span-4 row-span-1 h-[320px] rounded-2xl border p-4 flex flex-col shadow-xl transition-colors bg-qp-card border-qp-border min-h-0">
                 <h3 className="text-[11px] font-mono uppercase tracking-widest mb-3 text-qp-text-muted shrink-0">Probability Distribution</h3>
                 <div className="flex-1 min-h-0 relative">
                   {simResult ? (
                     <HistogramChart probabilities={simResult.probabilities} />
                   ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-sm border border-dashed rounded-xl border-qp-border/60 bg-qp-secondary/40 text-qp-text-muted">
                       <span className="opacity-50">Run circuit to view distribution</span>
                     </div>
                   )}
                 </div>
               </div>
               
               {/* Bottom Middle: Statevector (col span 4, row span 1) */}
               <div className="col-span-4 row-span-1 h-[320px] rounded-2xl border p-4 flex flex-col shadow-xl transition-colors bg-qp-card border-qp-border min-h-0">
                  <h3 className="text-[11px] font-mono uppercase tracking-widest mb-3 text-qp-text-muted shrink-0">State Visualization</h3>
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    {simResult && simResult.statevector ? (
                      <StatevectorTable statevector={simResult.statevector} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-sm border border-dashed rounded-xl border-qp-border/60 bg-qp-secondary/40 text-qp-text-muted">
                         <span className="opacity-50">Run circuit to view statevector</span>
                      </div>
                    )}
                  </div>
               </div>
               
               {/* Bottom Right: Execution Console (col span 4, row span 1) */}
               <div className="col-span-4 row-span-1 h-[320px] rounded-2xl border flex flex-col overflow-hidden shadow-xl transition-colors bg-qp-card border-qp-border min-h-0 relative">
                 <div className="px-4 py-3 text-[11px] font-mono tracking-widest uppercase flex justify-between items-center border-b bg-qp-secondary border-qp-border text-qp-text-muted shrink-0">
                   <span>Execution Console</span>
                 </div>
                 <div className="flex-1 min-h-0 relative p-4 font-mono text-[13px] leading-relaxed bg-transparent">
                   <ExecutionConsole 
                     stdout={execResult.stdout} 
                     stderr={execResult.stderr} 
                     exitCode={execResult.exitCode} 
                   />
                 </div>

               </div>
               
             </div>

          {(isDebugMode || debugTrace) && (
            <div id="debug-panel-container" className="p-8 bg-qp-bg border-t border-qp-border shrink-0 min-h-[600px] pb-16">
              {(selectedLanguage === 'openqasm2' || selectedLanguage === 'qiskit') && gates.length > 0 && (
                <DebuggerPanel qubits={qubits} cbits={cbits} gates={gates} onExitDebug={() => { setIsDebugMode(false); setDebugTrace(null); }} />
              )}
              {debugTrace && debugTrace.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-[11px] font-mono uppercase tracking-widest text-qp-text-muted mb-4">Step-by-Step Trace</h3>
                  {debugTrace.map((step: any) => (
                    <div key={step.step} className="flex items-start gap-3 p-3 rounded-xl border border-qp-border bg-qp-card text-xs font-mono">
                      <span className="text-emerald-400 shrink-0 w-14">Step {step.step}</span>
                      <span className="text-qp-text-muted shrink-0 w-12">ln {step.line}</span>
                      <span className="text-violet-300 flex-1">{step.operation}</span>
                      <span className="text-qp-text-muted text-[10px]">{step.timestamp.toFixed(3)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legacy Circuit Copilot UI, now served app-wide by Qrious Code. Restore: LEGACY_CIRCUIT_COPILOT_UI = true. */}
        {LEGACY_CIRCUIT_COPILOT_UI && (
        <>
        {/* Floating Action Button for AI Copilot */}
        <div className="fixed bottom-10 right-10 z-50">
          <SchrodingerLauncher anchorRef={launcherRef} onClick={toggleAiTutor} isOpen={aiTutorOpen} />
        </div>

        {/* Persistent Layout Anchors for Teleportation Geometry */}
        <div ref={gateAAnchorRef} className="fixed bottom-16 pointer-events-none w-0 h-0 z-0 bg-transparent" style={{ right: aiTutorOpen ? copilotWidth : COPILOT_WIDTH }} aria-hidden="true" />
        <div ref={gateBAnchorRef} className="fixed top-32 pointer-events-none w-0 h-0 z-0 bg-transparent" style={{ right: aiTutorOpen ? copilotWidth : COPILOT_WIDTH }} aria-hidden="true" />

        <CircuitCopilotSidebar
          anchorRef={copilotCatAnchorRef}
          isOpen={aiTutorOpen}
          onClose={closeAiTutor}
          circuitContext={currentCircuitContext}
          onApplyCode={applyAiCode}
          isCatInCopilot={isCatInCopilot}
          copilotWidth={copilotWidth}
          setCopilotWidth={setCopilotWidth}
        />
        
        <CatOverlay 
          isOpen={aiTutorOpen} 
          launcherAnchorRef={launcherRef} 
          gateAAnchorRef={gateAAnchorRef}
          gateBAnchorRef={gateBAnchorRef}
          copilotCatAnchorRef={copilotCatAnchorRef} 
          isCatInCopilot={isCatInCopilot}
          onCatArrived={() => setIsCatInCopilot(true)}
        />
        </>
        )}
      </div>
    </DndContext>
  );
};

export default GatesPlaygroundPage;
