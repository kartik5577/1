import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, ShieldCheck, Play, Pause, Volume2, Maximize, RotateCcw, RotateCw, AlertTriangle, ChevronLeft, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import YouTube, { YouTubeProps } from 'react-youtube';
import { cn } from '../lib/utils';

interface SecureVideoViewerProps {
  isOpen: boolean;
  url: string;
  title: string;
  onClose: () => void;
}

const getYoutubeId = (url: string) => {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'youtu.be') return parsedUrl.pathname.slice(1);
    if (parsedUrl.hostname.includes('youtube.com')) {
      return parsedUrl.searchParams.get('v') || parsedUrl.pathname.split('/').pop();
    }
    return null;
  } catch {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/|.*\/))([^?&"'>]+)/);
    return match ? match[1] : null;
  }
};

export default function SecureVideoViewer({ isOpen, url, title, onClose }: SecureVideoViewerProps) {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isRotated, setIsRotated] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [error, setError] = useState<string | null>(null);
  
  const playerRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const videoId = getYoutubeId(url);
  const isYoutube = !!videoId;

  // Security: Global Right Click & Shortcut Block
  useEffect(() => {
    if (!isOpen) return;

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
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('contextmenu', block, true);
      window.removeEventListener('keydown', handleKey, true);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Control Visibility Timer
  useEffect(() => {
    let timeout: any;
    if (showControls && isPlaying && !controlsLocked) {
      timeout = setTimeout(() => setShowControls(false), 5000); // 5s for mobile
    }
    return () => clearTimeout(timeout);
  }, [showControls, isPlaying, controlsLocked]);

  if (!isOpen) return null;

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    setDuration(event.target.getDuration());
    setIsLoading(false);
    setIsReady(true);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    // 1 = Playing, 2 = Paused
    setIsPlaying(event.data === 1);
  };

  const onError: YouTubeProps['onError'] = (e) => {
    console.error("YouTube Error:", e);
    setError("Failed to load video. Ensure the URL is a valid video resource.");
    setIsLoading(false);
  };

  const handleVideoReady = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    setIsLoading(false);
    setIsReady(true);
    setDuration(e.currentTarget.duration);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.currentTime);
      }
    }, 500);
  };

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isYoutube) {
      if (isPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    } else {
      if (isPlaying) playerRef.current.pause();
      else playerRef.current.play();
    }
  };

  const handleSeek = (seconds: number) => {
    if (!playerRef.current) return;
    if (isYoutube) {
      const now = playerRef.current.getCurrentTime();
      playerRef.current.seekTo(now + seconds, true);
    } else {
      playerRef.current.currentTime += seconds;
    }
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return '00:00';
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (!playerRef.current) return;
    if (isYoutube) playerRef.current.setVolume(v);
    else playerRef.current.volume = v / 100;
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('secure-video-container');
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex items-center justify-center">
      <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />

      <div 
        id="secure-video-container"
        className="relative w-full max-w-5xl aspect-video bg-black shadow-2xl overflow-hidden group"
      >
        
        {/* SECURE BLOCKER OVERLAYS - Lowered z-index to be behind controls but above video */}
        <div 
          className="absolute inset-0 z-[40] cursor-default pointer-events-auto" 
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { if (e.target === e.currentTarget) handlePlayPause(); }}
        />

        {/* The Player Container - EVERYTHING inside here will rotate if isRotated is true */}
        <div 
          className={cn(
            "w-full h-full transition-all duration-500 ease-in-out relative flex flex-col",
            isRotated ? "fixed inset-0 w-[100vh] h-[100vw] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 z-[55] bg-black" : "relative"
          )}
          onClick={() => setShowControls(!showControls)}
        >
          {isYoutube ? (
            <YouTube
              videoId={videoId}
              onReady={onReady}
              onStateChange={onStateChange}
              onError={onError}
              opts={{
                height: '100%', width: '100%',
                playerVars: {
                  autoplay: 1, controls: 0, modestbranding: 1, rel: 0, disablekb: 1, fs: 0, iv_load_policy: 3, origin: window.location.origin
                }
              }}
              className="w-full h-full flex-1"
              iframeClassName="w-full h-full border-none pointer-events-none"
            />
          ) : (
            <video 
              ref={playerRef}
              src={url} 
              className="w-full h-full flex-1 pointer-events-none" 
              autoPlay 
              onLoadedData={handleVideoReady}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controlsList="nodownload nofullscreen"
              disablePictureInPicture
              onContextMenu={e => e.preventDefault()}
            />
          )}

          {/* SECURE BLOCKER OVERLAYS - Moved inside to rotate with video */}
          <div 
            className="absolute inset-0 z-[40] cursor-default pointer-events-auto" 
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { 
                e.stopPropagation();
                if (showControls) {
                    handlePlayPause();
                } else {
                    setShowControls(true);
                }
            }}
          />

          {/* Back/Close Button Overlay - Inside rotated container */}
          <AnimatePresence>
            {showControls && (
              <div className="absolute top-4 left-4 z-[100] flex gap-2 pointer-events-auto">
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="p-4 rounded-2xl bg-black/60 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-2xl"
                >
                  <ChevronLeft className="w-8 h-8" />
                  <span className="ml-2 text-xs font-black uppercase tracking-widest hidden md:inline">Back</span>
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          {/* Right Top Buttons for Mobile (Rotate) */}
          <AnimatePresence>
            {showControls && (
              <div className="absolute top-4 right-4 z-[100] flex gap-2 pointer-events-auto">
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={(e) => { e.stopPropagation(); setIsRotated(!isRotated); }}
                  className={cn(
                    "p-4 rounded-2xl backdrop-blur-md border flex items-center justify-center transition-all active:scale-95 shadow-2xl",
                    isRotated ? "bg-indigo-600 text-white border-white/20" : "bg-black/60 text-white border-white/10"
                  )}
                >
                  <RotateCw className={cn("w-6 h-6 transition-transform duration-500", isRotated && "rotate-90")} />
                  <span className="ml-2 text-[10px] font-black uppercase tracking-widest">Rotate</span>
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="p-4 rounded-2xl bg-red-600/80 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-2xl"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          {/* CUSTOM CONTROLS OVERLAY - Inside rotated container */}
          {isReady && !error && (
            <div 
              className={cn(
                "absolute inset-0 z-[50] flex flex-col justify-between transition-opacity duration-300 pointer-events-none",
                showControls ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"
              )}
            >
              {/* Header - Desktop Title Only */}
              <div className="hidden md:flex p-6 bg-gradient-to-b from-black/90 to-transparent items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight line-clamp-1">{title}</h3>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Secure Session</p>
                  </div>
                </div>
              </div>

              {/* Middle Mobile Actions (Play/Pause/Seek) - Always available when controls shown */}
              <AnimatePresence>
                {showControls && (
                  <div className="absolute inset-0 flex items-center justify-center gap-8 md:gap-24 pointer-events-none">
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); handleSeek(-10); }}
                      className="p-6 md:p-8 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 pointer-events-auto shadow-2xl"
                    >
                      <RotateCcw className="w-8 h-8 md:w-10 md:h-10" />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest text-white/60">-10s</span>
                    </motion.button>
                    
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                      className="p-10 md:p-14 rounded-full bg-white text-black shadow-2xl pointer-events-auto shadow-white/10"
                    >
                      {isPlaying ? <Pause className="w-12 h-12 md:w-16 md:h-16 fill-current" /> : <Play className="w-12 h-12 md:w-16 md:h-16 fill-current ml-2" />}
                    </motion.button>

                    <motion.button 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); handleSeek(10); }}
                      className="p-6 md:p-8 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 pointer-events-auto shadow-2xl"
                    >
                      <RotateCw className="w-8 h-8 md:w-10 md:h-10" />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest text-white/60">+10s</span>
                    </motion.button>
                  </div>
                )}
              </AnimatePresence>

              {/* Empty Middle for spacing */}
              <div className="flex-1" />

              {/* Bottom Controls */}
              <div className="p-6 md:p-10 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-auto pt-32">
                {/* Progress Bar Container */}
                <div className="flex flex-col gap-2 mb-6 group/progress">
                  <div className="flex items-center justify-between text-[10px] md:text-xs font-mono text-white/60 mb-2">
                    <span className="bg-black/40 px-2 py-1 rounded">{formatTime(currentTime)}</span>
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse" />
                      <span className="uppercase tracking-[0.2em] font-black">{title}</span>
                    </div>
                    <span className="bg-black/40 px-2 py-1 rounded">{formatTime(duration)}</span>
                  </div>
                  
                  <div className="h-6 md:h-2 bg-zinc-800/80 rounded-full relative flex items-center">
                    <div 
                      className="absolute inset-y-0 left-0 bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all rounded-full h-full"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-xl border-4 border-indigo-600 md:hidden" />
                    </div>
                    <input 
                      type="range"
                      min="0" max={duration || 100} step="0.1" value={currentTime}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isYoutube) playerRef.current?.seekTo(val, true);
                        else playerRef.current.currentTime = val;
                        setCurrentTime(val);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Desktop Play/Pause/Seek Left Panel */}
                  <div className="hidden md:flex items-center gap-8">
                    <button onClick={(e) => { e.stopPropagation(); handleSeek(-10); }} className="text-zinc-400 hover:text-white transition-colors p-3">
                      <RotateCcw className="w-8 h-8" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                      className="w-16 h-16 rounded-3xl bg-white text-black flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-xl"
                    >
                      {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSeek(10); }} className="text-zinc-400 hover:text-white transition-colors p-3">
                      <RotateCw className="w-8 h-8" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 md:gap-10 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-3 group/vol bg-black/40 px-4 py-2 rounded-2xl border border-white/5">
                      <Volume2 className="w-5 h-5 text-zinc-400" />
                      <div className="w-20 md:w-32 h-1.5 bg-zinc-800 rounded-full relative overflow-hidden flex items-center">
                        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${volume}%` }} />
                        <input 
                          type="range" 
                          min="0" max="100" value={volume} 
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        className="p-4 md:p-5 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all active:scale-90 shadow-xl border border-white/10"
                      >
                        <Maximize className="w-6 h-6 md:w-7 md:h-7" />
                      </button>
                      <button 
                         onClick={(e) => { e.stopPropagation(); setControlsLocked(!controlsLocked); }}
                         className={cn(
                           "p-4 md:p-5 rounded-2xl transition-all shadow-xl border",
                           controlsLocked ? "bg-amber-600 text-white border-amber-400/50" : "bg-white/10 text-white/70 hover:text-white border-white/10"
                         )}
                      >
                        {controlsLocked ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATIC WATERMARK - Inside rotated container */}
          {isReady && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-[45] text-indigo-500/10 text-4xl md:text-6xl font-black uppercase tracking-[0.5em] font-mono rotate-[-30deg]">
              VectonixClasses
            </div>
          )}
          
          {/* Subtle Identity Watermark - Inside rotated container */}
          {isReady && (
            <div className="absolute bottom-24 right-8 pointer-events-none select-none z-[45] text-white/20 text-[10px] font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
              {profile?.mobile || user?.email || 'Vectonix Student'}
            </div>
          )}
        </div>

      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[8px] text-zinc-700 font-bold uppercase tracking-[1em] animate-pulse">
        Encrypted Stream Activity Monitor
      </div>
    </div>
  );
}
