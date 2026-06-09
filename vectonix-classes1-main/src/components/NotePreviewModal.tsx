import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Maximize2, Shield, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

interface NotePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  title: string;
}

export default function NotePreviewModal({ isOpen, onClose, images, title }: NotePreviewModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 1));
  const handleReset = () => setZoom(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-xl cursor-pointer"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Thumbnails (Flipkart Style Sidebar) */}
          <div className="w-full md:w-32 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-100 dark:border-zinc-800 p-4 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-4 no-scrollbar">
            {images.map((img, idx) => (
              <button
                key={idx}
                onMouseEnter={() => {
                  setSelectedIndex(idx);
                  handleReset();
                }}
                onClick={() => {
                  setSelectedIndex(idx);
                  handleReset();
                }}
                className={cn(
                  "relative w-20 h-24 md:w-full md:h-32 rounded-xl overflow-hidden border-2 transition-all shrink-0",
                  selectedIndex === idx 
                    ? "border-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-900/20" 
                    : "border-transparent opacity-50 hover:opacity-100"
                )}
              >
                <img 
                  src={img} 
                  alt={`Preview ${idx + 1}`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>

          {/* Main Preview */}
          <div className="flex-1 relative bg-white dark:bg-zinc-900 flex flex-col group overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-indigo-600 rounded-full text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Secured Preview
                </div>
                <h3 className="text-xl font-bold dark:text-white line-clamp-1">{title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                  <button onClick={handleZoomOut} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-zinc-500">
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-zinc-500 tabular-nums">{Math.round(zoom * 100)}%</span>
                  <button onClick={handleZoomIn} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-zinc-500">
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button onClick={handleReset} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-zinc-500 ml-1 border-l dark:border-zinc-700">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="p-3 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all group/close z-50 relative pointer-events-auto"
                  title="Close Preview"
                >
                  <X className="w-6 h-6 text-zinc-500 group-hover/close:rotate-90 transition-transform" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden" ref={containerRef}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  <motion.div 
                    drag={zoom > 1}
                    dragConstraints={containerRef}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => setIsDragging(false)}
                    style={{ scale: zoom }}
                    className={cn(
                      "relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden bg-white",
                      zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                    )}
                  >
                    <img 
                      src={images[selectedIndex]} 
                      alt="Main Preview" 
                      className="max-w-full max-h-[60vh] md:max-h-[70vh] object-contain select-none pointer-events-none"
                      onContextMenu={(e) => e.preventDefault()}
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Anti-screenshot Watermark */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.05] flex items-center justify-center flex-wrap gap-12 rotate-[-30deg]">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <span key={i} className="text-2xl font-black whitespace-nowrap uppercase tracking-widest">vectonicclasses</span>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation Arrows */}
              <button 
                onClick={() => { setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1)); handleReset(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-zinc-500 opacity-0 group-hover:opacity-100 transition-all border border-white/20 z-20"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={() => { setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0)); handleReset(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-zinc-500 opacity-0 group-hover:opacity-100 transition-all border border-white/20 z-20"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="text-sm font-bold text-zinc-500">
                Page {selectedIndex + 1} of {images.length}
              </div>
              <div className="flex gap-1">
                {images.map((_, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      selectedIndex === idx ? "w-8 bg-indigo-600" : "w-2 bg-zinc-200 dark:bg-zinc-800"
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase text-zinc-400">Copyright Protected</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
  );
}

