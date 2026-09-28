import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios';
import { FaMicrochip } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, tone } from '@/components/explorer';
import { checkHardwareRun, listHardwareDevices, runOnHardware } from '@/api/qrating';

/** Runs an accepted hardware solution on a real device for a badge.
 *
 *  Scoring never waits on this: qBraid jobs are asynchronous, capped per day and
 *  cost credits, so the round is already decided by the noise-model grade. */
export function HardwareVerifyButton({ submissionId }: { submissionId: string }) {
  const { theme } = useTheme();
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const devices = useQuery({
    queryKey: ['qbraid', 'devices'],
    queryFn: listHardwareDevices,
    staleTime: 10 * 60 * 1000,
  });

  const run = useQuery({
    queryKey: ['qrating', 'hardware', submissionId],
    queryFn: () => checkHardwareRun(submissionId),
    enabled: started,
    // Poll until the device queue resolves, then stop.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 5000;
    },
  });

  const start = async () => {
    const device = devices.data?.find((candidate) => candidate.is_simulator) ?? devices.data?.[0];
    if (!device) {
      toast.error('No quantum devices are available right now.');
      return;
    }
    setSubmitting(true);
    try {
      await runOnHardware(submissionId, device.id);
      setStarted(true);
      toast.success(`Queued on ${device.name ?? device.id}. It will finish in its own time.`);
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(detail ?? 'Could not queue the hardware run.');
    } finally {
      setSubmitting(false);
    }
  };

  if (run.data?.status === 'completed') {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="flex items-center gap-2 font-medium text-emerald-500">
          <FaMicrochip className="w-3.5 h-3.5" /> Verified on real hardware
        </p>
        {run.data.counts && (
          <p className={cn('mt-1.5 font-mono text-xs', tone.secondary(theme))}>
            {Object.entries(run.data.counts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([bits, count]) => `${bits}:${count}`)
              .join('  ')}
          </p>
        )}
      </div>
    );
  }

  if (run.data?.status === 'failed') {
    return (
      <p className="p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
        The hardware run failed. {run.data.error_message}
      </p>
    );
  }

  if (started) {
    return (
      <p className={cn('rounded-2xl border p-4 text-sm', tone.panel(theme), tone.secondary(theme))}>
        Queued on a real device. This can take a while, and your score is already locked in - you
        can leave this page.
      </p>
    );
  }

  return (
    <AccentButton variant="outline" onClick={start} disabled={submitting || devices.isLoading}>
      <FaMicrochip className="w-3.5 h-3.5" />
      {submitting ? 'Queueing...' : 'Run on real silicon'}
    </AccentButton>
  );
}
