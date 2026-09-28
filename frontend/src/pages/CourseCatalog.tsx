import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { listPublishedCourses, listEnrolledCourses, getCourseProgress, listEducatorCourses } from '../api/courses';
import { CertificateGenerator } from '../components/CertificateGenerator';
import type { Course } from '../api/courses';
import { DEMO_COURSES } from '@/data/demoDomainCourses';
import { PageHero, PageShell } from '@/components/explorer';
import { isStaff } from '@/lib/roles';

const DOMAIN_CATEGORIES = [
  { id: 'All', label: 'All Domains' },
  { id: 'CS', label: 'Computer Science' },
  { id: 'Civil', label: 'Civil & Structural' },
  { id: 'Mechanical', label: 'Mechanical & Fluid' },
  { id: 'Electrical', label: 'Electrical & Control' },
  { id: 'Hardware', label: 'Hardware Fundamentals' },
];

export default function CourseCatalog() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Course[]>([]);
  const [myTeachings, setMyTeachings] = useState<Course[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        let role = null;
        if (currentUser) {
          try {
            const token = await currentUser.getIdToken();
            const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
            const res = await fetch(`${API_URL}/api/user/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
              const data = await res.json();
              role = data.role;
              setUserRole(role);
            }
          } catch (e) {}
        }

        const [publishedData, enrolledData] = await Promise.all([
          listPublishedCourses(),
          listEnrolledCourses()
        ]);
        setCourses(publishedData);
        setEnrolledCourses(enrolledData);
        
        // Fetch progress for enrolled courses to identify completed ones
        const progressPromises = enrolledData.map(c => getCourseProgress(c.id).catch(() => null));
        const progressResults = await Promise.all(progressPromises);
        
        const completed = enrolledData.filter((_, idx) => {
           const p = progressResults[idx];
           return p && p.progress_percentage === 100;
        });
        setCompletedCourses(completed);

        if (isStaff(role)) {
          try {
            const teachings = await listEducatorCourses();
            setMyTeachings(teachings);
          } catch (e) {
            console.error(e);
          }
        }
      } catch (err) {
        console.error("Error fetching courses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [currentUser]);

  const filteredPublishedCourses = useMemo(() => {
    if (selectedCategory === 'All') return courses;
    return courses.filter(c => c.category === selectedCategory);
  }, [courses, selectedCategory]);

  const filteredDemoCourses = useMemo(() => {
    const publishedTitles = new Set(courses.map(c => c.title.toLowerCase().trim()));
    const remainingDemos = DEMO_COURSES.filter(d => !publishedTitles.has(d.title.toLowerCase().trim()));
    if (selectedCategory === 'All') return remainingDemos;
    return remainingDemos.filter(c => c.category === selectedCategory);
  }, [courses, selectedCategory]);

  return (
    <PageShell gap="tight">
      <PageHero
        title="Course Catalog"
        subtitle="Explore foundational quantum computing and domain-specific engineering applications."
      />
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className={`mb-6 flex w-full max-w-3xl justify-start sm:grid overflow-x-auto h-auto sm:h-10 p-1 ${isStaff(userRole) ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <TabsTrigger value="all">All Courses</TabsTrigger>
          <TabsTrigger value="enrolled">My Enrolled Courses</TabsTrigger>
          <TabsTrigger value="certificates">My Certificates</TabsTrigger>
          {isStaff(userRole) && <TabsTrigger value="teachings">My Teachings</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="all" className="mt-0 space-y-6">
          {/* Domain Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Discipline:</span>
            {DOMAIN_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                    : 'border-transparent text-zinc-500 hover:border-emerald-500/30 hover:text-emerald-500'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="hover:shadow-lg transition-shadow border-border/50">
                  <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-5/6 mb-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Render Backend Published Courses */}
              {filteredPublishedCourses.map(c => (
                <Card key={c.id} className="hover:shadow-lg transition-all border-emerald-500/30 bg-card/80 backdrop-blur hover:border-emerald-500/60 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                        {c.category ? `${c.category} Engineering` : 'Quantum Course'}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {c.level || 'Interactive'}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg group-hover:text-emerald-300 transition-colors">
                      <Link to={`/courses/${c.id}`} className="hover:underline">{c.title}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">{c.description}</p>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {c.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
                      <span>⏱️ {c.duration || 'Self-Paced'}</span>
                      <Link to={`/courses/${c.id}`} className="font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center">
                        Explore Course <span className="ml-1">→</span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrolled" className="mt-0 space-y-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="hover:shadow-lg transition-shadow border-border/50">
                  <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-5/6 mb-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : enrolledCourses.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-border">
              <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Check out the 'All Courses' tab to discover something new.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map(c => (
                <Card key={c.id} className="hover:shadow-lg transition-shadow border-primary/20">
                  <CardHeader>
                    <CardTitle>
                      <Link to={`/courses/${c.id}`} className="text-primary hover:underline">{c.title}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">{c.description}</p>
                    <div className="mt-4 flex items-center text-primary text-sm font-semibold">
                      Continue Learning <span className="ml-2">→</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certificates" className="mt-0 space-y-8">
          {loading ? (
             <div className="flex justify-center py-20">
               <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : completedCourses.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-border">
              <p className="text-muted-foreground">You don't have any certificates yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Complete a course to earn your first certificate!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCourses.map(c => (
                <Dialog key={c.id}>
                  <DialogTrigger asChild>
                    <Card className="hover:shadow-lg transition-shadow border-primary/20 cursor-pointer group">
                      <CardHeader>
                        <CardTitle className="group-hover:text-primary transition-colors">{c.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground line-clamp-2">{c.description}</p>
                        <div className="mt-4 flex items-center text-primary text-sm font-semibold">
                          View Certificate <span className="ml-2">→</span>
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl border-border/50 bg-background/95 backdrop-blur p-1 sm:p-6 overflow-x-auto">
                    <CertificateGenerator
                      studentName={currentUser?.displayName || (currentUser as any)?.full_name || 'Student'}
                      courseName={c.title}
                      completionDate={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    />
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          )}
        </TabsContent>

        {isStaff(userRole) && (
          <TabsContent value="teachings" className="mt-0 space-y-4">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="hover:shadow-lg transition-shadow border-border/50">
                    <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-5/6 mb-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : myTeachings.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-border">
                <p className="text-muted-foreground">You haven't created any courses yet.</p>
                <Link to="/educator/courses" className="text-primary hover:underline mt-2 inline-block">Go to Educator Dashboard to create one</Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myTeachings.map(c => (
                  <Card key={c.id} className="hover:shadow-lg transition-shadow border-primary/20">
                    <CardHeader>
                      <CardTitle>
                        <Link to={`/courses/${c.id}`} className="text-primary hover:underline">{c.title}</Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground line-clamp-3">{c.description}</p>
                      <div className="mt-4 flex items-center text-primary text-sm font-semibold">
                        View Course <span className="ml-2">→</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}

