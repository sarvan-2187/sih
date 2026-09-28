import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaBrain, FaCheck, FaTimes, FaMapSigns, FaCodeBranch, FaPlay } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { IconBadge, PageHero, PageShell, tone } from '@/components/explorer';
import { apiClient as api } from '@/lib/apiClient';
import { toast } from 'sonner';

interface ReviewItem {
  _id: string;
  target_id: string;
  target_type: string;
  title: string;
  efactor: number;
  interval: number;
  repetitions: number;
  next_review: string;
}

export const SpacedRepetitionPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [dueItems, setDueItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDueItems();
  }, []);

  const fetchDueItems = async () => {
    try {
      const res = await api.get('/api/v1/reviews/due');
      setDueItems(res.data.data);
    } catch (err) {
      toast.error('Failed to load review items');
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (id: string, rating: number) => {
    try {
      await api.post(`/api/v1/reviews/${id}/rate`, { rating });
      toast.success('Review recorded');
      setDueItems(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      toast.error('Failed to record review');
    }
  };

  const jumpToItem = (item: ReviewItem) => {
    if (item.target_type === 'roadmap') {
      navigate(`/roadmap?topic=${item.target_id}`);
    } else {
      navigate(`/algorithms`);
    }
  };

  if (loading) {
    return (
      <PageShell width="reading">
        <div className={cn("h-12 w-64 rounded animate-pulse", tone.skeleton(theme))} />
        <div className={cn("h-48 w-full rounded-[2rem] animate-pulse", tone.skeleton(theme))} />
      </PageShell>
    );
  }

  return (
    <PageShell width="reading">
      <PageHero
        eyebrow={
          <IconBadge>
            <FaBrain className="w-6 h-6" />
          </IconBadge>
        }
        title="Daily Reviews"
        subtitle="Master concepts permanently using the SM-2 spaced repetition algorithm."
      />

        {dueItems.length === 0 ? (
          <div className={cn("text-center p-12 rounded-[2rem] border", theme === 'dark' ? "bg-zinc-950 border-white/10" : "bg-white border-zinc-200")}>
            <FaCheck className="text-4xl text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-sans mb-2">You're all caught up!</h2>
            <p className={cn("text-sm font-mono max-w-md mx-auto", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
              No items are due for review right now. Explore the Roadmap or Algorithm Explorer and click "Mark for Review" on new topics to add them here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <h2 className="text-sm font-mono font-medium text-emerald-500 uppercase tracking-wider mb-2">
              Due Today ({dueItems.length})
            </h2>
            {dueItems.map(item => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4",
                  theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200 shadow-sm"
                )}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {item.target_type === 'roadmap' ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                        <FaMapSigns /> Roadmap
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center gap-1">
                        <FaCodeBranch /> Algorithm
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-sans font-medium">{item.title}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => jumpToItem(item)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-mono border transition-colors flex items-center gap-2",
                      theme === 'dark' ? "border-white/10 hover:bg-white/10 text-zinc-300" : "border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                    )}
                  >
                    <FaPlay /> Review Topic
                  </button>
                  <div className="h-6 w-px bg-zinc-500/20 mx-1" />
                  
                  {/* Rating Buttons */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRate(item._id, 1)} title="Forgot completely" className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors text-xs font-mono flex items-center justify-center">1</button>
                    <button onClick={() => handleRate(item._id, 3)} title="Hard to recall" className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-colors text-xs font-mono flex items-center justify-center">3</button>
                    <button onClick={() => handleRate(item._id, 5)} title="Easy" className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-colors text-xs font-mono flex items-center justify-center">5</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
    </PageShell>
  );
};
