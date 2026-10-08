import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { requestVideoOverview, getVideoOverviewStatus } from '../api/videoOverviews';
import type { VideoOverviewStatus, VideoTemplate, VoiceGender } from '../api/videoOverviews';
import { VideoResourcePlayer } from './VideoResourcePlayer';
import { FaFilm, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

type GeneratorState = 'idle' | 'submitting' | 'polling' | 'success' | 'error';

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

interface PdfSourceOption {
  resource_id: string;
  title: string;
}

interface VideoOverviewGeneratorProps {
  lessonId: string;
  pdfResources?: PdfSourceOption[];
  onGenerated?: () => void;
}

export default function VideoOverviewGenerator(props: VideoOverviewGeneratorProps) {
  return <VideoOverviewGeneratorInner {...props} />;
}

function VideoOverviewGeneratorInner({ lessonId, pdfResources = [], onGenerated }: VideoOverviewGeneratorProps) {
  const [state, setState] = useState<GeneratorState>('idle');
  const [prompt, setPrompt] = useState('');
  const [sourceResourceId, setSourceResourceId] = useState<string>('');
  const [template, setTemplate] = useState<VideoTemplate>('minimal_dark');
  const [voice, setVoice] = useState<VoiceGender>('female');
  const [status, setStatus] = useState<VideoOverviewStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [resourceId, setResourceId] = useState<string | null>(null);

  const videoOverviewIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startPolling = (videoOverviewId: string) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await getVideoOverviewStatus(videoOverviewId);
        setStatus(result.status);
        if (result.status === 'ready') {
          stopPolling();
          setResourceId(result.resource_id);
          setState('success');
          onGenerated?.();
        } else if (result.status === 'failed') {
          stopPolling();
          setErrorMessage(result.error || 'Video generation failed.');
          setState('error');
        }
      } catch (err: any) {
        stopPolling();
        setErrorMessage(err.message || 'Lost connection while checking generation status.');
        setState('error');
      }
    }, POLL_INTERVAL_MS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMessage('Describe what the video overview should cover.');
      setState('error');
      return;
    }

    setState('submitting');
    setErrorMessage('');
    try {
      const { video_overview_id } = await requestVideoOverview({
        lessonId,
        prompt: prompt.trim(),
        sourceResourceId: sourceResourceId || undefined,
        template,
        voice,
      });
      videoOverviewIdRef.current = video_overview_id;
      setStatus('queued');
      setState('polling');
      startPolling(video_overview_id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start video overview generation.');
      setState('error');
    }
  };

  const resetForm = () => {
    stopPolling();
    videoOverviewIdRef.current = null;
    setState('idle');
    setPrompt('');
    setSourceResourceId('');
    setTemplate('minimal_dark');
    setVoice('female');
    setStatus(null);
    setErrorMessage('');
    setResourceId(null);
  };

  return (
    <div className="w-full">
      <Card className="rounded-[2rem] border shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FaFilm className="w-5 h-5" />
            </span>
            AI Video Overview
          </CardTitle>
          <CardDescription>
            Generate a narrated slide-deck video summarizing this lesson.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait" initial={false}>
            {state === 'idle' && (
              <motion.form
                key="idle"
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="space-y-2">
                  <Label>What should the overview cover?</Label>
                  <Textarea
                    placeholder="e.g. Summarize this lesson on quantum entanglement for a first-time learner"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                {pdfResources.length > 0 && (
                  <div className="space-y-2">
                    <Label>Ground in an existing PDF resource (optional)</Label>
                    <Select value={sourceResourceId} onValueChange={setSourceResourceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="None — generate from prompt only" />
                      </SelectTrigger>
                      <SelectContent>
                        {pdfResources.map((res) => (
                          <SelectItem key={res.resource_id} value={res.resource_id}>
                            {res.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">Slide template</Label>
                    <Select value={template} onValueChange={(v) => setTemplate(v as VideoTemplate)}>
                      <SelectTrigger className="w-full truncate">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-xs text-muted-foreground ml-1 font-normal">&mdash; {opt.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">Narrator voice</Label>
                    <Select value={voice} onValueChange={(v) => setVoice(v as VoiceGender)}>
                      <SelectTrigger className="w-full truncate">
                        <SelectValue placeholder="Select voice" />
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
                </div>

                <Button type="submit" className="w-full h-12 text-lg rounded-xl">
                  Generate Video Overview
                </Button>
              </motion.form>
            )}

            {(state === 'submitting' || state === 'polling') && (
              <motion.div
                key="progress"
                className="flex flex-col items-center justify-center py-12 space-y-6"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>

                <div className="text-center w-full">
                  <h3 className="text-xl font-semibold mb-2">
                    {state === 'submitting' ? 'Starting generation...' : STATUS_LABEL[status ?? 'queued']}
                  </h3>

                  <div className="w-full max-w-md mx-auto mt-4">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${state === 'submitting' ? 2 : STATUS_PROGRESS[status ?? 'queued']}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      This usually takes 5-10 minutes. You can leave this page open in the background.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div
                key="error"
                className="flex flex-col items-center justify-center py-12 text-center"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <span className="w-16 h-16 rounded-2xl border border-destructive/20 bg-destructive/10 flex items-center justify-center mb-4">
                  <FaExclamationCircle className="w-8 h-8 text-destructive" />
                </span>
                <h3 className="text-2xl mb-2">Generation Failed</h3>
                <p className="text-muted-foreground mb-6 max-w-md">{errorMessage}</p>
                <Button variant="outline" onClick={resetForm} className="rounded-xl">Start Over</Button>
              </motion.div>
            )}

            {state === 'success' && (
              <motion.div
                key="success"
                className="flex flex-col items-center gap-6 py-6 text-center"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex flex-col items-center">
                  <span className="w-16 h-16 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center mb-4">
                    <FaCheckCircle className="w-8 h-8 text-emerald-500" />
                  </span>
                  <h3 className="text-2xl mb-2">Video Overview Ready!</h3>
                  <p className="text-muted-foreground mb-4">Your AI-generated overview has been added to this lesson's resources.</p>
                </div>
                {resourceId && (
                  <div className="w-full max-w-xl aspect-video rounded-xl overflow-hidden">
                    <VideoResourcePlayer resourceId={resourceId} title="AI Video Overview" />
                  </div>
                )}
                <Button onClick={resetForm} className="rounded-xl">Generate Another</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
