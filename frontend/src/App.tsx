import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import LearnerOnboarding from './pages/LearnerOnboarding';
import FacultyOnboarding from './pages/FacultyOnboarding';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import ResourceLibrary from './pages/ResourceLibrary';
import VideoPlayerPage from './pages/VideoPlayerPage';
import DocumentViewerPage from './pages/DocumentViewerPage';
import NotFound from './pages/NotFound';
import AdminMockup from './pages/AdminMockup';
import AdminPage from './pages/AdminPage';
import VerificationPage from './pages/VerificationPage';
import MentorshipPage from './pages/MentorshipPage';
import StudentAnalyticsPage from './pages/StudentAnalyticsPage';
import StudentJourneyPage from './pages/StudentJourneyPage';
import ClassroomsPage from './pages/ClassroomsPage';
import ClassroomDetailPage from './pages/ClassroomDetailPage';
import ClassroomJourneyPage from './pages/ClassroomJourneyPage';
import JoinClassroomPage from './pages/JoinClassroomPage';
import { STAFF_ROLES, isStaff, onboardingPath } from './lib/roles';
import type { Role } from './lib/roles';
import QuantumLibrary from './pages/QuantumLibrary';
import CourseCatalog from './pages/CourseCatalog';
import CourseDetail from './pages/CourseDetail';
import EducatorDashboard from './pages/EducatorDashboard';
import CourseEditor from './pages/CourseEditor';
import CourseViewer from './pages/CourseViewer';
import LiveSessionRoom from './pages/LiveSessionRoom';
import Settings from './pages/Settings';
import ProfilePage from './pages/ProfilePage';
import AlgorithmExplorerLandingPage from './modules/algorithm-explorer/pages/AlgorithmExplorerLandingPage';
import AlgorithmDetailPage from './modules/algorithm-explorer/pages/AlgorithmDetailPage';
import ConstellationPage from './modules/algorithm-constellation/pages/ConstellationPage';
import GatesPlaygroundPage from './modules/gates-playground/pages/GatesPlaygroundPage';
import QRoutePage from './modules/qroute/pages/QRoutePage';
import QRouteJobDetailPage from './modules/qroute/pages/QRouteJobDetailPage';
import PuzzlesLandingPage from './modules/quantum-puzzles/pages/PuzzlesLandingPage';
import QRatingHubPage from './modules/qrating/pages/QRatingHubPage';
import RoundArenaPage from './modules/qrating/pages/RoundArenaPage';
import StandingsPage from './modules/qrating/pages/StandingsPage';
import PracticePage from './modules/qrating/pages/PracticePage';
import PublicQRatingPage from './modules/qrating/pages/PublicQRatingPage';
import PuzzlePage from './modules/quantum-puzzles/pages/PuzzlePage';
import QForgeLandingPage from './modules/qforge/pages/QForgeLandingPage';
import QForgeBuilderPage from './modules/qforge/pages/QForgeBuilderPage';
import PlaygroundHubPage from './pages/PlaygroundHubPage';
import BlochSphereVisualizer from './components/bloch/BlochSphereVisualizer';
import AppLayout from './components/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoadmapPage } from './features/roadmap/pages/RoadmapPage';
import QplannerPage from './features/qplanner/pages/QplannerPage';
import { QuizPage } from './features/quiz/pages/QuizPage';
import { QuizReviewPage } from './features/quiz/pages/QuizReviewPage';
import { SpacedRepetitionPage } from './features/spaced-repetition/pages/SpacedRepetitionPage';
import { NotesPage } from './features/notes/pages/NotesPage';
import { AssessmentPage } from './features/analytics/pages/AssessmentPage';
import VideoOverviewChatPage from './pages/VideoOverviewChatPage';
import QBookLibraryPage from './modules/qbook/pages/QBookLibraryPage';
import QBookEditorPage from './modules/qbook/pages/QBookEditorPage';
import QStudioLibraryPage from './modules/qstudio/pages/QStudioLibraryPage';
import QStudioStudySpacePage from './modules/qstudio/pages/QStudioStudySpacePage';
import QStudioLocalOnlyPage from './modules/qstudio/pages/QStudioLocalOnlyPage';
import { PomodoroProvider } from './features/focus/context/PomodoroContext';
import FocusModePage from './pages/FocusModePage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});


// Protected Route Wrapper
function ProtectedRoute({ children, allowedRoles, requireVerified }: { children: React.ReactNode, allowedRoles?: Role[], requireVerified?: boolean }) {
  const { currentUser, loading } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setRoleLoading(false);
      return;
    }
    
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const fetchRole = async () => {
      try {
        const token = await currentUser.getIdToken();
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${API_URL}/api/user/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });

        // Artificial delay to let the Neko loading animation play
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (response.ok && isMounted) {
          const data = await response.json();
          setUserRole(data.role);
          setVerificationStatus(data.verification?.status ?? null);
        } else if (response.status === 404 && isMounted) {
          if (!window.location.pathname.startsWith('/onboarding')) {
            window.location.href = onboardingPath();
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return;
        }
        console.error(e);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setRoleLoading(false);
      }
    };
    
    fetchRole();
    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [currentUser]);

  if (loading || roleLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }
  
  if (!currentUser) return <Navigate to="/login" replace />;
  
  if (allowedRoles && userRole && !allowedRoles.includes(userRole as Role)) {
    return <Navigate to={userRole === 'admin' ? '/admin' : '/courses'} replace />;
  }

  if (requireVerified && isStaff(userRole) && verificationStatus !== 'approved') {
    return <Navigate to="/verification" replace />;
  }
  
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Router>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin-demo" element={<AdminMockup />} />
              <Route path="/q-rating/:handle" element={<PublicQRatingPage />} />
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              } />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/onboarding/learner" element={
                <ProtectedRoute>
                  <LearnerOnboarding />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/faculty" element={
                <ProtectedRoute>
                  <FacultyOnboarding />
                </ProtectedRoute>
              } />
              
              {/* Dashboard Routes with Sidebar Layout */}
              <Route element={<PomodoroProvider><AppLayout /></PomodoroProvider>}>
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/focus" element={
                  <ProtectedRoute>
                    <FocusModePage />
                  </ProtectedRoute>
                } />
                <Route path="/roadmap" element={
                  <ProtectedRoute>
                    <RoadmapPage />
                  </ProtectedRoute>
                } />
                <Route path="/qrating" element={
                  <ProtectedRoute>
                    <QRatingHubPage />
                  </ProtectedRoute>
                } />
                <Route path="/qrating/practice" element={
                  <ProtectedRoute>
                    <PracticePage />
                  </ProtectedRoute>
                } />
                <Route path="/qrating/rounds/:roundId" element={
                  <ProtectedRoute>
                    <RoundArenaPage />
                  </ProtectedRoute>
                } />
                <Route path="/qrating/rounds/:roundId/standings" element={
                  <ProtectedRoute>
                    <StandingsPage />
                  </ProtectedRoute>
                } />
                <Route path="/qplanner" element={
                  <ProtectedRoute allowedRoles={['learner']}>
                    <QplannerPage />
                  </ProtectedRoute>
                } />
                {/* Analytics now lives in the Profile page's Progress tab. Kept as a
                    redirect so old links and bookmarks still land somewhere useful. */}
                <Route path="/analytics" element={<Navigate to="/profile?tab=progress" replace />} />
                <Route path="/analytics/assessment/:type" element={
                  <ProtectedRoute>
                    <AssessmentPage />
                  </ProtectedRoute>
                } />
                <Route path="/quiz/:topicSlug" element={
                  <ProtectedRoute>
                    <QuizPage />
                  </ProtectedRoute>
                } />
                <Route path="/quiz/review/:attemptId" element={
                  <ProtectedRoute>
                    <QuizReviewPage />
                  </ProtectedRoute>
                } />
                <Route path="/notes" element={
                  <ProtectedRoute>
                    <NotesPage />
                  </ProtectedRoute>
                } />
                <Route path="/reviews" element={
                  <ProtectedRoute>
                    <SpacedRepetitionPage />
                  </ProtectedRoute>
                } />
                <Route path="/flashcards" element={
                  <ProtectedRoute>
                    <Navigate to="/roadmap" replace />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/verification" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES}>
                    <VerificationPage />
                  </ProtectedRoute>
                } />
                <Route path="/mentorship" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <MentorshipPage />
                  </ProtectedRoute>
                } />
                <Route path="/educator/analytics" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <StudentAnalyticsPage />
                  </ProtectedRoute>
                } />
                <Route path="/educator/analytics/:courseId/:studentUid" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <StudentJourneyPage />
                  </ProtectedRoute>
                } />
                {/* Institutional classrooms: teachers (verified staff) manage, learners join with consent */}
                <Route path="/classrooms" element={
                  <ProtectedRoute allowedRoles={['learner', ...STAFF_ROLES]} requireVerified>
                    <ClassroomsPage />
                  </ProtectedRoute>
                } />
                <Route path="/classrooms/join" element={
                  <ProtectedRoute allowedRoles={['learner', ...STAFF_ROLES]}>
                    <JoinClassroomPage />
                  </ProtectedRoute>
                } />
                <Route path="/classrooms/:classroomId" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <ClassroomDetailPage />
                  </ProtectedRoute>
                } />
                <Route path="/classrooms/:classroomId/students/:studentUid" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <ClassroomJourneyPage />
                  </ProtectedRoute>
                } />
                <Route path="/educator/courses" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <EducatorDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/courses" element={
                  <ProtectedRoute>
                    <CourseCatalog />
                  </ProtectedRoute>
                } />
                <Route path="/resources" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <ResourceLibrary />
                  </ProtectedRoute>
                } />
                
                {/* Quantathon Phase 1 Routes */}
                <Route path="/playground" element={
                  <ProtectedRoute>
                    <PlaygroundHubPage />
                  </ProtectedRoute>
                } />
                <Route path="/playground/gates" element={
                  <ProtectedRoute>
                    <GatesPlaygroundPage />
                  </ProtectedRoute>
                } />
                <Route path="/quantum-library" element={
                  <ProtectedRoute>
                    <QuantumLibrary />
                  </ProtectedRoute>
                } />
                <Route path="/puzzles" element={
                  <ProtectedRoute>
                    <PuzzlesLandingPage />
                  </ProtectedRoute>
                } />
                <Route path="/puzzles/:id" element={
                  <ProtectedRoute>
                    <PuzzlePage />
                  </ProtectedRoute>
                } />
                <Route path="/algorithms" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <AlgorithmExplorerLandingPage />
                  </ProtectedRoute>
                } />
                <Route path="/algorithms/:slug" element={
                  <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                    <AlgorithmDetailPage />
                  </ProtectedRoute>
                } />
                <Route path="/constellation" element={
                  <ProtectedRoute allowedRoles={['learner']}>
                    <ConstellationPage />
                  </ProtectedRoute>
                } />
                <Route path="/constellation/:slug" element={
                  <ProtectedRoute allowedRoles={['learner']}>
                    <AlgorithmDetailPage />
                  </ProtectedRoute>
                } />
                <Route path="/video-overview" element={
                  <ProtectedRoute>
                    <VideoOverviewChatPage />
                  </ProtectedRoute>
                } />
                <Route path="/qbook" element={
                  <ProtectedRoute>
                    <QBookLibraryPage />
                  </ProtectedRoute>
                } />
                <Route path="/qbook/:notebookId" element={
                  <ProtectedRoute>
                    <QBookEditorPage />
                  </ProtectedRoute>
                } />
                <Route path="/qstudio" element={
                  <ProtectedRoute>
                    {import.meta.env.PROD ? <QStudioLocalOnlyPage /> : <QStudioLibraryPage />}
                  </ProtectedRoute>
                } />
                <Route path="/qstudio/:studySpaceId" element={
                  <ProtectedRoute>
                    {import.meta.env.PROD ? <QStudioLocalOnlyPage /> : <QStudioStudySpacePage />}
                  </ProtectedRoute>
                } />
                <Route path="/bloch" element={
                  <ProtectedRoute>
                    <BlochSphereVisualizer />
                  </ProtectedRoute>
                } />
                <Route path="/qroute" element={
                  <ProtectedRoute><QRoutePage /></ProtectedRoute>
                } />
                <Route path="/qroute/jobs/:jobId" element={
                  <ProtectedRoute><QRouteJobDetailPage /></ProtectedRoute>
                } />
                <Route path="/qforge" element={
                  <ProtectedRoute><QForgeLandingPage /></ProtectedRoute>
                } />
                <Route path="/qforge/builder" element={
                  <ProtectedRoute><QForgeBuilderPage /></ProtectedRoute>
                } />
              </Route>

              {/* Standalone Protected Routes */}
              <Route path="/courses/:id" element={
                <ProtectedRoute>
                  <CourseDetail />
                </ProtectedRoute>
              } />
              <Route path="/courses/:id/view" element={
                <ProtectedRoute>
                  <CourseViewer />
                </ProtectedRoute>
              } />
              <Route path="/live/:sessionId" element={
                <ProtectedRoute>
                  <LiveSessionRoom />
                </ProtectedRoute>
              } />
              <Route path="/courses/:id/preview" element={
                <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                  <CourseViewer />
                </ProtectedRoute>
              } />
              <Route path="/educator/courses/:id" element={
                <ProtectedRoute allowedRoles={STAFF_ROLES} requireVerified>
                  <CourseEditor />
                </ProtectedRoute>
              } />
              <Route path="/resources/video/:id" element={
                <ProtectedRoute>
                  <VideoPlayerPage />
                </ProtectedRoute>
              } />
              <Route path="/resources/document/:id" element={
                <ProtectedRoute>
                  <DocumentViewerPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </AuthProvider>
        </TooltipProvider>
        <Toaster 
          richColors 
          position="top-right" 
          toastOptions={{
            style: { fontFamily: 'var(--font-sans)' }
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
