import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FloatingSearchButtonProps {
  isSearchOpen?: boolean;
}

export default function FloatingSearchButton({ isSearchOpen }: FloatingSearchButtonProps) {
  const location = useLocation();

  // Paths where the FAB should be hidden
  const hiddenPaths = ['/login', '/admin', '/dashboard', '/complete-profile'];
  const isPathHidden = hiddenPaths.some(path => location.pathname.startsWith(path));

  if (isPathHidden || isSearchOpen) return null;

  const toggleSearch = () => {
    window.dispatchEvent(new CustomEvent('toggle-search'));
  };

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0, opacity: 0, y: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleSearch}
        className="fixed bottom-[112px] left-8 lg:left-auto lg:right-8 z-[500] w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/40 group overflow-hidden"
        aria-label="Search"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <Search className="w-8 h-8 relative z-10" strokeWidth={3} />
        
        {/* Pulse effect */}
        <span className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-25" />
      </motion.button>
    </AnimatePresence>
  );
}
