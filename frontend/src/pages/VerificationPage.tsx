import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, CheckCircle2, Circle, Clock, FileText, IdCard, Loader2, Mail, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  apiErrorMessage, confirmEmailCode, getMyVerification, refreshIdCheck, saveProfile, sendEmailCode, startIdCheck,
  startOrcid, submitVerification, uploadProof,
} from '@/api/verification';
import type { Verification, VerificationProfile } from '@/api/verification';

const EMPTY_PROFILE: VerificationProfile = { institution: '', designation: '', department: '', research_areas: [], profile_url: '' };

function Step({ done, icon: Icon, title, description, children }: {
  done: boolean; icon: typeof Mail; title: string; description: string; children: ReactNode;
}) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="font-medium flex items-center gap-2">
              {title}
              {done ? <CheckCircle2 className="w-4 h-4 text-primary" aria-label="Done" /> : <Circle className="w-4 h-4 text-muted-foreground" aria-label="Not done" />}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function VerificationPage() {
  const [params, setParams] = useSearchParams();
  const [v, setV] = useState<Verification | null>(null);
  const [profile, setProfile] = useState<VerificationProfile>(EMPTY_PROFILE);
  const [areas, setAreas] = useState('');
  const [instEmail, setInstEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const handledReturn = useRef(false);

  const load = useCallback(async () => {
    const data = await getMyVerification();
    setV(data);
    if (data.profile) {
      setProfile(data.profile);
      setAreas(data.profile.research_areas.join(', '));
    }
    if (data.email_check?.email) setInstEmail(data.email_check.email);
    return data;
  }, []);

  useEffect(() => {
    load().catch((e) => setError(apiErrorMessage(e, 'Could not load verification status')));
  }, [load]);

  // Returning from ORCID (?orcid=...) or Didit (?verificationSessionId=...)
  useEffect(() => {
    if (handledReturn.current) return;
    const orcid = params.get('orcid');
    const didit = params.get('verificationSessionId');
    if (!orcid && !didit) return;
    handledReturn.current = true;
    if (orcid === 'linked') toast.success('ORCID linked');
    if (orcid === 'error') toast.error('ORCID sign-in did not complete. Please try again.');
    if (orcid === 'in_use') toast.error('That ORCID iD is already linked to another Qrious account.');
    if (didit) {
      refreshIdCheck().then(setV).then(() => toast.success('ID check result updated'))
        .catch((e) => toast.error(apiErrorMessage(e, 'Could not read ID check result')));
    }
    setParams({}, { replace: true });
  }, [params, setParams]);

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    setError('');
    try {
      await action();
      if (success) toast.success(success);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const redirectTo = (key: string, getUrl: () => Promise<string>) => run(key, async () => {
    window.location.href = await getUrl();
  });

  if (!v) {
    return (
      <div className="flex items-center justify-center h-64">
        {error ? <p className="text-destructive text-sm">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-primary" />}
      </div>
    );
  }

  const locked = v.status === 'pending' || v.status === 'approved';
  const isResearcher = v.role === 'researcher';
  const has = (req: string) => !v.missing.includes(req as never);
  const emailVerified = Boolean(v.email_check?.verified_at);
  const idApproved = v.id_check?.status === 'Approved';

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl tracking-tight">Identity verification</h1>
            <p className="text-muted-foreground">
              {isResearcher
                ? 'Verify your identity to unlock educator tools and mentorship from verified professors.'
                : 'Verify you are a real faculty member to unlock course creation and the resource library.'}
            </p>
          </div>
        </div>

        {v.status === 'approved' && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
            <BadgeCheck className="w-5 h-5 text-primary shrink-0" /> You are verified. All {isResearcher ? 'researcher' : 'educator'} features are unlocked.
          </div>
        )}
        {v.status === 'pending' && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted p-4 text-sm">
            <Clock className="w-5 h-5 text-primary shrink-0" /> Submitted. An admin is reviewing your details. You'll get an email with the result.
          </div>
        )}
        {v.status === 'rejected' && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>Not approved: {v.rejection_reason}. Update the steps below and submit again.</span>
          </div>
        )}
        {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

        <Step done={has('profile')} icon={UserRound} title="1. Academic profile" description="Where you teach or research.">
          <form
            className="grid sm:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run('profile', () => saveProfile({ ...profile, research_areas: areas.split(',').map((a) => a.trim()).filter(Boolean) }), 'Profile saved');
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Input id="institution" required disabled={locked} value={profile.institution} placeholder="Amrita Vishwa Vidyapeetham"
                onChange={(e) => setProfile({ ...profile, institution: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" required disabled={locked} value={profile.designation} placeholder={isResearcher ? 'PhD Scholar' : 'Assistant Professor'}
                onChange={(e) => setProfile({ ...profile, designation: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" disabled={locked} value={profile.department} placeholder="Computer Science"
                onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile_url">Faculty page or Google Scholar link</Label>
              <Input id="profile_url" type="url" disabled={locked} value={profile.profile_url} placeholder="https://"
                onChange={(e) => setProfile({ ...profile, profile_url: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="areas">Research areas (comma separated)</Label>
              <Input id="areas" disabled={locked} value={areas} placeholder="Quantum error correction, VQE"
                onChange={(e) => setAreas(e.target.value)} />
            </div>
            {!locked && (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</Button>
              </div>
            )}
          </form>
        </Step>

        <Step done={emailVerified} icon={Mail} title="2. Institutional email" description="We send a 6-digit code to your university address. Personal email providers are not accepted.">
          {emailVerified ? (
            <p className="text-sm">Verified: <span className="font-mono">{v.email_check?.email}</span></p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input type="email" aria-label="Institutional email" disabled={locked} value={instEmail} placeholder="you@university.edu"
                  onChange={(e) => setInstEmail(e.target.value)} />
                <Button variant="outline" disabled={locked || !instEmail || busy === 'send'}
                  onClick={() => run('send', () => sendEmailCode(instEmail), 'Code sent. Check your inbox')}>
                  {busy === 'send' ? 'Sending…' : v.email_check?.code_sent ? 'Resend code' : 'Send code'}
                </Button>
              </div>
              {v.email_check?.code_sent && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input inputMode="numeric" maxLength={6} aria-label="Verification code" placeholder="6-digit code" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                  <Button disabled={code.length !== 6 || busy === 'confirm'} onClick={() => run('confirm', () => confirmEmailCode(code), 'Email verified')}>
                    Verify
                  </Button>
                </div>
              )}
            </div>
          )}
        </Step>

        <Step
          done={Boolean(v.orcid?.orcid)}
          icon={BadgeCheck}
          title={`3. ORCID ${isResearcher ? '' : '(recommended)'}`}
          description={isResearcher ? 'Required. Sign in with ORCID so we can confirm your research record.' : 'Sign in with ORCID to confirm your affiliations and publications. Without ORCID, upload a proof document in step 5.'}
        >
          {v.orcid?.orcid ? (
            <div className="space-y-2 text-sm">
              <p>
                Linked: <a className="font-mono text-primary hover:underline" href={`https://orcid.org/${v.orcid.orcid}`} target="_blank" rel="noreferrer">{v.orcid.orcid}</a> ({v.orcid.name})
              </p>
              <p className="text-muted-foreground">{v.orcid.works_count} public works</p>
              {v.orcid.employments.filter((e) => e.current).map((e) => (
                <Badge key={`${e.organization}-${e.role}`} variant="outline" className="mr-2">{[e.role, e.organization].filter(Boolean).join(' · ')}</Badge>
              ))}
            </div>
          ) : (
            <Button variant="outline" disabled={locked || busy === 'orcid'} onClick={() => redirectTo('orcid', startOrcid)}>
              {busy === 'orcid' ? 'Opening ORCID…' : 'Sign in with ORCID'}
            </Button>
          )}
        </Step>

        <Step done={idApproved} icon={IdCard} title="4. Government ID + selfie" description="A secure check by Didit: scan your ID and take a quick selfie. Takes about 2 minutes.">
          <div className="space-y-3 text-sm">
            {v.id_check && (
              <p>
                Status: <Badge variant={idApproved ? 'secondary' : v.id_check.status === 'Declined' ? 'destructive' : 'outline'}>{v.id_check.status}</Badge>
                {v.id_check.full_name && <span className="ml-2 text-muted-foreground">Name on ID: {v.id_check.full_name}</span>}
              </p>
            )}
            {!idApproved && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={locked || busy === 'id'} onClick={() => redirectTo('id', startIdCheck)}>
                  {busy === 'id' ? 'Opening…' : v.id_check ? 'Retry ID check' : 'Start ID check'}
                </Button>
                {v.id_check && (
                  <Button variant="ghost" disabled={busy === 'refresh'} onClick={() => run('refresh', refreshIdCheck)}>Refresh result</Button>
                )}
              </div>
            )}
          </div>
        </Step>

        <Step
          done={Boolean(v.has_proof)}
          icon={FileText}
          title={`5. Proof document ${isResearcher || v.orcid?.orcid ? '(optional)' : ''}`}
          description="PDF of your faculty ID card or appointment letter, max 10 MB. Only admins can view it."
        >
          {v.has_proof ? (
            <p className="text-sm">Uploaded.</p>
          ) : (
            <Input
              type="file"
              accept="application/pdf"
              aria-label="Proof document PDF"
              disabled={locked || busy === 'proof'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) {
                  setError('Please choose a PDF under 10 MB');
                  return;
                }
                run('proof', () => uploadProof(file), 'Proof uploaded');
              }}
            />
          )}
        </Step>

        {!locked && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button size="lg" disabled={v.missing.length > 0 || busy === 'submit'} onClick={() => run('submit', submitVerification, 'Submitted for review')}>
              {busy === 'submit' ? 'Submitting…' : 'Submit for review'}
            </Button>
            {v.missing.length > 0 && (
              <p className="text-sm text-muted-foreground">Complete the remaining steps to submit.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
