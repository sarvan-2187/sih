import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '../context/AuthContext';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { useEffect, useState } from 'react';
import { FaBookOpen, FaCog, FaSignOutAlt, FaUpload, FaHome, FaFolderOpen, FaFlask, FaProjectDiagram, FaStickyNote, FaGlobe, FaBolt, FaFire, FaBook, FaChartLine, FaPuzzlePiece, FaUser, FaSatelliteDish, FaLightbulb, FaShareAlt, FaStopwatch, FaBrain, FaShieldAlt, FaUserFriends, FaChartBar, FaSchool, FaBullseye, FaMedal } from 'react-icons/fa';
import { isStaff } from '@/lib/roles';
import { Separator } from '@/components/ui/separator';
import { fetchXpSummary, fetchStreakStatus } from '@/features/gamification/api';
import type { XpSummary, StreakStatus } from '@/features/gamification/types/gamification.types';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { DailyXpModal } from '@/features/gamification/components/DailyXpModal';
import { PomodoroFAB } from '@/features/focus/components/PomodoroFAB';
import { usePomodoro } from '@/features/focus/hooks/usePomodoro';
import { NotificationBell } from '@/components/NotificationBell';
import { QriousCodeLauncher, QriousCodePanel, QriousCodeProvider } from '@/features/qrious-code/QriousCode';

export default function AppLayout() {

  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState<any>(null);
  const [xpSummary, setXpSummary] = useState<XpSummary | null>(null);
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [isXpModalOpen, setIsXpModalOpen] = useState(false);
  const { state: pomodoroState } = usePomodoro();
  
  const focusMins = String(Math.floor(pomodoroState.secondsLeft / 60)).padStart(2, '0');
  const focusSecs = String(pomodoroState.secondsLeft % 60).padStart(2, '0');
  const focusText = pomodoroState.isRunning 
    ? `${focusMins}m ${focusSecs}s` 
    : 'Focus Mode';

  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${API_URL}/api/user/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
          if (!isStaff(data.role)) {
            fetchGamificationHeader();
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data", error);
      }
    }
    async function fetchGamificationHeader() {
      try {
        const [xp, streak] = await Promise.all([fetchXpSummary(), fetchStreakStatus()]);
        setXpSummary(xp);
        setStreakStatus(streak);
      } catch (err) {
        console.error("Failed to load header gamification data", err);
      }
    }
    fetchUserData();
    
    const handleXpUpdate = () => {
      if (!isStaff(userData?.role)) {
        fetchGamificationHeader();
      }
    };

    window.addEventListener('xp_updated', handleXpUpdate);
    return () => {
      window.removeEventListener('xp_updated', handleXpUpdate);
    };
  }, [currentUser, location.pathname, userData?.role]);


  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Researchers get the educator tool set; both need identity verification to use it.
  const isEducator = isStaff(userData?.role);
  const isResearcher = userData?.role === 'researcher';
  const isVerified = userData?.verification?.status === 'approved';

  return (
    <SidebarProvider>
      <QriousCodeProvider>
      <Sidebar>
        <SidebarHeader className="p-4 pb-2">
          <Link to="/dashboard" className="flex items-center gap-3 text-xl font-sans transition-colors text-foreground">
            <img src="/apple-touch-icon.png" alt="Qrious Logo" className="w-8 h-8 rounded-full shadow-sm" />
            <span className="tracking-tight">Qrious</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/dashboard'} tooltip="Dashboard">
                  <Link to="/dashboard">
                    <FaHome />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/courses'} tooltip="Course Catalog">
                  <Link to="/courses">
                    <FaBookOpen />
                    <span>Course Catalog</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Learning Tools</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/roadmap'} tooltip="Quantum Roadmap">
                  <Link to="/roadmap">
                    <FaProjectDiagram />
                    <span>Quantum Roadmap</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!isEducator && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/qplanner'} tooltip="Qplanner">
                    <Link to="/qplanner">
                      <FaBullseye />
                      <span>Qplanner</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/notes'} tooltip="Personal Notes">
                  <Link to="/notes">
                    <FaStickyNote />
                    <span>Personal Notes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>


              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/playground')} tooltip="Quantum Playground">
                  <Link to="/playground">
                    <FaFlask />
                    <span>Quantum Playground</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/puzzles')} tooltip="Gate Puzzles">
                  <Link to="/puzzles">
                    <FaPuzzlePiece />
                    <span>Gate Puzzles</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/qrating')} tooltip="Q-Rating">
                  <Link to="/qrating">
                    <FaMedal />
                    <span>Q-Rating</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isEducator && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/algorithms'} tooltip="Algorithm Explorer">
                    <Link to="/algorithms">
                      <FaBookOpen />
                      <span>Algorithm Explorer</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!isEducator && userData?.role === 'learner' && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith('/classrooms')} tooltip="My Classrooms">
                    <Link to="/classrooms">
                      <FaSchool />
                      <span>My Classrooms</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!isEducator && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/constellation'} tooltip="Algorithm Constellation">
                    <Link to="/constellation">
                      <FaShareAlt />
                      <span>Algorithm Constellation</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/qbook')} tooltip="QBook">
                  <Link to="/qbook">
                    <FaBook />
                    <span>QBook</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/qstudio')} tooltip="QStudio">
                  <Link to="/qstudio">
                    <FaLightbulb />
                    <span>QStudio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/bloch'} tooltip="3D Bloch Sphere">
                  <Link to="/bloch">
                    <FaGlobe />
                    <span>3D Bloch Sphere</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/qroute'} tooltip="QRoute">
                  <Link to="/qroute">
                    <FaSatelliteDish />
                    <span>QRoute</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/focus'} tooltip={focusText}>
                  <Link to="/focus">
                    <FaStopwatch />
                    <span>{focusText}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          {isEducator && (
            <SidebarGroup>
              <SidebarGroupLabel>{isResearcher ? 'Researcher Tools' : 'Educator Tools'}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/verification'} tooltip="Identity Verification">
                    <Link to="/verification">
                      <FaShieldAlt />
                      <span>{isVerified ? 'Verified' : 'Verify Identity'}</span>
                      {userData && !isVerified && <span className="ml-auto h-2 w-2 rounded-full bg-primary" aria-label="Action needed" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/mentorship'} tooltip="Mentorship">
                    <Link to="/mentorship">
                      <FaUserFriends />
                      <span>Mentorship</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/educator/courses'} tooltip="Manage Courses">
                    <Link to="/educator/courses">
                      <FaUpload />
                      <span>Manage Courses</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith('/classrooms')} tooltip="Classrooms">
                    <Link to="/classrooms">
                      <FaSchool />
                      <span>Classrooms</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith('/educator/analytics')} tooltip="Student Analytics">
                    <Link to="/educator/analytics">
                      <FaChartBar />
                      <span>Student Analytics</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/resources'} tooltip="Resource Library">
                    <Link to="/resources">
                      <FaFolderOpen />
                      <span>Resource Library</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/profile'} tooltip="Profile">
                  <Link to="/profile">
                    <FaUser />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/settings'} tooltip="Settings">
                  <Link to="/settings">
                    <FaCog />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10" tooltip="Log Out">
                  <FaSignOutAlt />
                  <span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex-1 overflow-hidden bg-background">
        {/* Global Persistent Header Bar */}
        <header className={cn(
          "h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b backdrop-blur-md sticky top-0 z-20 font-sans",
          theme === 'dark' ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-zinc-200"
        )}>
          <div className="flex items-center gap-3">
            <SidebarTrigger className={cn("-ml-1", theme === 'dark' ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-zinc-900")} />
            <Separator orientation="vertical" className={cn("h-5", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
            <span className={cn(
              "tracking-tight hidden sm:inline text-sm font-sans",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>Qrious Quantum Platform</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
          {/* Gamification Status Badges & Notification Bell (Learners Only) */}
          {!isEducator && (
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono transition-opacity duration-500">
              {xpSummary && (
                <div
                  onClick={() => setIsXpModalOpen(true)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-300 shadow-sm border hover:scale-[1.03] group",
                    theme === 'dark'
                      ? "bg-zinc-900/60 border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-zinc-900"
                      : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-100"
                  )}
                  title="Click to view Daily XP Breakdown & Activity Ledger"
                >
                  <FaBolt className={cn(
                    "text-xs transition-transform group-hover:scale-110",
                    theme === 'dark' ? "text-zinc-400 group-hover:text-zinc-200" : "text-zinc-500 group-hover:text-zinc-700"
                  )} />
                  <span className="font-medium">{xpSummary.xp_total} XP</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md hidden md:inline font-sans",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-600"
                  )}>
                    Lvl {xpSummary.level} {xpSummary.rank_title}
                  </span>
                </div>
              )}

              {streakStatus && (
                <div
                  onClick={() => navigate('/profile')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-300 shadow-sm border hover:scale-[1.03] group",
                    theme === 'dark'
                      ? "bg-zinc-900/60 border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-zinc-900"
                      : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-100"
                  )}
                  title="Click to view Streak details on Profile"
                >
                  <FaFire className={cn(
                    "text-xs transition-transform",
                    theme === 'dark' ? "text-zinc-400 group-hover:text-zinc-200" : "text-zinc-500 group-hover:text-zinc-700"
                  )} />
                  <span className="font-medium">{streakStatus.current_streak}d Streak</span>
                </div>
              )}
              
              <NotificationBell />
            </div>
          )}
          </div>
        </header>

        {/* Main Content Area, with Qrious Code docked on the right when open */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <QriousCodePanel />
        </div>

        {/* Qrious Code's Schrodinger's-cat launcher, bottom-right on every page */}
        <QriousCodeLauncher />

        {!isEducator && (
          <>
            <DailyXpModal
              isOpen={isXpModalOpen}
              onClose={() => setIsXpModalOpen(false)}
              xpSummary={xpSummary}
            />
            <PomodoroFAB />
          </>
        )}
      </SidebarInset>
      </QriousCodeProvider>
    </SidebarProvider>
  );
}
