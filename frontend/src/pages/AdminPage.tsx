import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, FileText, Loader2, LogOut, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth } from '@/firebase';
import { apiErrorMessage, decideVerification, getProofUrl, listVerificationRequests } from '@/api/verification';
import type { VerificationRequest, VerificationStatus } from '@/api/verification';

function Check({ ok, label, detail }: { ok: boolean | null | undefined; label: string; detail?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-label="Passed" />
        : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" aria-label="Missing" />}
      <span><span className="text-foreground">{label}</span>{detail && <span className="text-muted-foreground"> · {detail}</span>}</span>
    </li>
  );
}

function RequestCard({ req, onDecided }: { req: VerificationRequest; onDecided: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const v = req.verification;
  const p = v.profile;

  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await decideVerification(req.uid, decision, reason);
      toast.success(decision === 'approve' ? `${req.full_name} approved` : `${req.full_name} rejected`);
      onDecided();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openProof = async () => {
    try {
      window.open(await getProofUrl(req.uid), '_blank', 'noopener');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="font-medium">{req.full_name}</CardTitle>
            <CardDescription>{req.email}</CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">{req.role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="space-y-2">
          <Check ok={Boolean(p?.institution)} label="Profile" detail={p && [p.designation, p.department, p.institution].filter(Boolean).join(', ')} />
          <Check ok={Boolean(v.email_check?.verified_at)} label="Institutional email" detail={v.email_check?.email} />
          <Check
            ok={Boolean(v.orcid?.orcid)}
            label="ORCID"
            detail={v.orcid?.orcid && (
              <>
                <a className="text-primary hover:underline" href={`https://orcid.org/${v.orcid.orcid}`} target="_blank" rel="noreferrer">{v.orcid.orcid}</a>
                {` (${v.orcid.name}) · ${v.orcid.works_count} works`}
                {v.orcid.employments.filter((e) => e.current).map((e) => ` · ${[e.role, e.organization].filter(Boolean).join(' at ')}`).join('')}
              </>
            )}
          />
          <Check ok={v.id_check?.status === 'Approved'} label="Government ID + selfie (Didit)" detail={v.id_check && `${v.id_check.status}${v.id_check.full_name ? ` · ${v.id_check.full_name}` : ''}`} />
          <Check ok={v.name_match} label="Names match" detail={v.name_match === null || v.name_match === undefined ? 'not enough data' : v.name_match ? 'ID matches profile/ORCID' : 'mismatch, check carefully'} />
          <Check ok={v.has_proof} label="Proof document" detail={v.has_proof ? 'uploaded' : 'none'} />
        </ul>
        {p?.profile_url && (
          <a className="text-sm text-primary hover:underline inline-flex items-center gap-1" href={p.profile_url} target="_blank" rel="noreferrer">
            Faculty / Scholar page <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {v.rejection_reason && <p className="text-sm text-destructive">Rejected: {v.rejection_reason}</p>}
        <div className="flex flex-col sm:flex-row gap-2">
          {v.has_proof && <Button variant="outline" size="sm" onClick={openProof}><FileText className="w-4 h-4" /> View proof</Button>}
          {v.status === 'pending' && (
            <>
              <Input aria-label="Rejection reason" placeholder="Reason (required to reject)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" disabled={busy} onClick={() => decide('approve')}>Approve</Button>
              <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => decide('reject')}>Reject</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [requests, setRequests] = useState<VerificationRequest[] | null>(null);

  const load = useCallback(() => {
    setRequests(null);
    listVerificationRequests(status).then(setRequests).catch((e) => {
      toast.error(apiErrorMessage(e));
      setRequests([]);
    });
  }, [status]);

  useEffect(load, [load]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl tracking-tight">Identity verification</h1>
              <p className="text-muted-foreground">Review educators and researchers before they get educator features.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => auth.signOut().then(() => navigate('/login'))}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>

        <Tabs value={status} onValueChange={(val) => setStatus(val as VerificationStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="unsubmitted">In progress</TabsTrigger>
          </TabsList>
        </Tabs>

        {requests === null ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map((r) => <RequestCard key={r.uid} req={r} onDecided={load} />)}
          </div>
        )}
      </div>
    </div>
  );
}
