import React, { useState, useRef, useEffect } from 'react';
import GIF from 'gif.js';
import type { QubitState, TrajectoryPoint, PulseParams } from './types/quantum';
import { CircuitCopilotSidebar } from '@/modules/gates-playground/components/CircuitCopilotSidebar';
import { useQriousCodeCircuit } from '@/features/qrious-code/QriousCode';
import { SchrodingerLauncher } from '@/modules/gates-playground/components/SchrodingerLauncher';
import { CatOverlay } from '@/modules/gates-playground/components/CatOverlay';
import { COPILOT_WIDTH } from '@/modules/gates-playground/constants/layout';
import type { CircuitContext } from '@/modules/gates-playground/hooks/useAiTutorApi';
import { useSidebar } from '@/components/ui/sidebar';
import {
  getInitialState,
  stateToBlochVector,
  createRotationOperator,
  createCustomAxisRotationOperator,
  createU3Operator,
  getGateOperator,
  applyUnitary,
  calculateRotationTrajectory,
  calculateOperatorTrajectory,
  applyRabiPulse
} from './utils/quantumMath';
import { BlochSphere3D } from './components/BlochSphere3D';
import { ControlPanels, type BlochSettings } from './components/ControlPanels';
import { TasksPanel } from './components/TasksPanel';
import { toast } from 'sonner';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

// Legacy per-page Circuit Copilot launcher + Schrodinger's-cat animation. Superseded by the
// app-wide Qrious Code panel (header button, see features/qrious-code). Switched off rather
// than deleted so it can be restored after the demo: set this to true.
const LEGACY_CIRCUIT_COPILOT_UI = false;

// Emerald action button — matching Qrious design language
function ActionBtn({
  id,
  onClick,
  disabled,
  children
}: {
  id: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-1.5 rounded-md text-white text-xs font-sans tracking-wide',
        'transition-all duration-300 active:scale-95 select-none shadow hover:shadow-emerald-500/25',
        disabled
          ? 'opacity-35 cursor-not-allowed bg-emerald-500/50'
          : 'bg-emerald-500 hover:bg-emerald-600'
      )}
    >
      {children}
    </button>
  );
}

export const BlochSphereVisualizer: React.FC = () => {
  const { theme } = useTheme();

  // Suppress harmless third-party library warnings that clutter the console
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === 'string') {
        if (args[0].includes('THREE.Clock: This module has been deprecated')) return;
        if (args[0].includes('Multiple readback operations using getImageData')) return;
      }
      originalWarn(...args);
    };
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  const [history, setHistory] = useState<QubitState[]>([getInitialState()]);
  const [trajectories, setTrajectories] = useState<TrajectoryPoint[]>([]);

  // GIF Export State
  const [isRecordingGif, setIsRecordingGif] = useState(false);
  const [isProcessingGif, setIsProcessingGif] = useState(false);
  const gifRef = useRef<GIF | null>(null);
  const gifFrameCountRef = useRef(0);

  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [isCatInCopilot, setIsCatInCopilot] = useState(false);
  const [copilotWidth, setCopilotWidth] = useState(COPILOT_WIDTH);

  const { setOpen: setMainSidebarOpen } = useSidebar();

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

  const handleApplyCode = (_code: string) => {
    toast.info("OpenQASM code application is only available in the Quantum Playground.");
  };

  const [settings, setSettings] = useState<BlochSettings>({
    spinColor: '#3b82f6',
    traceColor: '#1d4ed8',
    topStateText: '|0⟩',
    bottomStateText: '|1⟩',
    historyLength: 10,
    exportSize: 800
  });

  const [pulse, setPulse] = useState<PulseParams>({
    detuning: 0,
    phase: 0,
    amplitude: 1.0,
    pulseLength: 0.5
  });

  const currentState = history[history.length - 1];
  const blochVec = stateToBlochVector(currentState);

  const handleRotate = (axis: 'x' | 'y' | 'z', angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const rotOp = createRotationOperator(axis, angleRad);
    const newState = applyUnitary(rotOp, currentState);
    const newTrajectory = calculateRotationTrajectory(axis, angleRad, currentState, settings.traceColor);
    setHistory(prev => [...prev, newState]);
    setTrajectories(prev => [...prev, newTrajectory]);
    toast.success(`R_${axis.toUpperCase()}(${angleDeg}°)`);
  };

  const handleGate = (gate: 'H' | 'S' | 'Sdag' | 'T' | 'Tdag' | 'X' | 'Y' | 'Z') => {
    const operator = getGateOperator(gate);
    const newState = applyUnitary(operator, currentState);
    const newTrajectory = calculateOperatorTrajectory(operator, currentState, settings.traceColor);
    setHistory(prev => [...prev, newState]);
    setTrajectories(prev => [...prev, newTrajectory]);
    toast.success(`Gate: ${gate}`);
  };

  const handleCustomRotate = (polarDeg: number, azimuthalDeg: number, rotationDeg: number) => {
    const operator = createCustomAxisRotationOperator(polarDeg, azimuthalDeg, rotationDeg);
    const newState = applyUnitary(operator, currentState);
    const newTrajectory = calculateOperatorTrajectory(operator, currentState, settings.traceColor);
    setHistory(prev => [...prev, newState]);
    setTrajectories(prev => [...prev, newTrajectory]);
    toast.success(`Rotated ${rotationDeg}° around n̂`);
  };

  const handleUGate = (thetaDeg: number, phiDeg: number, lambdaDeg: number) => {
    const operator = createU3Operator(thetaDeg, phiDeg, lambdaDeg);
    const newState = applyUnitary(operator, currentState);
    const newTrajectory = calculateOperatorTrajectory(operator, currentState, settings.traceColor);
    setHistory(prev => [...prev, newState]);
    setTrajectories(prev => [...prev, newTrajectory]);
    toast.success(`U(${thetaDeg}°, ${phiDeg}°, ${lambdaDeg}°) applied`);
  };

  const handlePulse = (axis: 'x' | 'y') => {
    const newState = applyRabiPulse(
      axis,
      pulse.pulseLength,
      pulse.detuning,
      pulse.amplitude,
      pulse.phase,
      currentState
    );
    const operator = createRotationOperator(axis, 2 * Math.PI * pulse.amplitude * pulse.pulseLength);
    const newTrajectory = calculateOperatorTrajectory(operator, currentState, '#f59e0b');
    setHistory(prev => [...prev, newState]);
    setTrajectories(prev => [...prev, newTrajectory]);
    toast.success(`${axis.toUpperCase()}-axis Pulse applied`);
  };

  const handleUndo = () => {
    if (history.length > 1) {
      setHistory(prev => prev.slice(0, -1));
      setTrajectories(prev => prev.slice(0, -1));
      toast.info('Undid last operation');
    }
  };

  const handleReset = () => {
    setHistory([getInitialState()]);
    setTrajectories([]);
    toast.info('Reset to |0⟩');
  };



  const handleDownload = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `bloch-sphere-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('PNG downloaded');
    } else {
      toast.error('Canvas not found');
    }
  };

  const startGifRecording = () => {
    if (isRecordingGif) {
      if (gifRef.current && !isProcessingGif) {
        setIsProcessingGif(true);
        try {
          gifRef.current.render();
          toast.info('Processing GIF... this may take a moment.');
        } catch (e) {
          toast.error('Failed to process GIF.');
          setIsRecordingGif(false);
          setIsProcessingGif(false);
        }
      }
      return;
    }
    
    gifRef.current = new GIF({
      workers: 2,
      quality: 10,
      workerScript: '/gif.worker.js',
      background: theme === 'dark' ? '#09090b' : '#ffffff',
      transparent: null
    });

    gifRef.current.on('finished', (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bloch-sphere-animation-${Date.now()}.gif`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('GIF downloaded successfully!');
      setIsRecordingGif(false);
      setIsProcessingGif(false);
    });

    // Handle any potential errors to prevent UI lockup
    gifRef.current.on('abort', () => {
      toast.error('GIF generation aborted.');
      setIsRecordingGif(false);
      setIsProcessingGif(false);
    });

    gifFrameCountRef.current = 0;
    setIsRecordingGif(true);
    toast.info('Recording started! Apply gates now. Click "Stop Recording" when done.', { duration: 5000 });
  };

  const handleGifFrame = (canvas: HTMLCanvasElement) => {
    if (gifRef.current && isRecordingGif) {
      gifRef.current.addFrame(canvas, { delay: 50, copy: true });
      gifFrameCountRef.current += 1;

      // Safety limit: if someone records too long, auto-stop to prevent memory crash
      if (gifFrameCountRef.current >= 200) {
        startGifRecording(); // Auto-stop recording
        toast.info('Maximum GIF length reached. Stopping recording...');
      }
    }
  };

  const handleGifComplete = () => {
    if (gifRef.current) {
      gifRef.current.render();
      toast.info('Processing GIF... this may take a moment.');
    }
  };

  const currentCircuitContext: CircuitContext = {
    qasm: `// 3D Bloch Sphere Visualizer State\n// Qubit state: |ψ⟩ = (${currentState[0].re.toFixed(4)} + ${currentState[0].im.toFixed(4)}i)|0⟩ + (${currentState[1].re.toFixed(4)} + ${currentState[1].im.toFixed(4)}i)|1⟩\n// Bloch Vector: x=${blochVec.u.toFixed(4)}, y=${blochVec.v.toFixed(4)}, z=${blochVec.w.toFixed(4)}`,
    qubits: 1,
    cbits: 0,
    gateCount: history.length - 1,
  };

  // Lets the global Qrious Code panel see this circuit and apply code into it.
  useQriousCodeCircuit(currentCircuitContext, handleApplyCode);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div className={cn(
        "flex-1 overflow-y-auto transition-colors duration-300 py-12 px-6 md:px-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']",
        theme === 'dark' ? "text-white" : "text-zinc-900"
      )}>
        <div className="max-w-[1600px] mx-auto flex flex-col gap-12">

          {/* Hero Header §1.2 */}
          <div className="flex flex-col gap-4 max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-sans tracking-tight">
              3D Bloch Sphere Visualizer
            </h1>
            <p className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
              Explore single qubit states, apply standard quantum gates, custom axes rotations, and Rabi pulse simulations in interactive 3D.
            </p>
          </div>

          {/* ── Simulator card ── */}
          <div className={cn(
            "grid grid-cols-1 lg:grid-cols-[3fr_2fr] border rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all duration-300",
            theme === 'dark'
              ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50"
              : "bg-white border-zinc-200 hover:border-emerald-500/30"
          )}>

            {/* Left: sphere panel */}
            <div className={cn(
              "flex flex-col border-r min-w-0",
              theme === 'dark' ? "border-white/10" : "border-zinc-200"
            )}>

              {/* Top control bar */}
              <div className={cn(
                "flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0",
                theme === 'dark' ? "border-white/10" : "border-zinc-200"
              )}>
                <div className="flex items-center gap-2">
                  <ActionBtn id="bloch-init-btn" onClick={handleReset}>INIT</ActionBtn>
                  <ActionBtn id="bloch-undo-btn" onClick={handleUndo} disabled={history.length <= 1}>Undo</ActionBtn>
                </div>
                <div className="flex items-center gap-2">
                  <ActionBtn id="bloch-img-export" onClick={handleDownload} disabled={isRecordingGif || isProcessingGif}>
                    IMG Export
                  </ActionBtn>
                  <ActionBtn id="bloch-gif-export" onClick={startGifRecording} disabled={isProcessingGif}>
                    {isProcessingGif ? 'Processing...' : isRecordingGif ? 'Stop Recording' : 'Record GIF'}
                  </ActionBtn>
                </div>
              </div>

              {/* 3D Canvas — transparent bg so theme shows through */}
              <div className="flex-1 min-h-[460px] relative">
                <BlochSphere3D
                  blochVec={blochVec}
                  trajectories={trajectories}
                  spinColor={settings.spinColor}
                  traceColor={settings.traceColor}
                  topStateText={settings.topStateText}
                  bottomStateText={settings.bottomStateText}
                  historyLength={settings.historyLength}
                  isRecordingGif={isRecordingGif}
                  onGifFrame={handleGifFrame}
                  onGifComplete={handleGifComplete}
                  isDark={theme === 'dark'}
                  className="absolute inset-0"
                />
              </div>

              {/* Bottom bar */}
              <div className={cn(
                "flex items-center justify-end px-4 py-3 border-t shrink-0",
                theme === 'dark' ? "border-white/10" : "border-zinc-200"
              )}>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                  <span>x: <strong className="text-foreground tabular-nums">{blochVec.u.toFixed(3)}</strong></span>
                  <span>y: <strong className="text-foreground tabular-nums">{blochVec.v.toFixed(3)}</strong></span>
                  <span>z: <strong className="text-foreground tabular-nums">{blochVec.w.toFixed(3)}</strong></span>
                </div>
              </div>
            </div>

            {/* Right: controls accordion */}
            <div className="overflow-y-auto" style={{ maxHeight: '580px' }}>
              <ControlPanels
                onRotate={handleRotate}
                onGate={handleGate}
                onCustomRotate={handleCustomRotate}
                onUGate={handleUGate}
                onPulse={handlePulse}
                pulse={pulse}
                setPulse={setPulse}
                settings={settings}
                setSettings={setSettings}
              />
            </div>
          </div>

          {/* ── Tasks panel ── */}
          <TasksPanel />

          <p className="text-right text-[10px] text-muted-foreground/30 font-mono">
            quantlms · bloch sphere
          </p>
        </div>
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
        onClose={toggleAiTutor}
        circuitContext={currentCircuitContext}
        onApplyCode={handleApplyCode}
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
  );
};

export default BlochSphereVisualizer;
