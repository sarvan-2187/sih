import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import QuantumNewsRadar from '../components/QuantumNewsRadar';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

import { Leaderboard } from '../modules/quantum-puzzles/components/Leaderboard';
import { isStaff } from '@/lib/roles';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        }
      } catch (error) {
        console.error("Failed to fetch user data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, [currentUser]);

  return (
    <div className={cn(
      "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
      theme === 'dark' ? "text-white" : "text-zinc-900"
    )}>
      <div className="max-w-[1600px] mx-auto flex flex-col gap-12">
        {/* Hero Profile Header §1.2 */}
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
                `Welcome, ${userData?.full_name || currentUser?.displayName?.split(' ')[0] || 'Explorer'}!`
              )}
            </motion.h1>
            <motion.p
              className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Your exploration into the quantum realm continues here. Keep learning and explore the latest news!
            </motion.p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={isStaff(userData?.role) ? "lg:col-span-3" : "lg:col-span-2"}>
            {/* Quantum News Daily Pulse */}
            <QuantumNewsRadar variant={isStaff(userData?.role) ? "educator" : "student"} />
          </div>
          {!isStaff(userData?.role) && (
            <div>
              {/* Leaderboard Column */}
              <Leaderboard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
