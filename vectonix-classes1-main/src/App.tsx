/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useLocation, BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SettingsProvider, useSettings } from './hooks/useSettings';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import AboutUs from './pages/AboutUs';
import Contact from './pages/Contact';
import Courses from './pages/Courses';
import Offers from './pages/Offers';
import News from './pages/News';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CompleteProfile from './pages/CompleteProfile';
import CourseDetails from './pages/CourseDetails';
import NoteBookDetail from './pages/NoteBookDetail';
import AdminPanel from './pages/AdminPanel';
import SiteLock from './components/SiteLock';
import CookiesPolicy from './pages/legal/CookiesPolicy';
import Disclaimer from './pages/legal/Disclaimer';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import RefundPolicy from './pages/legal/RefundPolicy';
import TermsConditions from './pages/legal/TermsConditions';
import CartPage from './pages/Cart';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import LiveNotification from './components/LiveNotification';
import NewsTicker from './components/NewsTicker';
import { GraduationCap, Mail, Phone, CheckCircle2, RefreshCw, ExternalLink, Search, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_LOGO_URL } from './constants';
import AdvancedSearch from './components/AdvancedSearch';
import firebaseConfig from '../firebase-applet-config.json';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} />;
  
  // If profile is incomplete and not on the completion page, redirect to completion
  const needsCompletion = !profile?.profileCompleted && !isAdmin;
  if (needsCompletion && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <SiteLock>
      <AuthProvider>
        <ThemeProvider>
          <CartProvider>
            <SettingsProvider>
              <Router>
                <ScrollToTop />
                <AppContent />
              </Router>
            </SettingsProvider>
          </CartProvider>
        </ThemeProvider>
      </AuthProvider>
    </SiteLock>
  );
}

function AppContent() {
  const { settings, isFirebaseConnected, firebaseErrorCode } = useSettings();
  const { user, isAdmin } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [dismissFirebaseWarning, setDismissFirebaseWarning] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSearchOpen(false);
    };
    const handleToggleSearch = () => setIsSearchOpen(prev => !prev);
    
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('toggle-search', handleToggleSearch);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('toggle-search', handleToggleSearch);
    };
  }, []);

  useEffect(() => {
    if (settings.appName) {
      document.title = settings.appName;
    }
    
    // Set favicon to local logo
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      link.href = '/logo.png';
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = '/logo.png';
      document.head.appendChild(newLink);
    }
  }, [settings.appName]);

  useEffect(() => {
    // 1. Inject Google Search Console Ownership Verification Metadata Tag
    const verificationId = (settings as any).gscVerificationId;
    const existingMeta = document.querySelectorAll('meta[name="google-site-verification"]');
    existingMeta.forEach(el => el.remove());

    if (verificationId && verificationId.trim()) {
      const meta = document.createElement('meta');
      meta.name = 'google-site-verification';
      meta.content = verificationId.trim();
      document.head.appendChild(meta);
      console.log('Google Search Console HTML Head tag verified.');
    }

    // 2. Load Google Analytics 4 (gtag.js) script dynamically if GA measurement ID is active
    const gaId = (settings as any).gaMeasurementId;
    
    // Clear old scripts/configs to support live changes smoothly
    const existingScripts = document.querySelectorAll('script[src*="googletagmanager.com/gtag"]');
    existingScripts.forEach(el => el.remove());
    
    const targetInline = document.getElementById('vectonix-ga-tracker');
    if (targetInline) {
      targetInline.remove();
    }

    if (gaId && gaId.trim()) {
      // Dynamic loading of global gtag script tag
      const gScript = document.createElement('script');
      gScript.async = true;
      gScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId.trim()}`;
      document.head.appendChild(gScript);

      // Inline config gtag tracking script
      const inlineScript = document.createElement('script');
      inlineScript.id = 'vectonix-ga-tracker';
      inlineScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId.trim()}', {
          page_path: window.location.pathname,
          cookie_flags: 'SameSite=None;Secure'
        });
      `;
      document.head.appendChild(inlineScript);
      console.log(`Google Analytics dynamic config initiated: ${gaId.trim()}`);
    }
  }, [settings]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] transition-colors duration-300">
      <Navbar />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/landing" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/news" element={<News />} />
        <Route path="/course/:id" element={<CourseDetails />} />
        <Route path="/notebook/:id" element={<ProtectedRoute><NoteBookDetail /></ProtectedRoute>} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/free-resources" element={<ProtectedRoute><Navigate to="/dashboard?tab=content&subtab=free" replace /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        
        {/* Legal Routes */}
        <Route path="/cookies-policy" element={<CookiesPolicy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        
        {/* Fallback routes for categories */}
        <Route path="/notes" element={<Home />} />
        <Route path="/videos" element={<Home />} />
        <Route path="/live" element={<Home />} />
      </Routes>
      
      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[600] flex items-start justify-center pt-24 px-4 overflow-y-auto overflow-x-hidden no-scrollbar">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="fixed inset-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl py-8"
            >
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                        <Search className="w-6 h-6" />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white">Quick Search</h2>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Found exactly what you need</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setIsSearchOpen(false)}
                    className="p-4 bg-zinc-100 dark:bg-zinc-900 hover:bg-red-500 hover:text-white rounded-2xl transition-all group"
                  >
                    <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                  </button>
               </div>

               <AdvancedSearch onClose={() => setIsSearchOpen(false)} />

               <div className="mt-12 text-center">
                  <button 
                    onClick={() => setIsSearchOpen(false)}
                    className="inline-flex items-center gap-4 px-8 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all group font-black uppercase tracking-widest text-xs"
                  >
                    <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    <span>Close Search</span>
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Float Buttons */}
      <LiveNotification />
      {!['/login', '/dashboard', '/admin', '/complete-profile'].includes(location.pathname) && (
        <>
          <WhatsAppButton />
        </>
      )}
      <Footer />
    </div>

  );
}

