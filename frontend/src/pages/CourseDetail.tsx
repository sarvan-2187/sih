import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaBookOpen } from 'react-icons/fa';
import { EmptyState, PageHero, PageShell } from '@/components/explorer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getCourse, enrollCourse, getCourseProgress } from '../api/courses';
import { listLiveSessions, startLiveSession, type LiveSession } from '../api/liveSessions';
import { CertificateGenerator } from '../components/CertificateGenerator';

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [progress, setProgress] = useState<{ progress_percentage: number } | null>(null);

  const fetchCourse = async (isCancelled: () => boolean) => {
    if (!id) return;
    try {
      const data = await getCourse(id);
      if (isCancelled()) return;
      setCourse(data);
      if (data.format && data.format !== 'recorded') {
        const sessions = await listLiveSessions(id);
        if (isCancelled()) return;
        setLiveSessions(sessions);
      }
      if (data.enrolled || currentUser?.uid === data.owner_uid) {
        try {
          const p = await getCourseProgress(id);
          if (isCancelled()) return;
          setProgress(p);
        } catch (e) {
          console.error("Error fetching progress", e);
        }
      }
    } catch (err) {
      if (isCancelled()) return;
      console.error("Error fetching course", err);
      toast.error("Failed to load course details");
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  };

  useEffect(() => {
    if (!(id && currentUser)) return;
    // StrictMode double-invokes effects in dev, which would otherwise fire
    // fetchCourse() twice concurrently and toast twice on any transient
    // failure — this guard makes only the latest invocation's result apply
    // (the same pattern React's own docs recommend for async effects), so a
    // stale in-flight request from a superseded mount/id change is ignored
    // instead of racing the current one.
    let cancelled = false;
    fetchCourse(() => cancelled);
    return () => { cancelled = true; };
  }, [id, currentUser]);

  const enroll = async () => {
    if (!id) return;
    setEnrolling(true);
    const toastId = toast.loading("Enrolling in course...");
    try {
      await enrollCourse(id);
      
      // Fetch fresh course data to ensure we have the latest modules/lessons
      const data = await getCourse(id);
      setCourse(data);
      
      toast.success("Successfully enrolled!", { id: toastId });
      navigate(`/courses/${id}/view`);
    } catch (err) {
      console.error("Error enrolling", err);
      toast.error("Failed to enroll in the course. Please try again.", { id: toastId });
    } finally {
      setEnrolling(false);
    }
  };

  async function handleStartSession(sessionId: string) {
    if (!window.confirm("Are you sure you want to start this live session now?")) return;
    const toastId = toast.loading("Starting session...");
    try {
      await startLiveSession(sessionId);
      toast.success("Session started!", { id: toastId });
      navigate(`/live/${sessionId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start session", { id: toastId });
    }
  }

  if (loading) return (
    <PageShell width="reading" gap="tight">
      <Skeleton className="h-10 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <Skeleton className="h-10 w-32 mt-4 mb-8" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 mb-4" />
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
  if (!course)
    return (
      <PageShell width="reading">
        <EmptyState icon={<FaBookOpen className="w-6 h-6" />} title="Course not found" />
      </PageShell>
    );

  return (
    <PageShell width="reading" gap="tight">
      <PageHero title={course.title} subtitle={course.description} />
      
      {!course.enrolled && currentUser?.uid !== course.owner_uid ? (
        <Button onClick={enroll} disabled={enrolling} className="mb-8 font-medium">
          {enrolling ? "Enrolling..." : "Enroll in Course"}
        </Button>
      ) : (
        <Button 
          onClick={() => navigate(`/courses/${id}/view`)}
          className="mb-8 font-medium"
        >
          {currentUser?.uid === course.owner_uid ? "View Course" : "Continue Course"}
        </Button>
      )}

      <div className="space-y-6">
        {progress?.progress_percentage === 100 && currentUser && currentUser.uid !== course.owner_uid && (
          <CertificateGenerator
            studentName={currentUser.displayName || (currentUser as any).full_name || 'Student'}
            courseName={course.title}
            completionDate={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          />
        )}
        <h2 className="text-2xl font-semibold mb-4">Curriculum</h2>
        {course.modules?.map((m: any) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="text-xl">Module {m.order}: {m.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {m.lessons?.map((l: any) => (
                  <li key={l.id} className="p-3 border rounded bg-card text-foreground font-medium flex items-center justify-between">
                    <span>{l.order}. {l.title}</span>
                    {!(course.enrolled || currentUser?.uid === course.owner_uid) && (
                      <Badge variant="secondary">
                        Enroll to view
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {course.format && course.format !== "recorded" && (
        <div className="mt-10 pt-8 border-t border-border">
          <h2 className="text-2xl font-semibold mb-4">Live Sessions</h2>
          {liveSessions.map((session) => (
            <div key={session.id} className="p-4 border rounded-lg mb-3 flex justify-between items-center bg-card">
              <div>
                <h3 className="font-medium text-lg">{session.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {session.status === 'live' ? 'Live now' : new Date(session.scheduled_at).toLocaleString()}
                </p>
              </div>
              {session.status === 'live' && (
                <Link to={`/live/${session.id}`}>
                  <Button variant="default">Join Live</Button>
                </Link>
              )}
              {session.status === 'recording_ready' && (
                <Button variant="outline" onClick={() => navigate(`/courses/${id}/view`)}>Watch Recording</Button>
              )}
              {session.status === 'recording_processing' && (
                <span className="text-sm text-muted-foreground italic">Processing recording...</span>
              )}
              {session.status === 'scheduled' && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Scheduled</span>
                  {currentUser?.uid === course.owner_uid && (
                    <Button variant="default" onClick={() => handleStartSession(session.id)}>Start Session</Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {liveSessions.length === 0 && (
            <div className="p-4 md:p-8 text-center text-muted-foreground bg-secondary/50 rounded-lg">
              No live sessions scheduled.
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
