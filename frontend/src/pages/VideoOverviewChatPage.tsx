import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VideoResourcePlayer } from '../components/VideoResourcePlayer';
import {
  requestStandaloneVideoOverview,
  getVideoOverviewStatus,
  listMyVideoOverviews,
  getVideoOverviewViewUrl,
} from '../api/videoOverviews';
import type { VideoOverviewStatus, VideoTemplate, VoiceGender } from '../api/videoOverviews';
import { FaFilm, FaPaperPlane, FaExclamationCircle } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const POLL_INTERVAL_MS = 3000;

const STATUS_LABEL: Record<VideoOverviewStatus, string> = {
  queued: 'Queued...',
  scripting: 'Writing slide script...',
  narrating: 'Generating narration audio...',
  rendering: 'Rendering slides...',
  assembling: 'Assembling video...',
  uploading: 'Uploading video...',
  ready: 'Ready',
  failed: 'Failed',
};

const STATUS_PROGRESS: Record<VideoOverviewStatus, number> = {
  queued: 5,
  scripting: 20,
  narrating: 40,
  rendering: 60,
  assembling: 80,
  uploading: 92,
  ready: 100,
  failed: 100,
};

const TEMPLATE_OPTIONS: { value: VideoTemplate; label: string; description: string }[] = [
  { value: 'minimal_dark', label: 'Minimal Dark', description: 'Sleek black theme' },
  { value: 'bold_gradient', label: 'Bold Gradient', description: 'Vibrant colorful theme' },
  { value: 'academic_light', label: 'Academic Light', description: 'Clean lecture-note theme' },
];

const VOICE_OPTIONS: { value: VoiceGender; label: string }[] = [
  { value: 'female', label: 'Female Narrator' },
  { value: 'male', label: 'Male Narrator' },
];

interface Turn {
  id: string;
  prompt: string;
  status: VideoOverviewStatus;
  error: string | null;
}

function VideoOverviewChatPageInner() {
  const { theme } = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [template, setTemplate] = useState<VideoTemplate>('minimal_dark');
  const [voice, setVoice] = useState<VoiceGender>('female');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const pollTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const startPolling = (id: string) => {
    if (pollTimersRef.current[id]) return;
    pollTimersRef.current[id] = setInterval(async () => {
      try {
        const result = await getVideoOverviewStatus(id);
        updateTurn(id, { status: result.status, error: result.error });
        if (result.status === 'ready' || result.status === 'failed') {
          clearInterval(pollTimersRef.current[id]);
          delete pollTimersRef.current[id];
        }
      } catch (err: any) {
        clearInterval(pollTimersRef.current[id]);
        delete pollTimersRef.current[id];
        updateTurn(id, { status: 'failed', error: err.message || 'Lost connection while checking status.' });
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    listMyVideoOverviews()
      .then((docs) => {
        const loaded: Turn[] = docs
          .slice()
          .reverse()
          .map((d) => ({ id: d.id, prompt: d.prompt, status: d.status, error: d.error }));
        setTurns(loaded);
        loaded.forEach((t) => {
          if (t.status !== 'ready' && t.status !== 'failed') startPolling(t.id);
        });
      })
      .catch((err) => console.error('Failed to load video overview history', err))
      .finally(() => setLoadingHistory(false));

    const timers = pollTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const updateTurn = (id: string, patch: Partial<Turn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const prompt = input.trim();
    if (!prompt || submitting) return;

    setInput('');
    setSubmitting(true);
    const tempId = `pending-${Date.now()}`;
    setTurns((prev) => [...prev, { id: tempId, prompt, status: 'queued', error: null }]);

    try {
      const { video_overview_id } = await requestStandaloneVideoOverview(prompt, { template, voice });
      setTurns((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: video_overview_id } : t)));
      startPolling(video_overview_id);
    } catch (err: any) {
      updateTurn(tempId, { status: 'failed', error: err.message || 'Failed to start video overview generation.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn(
      "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
      theme === 'dark' ? "text-white" : "text-zinc-900"
    )}>
      <div className="max-w-[1600px] mx-auto flex flex-col gap-12">
        <div className="flex flex-col gap-4 max-w-3xl">
          <motion.h1
            className="text-4xl md:text-5xl font-sans tracking-tight"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            AI Video Overview
          </motion.h1>
          <motion.p
            className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Describe a quantum computing topic and get a narrated slide-deck video.
          </motion.p>
        </div>

        <motion.div
          className={cn(
            "p-8 rounded-[2rem] border shadow-sm",
            theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select value={template} onValueChange={(v) => setTemplate(v as VideoTemplate)}>
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} &mdash; {opt.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={voice} onValueChange={(v) => setVoice(v as VoiceGender)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={handleSend} className="flex gap-4 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what the video overview should cover... e.g. Explain the quantum teleportation protocol step by step"
              rows={2}
              className={cn(
                "resize-none rounded-2xl border px-4 py-3 shadow-none focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40",
                theme === 'dark' ? "bg-black border-white/10 placeholder:text-zinc-500" : "bg-zinc-50 border-zinc-200"
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="submit"
              disabled={submitting || !input.trim()}
              className="h-12 w-12 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow hover:bg-emerald-600 font-medium transition-colors disabled:opacity-50"
            >
              <FaPaperPlane className="text-sm" />
            </button>
          </form>
        </motion.div>

        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-sans tracking-tight">Video Library</h2>

          {loadingHistory && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-5 rounded-[2rem] border shadow-sm h-[220px] animate-pulse",
                    theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl mb-4",
                    theme === 'dark' ? "bg-white/10" : "bg-zinc-200"
                  )} />
                  <div className={cn(
                    "h-6 w-3/4 rounded mb-3",
                    theme === 'dark' ? "bg-white/10" : "bg-zinc-200"
                  )} />
                  <div className={cn(
                    "h-4 w-1/2 rounded",
                    theme === 'dark' ? "bg-white/5" : "bg-zinc-100"
                  )} />
                </div>
              ))}
            </div>
          )}

          {!loadingHistory && turns.length === 0 && (
            <motion.div
              className="flex flex-col items-center justify-center text-center py-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl border flex items-center justify-center mb-6",
                theme === 'dark' ? "bg-black border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-500"
              )}>
                <FaFilm className="w-7 h-7" />
              </div>
              <p className={cn("font-medium", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
                Ask for a video overview on any quantum computing topic to get started.
              </p>
            </motion.div>
          )}

          {!loadingHistory && turns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {turns.map((turn) => (
                <motion.div
                  key={turn.id}
                  className={cn(
                    "p-5 rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col h-full relative",
                    theme === 'dark'
                      ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50 hover:bg-white/5"
                      : "bg-white border-zinc-200 hover:border-emerald-500/30"
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:text-emerald-500",
                    theme === 'dark' ? "bg-black border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                  )}>
                    <FaFilm className="w-6 h-6" />
                  </div>

                  <h3 className="text-xl font-semibold mb-2 line-clamp-2">{turn.prompt}</h3>

                  <div className="mb-1 flex-1">
                  {turn.status === 'failed' ? (
                    <div className="flex items-start gap-2 text-red-500 text-sm">
                      <FaExclamationCircle className="mt-0.5 shrink-0" />
                      <span>{turn.error || 'Video generation failed.'}</span>
                    </div>
                  ) : turn.status === 'ready' ? (
                    <div className="w-full aspect-video rounded-xl overflow-hidden">
                      <VideoResourcePlayer resourceId={turn.id} title="AI Video Overview" fetchUrl={getVideoOverviewViewUrl} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className={cn(
                        "flex items-center gap-2 text-sm",
                        theme === 'dark' ? "text-zinc-400" : "text-zinc-500"
                      )}>
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        {STATUS_LABEL[turn.status]}
                      </div>
                      <div className={cn(
                        "h-1.5 w-full rounded-full overflow-hidden",
                        theme === 'dark' ? "bg-white/10" : "bg-zinc-200"
                      )}>
                        <motion.div
                          className="h-full rounded-full bg-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${STATUS_PROGRESS[turn.status]}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>
                  )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default function VideoOverviewChatPage() {
  return <VideoOverviewChatPageInner />;
}
