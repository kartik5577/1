import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, ArrowRight, X, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import LiveScheduleModal, { parseDateTimeToIST } from './LiveScheduleModal';
import { useAuth } from '../hooks/useAuth';
import { CountdownTimer } from './CountdownTimer';

export default function LiveNotification() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Query for classes that are either UPCOMING or LIVE
    const q = query(
      collection(db, 'liveClasses'),
      where('status', 'in', ['upcoming', 'live', 'completed'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => {
        // Show LIVE first, then UPCOMING, then COMPLETED
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        return 0;
      });

      setLiveClasses(classes);
      // Reset visibility when a new class appears
      if (classes.length > 0) {
        setIsVisible(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const isHomeOrAdmin = location.pathname === '/' || location.pathname === '/landing' || location.pathname.startsWith('/admin') || location.pathname.startsWith('/dashboard');

  if (!isHomeOrAdmin || liveClasses.length === 0 || !isVisible) return null;

  const currentClass = liveClasses[0];
  const isCurrentlyLive = currentClass.status === 'live';
  const isCompleted = currentClass.status === 'completed';

  const handleAction = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (isCurrentlyLive) {
      const isOwned = isAdmin || 
                    currentClass.isFree || 
                    Number(currentClass.price) <= 0 ||
                    profile?.purchasedItems?.includes(currentClass.id) ||
                    (currentClass.courseId && profile?.purchasedItems?.includes(currentClass.courseId));

      if (!isOwned && currentClass.courseId) {
        navigate(`/course/${currentClass.courseId}`);
        return;
      }

      if (currentClass.courseId) {
        navigate(`/course/${currentClass.courseId}?item=${currentClass.id}&type=live&autoJoin=true`);
      } else {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 right-6 z-[500] max-w-sm w-full pointer-events-auto"
        >
          <div className={cn(
            "relative group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden transition-all",
            isCurrentlyLive ? "hover:border-rose-500/50" : (isCompleted ? "hover:border-zinc-500/50" : "hover:border-blue-500/50")
          )}>
            {/* Status Indicator Bar */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-1",
              isCurrentlyLive ? "bg-rose-600" : (isCompleted ? "bg-zinc-500" : "bg-blue-600")
            )} />
            
            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-3 right-3 p-1 rounded-lg bg-zinc-100 dark:bg-white/5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="p-5 flex gap-4">
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    isCurrentlyLive ? "bg-rose-500/10 text-rose-500" : (isCompleted ? "bg-zinc-500/10 text-zinc-500" : "bg-blue-500/10 text-blue-500")
                  )}>
                    <Radio className={cn("w-6 h-6", isCurrentlyLive && "animate-pulse")} />
                  </div>
                  {isCurrentlyLive && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                    isCurrentlyLive ? "text-rose-500" : (isCompleted ? "text-zinc-500" : "text-blue-500")
                  )}>
                    <span className={cn("w-1 h-1 rounded-full animate-pulse", isCurrentlyLive ? "bg-rose-500" : (isCompleted ? "bg-zinc-500" : "bg-blue-500"))} />
                    {isCurrentlyLive ? 'Live Now' : (isCompleted ? 'Class Completed' : 'Scheduled Class')}
                  </span>
                </div>
                <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate uppercase tracking-tight mb-1">
                  {currentClass.title}
                </h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest line-clamp-1 mb-3">
                  {isCurrentlyLive ? 'Join the session to interact with faculty' : (
                    isCompleted ? 'This session has ended. Access recording soon.' : (
                    (() => {
                      const date = parseDateTimeToIST(currentClass.scheduledAt || currentClass.date || '', currentClass.time);
                      if (!date) return 'TBA';
                      try {
                        const now = new Date();
                        const isPast = date < now;
                        
                        const formattedDate = new Intl.DateTimeFormat('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }).format(date);
                        
                        const formattedTime = new Intl.DateTimeFormat('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        }).format(date);
                        
                        if (isPast) {
                           return `Class time passed: ${formattedDate} ${formattedTime}`;
                        }
                        
                        return `Scheduled: ${formattedDate} ${formattedTime}`;
                      } catch {
                        return 'TBA';
                      }
                    })()
                  ))}
                </p>
                
                {!isCurrentlyLive && !isCompleted && (() => {
                  const d = parseDateTimeToIST(currentClass.scheduledAt || currentClass.date || '', currentClass.time);
                  if (d && d > new Date()) {
                    return (
                      <div className="flex items-center gap-1.5 text-rose-500 font-extrabold text-[10px] uppercase tracking-wider mb-3 bg-rose-500/5 px-2.5 py-1 rounded-lg border border-rose-500/20 w-fit">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>Starts In:</span>
                        <CountdownTimer targetDate={d.toISOString()} />
                      </div>
                    );
                  }
                  return null;
                })()}

                <button 
                  onClick={handleAction}
                  className={cn(
                    "w-full py-2 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all group/btn",
                    isCurrentlyLive ? "bg-rose-600 hover:bg-rose-700" : (isCompleted || (() => {
                      const d = parseDateTimeToIST(currentClass.scheduledAt || currentClass.date || '', currentClass.time);
                      return d && d < new Date();
                    })() ? "bg-zinc-500 hover:bg-zinc-600" : "bg-blue-600 hover:bg-blue-700")
                  )}
                >
                  {isCurrentlyLive ? (user ? 'Join Class' : 'Login to Join') : (isCompleted || (() => {
                    const d = parseDateTimeToIST(currentClass.scheduledAt || currentClass.date || '', currentClass.time);
                    return d && d < new Date();
                  })() ? 'View Past Schedule' : 'View Schedule')}
                  <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <LiveScheduleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}

