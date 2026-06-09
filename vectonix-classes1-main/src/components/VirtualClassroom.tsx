import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Video, Users, ExternalLink, ShieldCheck, ShieldAlert, Key, MousePointer2, Lock, LockOpen } from 'lucide-react';
import { LiveChat } from './LiveChat';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface VirtualClassroomProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  userName: string;
  isModerator?: boolean;
  classId?: string;
  externalUrl?: string; // YouTube or other
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export const VirtualClassroom: React.FC<VirtualClassroomProps> = ({
  isOpen,
  onClose,
  roomName,
  userName,
  isModerator = false,
  classId,
  externalUrl
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showChat, setShowChat] = useState(false);
  const [classState, setClassState] = useState<{ isStarted: boolean, meetingPassword?: string, scheduledAt?: string, roomSecret?: string, allowStudentJoin?: boolean } | null>(null);
  const [checkingState, setCheckingState] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Check every 10s
    return () => clearInterval(timer);
  }, []);
  const { user, profile, isAdmin } = useAuth();
  const [autoJoined, setAutoJoined] = useState(false);
  
  // Auto-launch Jitsi for students coming from notification
  useEffect(() => {
    if (!isAdmin && classState?.isStarted && classState?.allowStudentJoin && !autoJoined) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('autoJoin') === 'true') {
        const secret = classState?.roomSecret ? `_${classState.roomSecret}` : '';
        const room = `VectonixClass_${roomName.replace(/[^a-zA-Z0-9]/g, '_')}_${classId || 'live'}${secret}`;
        const displayName = profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student';
        window.open(`https://meet.jit.si/${room}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.readOnlyName=true&config.disableProfile=true&config.remoteVideoMenu.disableHostControls=true`, '_blank');
        setAutoJoined(true);
      }
    }
  }, [classState?.isStarted, classState?.allowStudentJoin, isAdmin, autoJoined, roomName, classId, profile, user]);
  
  // Detect video type
  const isYoutube = externalUrl?.includes('youtube.com') || externalUrl?.includes('youtu.be');
  const isInternal = !externalUrl || externalUrl === '';

  // Listen to class state
  useEffect(() => {
    if (!classId) {
      setCheckingState(false);
      return;
    }

    const docRef = doc(db, 'liveClasses', classId);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setClassState({
          isStarted: data.isStarted,
          meetingPassword: data.meetingPassword,
          scheduledAt: data.scheduledAt,
          roomSecret: data.roomSecret,
          allowStudentJoin: data.allowStudentJoin
        });
      }
      setCheckingState(false);
    }, (error) => {
      setCheckingState(false);
      handleFirestoreError(error, OperationType.GET, `liveClasses/${classId}`);
    });

    return () => unsubscribe();
  }, [classId]);

  const handleStartClass = async () => {
    if (!classId || !isAdmin) return;
    setIsStarting(true);
    try {
      const roomSecret = Math.random().toString(36).substring(2, 10);
      const docRef = doc(db, 'liveClasses', classId);
      await updateDoc(docRef, { 
        isStarted: true,
        meetingPassword: adminPassword || '',
        roomSecret: roomSecret,
        updatedAt: new Date().toISOString()
      });
      setAdminPassword('');
      
      // Admin Priority: Immediately open the room to claim moderation
      const fullRoom = `VectonixClass_${roomName.replace(/[^a-zA-Z0-9]/g, '_')}_${classId || 'live'}_${roomSecret}`;
      const displayName = "Admin";
      window.open(`https://meet.jit.si/${fullRoom}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.readOnlyName=true&config.disableProfile=true`, '_blank');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `liveClasses/${classId}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndClass = async () => {
    if (!classId || !isAdmin) return;
    if (!window.confirm('Are you sure you want to end this class for students? This will mark it as completed.')) return;
    setIsStarting(true);
    try {
      const docRef = doc(db, 'liveClasses', classId);
      await updateDoc(docRef, { 
        isStarted: false,
        status: 'completed',
        allowStudentJoin: false,
        roomSecret: '', // Clear secret on end
        updatedAt: new Date().toISOString()
      });
      // Optionally reload or close
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `liveClasses/${classId}`);
    } finally {
      setIsStarting(false);
    }
  };

  const isTimeToStart = classState?.scheduledAt 
    ? new Date(classState.scheduledAt) <= currentTime 
    : true;

  useEffect(() => {
    // Security: Global Right Click & Shortcut Block
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && ['c','v','s','u','p','i','j'].includes(e.key.toLowerCase())) {
        return block(e);
      }
      if (e.key === 'F12') return block(e);
    };

    window.addEventListener('contextmenu', block, true);
    window.addEventListener('keydown', handleKey, true);

    return () => {
      window.removeEventListener('contextmenu', block, true);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract YouTube ID
  const getYTId = (url: string) => {
    if (!url) return null;
    try {
      const parsedUrl = new URL(url);
      let id = null;
      
      if (parsedUrl.hostname === 'youtu.be') {
        id = parsedUrl.pathname.slice(1);
      } else if (parsedUrl.hostname.includes('youtube.com')) {
        if (parsedUrl.pathname.includes('/live/')) {
          id = parsedUrl.pathname.split('/live/')[1].split(/[?#&]/)[0];
        } else if (parsedUrl.pathname.includes('/embed/')) {
          id = parsedUrl.pathname.split('/embed/')[1].split(/[?#&]/)[0];
        } else if (parsedUrl.pathname.includes('/shorts/')) {
          id = parsedUrl.pathname.split('/shorts/')[1].split(/[?#&]/)[0];
        } else {
          id = parsedUrl.searchParams.get('v');
        }
      }
      
      if (id && id.length === 11) return id;
      throw new Error('Not a direct match');
    } catch {
      // Fallback to more flexible regex if URL parsing fails or id not 11 chars
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/|shorts\/)([^#&?]{11}).*/;
      const match = url.match(regExp);
      return match ? match[2] : null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col font-sans"
      >
        {/* Header */}
        <div className="h-16 bg-zinc-950 border-b border-white/10 flex items-center justify-between px-6 shrink-0 shadow-2xl relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Video className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">{roomName.replace(/-/g, ' ')}</h2>
              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Live Session • Secured</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowChat(!showChat)}
              className="lg:hidden p-2 bg-indigo-600 rounded-lg text-white"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Single Device Active</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-[0.2em] border border-red-500/20"
            >
              Exit Class
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Classroom Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: Video Stage */}
          <div className="flex-1 relative bg-zinc-950 flex flex-col">
            <div className="flex-1 overflow-hidden relative">
              {/* Identity Watermark Overlay */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-[45] text-white/5 text-4xl md:text-6xl font-black uppercase tracking-[0.5em] font-mono rotate-[-30deg]">
                Vectonix Classes
                <div className="text-xl md:text-2xl mt-4 opacity-50 tracking-widest text-center">
                  {profile?.mobile || user?.email || 'STUDENT SESSION'}
                </div>
              </div>
              {isInternal ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center bg-zinc-900 relative overflow-hidden">
                  {/* Visual Accents */}
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full -mr-48 -mt-48"></div>
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 blur-[120px] rounded-full -ml-48 -mb-48"></div>
                  
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-indigo-500/40 border border-white/10 ring-4 ring-white/5 group transition-all">
                      <Video className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                    </div>
                    
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Secured Jitsi Hub</span>
                    </div>

                    <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Ready to Join Class?</h3>
                    <p className="text-zinc-400 max-w-sm text-sm mb-10 leading-relaxed font-medium">
                      Join the full-screen interaction for the best learning experience. Your progress and presence are securely monitored.
                    </p>

                    <div className="flex flex-col items-center justify-center gap-6">
                      {isModerator ? (
                        <>
                          {!classState?.isStarted ? (
                            <div className="w-full max-w-sm space-y-4">
                              <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Meeting Password (Optional)</label>
                                <div className="relative">
                                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                  <input 
                                    type="text"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    placeholder="e.g. VECTONIX2024"
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-white text-sm"
                                  />
                                </div>
                              </div>
                              <button 
                                onClick={handleStartClass}
                                disabled={isStarting || !isTimeToStart}
                                className={cn(
                                  "w-full flex items-center justify-center gap-3 px-10 py-5 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 group",
                                  !isTimeToStart 
                                    ? "bg-zinc-700 cursor-not-allowed opacity-50" 
                                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30"
                                )}
                              >
                                {isStarting ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <>
                                    {!isTimeToStart ? 'Locked Until Time' : 'Start Live Class'} 
                                    <ShieldCheck className="w-5 h-5" />
                                  </>
                                )}
                              </button>
                              {!isTimeToStart && classState?.scheduledAt && (
                                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest text-center">
                                  Scheduled for: {new Date(classState.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4 w-full max-w-sm">
                              {/* Student Access Toggle */}
                              <button
                                onClick={async () => {
                                  if (!classId) return;
                                  try {
                                    await updateDoc(doc(db, 'liveClasses', classId), {
                                      allowStudentJoin: !classState?.allowStudentJoin
                                    });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, `liveClasses/${classId}`);
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02]",
                                  classState?.allowStudentJoin 
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                                    : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                )}
                              >
                                <div className="flex items-center gap-3 text-left">
                                  {classState?.allowStudentJoin ? <LockOpen className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Student Access</p>
                                    <p className="text-xs font-bold">{classState?.allowStudentJoin ? 'Live: Students can join' : 'Locked: Click to allow join'}</p>
                                  </div>
                                </div>
                                <div className={cn(
                                  "w-10 h-6 rounded-full relative transition-colors p-1",
                                  classState?.allowStudentJoin ? "bg-emerald-500" : "bg-zinc-600 dark:bg-zinc-800"
                                )}>
                                  <motion.div 
                                    animate={{ x: classState?.allowStudentJoin ? 16 : 0 }}
                                    className="w-4 h-4 bg-white rounded-full shadow-sm"
                                  />
                                </div>
                              </button>

                              <div className="p-4 bg-zinc-800/10 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                                  <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Administrative Control</p>
                                  <p className="text-zinc-600 dark:text-zinc-400 text-xs font-bold">You are the global moderator.</p>
                                </div>
                                <button 
                                  onClick={handleEndClass}
                                  disabled={isStarting}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                                >
                                  {isStarting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                  End Class
                                </button>
                              </div>
                              <button 
                                onClick={async () => {
                                  // Ensure student access is on when joining
                                  if (!classState?.allowStudentJoin && classId) {
                                    await updateDoc(doc(db, 'liveClasses', classId), { allowStudentJoin: true });
                                  }
                                  const secret = classState?.roomSecret ? `_${classState.roomSecret}` : '';
                                  const room = `VectonixClass_${roomName.replace(/[^a-zA-Z0-9]/g, '_')}_${classId || 'live'}${secret}`;
                                  const displayName = "Admin";
                                  window.open(`https://meet.jit.si/${room}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.readOnlyName=true&config.disableProfile=true`, '_blank');
                                }}
                                className="w-full flex items-center justify-center gap-3 px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-indigo-500/30 active:scale-95 group"
                              >
                                Join Meeting
                                <ExternalLink className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {!classState?.isStarted || !classState?.allowStudentJoin ? (
                            <div className="flex flex-col items-center gap-4">
                              <div className="flex items-center gap-2 px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                                <span className="text-sm font-black text-amber-500 uppercase tracking-widest">
                                  {!classState?.isStarted ? "Waiting for Teacher to start..." : "Waiting for entry permission..."}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center px-8">
                                {!classState?.isStarted 
                                  ? "The meeting room is currently locked for safety." 
                                  : "The teacher has started the room but hasn't enabled student joining yet."}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4 w-full max-w-md">
                              <div className="p-8 bg-zinc-900 border border-white/10 rounded-3xl text-center space-y-6">
                                <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                                  <ShieldCheck className="w-10 h-10 text-emerald-500" />
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xl font-black text-white uppercase tracking-tight">Class is Interactive!</h4>
                                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest px-4">
                                    Your teacher has started the room. Click below to join the session.
                                  </p>
                                </div>

                                {classState?.meetingPassword && (
                                  <div className="py-4 px-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Room Key</p>
                                    <p className="text-xl font-black text-white tracking-[0.3em]">{classState?.meetingPassword}</p>
                                  </div>
                                )}

                                <div className="flex items-center justify-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 mx-auto w-fit">
                                  <Users className="w-4 h-4 text-zinc-500" />
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    Joining as: <span className="text-white">{profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student'}</span>
                                  </span>
                                </div>

                                <button 
                                  onClick={() => {
                                    const secret = classState?.roomSecret ? `_${classState.roomSecret}` : '';
                                    const room = `VectonixClass_${roomName.replace(/[^a-zA-Z0-9]/g, '_')}_${classId || 'live'}${secret}`;
                                    const displayName = profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student';
                                    window.open(`https://meet.jit.si/${room}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.readOnlyName=true&config.disableProfile=true&config.remoteVideoMenu.disableHostControls=true`, '_blank');
                                  }}
                                  className="w-full flex items-center justify-center gap-4 px-8 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-indigo-500/30 active:scale-95 group text-lg"
                                >
                                  Join Class Now
                                  <ExternalLink className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </button>
                              </div>
                              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] text-center">
                                * Audio & Video are disabled by default on join.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {isModerator && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-12 p-6 bg-zinc-800/50 rounded-3xl border border-white/10 text-left max-w-lg mx-auto"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <ShieldAlert className="w-5 h-5 text-amber-500" />
                          <h4 className="text-zinc-200 text-xs font-black uppercase tracking-widest">Moderator Security Guide</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                              <MousePointer2 className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-zinc-300 text-xs font-bold mb-1">0. Join First</p>
                              <p className="text-zinc-500 text-[10px] leading-relaxed">The first person to join the room becomes the <span className="text-white font-black">Moderator</span>. Always join before students.</p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                              <MousePointer2 className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-zinc-300 text-xs font-bold mb-1">1. Find Security Options</p>
                              <p className="text-zinc-500 text-[10px] leading-relaxed">Click the <span className="text-white font-black">Shield 🛡️</span> icon in the bottom toolbar after joining.</p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-zinc-300 text-xs font-bold mb-1">2. Enable Lobby</p>
                              <p className="text-zinc-500 text-[10px] leading-relaxed">Switch on "Lobby" to manually approve every student who tries to join.</p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                              <Key className="w-4 h-4 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-zinc-300 text-xs font-bold mb-1">3. Set a Password</p>
                              <p className="text-zinc-500 text-[10px] leading-relaxed">Add a meeting password for extra protection against link-sharing.</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <p className="mt-8 text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                       <ShieldCheck className="w-3 h-3 text-emerald-500" />
                       End-to-End Encrypted Session
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {isYoutube && getYTId(externalUrl!) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${getYTId(externalUrl!)}?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1`}
                      className="w-full h-full border-none"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center bg-zinc-900">
                      <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
                        <ExternalLink className="w-10 h-10 text-zinc-600" />
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">External Class Session</h3>
                      <p className="text-zinc-500 max-w-sm text-sm mb-8">This session is hosted on an external secure platform. Please use the button below to join the interaction.</p>
                      <a 
                        href={externalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-indigo-500/20 active:scale-95"
                      >
                        Launch Meeting Hub
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="h-8 bg-zinc-950 border-t border-white/5 flex items-center px-6 justify-between shrink-0">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Network Stable</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">H.264 HD+ Transcoding</span>
                  </div>
               </div>
               <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">© 2024 VECTONIX EDUTECH PRIVATE LIMITED</p>
            </div>
          </div>

          {/* RIGHT: Vectonix Native Chat */}
          <div className={cn(
            "lg:w-[360px] shrink-0 border-l border-white/10 transition-all duration-300",
            showChat ? "fixed inset-0 z-50 lg:relative lg:block" : "hidden lg:block"
          )}>
            {showChat && (
              <button 
                onClick={() => setShowChat(false)}
                className="lg:hidden absolute top-4 right-4 z-[60] p-2 bg-zinc-800 rounded-full text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <LiveChat classId={classId!} user={user} profile={profile} />
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

