import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Lock, AlertCircle, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAuth } from '../hooks/useAuth';

// Use a highly reliable public CDN (jsDelivr) mapped to the exact installed pdfjs-dist version to bypass Vercel SPA routing and custom MIME-type mapping complications
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SecurePDFViewerProps {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SecurePDFViewer({ url, title, isOpen, onClose }: SecurePDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { profile, user } = useAuth();
  
  // Use static watermark as requested
  const watermarkText = 'vectonicclasses';
  
  // Proxy the URL through our backend to bypass Firebase Storage CORS restrictions
  const proxyUrl = url ? `/api/proxy-pdf?url=${encodeURIComponent(url)}` : '';

  useEffect(() => {
    if (isOpen) {
      console.log(`[SecurePDFViewer] Component opened. Document Source URL: ${url}`);
      // Disable right click to prevent saving images
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      
      // Disable keyboard shortcuts (Ctrl+S, Ctrl+P, Ctrl+C, Ctrl+U)
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'u'].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      };
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, url]);

  // Handle Fetching Auth ID Token for Firebase Storage Authorization
  useEffect(() => {
    if (isOpen && user) {
      setTokenLoading(true);
      setErrorMsg(null);
      console.log(`[SecurePDFViewer] Fetching user authorization token for PDF: ${title}`);
      user.getIdToken(true)
        .then(t => {
          console.log('[SecurePDFViewer] Firebase ID Token successfully verified and resolved');
          setToken(t);
        })
        .catch(err => {
          console.error('[SecurePDFViewer] Error resolving Firebase user credentials:', err);
          setErrorMsg(`Authorization token fetch error: ${err.message || String(err)}`);
        })
        .finally(() => {
          setTokenLoading(false);
        });
    } else if (!isOpen) {
      setToken(null);
      setErrorMsg(null);
      setNumPages(null);
    }
  }, [isOpen, user, title]);

  const documentFile = React.useMemo(() => {
    if (!proxyUrl) return null;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    console.log('[SecurePDFViewer] Constructing secure document descriptor object', {
      url: proxyUrl,
      hasAuthorizationHeader: !!token
    });
    return {
      url: proxyUrl,
      httpHeaders: headers
    };
  }, [proxyUrl, token]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    console.log(`[SecurePDFViewer] Encrypted PDF document loaded successfully. Pages count: ${numPages}`);
    setNumPages(numPages);
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-5xl h-full bg-zinc-100 dark:bg-zinc-900 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-3 md:p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 z-20">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 shrink-0">
                  <Shield className="w-4 h-4 md:w-6 md:h-6" />
                </div>
                <div>
                  <h2 className="text-sm md:text-xl font-bold dark:text-white line-clamp-1">{title}</h2>
                  <div className="flex items-center gap-2 text-[8px] md:text-xs font-bold text-green-600 uppercase tracking-widest">
                    <Lock className="w-2 h-2 md:w-3 md:h-3" />
                    Secure View
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4">
                {/* Controls */}
                <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg md:rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <button onClick={zoomOut} className="p-1 md:p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md md:rounded-lg text-zinc-500 transition-colors">
                    <ZoomOut className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
                  <button 
                    onClick={resetZoom}
                    className="text-[10px] md:text-xs font-bold text-zinc-500 w-10 md:w-12 text-center hover:text-indigo-600 transition-colors"
                    title="Reset Zoom"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button onClick={zoomIn} className="p-1 md:p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md md:rounded-lg text-zinc-500 transition-colors">
                    <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
                </div>
                
                <button 
                  onClick={onClose}
                  className="p-1.5 md:p-3 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl md:rounded-2xl transition-all group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                >
                  <X className="w-4 h-4 md:w-6 md:h-6 text-zinc-500 group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div 
              className="flex-1 relative overflow-auto bg-zinc-200/50 dark:bg-zinc-950/50 flex flex-col items-center p-2 md:p-8 select-none" 
              onContextMenu={(e) => e.preventDefault()}
            >
              {!proxyUrl ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-red-500">
                  <AlertCircle className="w-10 h-10" />
                  <p className="text-sm font-bold uppercase tracking-widest">No document URL provided</p>
                </div>
              ) : tokenLoading ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Verifying Authorization & Decrypting...</p>
                </div>
              ) : !documentFile ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-red-500">
                  <AlertCircle className="w-10 h-10" />
                  <p className="text-sm font-bold uppercase tracking-widest">Preparing document setup failed</p>
                </div>
              ) : (
                <Document
                  file={documentFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(error) => {
                    console.error('[SecurePDFViewer] PDF load error for document source URL:', url, 'Error details:', error);
                    setErrorMsg(error?.message || String(error));
                  }}
                  loading={
                    <div className="flex flex-col items-center justify-center gap-4 py-20">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Decrypting Document...</p>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center gap-4 py-4 md:py-20 text-red-500 max-w-md text-center mx-auto px-4 bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-red-100 dark:border-red-950/20 shadow-xl">
                      <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
                      <p className="text-sm md:text-base font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 mt-2">Failed to load secure document</p>
                      {errorMsg && (
                        <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-red-200/20 w-full break-all font-semibold mt-3 text-left">
                          <strong>Reason:</strong> {errorMsg}
                        </p>
                      )}
                      <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
                        If this error persists, please ensure your account has purchase permissions and active internet connectivity.
                      </p>
                    </div>
                  }
                  className="flex flex-col items-center"
                >
                  {numPages && Array.from(new Array(numPages), (_, index) => (
                    <div key={`page_${index + 1}`} className="relative shadow-2xl mb-8 last:mb-0">
                      <Page 
                        pageNumber={index + 1} 
                        scale={scale} 
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="bg-white"
                      />
                      
                      {/* Watermark Overlay with custom style mapping to bypass global index.css gray-to-black/white overrides */}
                      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden flex flex-col items-center justify-center mix-blend-multiply">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div 
                            key={i} 
                            style={{ color: 'rgba(120, 120, 120, 0.12)' }}
                            className="text-xl md:text-2xl font-black rotate-[-30deg] whitespace-nowrap my-12 tracking-widest uppercase"
                          >
                            {watermarkText}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </Document>
              )}
            </div>

            {/* Pagination Footer - Repurposed for document info */}
            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 z-20">
              <div className="flex items-center gap-3 text-zinc-500">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  Protected Document • Do Not Share
                </p>
              </div>

              {numPages && (
                <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  Total Pages: {numPages}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
