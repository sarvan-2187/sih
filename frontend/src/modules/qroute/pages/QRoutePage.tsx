import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CircuitCanvas } from '../../gates-playground/components/CircuitCanvas';
import { GateTray } from '../../gates-playground/components/GateTray';
import { MonacoEditorPanel } from '../../gates-playground/components/MonacoEditorPanel';
import { useCircuitState } from '../../gates-playground/hooks/useCircuitState';
import { useQasmApi } from '../../gates-playground/hooks/useQasmApi';
import { gatesToQasm } from '../../gates-playground/utils/qasmParser';
import { useQRouteApi } from '../hooks/useQRouteApi';
import type { QRouteDevice, QRouteJob, QRouteProvider, Modality } from '../hooks/useQRouteApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FaAtom, FaSatelliteDish, FaCircleNotch } from 'react-icons/fa';

const QASM_SYNC_DEBOUNCE_MS = 400;
const POLL_INTERVAL_MS = 3000;

const MODALITY_LABEL: Record<Modality, string> = {
  superconducting: 'Superconducting',
  'trapped-ion': 'Trapped-ion',
  aggregator: 'Aggregator (mixed hardware)',
};

// Fixed display order — aggregators last, since their devices already show
// up individually tagged under superconducting/trapped-ion above them.
const MODALITY_ORDER: Modality[] = ['superconducting', 'trapped-ion', 'aggregator'];

type SubmitState = 'idle' | 'submitting' | 'polling' | 'success' | 'error';

const QRoutePage: React.FC = () => {
  const { qubits, setQubits, cbits, setCbits, gates, addGate, setGates, qasm, updateQasm, updateGate, removeGate, expandMacroGate } =
    useCircuitState(2);  // same 2q/2c starting circuit as Gates Playground
  const { exportQasm, importQasm } = useQasmApi();
  const location = useLocation();
  const navigate = useNavigate();
  const { listProviders, listDevices, submitJob, getJobStatus, listJobs, error: apiError } = useQRouteApi();

  const [qasmError, setQasmError] = useState<string | null>(null);
  const isQasmEdit = useRef(false);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [providers, setProviders] = useState<QRouteProvider[]>([]);
  const [devices, setDevices] = useState<QRouteDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string>(''); // `${provider}::${device.id}`
  const [shots, setShots] = useState(100);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<QRouteJob | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [jobHistory, setJobHistory] = useState<QRouteJob[]>([]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  // Load providers + devices once on mount — mirrors Gates Playground's
  // qBraid panel, just eagerly instead of behind a toggle, since this page's
  // whole purpose is picking a provider/device.
  useEffect(() => {
    (async () => {
      try {
        const [provs, devs] = await Promise.all([listProviders(), listDevices()]);
        setProviders(provs);
        setDevices(devs);
        if (devs.length > 0) setSelectedDeviceKey(`${devs[0].provider}::${devs[0].id}`);
      } catch {
        // listProviders/listDevices already record the error in the hook's
        // own `error` state; nothing extra to do here.
      } finally {
        setDevicesLoading(false);
      }
    })();
    listJobs().then(setJobHistory).catch(() => {});
  }, []);

  // A circuit handed over by Gates Playground's "Real Hardware" button, as
  // OpenQASM in router state. Order against the sync effect below doesn't
  // matter: the import is async, so it always lands after the mount pass and
  // replaces the empty-circuit default.
  useEffect(() => {
    const handoffQasm = (location.state as { qasm?: string } | null)?.qasm;
    if (!handoffQasm) return;

    // Consume it once. Router state is persisted in history.state, so without
    // clearing it a refresh — or a Back into this page later — would silently
    // re-import the old circuit over whatever the user has built since.
    navigate('.', { replace: true, state: null });

    // Load it through the same importQasm the editor uses, and let `gates`
    // stay the source of truth: the sync effect below then regenerates the
    // QASM from the parsed gates, so canvas and editor can't disagree.
    importQasm(handoffQasm)
      .then(({ gates: parsedGates, numQubits, numCbits }) => {
        setGates(parsedGates);
        setQubits(numQubits);
        setCbits(numCbits);
      })
      .catch((err: any) => {
        // Canvas can't mirror it — don't lose the circuit. Drop the pending
        // empty-circuit export first, or it would land on top of this a moment
        // later. Deliberately NOT setting isQasmEdit: gates never changed, so
        // the sync effect stays idle until the user's next edit, and that edit
        // should regenerate the QASM normally.
        if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
        updateQasm(handoffQasm);
        setQasmError(
          err.response?.data?.detail || err.message ||
          'Could not rebuild this circuit on the canvas — the QASM is loaded, and you can still submit it.'
        );
      });
  }, []);

  // Same bi-directional gates<->QASM sync Gates Playground uses: instant
  // local preview via gatesToQasm, then a debounced call to the backend's
  // real Qiskit transpiler for the authoritative string.
  useEffect(() => {
    if (isQasmEdit.current) {
      isQasmEdit.current = false;
      return;
    }
    updateQasm(gatesToQasm(gates, qubits, cbits));
    setQasmError(null);

    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => {
      exportQasm(gates, qubits, cbits)
        .then((authoritativeQasm) => updateQasm(authoritativeQasm))
        .catch(() => {});
    }, QASM_SYNC_DEBOUNCE_MS);

    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, [gates, qubits, cbits]);

  const handleQasmChange = (value: string | undefined) => {
    isQasmEdit.current = true;
    const newQasm = value || '';
    updateQasm(newQasm);

    if (importTimerRef.current) clearTimeout(importTimerRef.current);
    importTimerRef.current = setTimeout(() => {
      importQasm(newQasm)
        .then(({ gates: parsedGates, numQubits, numCbits }) => {
          setQasmError(null);
          setGates(parsedGates);
          if (numQubits !== qubits) setQubits(numQubits);
          if (numCbits !== cbits) setCbits(numCbits);
        })
        .catch((err: any) => {
          setQasmError(err.response?.data?.detail || err.message || 'Invalid OpenQASM 2.0');
        });
    }, QASM_SYNC_DEBOUNCE_MS);
  };

  const handleAddQubit = () => setQubits((q) => Math.min(8, q + 1));
  const handleRemoveQubit = () => setQubits((q) => Math.max(1, q - 1));
  const handleAddCbit = () => setCbits((c) => Math.min(8, c + 1));
  const handleRemoveCbit = () => setCbits((c) => Math.max(0, c - 1));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handleAddQubit(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleRemoveQubit(); return; }
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handleAddCbit(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleRemoveCbit(); return; }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const { name, type } = active.data.current as any;
    const { qubitIndex, stepIndex } = over.data.current as any;
    if (type === 'new_gate') {
      let controlQubit: number | undefined = undefined;
      if (['CNOT', 'CZ', 'CP', 'CY', 'SWAP', 'CTRL'].includes(name.toUpperCase())) {
        controlQubit = qubitIndex > 0 ? qubitIndex - 1 : qubitIndex + 1;
        if (controlQubit !== undefined && controlQubit >= qubits) controlQubit = undefined;
      }
      addGate({
        id: `${name}-${Date.now()}`,
        name: name.toUpperCase() === 'CTRL' ? 'CNOT' : name,
        target: qubitIndex,
        control: controlQubit,
        step: stepIndex,
      });
    }
  };

  const selectedDevice = devices.find((d) => `${d.provider}::${d.id}` === selectedDeviceKey);

  const devicesByModality = MODALITY_ORDER.map((modality) => ({
    modality,
    devices: devices.filter((d) => d.modality === modality),
  })).filter((group) => group.devices.length > 0);

  const providerConfigured = (providerId: string) => providers.find((p) => p.id === providerId)?.is_configured ?? false;

  const handleSubmit = async () => {
    if (!selectedDevice) return;
    stopPolling();
    setSubmitState('submitting');
    setSubmitError(null);
    setActiveJob(null);
    try {
      const job = await submitJob(selectedDevice.provider, selectedDevice.id, qasm, shots);
      setActiveJob(job);
      setJobHistory((prev) => [job, ...prev]);
      setSubmitState('polling');
      pollTimerRef.current = setInterval(async () => {
        try {
          const updated = await getJobStatus(job.id);
          setActiveJob(updated);
          setJobHistory((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          if (updated.status === 'completed') {
            stopPolling();
            setSubmitState('success');
          } else if (updated.status === 'failed') {
            stopPolling();
            setSubmitState('error');
            setSubmitError(updated.error_message || 'The job failed.');
          }
        } catch (err: any) {
          stopPolling();
          setSubmitState('error');
          setSubmitError(err.response?.data?.detail || err.message || 'Lost connection while checking job status.');
        }
      }, POLL_INTERVAL_MS);
    } catch (err: any) {
      setSubmitState('error');
      setSubmitError(err.response?.data?.detail || err.message || 'Failed to submit job.');
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="theme-qp flex flex-col h-[calc(100vh-3.5rem)] overflow-auto bg-background text-foreground">
        <div className="px-6 pt-4 pb-2 shrink-0">
          <h1 className="text-xl font-sans font-semibold flex items-center gap-2">
            <FaAtom className="text-emerald-500" /> QRoute
          </h1>
          <p className="text-sm text-muted-foreground">
            Build a circuit once, submit it to real hardware across multiple quantum providers.
          </p>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-4 px-6 pb-6 min-h-[700px]">
          {/* Circuit builder — left, 8 cols */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 min-h-0">
            <Card size="sm" className="shrink-0">
              <CardContent className="flex items-center gap-3 py-2">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold leading-none">Qubits</span>
                  <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5 shadow-sm">
                    <button onClick={handleRemoveQubit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-background text-foreground transition-colors text-xs font-bold leading-none" title="Remove Qubit (Ctrl+Down)">-</button>
                    <span className="w-3 text-center text-xs font-medium leading-none">{qubits}</span>
                    <button onClick={handleAddQubit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-background text-foreground transition-colors text-xs font-bold leading-none" title="Add Qubit (Ctrl+Up)">+</button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-center mr-2 pr-4 border-r border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold leading-none">Cbits</span>
                  <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5 shadow-sm">
                    <button onClick={handleRemoveCbit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-background text-foreground transition-colors text-xs font-bold leading-none" title="Remove Cbit (Alt+Down)">-</button>
                    <span className="w-3 text-center text-xs font-medium leading-none">{cbits}</span>
                    <button onClick={handleAddCbit} className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-background text-foreground transition-colors text-xs font-bold leading-none" title="Add Cbit (Alt+Up)">+</button>
                  </div>
                </div>
                <GateTray />
              </CardContent>
            </Card>

            <Card className="flex-1 min-h-[360px] flex flex-col overflow-hidden">
              <div className="flex-1 relative overflow-auto custom-scrollbar">
                <CircuitCanvas
                  qubits={qubits}
                  cbits={cbits}
                  gates={gates}
                  addGate={addGate}
                  updateGate={updateGate}
                  removeGate={removeGate}
                  expandMacroGate={expandMacroGate}
                />
              </div>
            </Card>

            <Card size="sm" className="h-56 flex flex-col overflow-hidden shrink-0">
              <CardHeader className="py-2 border-b">
                <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  OpenQASM 2.0
                </CardTitle>
              </CardHeader>
              {qasmError && (
                <div className="px-4 py-1.5 text-[11px] font-mono text-destructive bg-destructive/10 border-b shrink-0 truncate" title={qasmError}>
                  {qasmError}
                </div>
              )}
              <div className="flex-1 min-h-0">
                <MonacoEditorPanel code={qasm} onChange={handleQasmChange} />
              </div>
            </Card>
          </div>

          {/* Composer + job history — right, 4 cols */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0">
            <Card size="sm" className="shrink-0">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FaSatelliteDish className="text-emerald-500" /> Submit to real hardware
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {devicesLoading ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <FaCircleNotch className="animate-spin" /> Loading providers &amp; devices...
                  </p>
                ) : devices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {/* The hook's own error, when there is one — a failed/timed-out
                        request used to land here as a misleading "check your
                        credentials" even in production, where they're fine. */}
                    {apiError ?? 'No quantum providers are available right now.'}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-auto custom-scrollbar pr-1">
                    {devicesByModality.map((group) => (
                      <div key={group.modality} className="space-y-1">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          {MODALITY_LABEL[group.modality]}
                        </p>
                        {group.devices.map((d) => {
                          const key = `${d.provider}::${d.id}`;
                          const providerName = providers.find((p) => p.id === d.provider)?.display_name ?? d.provider;
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedDeviceKey(key)}
                              className={cn(
                                'w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between transition-colors',
                                selectedDeviceKey === key
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-border hover:bg-muted'
                              )}
                            >
                              <span>
                                <span className="font-medium">{providerName}</span>{' '}
                                <span className="text-muted-foreground">· {d.name}</span>
                              </span>
                              <Badge variant={d.status === 'AVAILABLE' ? 'secondary' : 'outline'}>
                                {d.is_simulator ? 'sim' : d.status.toLowerCase()}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {providers.filter((p) => !p.is_configured).length > 0 && (
                      <div className="pt-1 space-y-1">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Not configured</p>
                        {providers.filter((p) => !p.is_configured).map((p) => (
                          <div key={p.id} className="px-2.5 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground flex justify-between">
                            <span>{p.display_name}</span>
                            <Badge variant="outline">not configured</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-muted-foreground">Shots</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={shots}
                    onChange={(e) => setShots(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-muted border border-border text-sm outline-none"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!selectedDevice || !providerConfigured(selectedDevice?.provider ?? '') || submitState === 'submitting' || submitState === 'polling'}
                  className="w-full py-2 rounded-lg bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 transition-all"
                >
                  {submitState === 'submitting'
                    ? 'Submitting...'
                    : submitState === 'polling'
                    ? `Running (${activeJob?.status ?? '...'})...`
                    : 'Submit'}
                </button>

                {submitState === 'polling' && activeJob?.status_detail && (
                  <p className="text-[11px] text-muted-foreground text-center">{activeJob.status_detail}</p>
                )}

                {submitState === 'polling' && activeJob && (
                  <Link to={`/qroute/jobs/${activeJob.id}`} className="block text-[11px] text-emerald-500 hover:underline text-center">
                    View job page &rarr;
                  </Link>
                )}

                {submitState === 'error' && submitError && (
                  <p className="text-[11px] font-mono text-destructive bg-destructive/10 rounded-lg p-2 break-words" title={submitError}>
                    {submitError}
                  </p>
                )}

                {submitState === 'success' && activeJob?.result && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Result</p>
                      <Link to={`/qroute/jobs/${activeJob.id}`} className="text-[11px] text-emerald-500 hover:underline">
                        Full report &rarr;
                      </Link>
                    </div>
                    <div className="max-h-32 overflow-auto text-xs font-mono space-y-0.5">
                      {Object.entries(activeJob.result).map(([bitstring, count]) => (
                        <div key={bitstring} className="flex justify-between">
                          <span>{bitstring}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card size="sm" className="h-64 shrink-0 flex flex-col overflow-hidden">
              <CardHeader className="py-2 border-b shrink-0">
                <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Job history
                </CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-1.5">
                  {jobHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No jobs submitted yet.</p>
                  ) : (
                    jobHistory.map((job) => {
                      const providerName = providers.find((p) => p.id === job.provider)?.display_name ?? job.provider;
                      return (
                        <Link
                          key={job.id}
                          to={`/qroute/jobs/${job.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-border text-xs flex items-center justify-between hover:bg-muted transition-colors"
                        >
                          <span>
                            <span className="font-medium">{providerName}</span>{' '}
                            <span className="text-muted-foreground">· {job.device_id}</span>
                          </span>
                          <Badge
                            variant={
                              job.status === 'completed' ? 'secondary' : job.status === 'failed' ? 'destructive' : 'outline'
                            }
                          >
                            {job.status}
                          </Badge>
                        </Link>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default QRoutePage;
