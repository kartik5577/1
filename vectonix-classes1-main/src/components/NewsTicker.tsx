import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, ArrowRight, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Notice {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: any;
}

export default function NewsTicker() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isVisible) {
      document.documentElement.classList.add('has-ticker');
    } else {
      document.documentElement.classList.remove('has-ticker');
    }
  }, [isVisible]);

  useEffect(() => {
    const q = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notice[];
      const publicNotices = docs.filter(notice => ['public', 'both'].includes((notice as any).visibility || 'public')).slice(0, 5);
      setNotices(publicNotices);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (notices.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % notices.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [notices.length]);

  if (notices.length === 0 || !isVisible) return null;

  const currentNotice = notices[currentIndex];

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-blue-600 dark:bg-blue-700 py-2 overflow-hidden z-[500]">
      <div className="container mx-auto px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="flex-shrink-0 flex items-center gap-2">
            <Bell className="w-4 h-4 text-white animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-100 bg-white/10 px-2 py-0.5 rounded">
              Update
            </span>
          </div>

          <div className="relative h-6 flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentNotice.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="absolute inset-0 flex items-center"
              >
                <p className="text-sm font-bold text-white truncate uppercase tracking-tight">
                  {currentNotice.title}: <span className="font-normal opacity-90">{currentNotice.content}</span>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1">
            {notices.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  currentIndex === i ? "w-4 bg-white" : "w-1 bg-white/30"
                )} 
              />
            ))}
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
