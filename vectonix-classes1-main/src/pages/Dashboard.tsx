import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  Video, 
  Calendar, 
  ChevronRight, 
  Clock, 
  ArrowUpRight,
  ArrowRight,
  Bell,
  PlayCircle,
  FileText,
  History,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Home,
  Layout,
  ShoppingBag,
  Gift,
  Loader2,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
  User,
  Camera,
  Lock,
  Mail,
  Phone,
  Shield,
  Save,
  Trash2,
  AlertCircle,
  X,
  Tag,
  Printer
} from 'lucide-react';
import { MapPin, Flag, Globe } from 'lucide-react';
import { STATES_AND_DISTRICTS } from '../data/indiaData';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { cn, formatCurrency, getItemImage, amountToWords } from '../lib/utils';
import { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, updateDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import SecurePDFViewer from '../components/SecurePDFViewer';
import SecureVideoViewer from '../components/SecureVideoViewer';
import { VirtualClassroom } from '../components/VirtualClassroom';
import LiveScheduleModal from '../components/LiveScheduleModal';
import { CountdownTimer } from '../components/CountdownTimer';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

const StatCard = ({ label, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col gap-2 md:gap-4">
    <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center", bg, color)}>
      <Icon className="w-5 h-5 md:w-6 md:h-6" />
    </div>
    <div>
      <div className="text-[8px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{label}</div>
      <div className="text-xl md:text-2xl font-display font-black dark:text-white mt-0.5 md:mt-1">{value}</div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, profile, loading: authLoading, isAdmin, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab ] = useState<'content' | 'history' | 'profile' | 'offers' | 'news'>('content');
  const [subtab, setSubtab] = useState<'purchased' | 'free'>('purchased');
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const sub = params.get('subtab');
    
    if (tab === 'history' || tab === 'content' || tab === 'offers' || tab === 'news' || tab === 'profile') {
      setActiveTab(tab as any);
    }
    
    if (sub === 'free' || sub === 'purchased') {
      setSubtab(sub as any);
    }
  }, [location.search]);

  const handleNoticeClick = (notice: any) => {
    if (notice.title?.toLowerCase().includes('join class') || notice.content?.toLowerCase().includes('join class')) {
      setIsScheduleModalOpen(true);
    } else {
      setSelectedNotice(notice);
    }
  };
  const [purchasedItems, setPurchasedItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchingSecure, setFetchingSecure] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  // Profile Edit State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    dob: '',
    photoUrl: '',
    mobile: '',
    addressField: '',
    state: '',
    district: '',
    pincode: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        dob: profile.dob || '',
        photoUrl: profile.photoUrl || '',
        mobile: profile.mobile || '',
        addressField: profile.address?.addressField || '',
        state: profile.address?.state || '',
        district: profile.address?.district || '',
        pincode: profile.address?.pincode || ''
      });
    }
  }, [profile]);

  const [viewerConfig, setViewerConfig] = useState({ url: '', title: '', isOpen: false });
  const [videoViewerConfig, setVideoViewerConfig] = useState({ url: '', title: '', isOpen: false });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [classroomConfig, setClassroomConfig] = useState({
    isOpen: false,
    roomName: '',
    userName: '',
    classId: '',
    isModerator: false,
    externalUrl: ''
  });

  const fetchSecureUrl = async (itemId: string, type: 'lecture' | 'note' | 'live' | 'unit', fallbackUrl?: string) => {
    const parentCollection = type === 'note' ? 'notes' : 
                          type === 'lecture' ? 'lectures' : 
                          type === 'unit' ? 'units' : 'liveClasses';
    
    try {
      setFetchingSecure(itemId);
      const secureSnap = await getDoc(doc(db, parentCollection, itemId, 'secure', 'content'));
      if (secureSnap.exists()) {
        const data = secureSnap.data();
        return type === 'note' || type === 'unit' ? data.pdfUrl : (data.videoUrl || data.meetingUrl);
      }
      return fallbackUrl;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${parentCollection}/${itemId}/secure/content`);
      return fallbackUrl;
    } finally {
      setFetchingSecure(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin');
      return;
    }

    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      let step = "initializing";
      try {
        step = "fetching primary data collections";
        // Fetch collections in parallel
        const [coursesSnap, notesSnap, lecturesSnap, liveSnap, unitsSnap] = await Promise.all([
          getDocs(collection(db, 'courses')),
          getDocs(collection(db, 'notes')),
          getDocs(collection(db, 'lectures')),
          getDocs(collection(db, 'liveClasses')),
          getDocs(collection(db, 'units'))
        ]);

        step = "processing data items";
        const allItems = [
          ...coursesSnap.docs.map(doc => ({ id: doc.id, itemType: 'course', ...doc.data() })),
          ...notesSnap.docs.map(doc => ({ id: doc.id, itemType: 'note', ...doc.data() })),
          ...lecturesSnap.docs.map(doc => ({ id: doc.id, itemType: 'lecture', ...doc.data() })),
          ...liveSnap.docs.map(doc => ({ id: doc.id, itemType: 'live', ...doc.data() })),
          ...unitsSnap.docs.map(doc => ({ id: doc.id, itemType: 'unit', ...doc.data() }))
        ];

        step = "filtering purchased and free content";
        // Filter based on purchasedItems in profile OR if item is free
        const purchasedIds = profile?.purchasedItems || [];
        const filtered = allItems.filter(item => {
          const id = item.id;
          const courseId = (item as any).courseId;
          const noteId = (item as any).noteId;
          const isFree = (item as any).isFree === true || Number((item as any).price || 0) <= 0;
          
          return purchasedIds.includes(id) || 
                 (courseId && purchasedIds.includes(courseId)) ||
                 (noteId && purchasedIds.includes(noteId)) ||
                 isFree;
        });

        setPurchasedItems(filtered.map(item => ({
          ...item,
          isActuallyPurchased: purchasedIds.includes(item.id) || 
                              ((item as any).courseId && purchasedIds.includes((item as any).courseId)) ||
                              ((item as any).noteId && purchasedIds.includes((item as any).noteId))
        })).sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }));

        setAllMaterials(allItems);

        step = "fetching sales records";
        const salesSnap = await getDocs(query(collection(db, 'sales'), where('userId', '==', user.uid)));
        const mappedSales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        mappedSales.sort((a, b) => {
          const tA = a.timestamp ? (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime())) : 0;
          const tB = b.timestamp ? (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime())) : 0;
          return tB - tA;
        });
        setPayments(mappedSales);
      } catch (error: any) {
        console.error(`Error fetching dashboard data (during ${step}):`, error);
        setError(error.message || `An error occurred during ${step}. Please check your connection and permissions.`);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchData();
      
      const unsubNotices = onSnapshot(query(
        collection(db, 'notices'), 
        orderBy('createdAt', 'desc')
      ), (snap) => {
        const allNotices = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const filtered = allNotices.filter(n => ['registered', 'both'].includes(n.visibility)).slice(0, 5);
        setNotices(filtered);
      });

      // Filter for live and upcoming classes for the notification feed
      const liveQ = query(
        collection(db, 'liveClasses'), 
        where('status', 'in', ['live', 'upcoming'])
      );
      
      const unsubLive = onSnapshot(liveQ, (snap) => {
        const sortedLive = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (a.status !== 'live' && b.status === 'live') return 1;
            return 0;
          });
        setLiveClasses(sortedLive);
      });

      const promotionsQuery = query(
        collection(db, 'promotions'),
        orderBy('order', 'asc')
      );
      const unsubPromotions = onSnapshot(promotionsQuery, (snap) => {
        const allPromos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const activePromos = allPromos.filter(p => p.isActive === true);
        setPromotions(activePromos);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'promotions'));

      return () => {
        unsubNotices();
        unsubLive();
        unsubPromotions();
      };
    }
  }, [profile, user, authLoading, isAdmin, navigate]);

  const handleAction = async (item: any) => {
    const itemType = item.itemType || item.type;
    
    // Ownership check for everything except courses (which navigate)
    if (itemType !== 'course') {
      const isOwned = profile?.purchasedItems?.includes(item.id) || 
                      (item.courseId && profile?.purchasedItems?.includes(item.courseId)) || 
                      (item.noteId && profile?.purchasedItems?.includes(item.noteId)) ||
                      item.isFree || 
                      Number(item.price || 0) <= 0 ||
                      isAdmin;

      if (!isOwned) {
        setNotification({ message: 'Please purchase this item to access it.', type: 'error' });
        return;
      }
    }

    if (itemType === 'course') {
      navigate(`/course/${item.id}`);
    } else if (itemType === 'note' || itemType === 'unit') {
      const url = await fetchSecureUrl(item.id, itemType as any, item.pdfUrl);
      if (url) {
        setViewerConfig({ url, title: item.title, isOpen: true });
      } else if (itemType === 'note') {
        navigate(`/notebook/${item.id}`);
      }
    } else if (itemType === 'lecture') {
      const url = await fetchSecureUrl(item.id, 'lecture', item.videoUrl);
      if (url) setVideoViewerConfig({ url, title: item.title, isOpen: true });
    } else if (itemType === 'live') {
      const sanitizedRoom = (item.title || 'Class').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      if (item.isInternalRoom) {
        setClassroomConfig({
          isOpen: true,
          roomName: sanitizedRoom,
          userName: profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student',
          classId: item.id,
          isModerator: false,
          externalUrl: ''
        });
      } else {
        const url = await fetchSecureUrl(item.id, 'live', item.meetingUrl);
        if (url || item.meetingUrl) {
          setClassroomConfig({
            isOpen: true,
            roomName: sanitizedRoom,
            userName: profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student',
            classId: item.id,
            isModerator: false,
            externalUrl: url || item.meetingUrl
          });
        }
      }
    }
  };

  const availableDistricts = STATES_AND_DISTRICTS.find(s => s.name === profileForm.state)?.districts || [];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (profileForm.mobile && profileForm.mobile.length !== 10) {
      setNotification({ message: 'Mobile number must be exactly 10 digits', type: 'error' });
      return;
    }

    setProfileSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profileForm.name,
        mobile: profileForm.mobile,
        updatedAt: new Date().toISOString()
      });
      await refreshProfile();
      setEditingProfile(false);
      setNotification({ message: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      console.error('Error updating profile:', err);
      setNotification({ message: 'Failed to update profile', type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setProfileSaving(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, 'users', user.uid), {
        photoUrl: url,
        updatedAt: new Date().toISOString()
      });
      await refreshProfile();
      setProfileForm(prev => ({ ...prev, photoUrl: url }));
      setNotification({ message: 'Profile picture updated!', type: 'success' });
    } catch (err) {
      console.error('Error uploading image:', err);
      setNotification({ 
        message: 'Storage permission denied. Please ensure Firebase Storage is enabled and rules are set to allowed in your console.', 
        type: 'error' 
      });
    } finally {
      setProfileSaving(false);
    }
  };



  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedItems = purchasedItems
    .filter(item => {
      // Filter by subtab first
      if (subtab === 'free') {
        const isFree = item.isFree === true || Number(item.price || 0) <= 0;
        if (!isFree) return false;
      } else {
        // Purchased tab should only show things they actually bought
        if (!item.isActuallyPurchased) return false;
      }

      const searchStr = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(searchStr) ||
        item.category?.toLowerCase().includes(searchStr) ||
        item.itemType?.toLowerCase().includes(searchStr)
      );
    })
    .sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'createdAt') {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center dark:bg-[#050505]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 bg-indigo-600 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Initializing Student Workspace...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 sticky top-0 z-30 md:static dashboard-header">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-3 md:gap-6">
              <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] bg-indigo-600 overflow-hidden shadow-lg shadow-indigo-200 dark:shadow-none shrink-0 ring-2 md:ring-4 ring-indigo-50 dark:ring-indigo-900/20">
                <img 
                  src={profile?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'S')}&background=6366f1&color=fff&bold=true&size=128`} 
                  className="w-full h-full object-cover" 
                  alt="Profile"
                />
              </div>
            <div>
              <h1 className="text-lg md:text-3xl font-display font-black dark:text-white uppercase tracking-tight line-clamp-1">
                {activeTab === 'profile' ? 'My Profile' : 
                 activeTab === 'history' ? 'Billing & History' :
                 activeTab === 'offers' ? 'Exclusive Offers' :
                 activeTab === 'news' ? 'News & Updates' : 'Library'}
              </h1>
              <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-[7px] md:text-[10px] mt-0.5 md:mt-1">
                <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Logged in: {profile?.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/')}
              className="px-4 md:px-6 py-2.5 md:py-3.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-2 group"
            >
              <Home className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
              <span>Visit Website</span>
              <ArrowUpRight className="w-3 md:w-3.5 h-3 md:h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Vertical Sidebar Navigation for Desktop */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 pr-6 border-r border-zinc-200 dark:border-zinc-800 gap-2 h-fit sticky top-24 select-none">
          <div className="font-black text-[9px] tracking-widest text-zinc-400 uppercase mb-4 px-2">Workspace Menu</div>
          {[
            { id: 'content', label: 'Library', icon: Book },
            { id: 'history', label: 'Billing & History', icon: History },
            { id: 'offers', label: 'Exclusive Offers', icon: Tag },
            { id: 'news', label: 'News & Updates', icon: Bell },
            { id: 'profile', label: 'My Profile', icon: User }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all text-left w-full cursor-pointer",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20" 
                  : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900"
              )}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Content Wrapper */}
        <div className="flex-1 min-w-0 flex flex-col gap-6 md:gap-10">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-[2rem] flex items-center gap-4 text-red-600 dark:text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-black uppercase tracking-widest text-[10px]">Sync Error Encountered</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Top Section: Active Tab Banner */}
          <div className="bg-indigo-600/5 dark:bg-indigo-600/10 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-900/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
                {activeTab === 'content' && <Book className="w-6 h-6" />}
                {activeTab === 'history' && <History className="w-6 h-6" />}
                {activeTab === 'offers' && <Tag className="w-6 h-6 text-white" />}
                {activeTab === 'news' && <Bell className="w-6 h-6" />}
                {activeTab === 'profile' && <User className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white">
                  {activeTab === 'content' ? 'Student Library' :
                   activeTab === 'history' ? 'Billing & History' :
                   activeTab === 'offers' ? 'Exclusive Offers' :
                   activeTab === 'news' ? 'News & Announcements' : 'My Student Profile'}
                </h2>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1 leading-normal">
                  {activeTab === 'content' ? 'Access your purchased materials, books and free courses' :
                   activeTab === 'history' ? 'Track your subscriptions, purchases, GST invoices and billing history' :
                   activeTab === 'offers' ? 'Browse active premium vouchers, coupons and promo events' :
                   activeTab === 'news' ? 'Stay updated with dynamic alerts, news, and schedule notices' : 'Update and manage your personal user details'}
                </p>
              </div>
            </div>
          </div>

          {/* Horizontal Top-bar Navigation for Mobile Screens */}
          <div className="flex md:hidden items-center gap-4 border-b dark:border-zinc-800 overflow-x-auto scollbar-hide no-scrollbar py-1">
            {[
              { id: 'content', label: 'Library', icon: Book },
              { id: 'history', label: 'Billing', icon: History },
              { id: 'offers', label: 'Offers', icon: Tag },
              { id: 'news', label: 'News', icon: Bell },
              { id: 'profile', label: 'Profile', icon: User }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-2 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all relative shrink-0",
                  activeTab === tab.id ? "text-indigo-600 font-extrabold" : "text-zinc-400 hover:text-zinc-650"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-6">
          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Attractive Subtabs for Purchased vs Free */}
              <div className="grid grid-cols-2 gap-4 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-inner max-w-2xl mx-auto w-full">
                <button 
                  onClick={() => {
                    setSubtab('purchased');
                    navigate('/dashboard?tab=content&subtab=purchased', { replace: true });
                  }}
                  className={cn(
                    "relative py-4 px-8 rounded-full text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 overflow-hidden group",
                    subtab === 'purchased' 
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xl shadow-zinc-200 dark:shadow-none translate-y-[-2px]" 
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  )}
                >
                  <ShoppingBag className={cn("w-4 h-4 transition-transform group-hover:scale-110", subtab === 'purchased' ? "text-indigo-400 dark:text-indigo-600" : "text-zinc-300")} />
                  <span>Purchased Material</span>
                </button>
                <button 
                  onClick={() => {
                    setSubtab('free');
                    navigate('/dashboard?tab=content&subtab=free', { replace: true });
                  }}
                  className={cn(
                    "relative py-4 px-8 rounded-full text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 overflow-hidden group",
                    subtab === 'free' 
                      ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-500/30 translate-y-[-2px]" 
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  )}
                >
                  <Gift className={cn("w-4 h-4 transition-transform group-hover:scale-110", subtab === 'free' ? "text-white" : "text-zinc-300")} />
                  <span>Free Library</span>
                </button>
              </div>

              {/* Subtab Description Banner */}
              <motion.div 
                key={subtab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-6 rounded-[2.5rem] border flex items-center gap-6",
                  subtab === 'free' 
                    ? "bg-emerald-500/5 border-emerald-500/10" 
                    : "bg-indigo-500/5 border-indigo-500/10"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  subtab === 'free' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-indigo-500 text-white shadow-indigo-500/20"
                )}>
                  {subtab === 'free' ? <Gift className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight dark:text-white">
                    {subtab === 'free' ? 'Community Access Library' : 'My Personal Collection'}
                  </h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                    {subtab === 'free' 
                      ? 'Exploring high-quality resources donated by our community and faculty.' 
                      : 'Verified and premium educational assets acquired for your learning journey.'}
                  </p>
                </div>
              </motion.div>

              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative group flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    type="text"
                    placeholder="FIND MATERIALS, TOPICS OR CATEGORIES..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mr-2">Showing {filteredAndSortedItems.length} items</div>
                </div>
              </div>

              {/* Card List for Mobile, Table for Desktop */}
              <div className="grid grid-cols-1 md:hidden gap-4">
                {filteredAndSortedItems.length > 0 ? filteredAndSortedItems.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex flex-col gap-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm",
                            item.itemType === 'course' ? "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800" :
                            item.itemType === 'note' ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800" :
                            item.itemType === 'lecture' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800" :
                            item.itemType === 'unit' ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800" :
                            "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
                          )}>
                            {item.itemType === 'course' && <Book className="w-7 h-7" />}
                            {item.itemType === 'note' && <FileText className="w-7 h-7" />}
                            {item.itemType === 'unit' && <FileText className="w-7 h-7" />}
                            {item.itemType === 'lecture' && <Video className="w-7 h-7" />}
                            {item.itemType === 'live' && <PlayCircle className="w-7 h-7" />}
                          </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-black dark:text-white uppercase tracking-tight leading-tight mb-1">{item.title}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded border dark:border-zinc-700">{item.itemType}</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate">{item.category || 'General'}</span>
                            {item.itemType === 'live' && item.scheduledAt && new Date(item.scheduledAt) > new Date() && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-100 dark:border-rose-800/50">
                                <Clock className="w-2.5 h-2.5" />
                                <CountdownTimer targetDate={item.scheduledAt} className="text-[8px]" />
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                    <button 
                      onClick={() => handleAction(item)}
                      disabled={fetchingSecure === item.id}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {fetchingSecure === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {item.itemType === 'note' || item.itemType === 'unit' ? 'Read' : (item.itemType === 'lecture' ? 'Watch' : (item.itemType === 'course' ? 'Explore' : 'Join'))}
                          <ArrowUpRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )) : (
                  <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                    <ShoppingBag className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Empty Workspace</p>
                  </div>
                )}
              </div>

              {/* Desktop Only Table */}
              <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200/60 dark:border-zinc-800 overflow-hidden shadow-xl shadow-zinc-200/40 dark:shadow-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/80 dark:bg-zinc-800/80 border-b border-zinc-200/60 dark:border-zinc-800">
                      <th 
                        className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-600 transition-colors group"
                        onClick={() => toggleSort('title')}
                      >
                        <div className="flex items-center gap-2">
                          Description
                          {sortField === 'title' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-600 transition-colors group"
                        onClick={() => toggleSort('itemType')}
                      >
                        <div className="flex items-center gap-2">
                          Format
                          {sortField === 'itemType' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-right">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800">
                    {filteredAndSortedItems.length > 0 ? filteredAndSortedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                        <td className="px-8 py-7">
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 shadow-sm group-hover:scale-105 transition-all duration-300",
                              item.itemType === 'course' ? "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800" :
                              item.itemType === 'note' ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800" :
                              item.itemType === 'lecture' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800" :
                              item.itemType === 'unit' ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800" :
                              "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
                            )}>
                              {item.itemType === 'course' && <Book className="w-7 h-7" />}
                              {item.itemType === 'note' && <FileText className="w-7 h-7" />}
                              {item.itemType === 'unit' && <FileText className="w-7 h-7" />}
                              {item.itemType === 'lecture' && <Video className="w-7 h-7" />}
                              {item.itemType === 'live' && <PlayCircle className="w-7 h-7" />}
                            </div>
                            <div>
                              <div className="text-sm font-black dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors leading-tight">{item.title}</div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{item.category || item.subject || 'Elite Study'}</span>
                                {(item.itemType === 'live' ? item.scheduledAt : item.createdAt) && (
                                  <>
                                    <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></span>
                                    <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
                                      {item.itemType === 'live' ? 'Scheduled: ' : ''}
                                      {(() => {
                                        try {
                                          const date = new Date(item.itemType === 'live' ? item.scheduledAt : item.createdAt);
                                          if (isNaN(date.getTime())) return 'TBA';
                                          const formatter = new Intl.DateTimeFormat('en-US', {
                                            timeZone: 'Asia/Kolkata',
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: true
                                          });
                                          const parts = formatter.formatToParts(date);
                                          const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
                                          
                                          const d = partMap.day;
                                          const m = partMap.month;
                                          const y = partMap.year;
                                          
                                          if (item.itemType === 'live') {
                                            const mm = partMap.minute;
                                            const ss = partMap.second || '00';
                                            const ampm = partMap.dayPeriod || 'AM';
                                            const hh = parseInt(partMap.hour).toString().padStart(2, '0');
                                            return (
                                              <div className="flex flex-col gap-1">
                                                <span>{`${d}/${m}/${y} at ${hh}:${mm} ${ampm}`}</span>
                                                {new Date(item.scheduledAt) > new Date() && (
                                                  <div className="flex items-center gap-1.5 text-rose-500 font-black">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    <CountdownTimer targetDate={item.scheduledAt} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }
                                          
                                          return `${d}/${m}/${y}`;
                                        } catch {
                                          return 'TBA';
                                        }
                                      })()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-7 uppercase">
                          <div className="flex">
                            <span className={cn(
                              "text-[10px] font-black tracking-widest px-3 py-1.5 rounded-lg border-2",
                              item.itemType === 'course' ? "bg-white dark:bg-zinc-900 text-indigo-600 border-indigo-100 dark:border-indigo-900/40" :
                              item.itemType === 'note' ? "bg-white dark:bg-zinc-900 text-red-600 border-red-100 dark:border-red-900/40" :
                              item.itemType === 'lecture' ? "bg-white dark:bg-zinc-900 text-emerald-600 border-emerald-100 dark:border-emerald-900/40" :
                              item.itemType === 'unit' ? "bg-white dark:bg-zinc-900 text-blue-600 border-blue-100 dark:border-blue-900/40" :
                              "bg-white dark:bg-zinc-900 text-amber-600 border-amber-100 dark:border-amber-900/40"
                            )}>
                              {item.itemType}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-7 text-right">
                          <button 
                            onClick={() => handleAction(item)}
                            disabled={fetchingSecure === item.id}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all active:scale-95 shadow-md shadow-zinc-200 dark:shadow-none disabled:opacity-50 min-w-[120px] justify-center"
                          >
                            {fetchingSecure === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <span>{item.itemType === 'note' || item.itemType === 'unit' ? 'Read' : (item.itemType === 'lecture' ? 'Watch' : (item.itemType === 'course' ? 'Explore' : 'Join'))}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                              <Search className="w-8 h-8 text-zinc-300" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">No matching materials found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Billing Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Slider Alert Banner */}
              <div className="flex items-center justify-between text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest px-1">
                <span className="flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                  Scroll left/right & up/down to view full details
                </span>
                <span className="text-zinc-400 font-mono">My Purchases: {payments.length}</span>
              </div>

              {/* Secure vertical & horizontal scrolling table container */}
              <div className="overflow-x-auto overflow-y-auto max-h-[600px] rounded-[2rem] border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl table-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1450px]">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/60 dark:border-zinc-800 sticky top-0 z-10">
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">NAME</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">MOBILE</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">PAYMENT METHOD</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">STATUS</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">ITEM</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">PRICE</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">DISCOUNT</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-center animate-none">COUPAN DISCOUNT</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">GST (18%)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">PAID AMOUNT</th>
                      <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">TIME STAMPS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                    {payments.length > 0 ? payments.map((payment) => {
                      const matchedMaterial = allMaterials.find(m => m.id === payment.itemId);
                      const itemTitle = matchedMaterial?.title || (payment.itemId === 'batch_purchase' ? 'Batch Purchase Access' : 'Course Material Access');
                      const subjectName = matchedMaterial?.subject || matchedMaterial?.category || 'General';
                      
                      // Formula variables
                      // Safe parsing of prices in case they are stored as strings or styled with currency symbols
                      const parsePrice = (val: any): number => {
                        if (val === undefined || val === null) return 0;
                        if (typeof val === 'number') return val;
                        const clean = String(val).replace(/[^0-9.]/g, '');
                        return Number(clean) || 0;
                      };

                      let actualPriceVal = 0;
                      let discountPriceVal = 0;
                      let adminDiscountAmount = 0;

                      if (payment.originalPrice !== undefined) {
                        actualPriceVal = parsePrice(payment.originalPrice);
                        discountPriceVal = payment.productDiscount !== undefined 
                          ? parsePrice(payment.originalPrice) - parsePrice(payment.productDiscount)
                          : parsePrice(payment.amount || 0);
                        adminDiscountAmount = payment.productDiscount !== undefined
                          ? parsePrice(payment.productDiscount)
                          : Math.max(0, actualPriceVal - discountPriceVal);
                      } else {
                        // Older purchases fallback
                        if (payment.itemId === 'batch_purchase' && Array.isArray(payment.itemIds)) {
                          let totalOriginal = 0;
                          let totalDiscounted = 0;
                          payment.itemIds.forEach((id: string) => {
                            const mat = allMaterials.find(m => m.id === id);
                            if (mat) {
                              totalOriginal += parsePrice(mat.price || 0);
                              totalDiscounted += parsePrice(mat.discountPrice || mat.price || 0);
                            }
                          });
                          if (totalOriginal > 0) {
                            actualPriceVal = totalOriginal;
                            discountPriceVal = totalDiscounted > 0 ? totalDiscounted : parsePrice(payment.amount || 0);
                            adminDiscountAmount = Math.max(0, actualPriceVal - discountPriceVal);
                          } else {
                            actualPriceVal = parsePrice(payment.amount || 0);
                            discountPriceVal = parsePrice(payment.amount || 0);
                            adminDiscountAmount = 0;
                          }
                        } else {
                          actualPriceVal = parsePrice(matchedMaterial?.price || payment.amount || 0);
                          discountPriceVal = parsePrice(payment.amount || 0);
                          adminDiscountAmount = Math.max(0, actualPriceVal - discountPriceVal);
                        }
                      }

                      const couponCode = payment.couponCode || payment.discountApplied || null;
                      
                      let couponDiscountAmount = 0;
                      if (payment.couponDiscount !== undefined) {
                        couponDiscountAmount = parsePrice(payment.couponDiscount);
                      } else if (couponCode) {
                        const promo = promotions.find(p => p.couponCode && p.couponCode.toLowerCase() === couponCode.toLowerCase());
                        if (promo) {
                          if (promo.discountType === 'percentage') {
                            couponDiscountAmount = Math.round((discountPriceVal * parsePrice(promo.discountValue)) / 100);
                          } else {
                            couponDiscountAmount = Math.min(discountPriceVal, parsePrice(promo.discountValue || 0));
                          }
                        }
                      }

                      const priceAfterCoupon = Math.max(0, (payment.productDiscount !== undefined ? (actualPriceVal - adminDiscountAmount) : discountPriceVal) - couponDiscountAmount);
                      
                      const gstPercent = payment.gstPercent !== undefined ? parsePrice(payment.gstPercent) : 18;
                      const gstAmount = payment.gstAmount !== undefined 
                        ? parsePrice(payment.gstAmount) 
                        : priceAfterCoupon * (gstPercent / 100);

                      const finalNetPaid = payment.paidAmount !== undefined 
                        ? parsePrice(payment.paidAmount) 
                        : priceAfterCoupon + gstAmount;

                      const isSuccess = !payment.status || payment.status.toLowerCase() === 'successful' || payment.status.toLowerCase() === 'paid';

                      return (
                        <tr key={payment.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-all group">
                          {/* NAME */}
                          <td className="px-6 py-5 shrink-0 whitespace-nowrap">
                            <div className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100">{profile?.name || 'Student Account'}</div>
                          </td>
                          {/* MOBILE */}
                          <td className="px-6 py-5 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                            {profile?.mobile || profile?.phoneNumber || 'N/A'}
                          </td>
                          {/* PAYMENT METHOD */}
                          <td className="px-6 py-5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider whitespace-nowrap">
                            {payment.paymentMethod || (payment.paymentId ? 'Razorpay Online' : 'Online Gateway')}
                          </td>
                          {/* STATUS */}
                          <td className="px-6 py-5 whitespace-nowrap">
                            {isSuccess ? (
                              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30 animate-none">
                                SUCCESSFUL
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 animate-none">
                                {payment.status?.toUpperCase() || 'PENDING'}
                              </span>
                            )}
                          </td>
                          {/* ITEM */}
                          <td className="px-6 py-5 max-w-[240px] truncate whitespace-nowrap" title={itemTitle}>
                            <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 capitalize">{itemTitle}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-650 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border dark:border-zinc-700">{payment.itemType || 'course'}</span>
                              <span className="text-[8px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{subjectName}</span>
                            </div>
                          </td>
                          {/* PRICE */}
                          <td className="px-6 py-5 text-xs font-bold text-zinc-800 dark:text-zinc-200 text-right whitespace-nowrap">
                            {formatCurrency(actualPriceVal)}
                          </td>
                          {/* DISCOUNT */}
                          <td className="px-6 py-5 text-right whitespace-nowrap">
                            {adminDiscountAmount > 0 ? (
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                -{formatCurrency(adminDiscountAmount)}
                              </span>
                            ) : (
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs">-</span>
                            )}
                          </td>
                          {/* COUPAN DISCOUNT */}
                          <td className="px-6 py-5 text-center whitespace-nowrap">
                            {couponCode ? (
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg text-[9px] font-black font-mono uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30 select-all">
                                  {couponCode}
                                </span>
                                {couponDiscountAmount > 0 && (
                                  <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold">
                                    -{formatCurrency(couponDiscountAmount)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs">-</span>
                            )}
                          </td>
                          {/* GST */}
                          <td className="px-6 py-5 text-xs font-bold text-zinc-800 dark:text-zinc-200 text-right whitespace-nowrap">
                            {formatCurrency(gstAmount)}
                          </td>
                          {/* PAID AMOUNT */}
                          <td className="px-6 py-5 text-xs font-black text-indigo-700 dark:text-indigo-400 text-right whitespace-nowrap">
                            {formatCurrency(finalNetPaid)}
                          </td>
                          {/* TIME STAMPS */}
                          <td className="px-6 py-5 text-right text-xs text-zinc-600 dark:text-zinc-400 font-mono whitespace-nowrap">
                            {new Date(payment.timestamp).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={11} className="px-8 py-20 text-center text-zinc-600 dark:text-zinc-400 uppercase tracking-widest text-[10px] font-black">No billing records found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Offers Tab */}
          {activeTab === 'offers' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {promotions.length > 0 ? (
                  promotions.map((promo) => (
                    <div 
                      key={promo.id}
                      className="group relative bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm p-4 flex flex-col gap-4"
                    >
                      <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden shadow-lg border dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                        <img src={promo.imgUrl || promo.imageUrl || promo.img || getItemImage(promo.title, promo.type || 'offer')} alt={promo.title} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[7px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-800">
                             {promo.type || 'Special'}
                           </span>
                           {promo.expiryDate && (
                             <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">Exp: {new Date(promo.expiryDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                           )}
                        </div>
                        <h3 className="text-[13px] font-black uppercase tracking-tight dark:text-white group-hover:text-indigo-600 transition-colors uppercase">{promo.title}</h3>
                        <p className="text-[10px] font-medium text-zinc-500 mt-1 line-clamp-2">{promo.description}</p>
                        
                        {promo.couponCode && (
                          <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest select-all">{promo.couponCode}</span>
                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">
                               {promo.discountValue}{promo.discountType === 'percentage' ? '%' : ' OFF'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-6">
                      <Tag className="w-10 h-10 text-zinc-300" />
                    </div>
                    <h3 className="text-2xl font-display font-black text-zinc-300 uppercase tracking-tight">No Active Offers</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-2">Check back later for exciting discounts</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* News & Updates Tab */}
          {activeTab === 'news' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Active Sessions Mini Grid */}
              {liveClasses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {liveClasses.map((live) => (
                    <div 
                      key={live.id}
                      onClick={() => handleAction({ ...live, itemType: 'live' })}
                      className={cn(
                        "p-6 rounded-[2.5rem] border transition-all cursor-pointer relative overflow-hidden group",
                        live.status === 'live' 
                          ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/50" 
                          : "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                          live.status === 'live' ? "bg-rose-500 text-white" : "bg-blue-500 text-white"
                        )} text-white>
                          <Video className={cn("w-6 h-6", live.status === 'live' && "animate-pulse")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                             <span className={cn(
                               "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                               live.status === 'live' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                             )}>
                               {live.status}
                             </span>
                          </div>
                          <h4 className="text-[13px] font-black dark:text-white uppercase tracking-tight truncate group-hover:text-indigo-600 transition-colors uppercase">{live.title}</h4>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* General Notices List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {notices.length > 0 ? (
                  notices.map((notice) => (
                    <div 
                      key={notice.id}
                      onClick={() => handleNoticeClick(notice)}
                      className="p-8 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] hover:border-indigo-600/30 transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <span className={cn(
                          "px-4 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest border",
                          notice.type === 'news' ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" :
                          notice.type === 'update' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" :
                          "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
                        )}>
                          {notice.type || 'Announcement'}
                        </span>
                        <div className="flex items-center gap-2 text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(notice.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                      </div>
                      <h3 className="text-lg font-black dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors uppercase mb-3 leading-tight">{notice.title}</h3>
                      <p className="text-xs text-zinc-400 font-medium line-clamp-3 leading-relaxed">{notice.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-6">
                      <Bell className="w-10 h-10 text-zinc-300" />
                    </div>
                    <h3 className="text-2xl font-display font-black text-zinc-300 uppercase tracking-tight">No Active Updates</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-2">You're all caught up with recent announcements</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8 md:gap-12"
            >
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Profile Card */}
                <div className="w-full lg:w-96 shrink-0 flex flex-col gap-6">
                  <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 shadow-sm flex flex-col items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-600 to-indigo-400 opacity-20"></div>
                    
                    <div className="relative mt-8">
                      <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden ring-4 ring-white dark:ring-zinc-900 shadow-xl">
                        <img 
                          src={profileForm.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'S')}&background=6366f1&color=fff&bold=true&size=200`} 
                          className="w-full h-full object-cover"
                          alt="Profile"
                        />
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-all active:scale-90"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>

                    <div className="text-center w-full px-4">
                      <h2 className="text-3xl font-display font-black dark:text-white uppercase tracking-tight break-words">{profile?.name}</h2>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Shield className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Verified {profile?.role || 'Student'}</span>
                      </div>
                    </div>

                    <div className="w-full flex flex-col gap-4 py-8 border-y dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Join Date</span>
                        <span className="text-xs font-bold dark:text-white uppercase">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }) : 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mobile Number</span>
                        <span className="text-xs font-bold dark:text-white uppercase">{profile?.mobile || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="flex-1 w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 md:p-12 shadow-sm">
                  <div className="max-w-3xl">
                    <h3 className="text-2xl font-display font-black dark:text-white uppercase tracking-tight mb-10">Personal Information</h3>
                    
                    <form onSubmit={handleUpdateProfile} className="flex flex-col gap-10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-8">
                        {/* Name Input */}
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Full Name</label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-indigo-600 transition-all" />
                            <input 
                              type="text"
                              required
                              value={profileForm.name}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Enter your full name"
                              className="w-full pl-12 pr-4 py-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs xl:text-sm font-bold dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Email - If present */}
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Email Address</label>
                          <div className="relative opacity-60">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                            <input 
                              type="email"
                              disabled
                              value={(user?.email || 'N/A').toLowerCase()}
                              className="w-full pl-12 pr-4 py-5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-[11px] sm:text-xs xl:text-sm font-bold text-zinc-500 lowercase tracking-normal cursor-not-allowed overflow-x-auto"
                            />
                          </div>
                        </div>

                        {/* Mobile Number */}
                        <div className="flex flex-col gap-3 col-span-1">
                          <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Mobile Number</label>
                            <span className={`text-[10px] font-bold ${profileForm.mobile.length === 10 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                              {profileForm.mobile.length}/10 Digits
                            </span>
                          </div>
                          <div className="relative group">
                            <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-all ${profileForm.mobile.length === 10 ? 'text-emerald-500' : 'text-zinc-400 group-focus-within:text-indigo-600'}`} />
                            <input 
                              type="tel"
                              required
                              value={profileForm.mobile}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setProfileForm(prev => ({ ...prev, mobile: val }));
                              }}
                              placeholder="Enter exactly 10-digit mobile number"
                              className={`w-full pl-12 pr-4 py-5 bg-zinc-50 dark:bg-zinc-800/50 border rounded-2xl text-xs xl:text-sm font-bold dark:text-white transition-all outline-none focus:ring-2 ${
                                profileForm.mobile.length === 10 
                                  ? 'border-emerald-500/30 focus:ring-emerald-500' 
                                  : 'border-zinc-100 dark:border-zinc-800 focus:ring-indigo-600'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-4">
                        <button 
                          type="submit"
                          disabled={profileSaving}
                          className="flex items-center justify-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all flex-1 md:flex-none disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
                        >
                          {profileSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          Save Profile Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          </div>
        </div>
      </div>



      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl flex items-center gap-3 shadow-2xl backdrop-blur-md border",
              notification.type === 'success' ? "bg-emerald-600/90 text-white border-emerald-500" : "bg-red-600/90 text-white border-red-500"
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-[11px] font-black uppercase tracking-widest">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewers */}
      <SecurePDFViewer 
        isOpen={viewerConfig.isOpen}
        url={viewerConfig.url}
        title={viewerConfig.title}
        onClose={() => setViewerConfig({ ...viewerConfig, isOpen: false })}
      />

      <SecureVideoViewer 
        isOpen={videoViewerConfig.isOpen}
        url={videoViewerConfig.url}
        title={videoViewerConfig.title}
        onClose={() => setVideoViewerConfig({ ...videoViewerConfig, isOpen: false })}
      />

      <VirtualClassroom
        isOpen={classroomConfig.isOpen}
        onClose={() => setClassroomConfig({ ...classroomConfig, isOpen: false })}
        roomName={classroomConfig.roomName}
        userName={classroomConfig.userName}
        isModerator={false}
        classId={classroomConfig.classId}
        externalUrl={classroomConfig.externalUrl}
      />

      <LiveScheduleModal 
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Notice Detail Modal */}
      <AnimatePresence>
        {selectedNotice && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNotice(null)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/10"
            >
              <div className="p-8 lg:p-12 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border",
                    selectedNotice.type === 'news' ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" :
                    selectedNotice.type === 'update' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" :
                    "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
                  )}>
                    {selectedNotice.type || 'announcement'}
                  </span>
                  <button 
                    onClick={() => setSelectedNotice(null)}
                    className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 dark:text-white" />
                  </button>
                </div>

                <div className="space-y-6">
                  <h2 className="text-3xl lg:text-5xl font-display font-black dark:text-white uppercase tracking-tighter leading-tight">
                    {selectedNotice.title}
                  </h2>
                  
                  <div className="flex items-center gap-4 text-zinc-400 dark:text-zinc-500">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                       <Calendar className="w-4 h-4" />
                       {new Date(selectedNotice.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' })}
                    </div>
                  </div>

                  <div className="w-20 h-1 bg-indigo-600 rounded-full" />

                  <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <p className="text-zinc-600 dark:text-zinc-300 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedNotice.content}
                    </p>
                  </div>

                  {selectedNotice.attachmentUrl && (
                    <div className="mt-12 p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
                      <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                            <FileText className="w-7 h-7" />
                          </div>
                          <div>
                            <p className="text-sm font-black dark:text-white uppercase tracking-tight line-clamp-1">{selectedNotice.attachmentName}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Official Document Attachment</p>
                          </div>
                        </div>
                        <a 
                          href={selectedNotice.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm text-center hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-3"
                        >
                          DOWNLOAD ATTACHMENT <ArrowUpRight className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
                 <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em]">Official Academy Communication</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beautiful A4 Invoice Modal */}
      <AnimatePresence>
        {selectedInvoice && (() => {
          const amount = selectedInvoice.amount || 0;
          const gstPercentValue = selectedInvoice.gstPercent !== undefined ? selectedInvoice.gstPercent : (settings.gstPercent ?? 18);
          const baseAmount = amount / (1 + (gstPercentValue / 100));
          const totalGst = amount - baseAmount;
          const cgst = totalGst / 2;
          const sgst = totalGst / 2;
          const invoiceNo = `VTX-${new Date(selectedInvoice.timestamp).getFullYear()}-${selectedInvoice.id.toUpperCase().substring(0, 8)}`;
          const invoiceDate = new Date(selectedInvoice.timestamp).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          });
          const matchedMaterial = allMaterials.find(m => m.id === selectedInvoice.itemId);
          const itemTitle = matchedMaterial?.title || 'Course Material Access';
          
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print text-left">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-900/45 backdrop-blur-md dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-4xl p-6 md:p-8 border border-zinc-100 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[95vh]"
              >
                {/* Top action controls */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      Tax Invoice Preview
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium tracking-wide font-mono">
                      Invoice: {invoiceNo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/15"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print / Save A4 PDF</span>
                    </button>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-rose-500 rounded-xl transition-all"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Invoice Area viewport container */}
                <div className="flex-1 overflow-y-auto pr-1 select-text bg-zinc-100/50 dark:bg-black/20 p-4 md:p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 scrollbar-thin">
                  
                  {/* The Print Layout */}
                  <div 
                    id="invoice-print-area" 
                    className="bg-white text-zinc-900 p-8 md:p-12 mx-auto w-full max-w-[210mm] min-h-[297mm] font-sans flex flex-col justify-between border border-zinc-200 shadow-sm relative text-left"
                    style={{ colorScheme: 'light' }}
                  >
                    {/* Header section (Company Branding + Title) */}
                    <div>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-8 border-b border-zinc-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-extrabold shadow-md shadow-indigo-600/20">
                            V
                          </div>
                          <div>
                            <h1 className="text-xl font-extrabold tracking-tight text-zinc-950 font-display">VECTONIX CLASSES</h1>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Learn with Expert Educators</p>
                          </div>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="inline-block px-3 py-1 bg-zinc-100 rounded text-xs font-black text-zinc-800 uppercase tracking-widest border border-zinc-200 mb-1">
                            Tax Invoice
                          </div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Original For Recipient</p>
                        </div>
                      </div>

                      {/* Seller & Student Metadata Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 text-xs leading-relaxed">
                        <div>
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Issued By</h4>
                          <p className="font-bold text-zinc-900 text-sm">Vectonix Educational Services</p>
                          <p className="text-zinc-650 font-normal">Vectonix Towers, Civil Lines</p>
                          <p className="text-zinc-650 font-normal">Near University Gate, New Delhi - 110001</p>
                          <p className="text-zinc-650 mt-1 font-normal">GSTIN: <span className="font-mono text-zinc-900 font-bold">07AAAAA0000A1Z1</span></p>
                          <p className="text-zinc-650 flex items-center gap-1.5 mt-2 font-normal animate-none">
                            <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> support@vectonixclasses.com
                          </p>
                          <p className="text-zinc-655 flex items-center gap-1.5 font-normal animate-none">
                            <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> +91 92866 70192
                          </p>
                        </div>
                        <div className="md:text-right">
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Billed To (Student)</h4>
                          <p className="font-bold text-zinc-900 text-sm">{profile?.name || 'Student Account'}</p>
                          {profile?.email && (
                            <p className="text-zinc-650 flex items-center gap-1.5 md:justify-end font-normal animate-none">
                              <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> {profile.email.toLowerCase()}
                            </p>
                          )}
                          {(profile?.mobile || profile?.phoneNumber) && (
                            <p className="text-zinc-650 flex items-center gap-1.5 md:justify-end font-normal animate-none">
                              <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> {profile.mobile || profile.phoneNumber}
                            </p>
                          )}
                          {profile?.dob && profile.dob !== 'N/A' && (
                            <p className="text-zinc-650 font-normal">D.O.B: <span className="font-medium text-zinc-800">{profile.dob}</span></p>
                          )}
                          <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col gap-1 md:items-end">
                            <p className="text-zinc-550 font-normal">Invoice No: <span className="font-mono font-bold text-zinc-900">{invoiceNo}</span></p>
                            <p className="text-zinc-550 font-normal">Date: <span className="font-bold text-zinc-900">{invoiceDate}</span></p>
                            <p className="text-zinc-550 flex items-center gap-1 md:justify-end font-normal">
                              Status: <span className="font-black text-emerald-600 uppercase tracking-widest text-[9px]">SUCCESSFUL / PAID</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Items Purchased Table */}
                      <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                              <th className="px-5 py-3.5">Sl. No</th>
                              <th className="px-5 py-3.5">Particulars / Description</th>
                              <th className="px-5 py-3.5 text-center">Qty</th>
                              <th className="px-5 py-3.5 text-right">Rate</th>
                              <th className="px-5 py-3.5 text-right">Tax Rates (GST)</th>
                              <th className="px-5 py-3.5 text-right">Total Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 text-xs text-left">
                            <tr className="align-top">
                              <td className="px-5 py-6 font-mono text-zinc-400">01</td>
                              <td className="px-5 py-6">
                                <p className="font-bold text-zinc-900 capitalize text-sm">{itemTitle}</p>
                                <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold mt-1">Item Code: VTX-{selectedInvoice.itemId.toUpperCase().substring(0, 5)} / {selectedInvoice.itemType}</p>
                              </td>
                              <td className="px-5 py-6 text-center font-bold text-zinc-700">1</td>
                              <td className="px-5 py-6 text-right font-semibold text-zinc-800">{formatCurrency(baseAmount)}</td>
                              <td className="px-5 py-6 text-right text-zinc-550 font-mono">{gstPercentValue}% GST (Incl)</td>
                              <td className="px-5 py-6 text-right font-extrabold text-zinc-950">{formatCurrency(amount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Financial Summary Calculation Side-by-side */}
                      <div className="flex flex-col md:flex-row justify-between items-start gap-8 leading-relaxed mb-8">
                        <div className="flex-1 max-w-md">
                          <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Amount in Words</h5>
                          <p className="text-xs font-bold text-indigo-950 italic capitalize bg-indigo-50/40 border border-indigo-100/50 p-3 rounded-xl">
                            {amountToWords(amount)}
                          </p>
                          <div className="mt-4 text-[10px] text-zinc-500">
                            <p className="font-bold text-zinc-800">Tax Declaration:</p>
                            <p>Subject to Delhi Jurisdiction. Highly compliant, {gstPercentValue}% GST is fully inclusive within course membership fee.</p>
                          </div>
                        </div>
                        <div className="w-full md:w-80 text-xs shrink-0 bg-zinc-50/50 p-5 rounded-2xl border border-zinc-200/60 divide-y divide-zinc-200/80">
                          <div className="flex justify-between items-center py-2 text-zinc-650">
                            <span>Subtotal (Base Value):</span>
                            <span className="font-semibold text-zinc-800">{formatCurrency(baseAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 text-zinc-550 text-[10px]">
                            <span>CGST ({(gstPercentValue / 2).toFixed(1)}%):</span>
                            <span className="font-mono">{formatCurrency(cgst)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 text-zinc-550 text-[10px]">
                            <span>SGST ({(gstPercentValue / 2).toFixed(1)}%):</span>
                            <span className="font-mono">{formatCurrency(sgst)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2.5 font-bold text-zinc-900 text-sm">
                            <span className="text-zinc-650">Grand Total:</span>
                            <span className="text-indigo-600 text-base font-extrabold font-display">{formatCurrency(amount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Invoice Footer (Signature Signatory block) */}
                    <div className="pt-8 border-t border-zinc-200">
                      <div className="flex justify-between items-end">
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Important Terms</p>
                          <p className="text-[9px] text-zinc-500 leading-normal max-w-md font-normal font-sans">
                            1. Course access is linked strictly with student email identification. Credentials cannot be shared.<br/>
                            2. Subscriptions are non-refundable & non-transferable once items are purchased.<br/>
                            3. This is a secure digital record invoice and does not require physically ink-signed seals.
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="w-16 h-16 rounded-full border border-indigo-200 text-indigo-500 flex flex-col items-center justify-center relative bg-indigo-50/15 mb-2 select-none rotate-6">
                            <span className="text-[6px] font-black uppercase tracking-widest">VECTONIX</span>
                            <span className="text-[7px] font-black text-indigo-600 uppercase leading-none mt-0.5">APPROVED</span>
                            <span className="text-[5px] font-sans text-indigo-400">STAFF SEAL</span>
                          </div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Authorized Officer</p>
                          <p className="text-[11px] font-bold text-zinc-800 leading-none mt-1 font-sans">Vectonix Classes</p>
                        </div>
                      </div>
                      <div className="text-center mt-8 text-[9px] text-zinc-400 uppercase tracking-[0.2em] font-black border-t border-zinc-100 pt-4 font-sans">
                        * Thank you for choosing Vectonix Classes - Let's excel together *
                      </div>
                    </div>
                  </div>
                  
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
