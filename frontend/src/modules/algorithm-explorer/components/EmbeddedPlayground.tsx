import React, { useEffect, useState } from 'react';
import { CircuitCanvas } from '../../gates-playground/components/CircuitCanvas';
import { useCircuitState } from '../../gates-playground/hooks/useCircuitState';
import { useSimulationApi } from '../../gates-playground/hooks/useSimulationApi';
import { GateTray } from '../../gates-playground/components/GateTray';
import { HistogramChart } from '../../gates-playground/components/HistogramChart';
import { StatevectorTable } from '../../gates-playground/components/StatevectorTable';
import { DndContext } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Play, RotateCcw, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmbeddedPlaygroundProps {
  initialQubits?: number;
  initialGates?: any[];
  algorithmId: string;
  algorithmName?: string;
}

export const EmbeddedPlayground: React.FC<EmbeddedPlaygroundProps> = ({ 
  initialQubits = 2, 
  initialGates = [], 
  algorithmId,
  algorithmName 
}) => {
  const { 
    qubits, setQubits, cbits, setCbits, gates, setGates, updateGate, removeGate, addGate 
  } = useCircuitState(initialQubits);
  
  const { simulate, result, loading, clearResult } = useSimulationApi();
  const [activeTab, setActiveTab] = useState<'histogram' | 'statevector'>('histogram');

  // Initialize gates
  useEffect(() => {
    if (initialGates && initialGates.length > 0) {
      setGates(initialGates);
      setQubits(initialQubits);
      setCbits(initialQubits);
    }
  }, [algorithmId]);

  const handleRun = () => {
    simulate(qubits, cbits, gates);
  };

  const handleClear = () => {
    setGates([]);
    clearResult();
  };

  const handleReset = () => {
    setGates(initialGates || []);
    setQubits(initialQubits);
    setCbits(initialQubits);
    clearResult();
  };

  const placeGate = (name: string, qubitIndex: number, stepIndex: number) => {
    let controlQubit: number | undefined = undefined;
    if (['CNOT', 'CZ', 'CP', 'CY', 'SWAP', 'CTRL'].includes(name.toUpperCase())) {
      controlQubit = qubitIndex > 0 ? qubitIndex - 1 : qubitIndex + 1;
      if (controlQubit !== undefined && controlQubit >= qubits) {
        controlQubit = undefined;
      }
    }

    addGate({
      id: `${name}-${Date.now()}`,
      name: name.toUpperCase() === 'CTRL' ? 'CNOT' : name,
      target: qubitIndex,
      control: controlQubit,
      step: stepIndex
    });
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

  return (
    <div className="my-8 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 m-0">Interactive Playground</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 mr-4">
            <div className="flex items-center gap-1 text-sm bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
              <span className="px-2 text-slate-500 dark:text-zinc-400 font-medium">Qubits</span>
              <button onClick={() => setQubits(Math.max(1, qubits - 1))} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-700 rounded shadow-sm hover:bg-slate-50 text-slate-700 dark:text-slate-200">-</button>
              <span className="w-4 text-center font-medium text-slate-700 dark:text-slate-200">{qubits}</span>
              <button onClick={() => setQubits(Math.min(8, qubits + 1))} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-700 rounded shadow-sm hover:bg-slate-50 text-slate-700 dark:text-slate-200">+</button>
            </div>
          </div>
          <div className="flex gap-2">
          <button 
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button 
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button 
            onClick={handleRun}
            disabled={loading || gates.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3.5 h-3.5" fill="currentColor" /> {loading ? 'Running...' : 'Run Circuit'}
          </button>
          </div>
        </div>
      </div>

      <div className="p-4 overflow-x-auto min-h-[300px]">
        <DndContext onDragEnd={handleDragEnd}>
          <CircuitCanvas
            qubits={qubits}
            cbits={cbits}
            gates={gates}
            addGate={addGate}
            updateGate={updateGate}
            removeGate={removeGate}
          />
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800">
            <h4 className="text-sm font-semibold text-slate-500 dark:text-zinc-500 mb-3 uppercase tracking-wider">Gate Palette</h4>
            <GateTray />
          </div>
        </DndContext>
      </div>

      {result && (
        <div className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex border-b border-slate-200 dark:border-zinc-800 px-4 pt-2">
            <button 
              className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'histogram' ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300")}
              onClick={() => setActiveTab('histogram')}
            >
              Measurements (Counts)
            </button>
            <button 
              className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'statevector' ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300")}
              onClick={() => setActiveTab('statevector')}
            >
              Statevector
            </button>
          </div>
          <div className="p-6">
            {activeTab === 'histogram' && result.probabilities && (
              <div className="h-64"><HistogramChart probabilities={result.probabilities} /></div>
            )}
            {activeTab === 'statevector' && result.statevector && (
              <StatevectorTable statevector={result.statevector} />
            )}
          </div>
        </div>
      )}
      
      {/* TEMP(Qrious): full playground link hidden */ false && <div className="flex justify-end border-t border-slate-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
        <button 
          onClick={() => {
            sessionStorage.setItem('qrious_playground_algorithm_transfer', JSON.stringify({
              qubits,
              cbits,
              gates,
              timestamp: Date.now(),
              context: algorithmName || algorithmId
            }));
            window.location.href = '/playground';
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 px-6 rounded-lg transition-all shadow-md hover:shadow-lg hover:shadow-emerald-500/20 inline-flex items-center gap-2 transform hover:-translate-y-0.5"
        >
          <ExternalLink size={16} /> Run in Full Playground
        </button>
      </div>}
    </div>
  );
};
