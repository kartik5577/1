import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Loader2, 
  User as UserIcon, 
  Camera, 
  CheckCircle2,
  GraduationCap,
  Mail,
  Phone
} from 'lucide-react';

type Step = 'details' | 'success';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Einstein',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Newton',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Curie',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Tesla',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Galileo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Space',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Physics',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Laser'
];

export default function CompleteProfile() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [mobile, setMobile] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const renderErrorBlock = (errText: string) => {
    if (!errText) return null;
    return (
      <div className="flex flex-col gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl my-2">
        <p className="text-red-500 text-xs font-semibold text-center">{errText}</p>
      </div>
    );
  };

  useEffect(() => {
    // If user's profile is already completed, skip this page
    if (!authLoading && user && profile?.profileCompleted) {
      navigate('/dashboard');
      return;
    }
    // If not logged in, go to login
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (!authLoading && (user || profile) && !isInitialized) {
      const initialName = profile?.name || user?.displayName || '';
      const initialPhoto = profile?.photoUrl || user?.photoURL || '';
      const initialMobile = profile?.mobile || '';
      
      setName(initialName);
      setPhotoUrl(initialPhoto);
      setMobile(initialMobile);
      setIsInitialized(true);
    }
  }, [user, profile, authLoading, navigate, isInitialized]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Custom profile image should be smaller than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep only digits, max 10
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (mobile.length !== 10) {
      setError('Please enter a valid exactly 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user!.uid);
      const cleanEmail = user?.email ? user.email.toLowerCase() : '';
      
      const updateData = {
        uid: user!.uid,
        name: name.trim(),
        photoUrl: photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        email: cleanEmail,
        mobile: mobile,
        profileCompleted: true,
        updatedAt: new Date().toISOString()
      };

      // Set/merge document in Firestore with custom Error Recovery Handling
      try {
        await setDoc(userRef, updateData, { merge: true });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${user!.uid}`);
      }
      
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name.trim(),
          photoURL: updateData.photoUrl
        });
      }

      setStep('success');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2050);
    } catch (err: any) {
      console.error('Profile Completion Error:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] flex flex-col items-center justify-center p-6 py-12 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-zinc-50 dark:bg-[#0a0a0a] rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-zinc-100 dark:border-white/5"
      >
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-600/10 transform rotate-3">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-1">
              Welcome to <span className="text-blue-500 italic font-bold">Vectonix</span>
            </h1>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px]">
              Set up your profile to customize your experience
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'details' && (
            <motion.form 
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleCompleteProfile}
              className="space-y-6"
            >
              {/* Profile Image Display & Custom Upload */}
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 bg-zinc-200 dark:bg-zinc-900 rounded-3xl flex items-center justify-center overflow-hidden border border-zinc-300 dark:border-white/5 shadow-inner">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-10 h-10 text-zinc-400" />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-2xl cursor-pointer shadow-lg transition-transform active:scale-90 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </label>
                </div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Click camera icon to upload custom image (Max 2MB)
                </p>
              </div>

              {/* Preset Avatar Selection Option */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block text-center">
                  Or Pick a Preset Student Avatar
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {PRESET_AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPhotoUrl(avatar)}
                      className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition-all p-0.5 bg-zinc-100 dark:bg-zinc-900 hover:scale-110 flex items-center justify-center ${
                        photoUrl === avatar ? 'border-blue-500 ring-2 ring-blue-500/20 scale-105' : 'border-transparent'
                      }`}
                    >
                      <img src={avatar} alt={`Avatar ${idx}`} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                {/* Mobile Number */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Mobile Number *</label>
                    <span className={`text-[10px] font-bold ${mobile.length === 10 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                      {mobile.length}/10 digits
                    </span>
                  </div>
                  <div className="relative">
                    <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mobile.length === 10 ? 'text-emerald-500' : 'text-zinc-400'}`} />
                    <input 
                      type="tel" 
                      required
                      value={mobile}
                      onChange={handleMobileChange}
                      placeholder="Enter 10-digit mobile number"
                      className={`w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-900/50 border rounded-2xl focus:ring-2 transition-all font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-655 ${
                        mobile.length === 10 
                          ? 'border-emerald-500/30 focus:ring-emerald-500 focus:border-emerald-500' 
                          : 'border-zinc-200 dark:border-white/5 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Your Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Your Display Name *</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter Your Name"
                      className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-650"
                    />
                  </div>
                </div>

                {/* Email (Read-Only) */}
                <div className="space-y-2 opacity-75">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Email Address (Google Login)</label>
                  <div className="relative col-span-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="email" 
                      disabled
                      value={(user?.email || '').toLowerCase()}
                      placeholder="Email Address"
                      className="w-full pl-11 pr-4 py-3.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl font-bold text-zinc-500 dark:text-zinc-400 cursor-not-allowed lowercase tracking-normal text-xs overflow-x-auto"
                    />
                  </div>
                </div>
              </div>

              {renderErrorBlock(error)}

              <button 
                type="submit"
                disabled={loading || !name || mobile.length !== 10}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.15em] text-xs hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/10 active:scale-95 cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalize Setup <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.form>
          )}

          {step === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/10 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-2">Setup Complete!</h2>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Redirecting you to your dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 flex items-center gap-3"
      >
        <ShieldCheck className="w-5 h-5 text-blue-500" />
        <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">End-to-End Secure Education Platform</p>
      </motion.div>
    </div>
  );
}
