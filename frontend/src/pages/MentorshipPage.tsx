import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, GraduationCap, Loader2, MessageSquare, Search, Send, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { apiErrorMessage } from '@/api/verification';
import {
  listMentors, listMentorships, listMessages, requestMentorship, respondToMentorship, sendMessage,
} from '@/api/mentorship';
import type { MentorCard, Mentorship, MentorshipMessage } from '@/api/mentorship';

const POLL_MS = 10_000;

function statusVariant(status: Mentorship['status']) {
  return status === 'accepted' ? 'secondary' : status === 'declined' ? 'destructive' : 'outline';
}

function Chat({ mentorship, myUid }: { mentorship: Mentorship; myUid: string }) {
  const [messages, setMessages] = useState<MentorshipMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = () => listMessages(mentorship.id).then((m) => active && setMessages(m)).catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [mentorship.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await sendMessage(mentorship.id, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Message not sent'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex flex-col min-h-[420px]">
      <CardHeader>
        <CardTitle className="font-medium">{mentorship.counterpart.full_name}</CardTitle>
        <CardDescription>
          {mentorship.topic}
          {mentorship.counterpart.email && <> · <a className="text-primary hover:underline" href={`mailto:${mentorship.counterpart.email}`}>{mentorship.counterpart.email}</a></>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div className="flex-1 max-h-96 overflow-y-auto space-y-2 pr-1" aria-live="polite">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>}
          {messages.map((m) => (
            <div key={m.id} className={m.sender_uid === myUid ? 'flex justify-end' : 'flex justify-start'}>
              <div className={
                m.sender_uid === myUid
                  ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap break-words'
                  : 'max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words'
              }>
                {m.body}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <Input aria-label="Message" value={draft} maxLength={2000} placeholder="Write a message" onChange={(e) => setDraft(e.target.value)} />
          <Button type="submit" size="icon" aria-label="Send" disabled={sending || !draft.trim()}><Send className="w-4 h-4" /></Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function MentorshipPage() {
  const { currentUser } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [mentors, setMentors] = useState<MentorCard[]>([]);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Mentorship[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [requestTo, setRequestTo] = useState<MentorCard | null>(null);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const isResearcher = role === 'researcher';

  const loadItems = useCallback(() => listMentorships().then(setItems).catch((e) => toast.error(apiErrorMessage(e))), []);

  useEffect(() => {
    apiClient.get('/api/user/me').then((r) => setRole(r.data.role)).catch(() => {});
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!isResearcher) return;
    const t = setTimeout(() => listMentors(query).then(setMentors).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [isResearcher, query]);

  const submitRequest = async () => {
    if (!requestTo) return;
    setBusy(true);
    try {
      await requestMentorship(requestTo.uid, topic, message);
      toast.success(`Request sent to ${requestTo.full_name}`);
      setRequestTo(null);
      setTopic('');
      setMessage('');
      loadItems();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Request not sent'));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (m: Mentorship, accept: boolean) => {
    try {
      await respondToMentorship(m.id, accept, notes[m.id] || '');
      toast.success(accept ? 'Mentorship accepted' : 'Request declined');
      await loadItems();
      if (accept) setActiveId(m.id);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const openRequestIds = new Set((items || []).filter((m) => m.status !== 'declined').map((m) => m.counterpart.uid));
  const active = items?.find((m) => m.id === activeId && m.status === 'accepted');

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl tracking-tight">Mentorship</h1>
            <p className="text-muted-foreground">
              {isResearcher
                ? 'Get guidance from verified professors on your quantum research.'
                : 'Mentor verified researchers who reach out to you.'}
            </p>
          </div>
        </div>

        {isResearcher && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xl tracking-tight">Verified professors</h2>
              <div className="relative sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" aria-label="Search mentors" placeholder="Search by name, institution or area" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            {mentors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verified professors match yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mentors.map((mentor) => (
                  <Card key={mentor.uid} className="animate-in fade-in duration-500">
                    <CardHeader>
                      <CardTitle className="font-medium flex items-center gap-2">
                        {mentor.full_name}
                        <BadgeCheck className="w-4 h-4 text-primary" aria-label="Verified" />
                      </CardTitle>
                      <CardDescription>{[mentor.designation, mentor.department, mentor.institution].filter(Boolean).join(' · ')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {mentor.research_areas.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
                      </div>
                      <Button variant="outline" disabled={openRequestIds.has(mentor.uid)} onClick={() => setRequestTo(mentor)}>
                        {openRequestIds.has(mentor.uid) ? 'Request sent' : 'Request mentorship'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-start">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl tracking-tight">{isResearcher ? 'Your requests' : 'Mentorship requests'}</h2>
            {items === null && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            {items?.length === 0 && (
              <div className="flex flex-col items-center text-center gap-2 py-10 text-muted-foreground">
                <GraduationCap className="w-8 h-8" />
                <p className="text-sm">{isResearcher ? 'Request mentorship from a professor above.' : 'No requests yet. Verified researchers can find you in the mentor directory.'}</p>
              </div>
            )}
            {items?.map((m) => (
              <Card key={m.id} className={m.id === activeId ? 'border-primary/50' : undefined}>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate">{m.counterpart.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.topic}</p>
                    </div>
                    <Badge variant={statusVariant(m.status)} className="capitalize">{m.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.message}</p>
                  {m.response_note && <p className="text-sm">Note: {m.response_note}</p>}
                  {m.as === 'mentor' && m.status === 'pending' && (
                    <div className="flex flex-col gap-2">
                      <Input aria-label="Optional note" placeholder="Optional note" maxLength={500} value={notes[m.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => respond(m, true)}>Accept</Button>
                        <Button size="sm" variant="ghost" onClick={() => respond(m, false)}>Decline</Button>
                      </div>
                    </div>
                  )}
                  {m.status === 'accepted' && (
                    <Button size="sm" variant="outline" className="self-start" onClick={() => setActiveId(m.id)}>
                      <MessageSquare className="w-4 h-4" /> Open chat
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div>
            {active && currentUser ? (
              <Chat mentorship={active} myUid={currentUser.uid} />
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center text-center gap-2 py-24 rounded-xl border border-dashed text-muted-foreground">
                <MessageSquare className="w-8 h-8" />
                <p className="text-sm">Open an accepted mentorship to chat.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={requestTo !== null} onOpenChange={(open) => !open && setRequestTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request mentorship</DialogTitle>
            <DialogDescription>From {requestTo?.full_name}. Explain what you're working on and how they can help.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" maxLength={120} value={topic} placeholder="Noise-aware VQE for small molecules" onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" maxLength={1000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestTo(null)}>Cancel</Button>
            <Button disabled={busy || topic.trim().length < 3 || message.trim().length < 10} onClick={submitRequest}>
              {busy ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
