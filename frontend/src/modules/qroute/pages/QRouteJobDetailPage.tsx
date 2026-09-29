import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import { useQRouteApi } from '../hooks/useQRouteApi';
import type { QRouteDevice, QRouteJob, QRouteProvider } from '../hooks/useQRouteApi';
import { HistogramChart } from '../../gates-playground/components/HistogramChart';
import { QCompareCard } from '../components/QCompareCard';
import { CircuitCanvas } from '../../gates-playground/components/CircuitCanvas';
import { qasmToGates } from '../../gates-playground/utils/qasmParser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FaArrowLeft, FaCircleNotch } from 'react-icons/fa';

const POLL_INTERVAL_MS = 3000;

const STATUS_VARIANT: Record<QRouteJob['status'], 'secondary' | 'destructive' | 'outline'> = {
  completed: 'secondary',
  failed: 'destructive',
  queued: 'outline',
  running: 'outline',
};

const formatTimestamp = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="text-sm">{value}</p>
  </div>
);

const QRouteJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { getJobStatus, listProviders, listDevices } = useQRouteApi();

  const [job, setJob] = useState<QRouteJob | null>(null);
  const [providers, setProviders] = useState<QRouteProvider[]>([]);
  const [device, setDevice] = useState<QRouteDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const latest = await getJobStatus(jobId);
        if (cancelled) return;
        setJob(latest);
        if (latest.status === 'completed' || latest.status === 'failed') {
          stopPolling();
        }
      } catch {
        if (!cancelled) {
          stopPolling();
          setNotFound(true);
        }
      }
    };

    (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
      pollTimerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    })();

    listProviders().then((p) => !cancelled && setProviders(p)).catch(() => {});

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [jobId]);

  // Device metadata (name, modality) isn't stored on the job doc itself —
  // only device_id/provider are — so it's resolved from a live device list
  // once we know which provider this job belongs to.
  useEffect(() => {
    if (!job) return;
    listDevices(job.provider)
      .then((devices) => setDevice(devices.find((d) => d.id === job.device_id) ?? null))
      .catch(() => {});
  }, [job?.provider, job?.device_id]);

  // Static, read-only render of the circuit that actually ran — reuses the
  // same CircuitCanvas the composer uses (so it's automatically in-theme in
  // both light/dark), fed from a local parse of the stored QASM rather than
  // a round-trip to the backend, since this is a historical record, not
  // something the user is actively editing.
  //
  // Must run before any early `return` below — React requires every hook to
  // fire on every render, in the same order. This one used to sit after the
  // loading/not-found returns, so the first render (loading=true, no job
  // yet) called fewer hooks than a later render once `job` existed —
  // "Rendered more hooks than during the previous render."
  const parsedCircuit = useMemo(() => {
    if (!job?.qasm) return null;
    try {
      return qasmToGates(job.qasm);
    } catch {
      return null;
    }
  }, [job?.qasm]);

  if (loading) {
    return (
      <div className="theme-qp flex items-center justify-center h-[calc(100vh-3.5rem)] text-muted-foreground text-sm gap-2">
        <FaCircleNotch className="animate-spin" /> Loading job...
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="theme-qp flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-3 text-muted-foreground">
        <p className="text-sm">Job not found, or you don't have access to it.</p>
        <Link to="/qroute" className="text-sm text-emerald-500 hover:underline">
          &larr; Back to QRoute
        </Link>
      </div>
    );
  }

  const providerName = providers.find((p) => p.id === job.provider)?.display_name ?? job.provider;
  const totalShots = job.result ? Object.values(job.result).reduce((a, b) => a + b, 0) : 0;
  const probabilities = job.result
    ? Object.fromEntries(Object.entries(job.result).map(([bitstring, count]) => [bitstring, totalShots ? count / totalShots : 0]))
    : null;

  return (
    <div className="theme-qp h-[calc(100vh-3.5rem)] overflow-auto bg-background text-foreground px-6 py-4">
      <Link to="/qroute" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <FaArrowLeft className="w-3 h-3" /> Back to QRoute
      </Link>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-sans font-semibold">
            {providerName} <span className="text-muted-foreground font-normal">· {device?.name ?? job.device_id}</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">{job.id}</p>
        </div>
        <Badge variant={STATUS_VARIANT[job.status]} className="text-sm px-3 py-1 h-auto">
          {job.status === 'running' || job.status === 'queued' ? (
            <span className="flex items-center gap-1.5">
              <FaCircleNotch className="animate-spin w-3 h-3" /> {job.status}
            </span>
          ) : (
            job.status
          )}
        </Badge>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">Job details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <DetailField label="Provider" value={providerName} />
            <DetailField label="Modality" value={device?.modality ?? '—'} />
            <DetailField label="Device" value={job.device_id} />
            <DetailField label="Simulator" value={device ? (device.is_simulator ? 'Yes' : 'No — real hardware') : '—'} />
            <DetailField label="Shots" value={job.shots} />
            <DetailField label="Created" value={formatTimestamp(job.created_at)} />
            <DetailField label="Updated" value={formatTimestamp(job.updated_at)} />
            <DetailField label="Cost" value={job.cost != null ? `$${job.cost}` : '—'} />
            <DetailField label="Estimated cost" value={job.estimated_cost != null ? `$${job.estimated_cost}` : '—'} />
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-sm">Circuit</CardTitle>
          </CardHeader>
          <CardContent>
            {job.qasm ? (
              <Tabs defaultValue="diagram">
                <TabsList>
                  <TabsTrigger value="diagram">Diagram</TabsTrigger>
                  <TabsTrigger value="qasm">QASM</TabsTrigger>
                </TabsList>
                <TabsContent value="diagram">
                  {parsedCircuit ? (
                    <div className="h-72 border border-border rounded-lg overflow-hidden bg-qp-bg">
                      <DndContext onDragEnd={() => {}}>
                        <CircuitCanvas
                          readOnly
                          qubits={parsedCircuit.numQubits}
                          cbits={parsedCircuit.numCbits}
                          gates={parsedCircuit.gates}
                          addGate={() => {}}
                          updateGate={() => {}}
                          removeGate={() => {}}
                        />
                      </DndContext>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-6 text-center">Couldn't render a diagram for this circuit.</p>
                  )}
                </TabsContent>
                <TabsContent value="qasm">
                  <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                    {job.qasm}
                  </pre>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No circuit recorded for this job.</p>
            )}
          </CardContent>
        </Card>

        {job.status === 'failed' && job.error_message && (
          <Card className="col-span-12 border-destructive/40">
            <CardHeader>
              <CardTitle className="text-sm text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive break-words">{job.error_message}</p>
            </CardContent>
          </Card>
        )}

        {job.status === 'completed' && job.result && probabilities && (
          <>
            <Card className="col-span-12 lg:col-span-7 h-80">
              <CardHeader>
                <CardTitle className="text-sm">Measurement distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <HistogramChart probabilities={probabilities} />
              </CardContent>
            </Card>

            <Card className="col-span-12 lg:col-span-5">
              <CardHeader>
                <CardTitle className="text-sm">Raw counts ({totalShots} shots)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-auto text-xs font-mono space-y-1">
                  {Object.entries(job.result)
                    .sort(([, a], [, b]) => b - a)
                    .map(([bitstring, count]) => (
                      <div key={bitstring} className="flex justify-between border-b border-border/50 py-0.5">
                        <span>{bitstring}</span>
                        <span className="text-muted-foreground">
                          {count} ({totalShots ? ((count / totalShots) * 100).toFixed(1) : '0.0'}%)
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <QCompareCard jobId={job.id} isSimulator={device?.is_simulator ?? true} />
          </>
        )}

        {(job.status === 'queued' || job.status === 'running') && (
          <Card className="col-span-12">
            <CardContent className="py-6 flex flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <FaCircleNotch className="animate-spin" /> Waiting on {providerName} — this page refreshes automatically.
              </span>
              {job.status_detail && (
                <span className="text-xs">
                  {job.status_detail}
                  {!device?.is_simulator && ' — real hardware queues are shared globally and can take a while.'}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        {/* qCompare needs the real-hardware result to diff against an ideal
            simulation, so it can't run until the job itself completes — this
            placeholder tells the user it's coming instead of the card just
            silently not being there yet. Skipped for simulator/mock devices,
            same guard QCompareCard itself uses once the job does complete. */}
        {(job.status === 'queued' || job.status === 'running') && device && !device.is_simulator && (
          <Card className="col-span-12 border-dashed">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">qCompare — ideal vs. real hardware</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FaCircleNotch className="animate-spin w-3 h-3 shrink-0" />
                Waiting for the hardware result before it can explain how this run compares to an ideal simulation.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QRouteJobDetailPage;
