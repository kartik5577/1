import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, UserPlus, Moon, Sun, ShoppingCart, Search, Menu, X, ArrowRight, ArrowLeft, Home, BookOpen, Sparkles, Info, MessageSquare, LayoutDashboard, Settings, Tag, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { APP_LOGO_URL } from '../constants';
import { useSettings } from '../hooks/useSettings';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import AdvancedSearch from './AdvancedSearch';

export default function Navbar() {
  const { user, profile, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { itemCount, clearCart } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const { pathname, search } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const isAuthView = (pathname.startsWith('/admin') || pathname.startsWith('/dashboard')) && pathname !== '/login' && pathname !== '/auth-success';

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const handleSignOut = async () => {
    try {
      if (user) {
        // Clear session in Firestore
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            sessionId: null
          });
        } catch (e) {
          console.warn('Could not clear remote session:', e);
        }
      }
      localStorage.removeItem('sessionId');
      // Note: We do NOT call clearCart() here because it synchronously wipes out the parent user's remote Firestore cart in the database prior to auth teardown.
      // The CartProvider has an automatic, reactive useEffect that detects when user auth status becomes null, and clears only the client-side cart memory safely.
      await signOut(auth);
      
      // Use replace or location.href to prevent back-button issues
      const isHome = window.location.pathname === '/' || window.location.pathname === '/landing';
      window.location.replace('/');
      
      // If we are already on home page, window.location.replace won't do a hard reload, so trigger manually
      if (isHome) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback redirect and hard reload
      window.location.href = '/';
      window.location.reload();
    }
  };

  if (isAuthView && user) {
    const portalPath = isAdmin ? '/admin' : '/dashboard';
    const portalName = isAdmin ? 'Admin Console' : 'Student Portal';

    return (
      <nav className="sticky top-0 z-50 w-full border-b bg-white dark:bg-[#050505] border-zinc-100 dark:border-zinc-800/50 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-8 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
              <span className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white group-hover:text-indigo-600 transition-colors hidden sm:block">
                {settings.appName || 'Vectonix Classes'}
              </span>
            </Link>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>
            <span className="text-xs font-semibold text-zinc-500 hidden sm:block">{portalName}</span>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block"></div>
            <Link 
              to="/" 
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-indigo-600 transition-all group"
            >
              <Home className="w-4 h-4" />
              <span className="hidden md:block">View Website</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {!isAdmin && (
              <>
                <Link 
                  to="/cart"
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:text-indigo-600 transition-all shadow-sm relative"
                  title="Shopping Cart"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {itemCount > 0 && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-blue-600 text-white text-[7px] font-black rounded-full flex items-center justify-center border border-white dark:border-zinc-900">
                      {itemCount}
                    </span>
                  )}
                </Link>
                <Link 
                  to="/dashboard?tab=content"
                  className={cn(
                    "p-2.5 rounded-xl border transition-all flex items-center gap-2 shadow-sm",
                    pathname === '/dashboard' && (new URLSearchParams(search).get('tab') === 'content' || !new URLSearchParams(search).get('tab'))
                      ? "bg-indigo-600 text-white border-indigo-600" 
                      : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:text-indigo-600"
                  )}
                  title="Library"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">Library</span>
                </Link>
              </>
            )}
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:text-indigo-600 transition-all shadow-sm"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 md:mx-2"></div>
            <Link 
              to={isAdmin ? "/admin?tab=profile" : "/dashboard?tab=profile"}
              className={cn(
                  "p-2.5 rounded-xl border transition-all flex items-center gap-2 shadow-sm",
                  new URLSearchParams(search).get('tab') === 'profile'
                    ? "bg-indigo-600 text-white border-indigo-600" 
                    : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:text-indigo-600"
                )}
              title="View Profile"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">Profile</span>
            </Link>
            <button 
              onClick={handleSignOut}
              className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-100 transition-all shadow-sm border border-red-100 dark:border-red-900/30"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] p-4 lg:p-6 pointer-events-none">
      <nav className="container mx-auto max-w-7xl h-16 lg:h-20 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 rounded-3xl lg:rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] dark:shadow-none flex items-center justify-between px-4 lg:px-8 pointer-events-auto">
          <div className="flex items-center gap-3 lg:gap-6">
            {pathname !== '/' && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => navigate(-1)}
                className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 flex items-center justify-center text-zinc-500 hover:text-blue-600 hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            )}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <div className="h-9 lg:h-11 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
              <span className="text-sm lg:text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {settings.appName || 'Vectonix Classes'}
              </span>
            </Link>
          </div>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {[
            { name: 'Home', path: '/' },
            { name: 'Courses', path: '/courses' },
            { name: 'Free Resources', path: '/free-resources' },
            { name: 'Coupons', path: '/offers' },
            { name: 'News', path: '/news' },
            { name: 'About', path: '/about' },
            { name: 'Contact', path: '/contact' }
          ].map((link) => (
            <Link 
              key={link.name} 
              to={link.path}
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2",
                pathname === link.path 
                  ? "text-blue-600 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-blue-600 after:rounded-full" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <div className="hidden sm:flex items-center bg-zinc-100/50 dark:bg-white/5 rounded-2xl p-1 border border-zinc-200/30 dark:border-white/5">
            <button 
              onClick={toggleTheme}
              className="p-2 lg:p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all"
              title="Theme"
            >
              {isDark ? <Sun className="w-4 h-4 lg:w-5 lg:h-5" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5" />}
            </button>
            <Link 
              to="/cart" 
              className="relative p-2 lg:p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all"
              title="Cart"
            >
              <ShoppingCart className="w-4 h-4 lg:w-5 lg:h-5" />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
               <div className="flex items-center gap-1 bg-zinc-100/50 dark:bg-white/5 p-1 rounded-2xl border border-zinc-200/30 dark:border-white/5">
                 <Link 
                   to={isAdmin ? "/admin" : "/dashboard"}
                   className="px-4 lg:px-6 py-2 lg:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
                 >
                   <UserIcon className="w-4 h-4 lg:w-4 lg:h-4" />
                   <span className="hidden sm:inline">{isAdmin ? 'Admin' : 'Dashboard'}</span>
                 </Link>
                 <button 
                   onClick={handleSignOut}
                   className="p-2 lg:p-2.5 text-zinc-400 hover:text-red-500 transition-all"
                   title="Sign Out"
                 >
                   <LogOut className="w-4 h-4" />
                 </button>
               </div>
            ) : (
               <div className="flex items-center bg-zinc-100/50 dark:bg-white/5 p-1 rounded-2xl border border-zinc-200/30 dark:border-white/5">
                 <Link 
                   to="/login"
                   className="px-4 py-2 lg:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/10 active:scale-95 flex items-center gap-2"
                   title="Sign In"
                 >
                   <LogIn className="w-4 h-4" />
                   <span>Sign In</span>
                 </Link>
               </div>
            )}
            
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-lg transition-all active:scale-95"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-zinc-900/20 dark:bg-black/60 backdrop-blur-sm z-[110] pointer-events-auto"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
              className="lg:hidden fixed top-24 right-4 w-[calc(100vw-32px)] max-w-sm bg-white dark:bg-zinc-900 shadow-[0_32px_64px_rgba(0,0,0,0.2)] dark:shadow-none z-[120] rounded-[2.5rem] border border-zinc-200 dark:border-white/5 flex flex-col max-h-[calc(100vh-120px)] overflow-y-auto origin-top-right pointer-events-auto"
            >
              <div className="p-6 lg:p-8 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Navigation</span>
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 text-zinc-400"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { name: 'Home', path: '/', icon: Home },
                    { name: 'Courses', path: '/courses', icon: BookOpen },
                    { name: 'Free Resources', path: '/free-resources', icon: Sparkles },
                    { name: 'Coupons', path: '/offers', icon: Tag },
                    { name: 'News', path: '/news', icon: Bell },
                    { name: 'About Us', path: '/about', icon: Info },
                    { name: 'Contact Us', path: '/contact', icon: MessageSquare }
                  ].map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.path;
                    return (
                      <Link 
                        key={link.name} 
                        to={link.path}
                        onClick={() => setIsMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-2xl transition-all",
                          isActive ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-black uppercase tracking-widest">{link.name}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="h-px bg-zinc-100 dark:bg-white/5" />

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={toggleTheme}
                    className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl text-zinc-500"
                  >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="text-[8px] font-black uppercase">Theme</span>
                  </button>
                  <Link 
                    to="/cart"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl text-zinc-500 relative"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {itemCount > 0 && <span className="absolute top-3 right-5 w-4 h-4 bg-blue-600 text-white text-[8px] rounded-full flex items-center justify-center">{itemCount}</span>}
                    <span className="text-[8px] font-black uppercase">Cart</span>
                  </Link>
                </div>

                {user ? (
                  <Link 
                    to={isAdmin ? "/admin" : "/dashboard"}
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl"
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    Go to Portal
                  </Link>
                ) : (
                  <Link 
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-600/20"
                  >
                    Student Login
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
