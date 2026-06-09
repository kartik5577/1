import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { motion } from 'motion/react';

export default function SiteLock({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unlocked = sessionStorage.getItem('site_unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '123456') {
      sessionStorage.setItem('site_unlocked', 'true');
      setIsUnlocked(true);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-10 border border-zinc-100 dark:border-zinc-800 shadow-2xl flex flex-col items-center text-center gap-6"
      >
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-[1.5rem] flex items-center justify-center text-indigo-600 mb-2">
          <Lock className="w-10 h-10" />
        </div>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-extrabold dark:text-white">Under Construction</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            This website is currently in development mode. Please enter the access password to view the site.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter Password"
              className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-center text-lg tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              autoFocus
            />
            {error && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-red-500 text-sm font-bold"
              >
                {error}
              </motion.p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
          >
            Enter Site
          </button>
        </form>
      </motion.div>
    </div>
  );
}
