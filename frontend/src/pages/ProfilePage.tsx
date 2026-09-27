import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { XPBar } from '@/features/gamification/components/XPBar';
import { StreakCalendar } from '@/features/gamification/components/StreakCalendar';
import { BadgeGrid } from '@/features/gamification/components/BadgeGrid';
import { BadgeUnlockModal } from '@/features/gamification/components/BadgeUnlockModal';
import { fetchXpSummary, fetchBadgesCatalog, fetchStreakStatus, checkNewBadges } from '@/features/gamification/api';
import type { XpSummary, Badge, StreakStatus } from '@/features/gamification/types/gamification.types';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { FaUser, FaEnvelope, FaGraduationCap, FaCompass } from 'react-icons/fa';
import { isStaff } from '@/lib/roles';

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Gamification states
  const [xpSummary, setXpSummary] = useState<XpSummary | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [unlockedModalBadge, setUnlockedModalBadge] = useState<Badge | null>(null);

  const loadGamification = async () => {
    try {
      const [xp, bList, streak, newlyUnlocked] = await Promise.all([
        fetchXpSummary(),
        fetchBadgesCatalog(),
        fetchStreakStatus(),
        checkNewBadges()
      ]);
      setXpSummary(xp);
      setBadges(bList);
      setStreakStatus(streak);
      if (newlyUnlocked && newlyUnlocked.length > 0) {
        setUnlockedModalBadge(newlyUnlocked[0]);
      }
    } catch (err) {
      console.error('Failed to load gamification data:', err);
    }
  };

  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${API_URL}/api/user/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
          if (!isStaff(data.role)) {
            loadGamification();
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, [currentUser]);

  const isEducator = isStaff(userData?.role);

  return (
    <div className={cn(
      "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
      theme === 'dark' ? "text-white" : "text-zinc-900"
    )}>
      <div className="max-w-[1600px] mx-auto flex flex-col gap-12">
        {/* Profile Header §1.2 */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="shrink-0">
            {loading ? (
              <Skeleton className={cn("w-20 h-20 rounded-full", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
            ) : (
              <Avatar className={cn("w-20 h-20 shadow-sm border-2", theme === 'dark' ? "border-white/10" : "border-zinc-200")}>
                <AvatarImage src={currentUser?.photoURL || ''} alt="Profile" />
                <AvatarFallback className="text-2xl font-sans bg-emerald-500 text-white">
                  {userData?.full_name ? userData.full_name.charAt(0).toUpperCase() : currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          <div className="flex flex-col gap-3 max-w-3xl text-center md:text-left">
            <motion.h1
              className="text-4xl md:text-5xl font-sans tracking-tight font-normal"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {loading ? (
                <Skeleton className={cn("h-12 w-80 md:mx-0 mx-auto rounded-lg", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
              ) : (
                userData?.full_name || currentUser?.displayName || 'Educator'
              )}
            </motion.h1>
            <motion.p
              className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {isEducator
                ? "Manage your educator profile, course preferences, and system metadata."
                : "Manage your profile, view learning status, streaks, and achievement badges."}
            </motion.p>
          </div>
        </div>

        {/* Level XP Bar (Learners Only) */}
        {!isEducator && <XPBar xpSummary={xpSummary} loading={loading} />}

        {/* Grid: Streak Calendar (Learners Only) + Account Status Card */}
        <div className={cn("grid gap-8", !isEducator ? "md:grid-cols-2" : "grid-cols-1 max-w-2xl")}>
          {!isEducator && (
            <StreakCalendar streakStatus={streakStatus} loading={loading} onRefresh={loadGamification} />
          )}

          {/* Account Status Card §1.4 */}
          <motion.div
            className={cn(
              "p-8 rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full group relative hover:scale-[1.015]",
              theme === 'dark'
                ? "bg-zinc-950/50 border-white/10 hover:border-white/20 hover:bg-zinc-900/30"
                : "bg-white border-zinc-200 hover:border-zinc-300"
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <div className="flex items-center gap-4 mb-6">
                {/* Icon badge §1.5 */}
                <div className={cn(
                  "w-12 h-12 rounded-2xl border flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-105",
                  theme === 'dark' 
                    ? "bg-black border-white/10 text-zinc-400 group-hover:text-zinc-200" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-700 group-hover:text-zinc-900"
                )}>
                  <FaUser className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-sans tracking-tight">Account Details</h3>
                  <p className={cn("text-xs", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                    Your primary login and system metadata
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="space-y-4">
                  <Skeleton className={cn("h-4 w-48", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
                  <Skeleton className={cn("h-4 w-32", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
                </div>
              ) : (
                <div className="space-y-4 font-sans text-sm">
                  <div className="flex items-center gap-3">
                    <FaEnvelope className={cn("text-base shrink-0", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")} />
                    <div>
                      <div className={cn("text-xs font-mono uppercase", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Email Address</div>
                      <div className="text-base font-medium">{currentUser?.email}</div>
                    </div>
                  </div>

                  {userData?.role && (
                    <div className="flex items-center gap-3">
                      <FaGraduationCap className={cn("text-base shrink-0", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")} />
                      <div>
                        <div className={cn("text-xs font-mono uppercase", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Account Role</div>
                        <div className="text-base capitalize font-medium text-emerald-500">{userData.role}</div>
                      </div>
                    </div>
                  )}

                  {userData?.interested_topic && (
                    <div className="flex items-center gap-3">
                      <FaCompass className={cn("text-base shrink-0", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")} />
                      <div>
                        <div className={cn("text-xs font-mono uppercase", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Primary Interest</div>
                        <div className="text-base font-medium">{userData.interested_topic}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Achievement Badges Catalog Grid (Learners Only) */}
        {!isEducator && <BadgeGrid badges={badges} loading={loading} />}

        {/* Celebration Modal for newly unlocked badge */}
        {!isEducator && unlockedModalBadge && (
          <BadgeUnlockModal badge={unlockedModalBadge} onClose={() => setUnlockedModalBadge(null)} />
        )}
      </div>
    </div>
  );
}
