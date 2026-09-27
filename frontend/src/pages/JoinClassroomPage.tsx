import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Loader2, Lock, School } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/api/verification';
import { joinClassroom, previewJoin } from '@/api/classrooms';
import type { JoinPreview } from '@/api/classrooms';

export default function JoinClassroomPage() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const navigate = useNavigate();
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) { setError('No join code provided.'); return; }
    previewJoin(code).then(setPreview).catch((e) => setError(apiErrorMessage(e, 'Could not find that classroom')));
  }, [code]);

  const join = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await joinClassroom(code, preview.consent_version);
      toast.success(`You joined ${res.name}`);
      navigate('/classrooms');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const blocker = !preview ? null
    : !preview.is_student ? 'Only student accounts can join classrooms.'
    : preview.status !== 'active' ? 'This classroom is archived and not accepting students.'
    : !preview.email_allowed ? `This classroom only accepts ${preview.allowed_email_domains.map((d) => '@' + d).join(', ')} accounts. Sign in with your institution email to join.`
    : null;

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {error && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            <Button asChild variant="outline" className="self-start"><Link to="/classrooms">Back to classrooms</Link></Button>
          </div>
        )}
        {!preview ? (!error && <Loader2 className="w-6 h-6 animate-spin text-primary" />) : (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-medium">{preview.name}</CardTitle>
                  <CardDescription>{[preview.teacher, preview.institution].filter(Boolean).join(' · ')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {preview.description && <p className="text-sm text-muted-foreground">{preview.description}</p>}

              {preview.already_member ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">You're already a member of this classroom.</p>
                  <Button asChild variant="outline" className="self-start"><Link to="/classrooms">Go to my classrooms</Link></Button>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium mb-2">Your faculty will see</p>
                      <ul className="space-y-2">
                        {preview.shared.map((s) => (
                          <li key={s} className="flex gap-2 text-sm"><Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden />{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Always private</p>
                      <ul className="space-y-2">
                        {preview.never_shared.map((s) => (
                          <li key={s} className="flex gap-2 text-sm text-muted-foreground"><Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">You can leave this classroom at any time from the Classrooms page. Your faculty stops seeing your activity immediately.</p>

                  {blocker ? (
                    <div className="rounded-md bg-muted p-3 text-sm">{blocker}</div>
                  ) : (
                    <>
                      <label className="flex items-start gap-3 text-sm cursor-pointer">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                        <span>I agree to share this learning activity with the faculty of {preview.name}.</span>
                      </label>
                      <Button className="self-start" disabled={!agreed || busy} onClick={join}>{busy ? 'Joining…' : 'Join classroom'}</Button>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
