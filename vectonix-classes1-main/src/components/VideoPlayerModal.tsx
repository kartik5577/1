import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Volume2, VolumeX, Play, Pause, RotateCcw, RotateCw, Maximize, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

interface VideoPlayerModalProps {
  isOpen: boolean;
  url: string;
  title: string;
  onClose: () => void;
}

const getYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function VideoPlayerModal({ isOpen, url, title, onClose }: VideoPlayerModalProps) {
  const { profile, user } = useAuth();
  const [isBuffering, setIsBuffering] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isRotated, setIsRotated] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false);
  const [volume, setVolume] = useState(100);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsBuffering(true);
      setLoadError(false);
      const timer = setTimeout(() => setIsBuffering(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, url]);

  useEffect(() => {
    let timeout: any;
    if (showControls && isPlaying && !controlsLocked) {
      timeout = setTimeout(() => setShowControls(false), 5000); // 5s for mobile
    }
    return () => clearTimeout(timeout);
  }, [showControls, isPlaying, controlsLocked]);

  const youtubeId = getYoutubeId(url);
  const isYoutube = !!youtubeId;
  const embedUrl = isYoutube 
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&controls=0&showinfo=0&enablejsapi=1&origin=${window.location.origin}`
    : url;

  const sendCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && isYoutube) {
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      sendCommand('pauseVideo');
    } else {
      sendCommand('playVideo');
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (isMuted) {
      sendCommand('unMute');
    } else {
      sendCommand('mute');
    }
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    sendCommand('setVolume', [newVolume]);
    if (newVolume > 0 && isMuted) {
      toggleMute();
    }
  };

  const handleSeek = (seconds: number) => {
    if (isYoutube) {
      // We use the sendCommand to seek relative if we had a duration/current time
      // But for postMessage it's usually absolute. 
      // Since we don't track time in this simple modal (it uses raw iframe), 
      // we'll rely on the buttons we added which use specific 'seekTo' logic if possible.
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('video-modal-container');
    if (!container) return;
    if (!document.fullscreenElement) container.requestFullscreen();
    else document.exitFullscreen();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
        onClick={onClose}
      >
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-[110] flex items-center gap-4">
          <div className="text-white font-bold hidden md:block">{title}</div>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <motion.div
          id="video-modal-container"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={cn(
            "w-full max-w-6xl aspect-video bg-black shadow-2xl relative group transition-all duration-500 flex flex-col",
            isRotated ? "fixed inset-0 w-[100vh] h-[100vw] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 z-[9999] max-w-none rounded-none" : "rounded-2xl overflow-hidden"
          )}
          onClick={(e) => { e.stopPropagation(); setShowControls(!showControls); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Header with Title and Close - Inside rotated container for mobile accessibility */}
          <AnimatePresence>
            {showControls && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 inset-x-0 z-[60] p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between pointer-events-none"
              >
                <div className="text-white font-bold text-xs md:text-base truncate max-w-[70%]">{title}</div>
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setControlsLocked(!controlsLocked); }}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      controlsLocked ? "bg-amber-600 text-white shadow-lg shadow-amber-500/40" : "bg-white/10 text-white/70 hover:text-white"
                    )}
                    title={controlsLocked ? "Unlock Controls" : "Lock Controls"}
                  >
                    {controlsLocked ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsRotated(!isRotated); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
                      isRotated ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    <RotateCw className={cn("w-4 h-4 transition-transform duration-500", isRotated && "rotate-90")} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Rotate</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-3 bg-white/10 hover:bg-red-500 text-white rounded-xl backdrop-blur-md transition-all active:scale-90 pointer-events-auto"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 pointer-events-none">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
          )}

          {/* Video Player */}
          {loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900 px-4 text-center">
              <p className="font-bold uppercase tracking-widest text-sm mb-2">Failed to load video</p>
              <p className="text-xs opacity-60">The video URL might be invalid or restricted.</p>
            </div>
          ) : isYoutube ? (
            <div className="relative w-full h-full flex-1">
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="w-full h-full pointer-events-none scale-[1.3] origin-center"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                onLoad={() => setIsBuffering(false)}
              />
              {/* Central Interaction Blocker */}
              <div 
                className="absolute inset-0 z-30 bg-transparent" 
                onClick={(e) => {
                    e.stopPropagation();
                    if (showControls) {
                        togglePlay();
                    } else {
                        setShowControls(true);
                    }
                }} 
              />
            </div>
          ) : (
            <video
              src={url}
              className="w-full h-full flex-1"
              controls
              autoPlay
              playsInline
              controlsList="nodownload noremoteplayback"
              onContextMenu={(e) => e.preventDefault()}
              onLoadedData={() => setIsBuffering(false)}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onError={() => {
                setLoadError(true);
                setIsBuffering(false);
              }}
            />
          )}

          {/* Middle Quick Actions */}
          <AnimatePresence>
            {showControls && isYoutube && !loadError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center gap-16 md:gap-24 pointer-events-none z-50"
              >
                  <motion.button 
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); sendCommand('seekTo', [ -10, true ]); }}
                      className="p-5 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/5 pointer-events-auto md:hidden"
                  >
                      <RotateCcw className="w-8 h-8" />
                  </motion.button>
                  
                  <motion.button 
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                      className="p-8 rounded-full bg-white text-black shadow-2xl pointer-events-auto md:hidden"
                  >
                      {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                  </motion.button>

                  <motion.button 
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); sendCommand('seekTo', [ 10, true ]); }}
                      className="p-5 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/5 pointer-events-auto md:hidden"
                  >
                      <RotateCw className="w-8 h-8" />
                  </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Simple Custom Controls */}
          {isYoutube && !loadError && (
            <div 
              className={cn(
                "absolute inset-x-0 bottom-0 z-50 p-4 md:p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-all duration-300 pointer-events-none",
                showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
                <div className="flex items-center gap-4 md:gap-8">
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white text-black rounded-full hover:bg-indigo-500 hover:text-white transition-all active:scale-90"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                  </button>

                  <div className="flex items-center gap-4">
                    <button onClick={(e) => { e.stopPropagation(); sendCommand('seekTo', [ -10, true ]); }} className="text-white/70 hover:text-white transition-colors p-2">
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); sendCommand('seekTo', [ 10, true ]); }} className="text-white/70 hover:text-white transition-colors p-2">
                      <RotateCw className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="hidden sm:flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                      className="text-white/70 hover:text-white transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleVolumeChange}
                      className="w-20 md:w-24 accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="text-white/70 hover:text-white transition-colors p-2"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

      </motion.div>
    </AnimatePresence>
  );
}
