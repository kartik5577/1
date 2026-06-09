import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const { user, profile, isAdmin, loading: authLoading, setSessionId } = useAuth();
  const { settings } = useSettings();
  const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

  useEffect(() => {
    if (!authLoading && user && !loading) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        // Normal student
        if (!profile?.profileCompleted) {
          navigate('/complete-profile');
        } else {
          const dest = from === '/login' || from === '/complete-profile' ? '/dashboard' : from;
          navigate(dest, { replace: true });
        }
      }
    }
  }, [user, profile, isAdmin, authLoading, navigate, from, loading]);

  // A cohesive and robust helper to validate geographic rules & sync session data to Firestore
  const syncUserSessionAndGetProfile = async (loggedUser: any) => {
    const userDocRef = doc(db, 'users', loggedUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    const isAdminEmail = loggedUser.email?.toLowerCase() === 'vectonixclasses@gmail.com';

    // Restriction to India for students (anyone outside India should be restricted to login/signup)
    if (!isAdminEmail) {
      let isIndia = true;
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          if (data.country_code && data.country_code !== 'IN') {
            isIndia = false;
          }
        }
      } catch (e) {
        console.warn('IP country check failed, falling back to timezone check:', e);
      }

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = new Date().getTimezoneOffset();
      const nonIndianTZs = ['America/', 'Europe/', 'Atlantic/', 'Pacific/', 'Australia/', 'Africa/', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Seoul'];
      const tzIsNoIndia = nonIndianTZs.some(prefix => tz.startsWith(prefix));

      if (!isIndia || (tzIsNoIndia && offset !== -330)) {
        await signOut(auth);
        throw new Error('Access Restricted. Vectonix is currently only available to residents of India.');
      }
    }

    const cleanEmail = loggedUser.email ? loggedUser.email.toLowerCase() : '';
    setSessionId(newSessionId);

    if (!userDocSnap.exists()) {
      await setDoc(userDocRef, {
        uid: loggedUser.uid,
        email: cleanEmail,
        role: isAdminEmail ? 'admin' : 'student',
        name: loggedUser.displayName || 'Vectonix Student',
        photoUrl: loggedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedUser.displayName || 'V')}&background=random`,
        purchasedItems: [],
        sessionId: newSessionId,
        createdAt: new Date().toISOString()
      });
    } else {
      await updateDoc(userDocRef, {
        sessionId: newSessionId,
        email: cleanEmail
      });
    }

    // Fetch user data to evaluate restrictions
    const userData = (await getDoc(userDocRef)).data() as any;

    if (userData?.restricted) {
      await signOut(auth);
      throw new Error('Your account has been restricted. Please contact support.');
    }

    return userData;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await syncUserSessionAndGetProfile(result.user);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      
      console.error('Google Login Error:', err);
      if (err.code === 'auth/network-request-failed' || err.code === 'auth/internal-error') {
        setError('Connection issues detected. Please try opening the app in a new tab.');
      } else {
        setError(err.message || 'Google login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderErrorBlock = (errText: string) => {
    if (!errText) return null;
    return (
      <div className="p-4 bg-red-100 dark:bg-red-955/40 border border-red-200 dark:border-red-900/50 rounded-2xl my-2">
        <p className="text-red-600 dark:text-red-400 text-xs font-semibold text-center leading-relaxed">{errText}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-white dark:bg-[#050505] transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-50 dark:bg-[#0a0a0a] rounded-[3rem] shadow-2xl border border-zinc-100 dark:border-white/5 p-8 lg:p-12"
      >
        <div className="flex flex-col gap-8">
          <div className="text-center flex flex-col items-center gap-3">
            <Link to="/" className="flex flex-col items-center gap-2 group cursor-pointer select-none">
              <div className="h-20 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
                <img 
                  src={settings.logoUrl || '/logo.png'} 
                  alt={settings.appName || 'Vectonix Classes'} 
                  className="h-full w-auto object-contain"
                />
              </div>
              <span className="text-xl font-black uppercase tracking-wider text-zinc-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                {settings.appName || 'Vectonix Classes'}
              </span>
            </Link>

            <h1 className="text-xl font-extrabold text-zinc-700 dark:text-zinc-300 tracking-tight leading-none mt-2">
              <span className="text-blue-500 italic font-black">Welcome</span> Back
            </h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] leading-relaxed">
              Sign in to access your customized student portal
            </p>
          </div>

          {renderErrorBlock(error)}

          {/* Social Provider Button - Redesigned as dynamic center CTA */}
          <div className="flex flex-col gap-4">
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || authLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/10 hover:shadow-blue-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <div className="bg-white p-1 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
              )}
              {loading ? 'Logging in...' : 'Continue with Google'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 italic">
              By continuing, you agree to our <br />
              <Link to="/terms-conditions" className="underline hover:text-blue-500 transition-colors">Terms</Link> · 
              <Link to="/privacy-policy" className="underline hover:text-blue-500 transition-colors mx-1">Privacy</Link> · 
              <Link to="/refund-policy" className="underline hover:text-blue-500 transition-colors mx-1">Refund</Link> · 
              <Link to="/cookies-policy" className="underline hover:text-blue-500 transition-colors mx-1">Cookies</Link> · 
              <Link to="/disclaimer" className="underline hover:text-blue-500 transition-colors ml-1">Disclaimer</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
