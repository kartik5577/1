import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Calendar, Clock, ArrowRight, X, PlayCircle, ExternalLink, GraduationCap, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { CountdownTimer } from './CountdownTimer';

interface LiveClass {
  id: string;
  title: string;
  date?: string;
  time?: string;
  scheduledAt?: string;
  status: 'live' | 'upcoming' | 'completed' | 'cancelled';
  subject?: string;
  grade?: string;
  instructor?: string;
  description?: string;
  thumbnail?: string;
  courseId?: string;
}

interface LiveScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const parseDateTimeToIST = (dateStr?: string, timeStr?: string) => {
  if (!dateStr) return null;
  try {
    if (dateStr.includes('T') || dateStr.includes('Z')) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) return null;
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    
    let hour = 12;
    let minute = 0;
    let second = 0;
    if (timeStr) {
      const timeParts = timeStr.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
      if (timeParts) {
        hour = parseInt(timeParts[1]);
        minute = parseInt(timeParts[2]);
        if (timeParts[3]) second = parseInt(timeParts[3]);
        const ampm = timeParts[4];
        if (ampm && ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      } else {
        const parts = timeStr.split(/[:\s]/);
        if (parts.length >= 2) {
          hour = parseInt(parts[0]) || 12;
          minute = parseInt(parts[1]) || 0;
        }
      }
    }
    
    const forceISTString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}+05:30`;
    const d = new Date(forceISTString);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

export default function LiveScheduleModal({ isOpen, onClose }: LiveScheduleModalProps) {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'liveClasses'),
      where('status', 'in', ['live', 'upcoming', 'completed']),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiveClass[];

      // Sort: Live classes first, then upcoming by date/time
      const sorted = docs.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        // Secondary sort by date if available
        const dateA = (a.scheduledAt ? new Date(a.scheduledAt) : parseDateTimeToIST(a.date, a.time))?.getTime() || 0;
        const dateB = (b.scheduledAt ? new Date(b.scheduledAt) : parseDateTimeToIST(b.date, b.time))?.getTime() || 0;
        return dateA - dateB;
      });

      setClasses(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleJoin = (liveClass: LiveClass) => {
    if (!user) {
      navigate('/login');
      onClose();
      return;
    }

    if (liveClass.status === 'live') {
      const isOwned = isAdmin || 
                    (liveClass as any).isFree || 
                    Number((liveClass as any).price) <= 0 ||
                    profile?.purchasedItems?.includes(liveClass.id) ||
                    (liveClass.courseId && profile?.purchasedItems?.includes(liveClass.courseId));

      if (!isOwned && liveClass.courseId) {
        navigate(`/course/${liveClass.courseId}`);
        onClose();
        return;
      }

      if (liveClass.courseId) {
        navigate(`/course/${liveClass.courseId}?item=${liveClass.id}&type=live&autoJoin=true`);
      } else {
        // Fallback if no courseId (though admin should always set it)
        navigate(`/courses?contentType=Live&id=${liveClass.id}&autoJoin=true`);
      }
      onClose();
    }
  };

  const formatDate = (item: LiveClass) => {
    const rawDate = item.scheduledAt || item.date || '';
    if (!rawDate) return 'TBA';
    
    try {
      const date = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
      if (!date || isNaN(date.getTime())) return rawDate;
      
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch {
      return rawDate;
    }
  };

  const formatTime = (item: LiveClass) => {
    const rawTime = item.time || '';
    const date = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
    if (!date || isNaN(date.getTime())) return rawTime || 'TBA';
    
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(date);
    } catch {
      return rawTime || 'TBA';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-white/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Live Session Schedule</h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Don't miss out on interactive learning</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-all flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <PlayCircle className="w-12 h-12 text-rose-500 animate-spin" />
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Loading Schedule...</p>
                </div>
              ) : classes.length > 0 ? (
                classes.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    className={cn(
                      "group p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                      item.status === 'live' 
                        ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/50" 
                        : "bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5 hover:border-blue-500/50"
                    )}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                          item.status === 'live' ? "bg-rose-500 text-white" : "bg-blue-600 text-white"
                        )}>
                          {item.status === 'live' ? <Radio className="w-7 h-7 animate-pulse" /> : <Calendar className="w-7 h-7" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                              item.status === 'live' ? "bg-rose-500 text-white animate-pulse" : 
                              ((() => {
                                const d = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
                                return d && d < new Date();
                              })() ? "bg-zinc-500 text-white" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400")
                            )}>
                              {item.status === 'live' ? 'Live' : ((() => {
                                const d = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
                                return d && d < new Date() ? 'Passed' : 'Upcoming';
                              })())}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" /> {item.grade || '6-12'} Class
                            </span>
                          </div>
                          <h3 className="text-lg font-black dark:text-white uppercase tracking-tight line-clamp-1 group-hover:text-rose-500 transition-colors">
                            {item.title}
                          </h3>
                          {item.instructor && (
                            <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-1">
                              Instructor: {item.instructor}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(item)}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(item)}</span>
                            {(() => {
                              const d = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
                              if (item.status === 'upcoming' && d && d > new Date()) {
                                return (
                                  <span className="flex items-center gap-1.5 text-rose-500 px-2 py-0.5 bg-rose-500/5 rounded-lg border border-rose-500/20">
                                    <Clock className="w-3 h-3 animate-pulse" />
                                    <CountdownTimer targetDate={d.toISOString()} />
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-zinc-400 font-medium mt-2 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isAdmin && (
                          <button 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              if (window.confirm(`Delete "${item.title}"?`)) {
                                try {
                                  await deleteDoc(doc(db, 'liveClasses', item.id));
                                } catch (err) {
                                  console.error('Failed to delete:', err);
                                }
                              }
                            }}
                            className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            title="Admin Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        {item.status === 'live' ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleJoin(item); }}
                            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20 active:scale-95 group-hover:scale-105"
                          >
                            Join Now <PlayCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className={cn(
                            "px-6 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                            ((() => {
                              const d = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
                              return d && d < new Date();
                            })())
                              ? "bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-400"
                              : "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                          )}>
                            <Clock className="w-4 h-4" />
                            <span>{((() => {
                              const d = parseDateTimeToIST(item.scheduledAt || item.date || '', item.time);
                              return d && d < new Date() ? 'Time Passed' : (item.date ? 'Coming Soon' : 'Waiting');
                            })())}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
                  <Calendar className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest text-zinc-400">No upcoming classes scheduled</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t dark:border-zinc-800 text-center">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">
                Live classes are available for enrolled students only. <br />
                Ensure you have a stable internet connection for the best experience.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
