import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Video, Users, Star, ArrowRight, CheckCircle2, GraduationCap, ShoppingBag, Search, FileText, Calendar, Radio, Eye, Plus, ShoppingCart, Loader2, ChevronLeft, ChevronRight, ChevronDown, Tag, Atom, FlaskConical, BrainCircuit, Zap, X, LayoutGrid, ArrowUpRight, Bell, Map, MapPin, Instagram, Youtube, Send, Mail, Phone, Clock, Gift, MessageCircle } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, where, onSnapshot, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { cn, formatCurrency, getItemImage, getBannerImage } from '../lib/utils';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../context/CartContext';
import AdvancedSearch from '../components/AdvancedSearch';
import LiveScheduleModal from '../components/LiveScheduleModal';
import PriceDisplay from '../components/PriceDisplay';

export default function Home() {
  const { settings } = useSettings();
  const { user, profile, isAdmin } = useAuth();
  const { addToCart, isInCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [catalogNotes, setCatalogNotes] = useState<any[]>([]);
  const [catalogLectures, setCatalogLectures] = useState<any[]>([]);
  const [catalogLiveClasses, setCatalogLiveClasses] = useState<any[]>([]);
  const [activeCatalogTab, setActiveCatalogTab] = useState<'all' | 'courses' | 'notes' | 'lectures' | 'live'>('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');
  const [activeBanner, setActiveBanner] = useState(0);
  const [banners, setBanners] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [homepage, setHomepage] = useState<any>(null);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string, title: string } | null>(null);
  const [isHoveringBanner, setIsHoveringBanner] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '', courseId: 'general' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSubmitReview = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!reviewForm.content.trim()) {
      setNotification({ message: 'Please write your feedback.', type: 'error' });
      return;
    }

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        courseId: reviewForm.courseId,
        userId: user.uid,
        userName: profile?.name || profile?.fullName || user.email?.split('@')[0] || 'Student',
        userPhoto: profile?.photoUrl || null,
        rating: reviewForm.rating,
        content: reviewForm.content,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setNotification({ message: 'Review submitted for approval!', type: 'success' });
      setReviewForm({ rating: 5, content: '', courseId: 'general' });
      setShowReviewModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleNoticeClick = (notice: any) => {
    if (notice.title?.toLowerCase().includes('join class') || notice.content?.toLowerCase().includes('join class')) {
      setIsScheduleModalOpen(true);
    } else {
      setSelectedNotice(notice);
    }
  };

  useEffect(() => {
    const unsubourses = onSnapshot(collection(db, 'courses'), (snap) => {
      setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'courses'));

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'subjects'));

    const bannersQuery = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubBanners = onSnapshot(bannersQuery, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (docs.length > 0) {
        setBanners(docs);
      } else {
        // Fallback banners if none in DB
        setBanners([
          { 
            img: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80&w=1600", 
            title: "Master Classical Mechanics", 
            subtitle: "Comprehensive notes and problem sets for JEE & NEET",
            buttonText: "Start Learning",
            link: "/"
          },
          { 
            img: "https://images.unsplash.com/photo-1509048191080-d2984bad6ad5?auto=format&fit=crop&q=80&w=1600", 
            title: "Quantum Physics Deep Dive", 
            subtitle: "Interact with expert faculty in our live masterclasses",
            buttonText: "Join Live",
            link: "/"
          },
          { 
            img: "https://images.unsplash.com/photo-1544383335-9cd7318db9e9?auto=format&fit=crop&q=80&w=1600", 
            title: "Electromagnetism Decoded", 
            subtitle: "Visual learning tools for complex physics concepts",
            buttonText: "View Courses",
            link: "/"
          }
        ]);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'banners'));

    const noticesQuery = query(
      collection(db, 'notices'), 
      orderBy('createdAt', 'desc')
    );
    const unsubNotices = onSnapshot(noticesQuery, (snap) => {
      const allNotices = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const publicNotices = allNotices.filter(n => ['public', 'both'].includes(n.visibility || 'public')).slice(0, 4);
      setNotices(publicNotices);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'notices'));

    const unsubHomepage = onSnapshot(doc(db, 'homepage', 'config'), (snap) => {
      if(snap.exists()) setHomepage(snap.data());
    }, (error) => handleFirestoreError(error, OperationType.GET, 'homepage/config'));

    const promotionsQuery = query(
      collection(db, 'promotions'),
      orderBy('order', 'asc')
    );
    const unsubPromotions = onSnapshot(promotionsQuery, (snap) => {
      const allPromotions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setPromotions(allPromotions.filter(p => p.isActive === true));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'promotions'));

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('status', '==', 'approved')
    );
    const unsubReviews = onSnapshot(reviewsQuery, (snap) => {
      const allReviews = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const approvedReviews = allReviews
        .sort((a, b) => {
          const tA = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime() || 0) : 0;
          const tB = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime() || 0) : 0;
          return tB - tA;
        })
        .slice(0, 6);
      setReviews(approvedReviews);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reviews'));

    // Get all approved reviews for rating calculations
    const allReviewsQuery = query(
      collection(db, 'reviews'),
      where('status', '==', 'approved')
    );
    const unsubAllReviews = onSnapshot(allReviewsQuery, (snap) => {
      const allApproved = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Calculate average ratings per course
      const ratingMap: { [key: string]: { sum: number, count: number } } = {};
      allApproved.forEach((rev: any) => {
        if (!ratingMap[rev.courseId]) ratingMap[rev.courseId] = { sum: 0, count: 0 };
        ratingMap[rev.courseId].sum += rev.rating;
        ratingMap[rev.courseId].count += 1;
      });
      
      const sessionRatingMap: { [key: string]: number } = {};
      Object.keys(ratingMap).forEach(cid => {
        sessionRatingMap[cid] = Math.round((ratingMap[cid].sum / ratingMap[cid].count) * 10) / 10;
      });
      (window as any)._productRatings = sessionRatingMap;
      (window as any)._productReviewCounts = Object.fromEntries(Object.entries(ratingMap).map(([k, v]) => [k, v.count]));
    });

    return () => {
      unsubourses();
      unsubSubjects();
      unsubBanners();
      unsubNotices();
      unsubHomepage();
      unsubPromotions();
      unsubReviews();
      unsubAllReviews();
    };
  }, [user]);

  useEffect(() => {
    if (banners.length <= 1 || isHoveringBanner) return;
    
    const interval = setInterval(() => {
      setActiveBanner(prev => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length, isHoveringBanner]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [location.search]);
  useEffect(() => {
    setLoading(true);

    const notesQuery = query(collection(db, 'notes'));
    const lecturesQuery = query(collection(db, 'lectures'));
    const coursesQuery = query(collection(db, 'courses'));
    const liveQuery = query(collection(db, 'liveClasses'));

    let allCourses: any[] = [];
    let allNotes: any[] = [];
    let allLectures: any[] = [];
    let allLive: any[] = [];

    const updateAllItems = () => {
      // 1. Courses with aggregated prices
      const coursesWithPrices = allCourses.map(course => {
        const courseNotes = allNotes.filter(n => n.courseId === course.id);
        const courseLectures = allLectures.filter(l => l.courseId === course.id);
        const courseLive = allLive.filter(lc => lc.courseId === course.id);
        
        const sumPrice = [...courseNotes, ...courseLectures, ...courseLive].reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
        const sumDiscountPrice = [...courseNotes, ...courseLectures, ...courseLive].reduce((acc, curr) => acc + (Number(curr.discountPrice || curr.price) || 0), 0);

        return { 
          ...course, 
          type: 'course',
          dynamicPrice: sumPrice || Number(course.price) || 0,
          dynamicDiscountPrice: sumDiscountPrice || Number(course.discountPrice || course.price) || 0
        };
      });

      // 2. Standalone items (not tied to any course)
      let standaloneNotes = allNotes.map(n => ({ 
        ...n, 
        type: 'note', 
        dynamicPrice: Number(n.price) || 0, 
        dynamicDiscountPrice: Number(n.discountPrice || n.price) || 0 
      }));
      
      let standaloneLectures = allLectures.map(l => ({ 
        ...l, 
        type: 'lecture', 
        dynamicPrice: Number(l.price) || 0, 
        dynamicDiscountPrice: Number(l.discountPrice || l.price) || 0 
      }));
      
      let standaloneLive = allLive.map(lc => ({ 
        ...lc, 
        type: 'live', 
        dynamicPrice: Number(lc.price) || 0, 
        dynamicDiscountPrice: Number(lc.discountPrice || lc.price) || 0 
      }));

      // Combine all. If courses exist, maybe we prioritize them, but for "not showing catalog" 
      // let's show everything distinct.
      // To avoid duplicates if an item is both in a course and standalone, 
      // we usually just show everything or filter.
      // For now, let's show only courses as per user request.
      let result = [...coursesWithPrices];
      
      // Remove duplicates by ID (in case some items are duplicated in state)
      const seen = new Set();
      result = result.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      
      if (selectedCourseId) {
        result = result.filter(item => item.id === selectedCourseId || item.courseId === selectedCourseId);
      }

      if (selectedSubjectId) {
        const targetSubj = selectedSubjectId.toLowerCase();
        result = result.filter(item => 
          item.subject?.toLowerCase().includes(targetSubj) || 
          item.subjectId === selectedSubjectId ||
          item.category?.toLowerCase().includes(targetSubj)
        );
        standaloneNotes = standaloneNotes.filter(item => 
          item.subject?.toLowerCase().includes(targetSubj) || item.subjectId === selectedSubjectId
        );
        standaloneLectures = standaloneLectures.filter(item => 
          item.subject?.toLowerCase().includes(targetSubj) || item.subjectId === selectedSubjectId
        );
        standaloneLive = standaloneLive.filter(item => 
          item.subject?.toLowerCase().includes(targetSubj) || item.subjectId === selectedSubjectId
        );
      }
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter(item => 
          item.title?.toLowerCase().includes(term) || 
          item.description?.toLowerCase().includes(term) ||
          item.subject?.toLowerCase().includes(term)
        );
      }

      // Sort
      const sorted = result.sort((a, b) => {
        if (sortBy === 'price-low') return (a.dynamicDiscountPrice || 0) - (b.dynamicDiscountPrice || 0);
        if (sortBy === 'price-high') return (b.dynamicDiscountPrice || 0) - (a.dynamicDiscountPrice || 0);
        
        const dateA = (a as any).updatedAt ? new Date((a as any).updatedAt).getTime() : ((a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0);
        const dateB = (b as any).updatedAt ? new Date((b as any).updatedAt).getTime() : ((b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0);
        return dateB - dateA;
      });
      setItems(sorted);
      setCatalogNotes(standaloneNotes);
      setCatalogLectures(standaloneLectures);
      setCatalogLiveClasses(standaloneLive);
      setLoading(false);
    };

    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(onSnapshot(coursesQuery, (snap) => {
      allCourses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAllItems();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'courses')));

    unsubscribers.push(onSnapshot(notesQuery, (snap) => {
      allNotes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAllItems();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'notes')));

    unsubscribers.push(onSnapshot(lecturesQuery, (snap) => {
      allLectures = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAllItems();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'lectures')));

    unsubscribers.push(onSnapshot(liveQuery, (snap) => {
      allLive = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAllItems();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'liveClasses')));

    return () => unsubscribers.forEach(unsub => unsub());
  }, [selectedCourseId, selectedSubjectId, searchTerm, sortBy, user]);

  const getFilteredCatalogItems = () => {
    switch (activeCatalogTab) {
      case 'courses':
        return items;
      case 'notes':
        return catalogNotes;
      case 'lectures':
        return catalogLectures;
      case 'live':
        return catalogLiveClasses;
      default: {
        const combined = [...items, ...catalogNotes, ...catalogLectures, ...catalogLiveClasses];
        return combined.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        });
      }
    }
  };

    const ProductCard = ({ item }: { item: any }) => {
      const isPurchased = profile?.purchasedItems?.includes(item.id) || 
                         (item.courseId && profile?.purchasedItems?.includes(item.courseId)) ||
                         isAdmin;
      const inCart = isInCart(item.id);
  
      const displayImage = item.thumbnail || item.coverImage || item.imageUrl || item.imgUrl || getItemImage(item.title, item.subject || item.category);
      const displayPrice = item.dynamicDiscountPrice || item.dynamicPrice || item.discountPrice || item.price || 0;
      const originalPrice = item.dynamicPrice || item.price || 0;

      const avgRating = (window as any)._productRatings?.[item.id] || (window as any)._productRatings?.[item.courseId] || 5.0;
      const reviewCount = (window as any)._productReviewCounts?.[item.id] || (window as any)._productReviewCounts?.[item.courseId] || 0;
  
      const handleCardClick = () => {
        if (item.type === 'course') {
          navigate(`/course/${item.id}`);
        } else {
          // If it's a standalone item, go to course view or specialized view if courseId exists
          if (item.courseId) {
            navigate(`/course/${item.courseId}?item=${item.id}&type=${item.type}`);
          } else {
            // Standalone item without course
            navigate(`/checkout/${item.id}?type=${item.type}`);
          }
        }
      };

    const handleAddToCart = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!inCart && !isPurchased) {
        addToCart({
          id: item.id,
          title: item.title,
          price: item.price || 0,
          discountPrice: item.discountPrice,
          type: item.type as any,
          coverImage: displayImage,
          courseId: item.type === 'course' ? item.id : item.courseId,
          subject: item.subject,
          gstPercent: 0
        });
      }
    };

    const handleBuyNow = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!inCart && !isPurchased) {
        addToCart({
          id: item.id,
          title: item.title,
          price: item.price || 0,
          discountPrice: item.discountPrice,
          type: item.type as any,
          coverImage: displayImage,
          courseId: item.type === 'course' ? item.id : item.courseId,
          subject: item.subject,
          gstPercent: 0
        });
      }
      navigate('/cart');
    };

    const hasDiscount = item.discountPrice && item.price > item.discountPrice;
    const isBestSeller = avgRating >= 4.8 && (item.type === 'course' || item.subject?.toLowerCase() === 'physics');

    return (
      <motion.div
        onClick={handleCardClick}
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="group bg-white dark:bg-[#0f0f0f] rounded-2xl md:rounded-3xl border border-zinc-100 dark:border-white/5 overflow-hidden hover:border-blue-500/50 transition-all cursor-pointer flex flex-col min-h-[380px] md:min-h-[440px] relative shadow-sm hover:shadow-xl hover:translate-y-[-4px]"
      >
        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-2 right-2 z-20 px-2 py-0.5 bg-rose-600 rounded-md flex items-center gap-1 shadow-lg border border-rose-500/10">
             <Tag className="w-2 h-2 text-white" />
             <span className="text-[7px] font-black uppercase text-white tracking-widest">
               {Math.round((1 - (item.discountPrice / item.price)) * 100)}% OFF
             </span>
          </div>
        )}

        {/* Bestseller Badge */}
        {isBestSeller && !hasDiscount && (
          <div className="absolute top-2 right-2 z-20 px-2 py-0.5 bg-amber-500 rounded-md flex items-center gap-1 shadow-lg border border-amber-400/10">
             <Star className="w-2 h-2 text-white fill-white" />
             <span className="text-[7px] font-black uppercase text-white tracking-widest">
               BESTSELLER
             </span>
          </div>
        )}

        <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 group/img p-8 flex items-center justify-center">
          <img 
            src={displayImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'} 
            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 opacity-95 group-hover:opacity-100" 
            alt={item.title} 
            referrerPolicy="no-referrer"
          />
          
          <div className="absolute inset-0 bg-black/[0.02] dark:bg-black/[0.04] pointer-events-none" />

          {/* Subject & Content Type Badges */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 items-center">
            <span className="px-2 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded-md text-[7px] font-black uppercase tracking-widest text-blue-400 backdrop-blur-md">
              {item.subject || 'PREMIUM'}
            </span>
            <span className={cn(
              "px-2 py-0.5 border rounded-md text-[7px] font-black uppercase tracking-widest backdrop-blur-md shadow-sm",
              item.type === 'course' ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400" :
              item.type === 'lecture' ? "bg-purple-600/20 border-purple-500/30 text-purple-400" :
              item.type === 'note' ? "bg-amber-600/20 border-amber-500/30 text-amber-400" :
              item.type === 'live' ? "bg-rose-600/20 border-rose-500/30 text-rose-400" :
              "bg-zinc-600/20 border-zinc-500/30 text-zinc-400"
            )}>
              {item.type === 'course' ? 'Full Course' :
               item.type === 'lecture' ? 'Video Lecture' :
               item.type === 'note' ? 'PDF Notes' :
               item.type === 'live' ? 'Live Class' :
               item.type || 'Material'}
            </span>
          </div>
          
          {isPurchased && (
             <div className="absolute top-2 left-2 p-1.5 bg-emerald-500 text-white rounded-full shadow-lg">
                <CheckCircle2 className="w-3 h-3" />
             </div>
          )}
        </div>
        
        <div className="p-3 md:p-4 flex flex-col flex-1 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                 <div className="flex gap-0.5">
                   {[...Array(5)].map((_, i) => (
                     <Star key={i} className={cn("w-2.5 h-2.5", i < Math.round(avgRating) ? "text-amber-500 fill-amber-500" : "text-zinc-200 dark:text-zinc-800")} />
                   ))}
                 </div>
                 <span className="ml-1 text-[8px] font-bold text-zinc-400">{avgRating.toFixed(1)} {reviewCount > 0 && `(${reviewCount})`}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {item.type === 'course' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>Full Course</span>
                  </>
                ) : item.type === 'lecture' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>Video Lecture</span>
                  </>
                ) : item.type === 'note' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>PDF Notes</span>
                  </>
                ) : item.type === 'live' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-rose-500">Live Class</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    <span>{item.type}</span>
                  </>
                )}
              </div>
            </div>
            <h3 className="text-[11px] md:text-sm font-black text-zinc-900 dark:text-white line-clamp-1 leading-tight uppercase tracking-tight group-hover:text-blue-400 transition-colors">{item.title}</h3>
          </div>
          
          <div className="mt-auto pt-2 space-y-3">
            {/* Price section - Only show if not free and has a price greater than 0 */}
            {!item.isFree && item.price && Number(item.price) > 0 ? (
              <PriceDisplay price={item.price} discountPrice={item.discountPrice} itemId={item.id} size="sm" />
            ) : null}

            {item.isFree ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick();
                }}
                className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-black/5 flex items-center justify-center gap-2"
              >
                View Details
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleAddToCart}
                  disabled={inCart || isPurchased}
                  className="py-2.5 bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white rounded-lg font-black uppercase tracking-widest text-[8px] transition-all active:scale-95 disabled:opacity-50 border border-zinc-200 dark:border-white/10 flex items-center justify-center gap-2"
                >
                  {isPurchased ? 'Already Bought' : (inCart ? 'In Cart' : 'Cart+')}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPurchased) {
                      handleCardClick();
                    } else {
                      handleBuyNow(e);
                    }
                  }}
                  className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black uppercase tracking-widest text-[8px] transition-all active:scale-95 shadow-lg shadow-blue-500/10"
                >
                  {isPurchased ? 'Access' : 'Buy Now'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderHighlightedTitle = (title: string) => {
    const target = "Vectonix Classes";
    const index = title.toLowerCase().indexOf(target.toLowerCase());
    if (index !== -1) {
      const before = title.substring(0, index);
      const matched = title.substring(index, index + target.length);
      const after = title.substring(index + target.length);
      return (
        <>
          {before}
          <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-sky-400 dark:to-indigo-400">
            {matched}
          </span>
          {after}
        </>
      );
    }
    
    const fallbackTarget = "Vectonix";
    const fallbackIndex = title.toLowerCase().indexOf(fallbackTarget.toLowerCase());
    if (fallbackIndex !== -1) {
      const before = title.substring(0, fallbackIndex);
      const matched = title.substring(fallbackIndex, fallbackIndex + fallbackTarget.length);
      const after = title.substring(fallbackIndex + fallbackTarget.length);
      return (
        <>
          {before}
          <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-sky-400 dark:to-indigo-400">
            {matched}
          </span>
          {after}
        </>
      );
    }

    return title;
  };

  return (
    <div className="bg-white dark:bg-[#050505] min-h-screen text-zinc-900 dark:text-white transition-colors duration-300 selection:bg-blue-500 selection:text-white pt-32 sm:pt-36 md:pt-40 lg:pt-44 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-4 pb-16 md:pt-8 md:pb-20 overflow-hidden flex items-center justify-center text-center">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-none whitespace-pre-wrap text-zinc-900 dark:text-white">
              {renderHighlightedTitle(homepage?.heroTitle || 'Master Your Future with Vectonix Classes')}
            </h1>
            
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 }}
               className="max-w-3xl mx-auto relative group"
            >
              <div className="absolute inset-0 bg-blue-600/20 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div 
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-search'))}
                className="relative flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-1.5 md:p-2 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl cursor-pointer hover:border-blue-500/50 transition-all active:scale-[0.99] group/search"
              >
                <div className="flex-1 flex items-center gap-2 md:gap-4 px-3 md:px-6 min-w-0">
                  <Search className="w-5 h-5 md:w-6 md:h-6 text-zinc-400 group-hover/search:text-blue-500 shrink-0 transition-colors" />
                  <span className="text-xs md:text-lg font-bold text-zinc-400 uppercase tracking-tight truncate">Search for courses, notes, or lectures...</span>
                </div>
                <div className="px-4 py-2.5 md:px-10 md:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-xl shadow-blue-500/20 flex items-center gap-1.5 md:gap-3 shrink-0">
                  <span className="hidden sm:inline">Find Now</span> <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
              </div>
            </motion.div>

            {user && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center"
              >
                <button
                  onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                  className="px-10 py-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-indigo-600 rounded-[2rem] font-black uppercase tracking-widest text-[11px] hover:border-indigo-600 transition-all shadow-xl shadow-indigo-500/5 flex items-center gap-3 group"
                >
                  <LayoutGrid className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Jump to {isAdmin ? 'Admin Panel' : 'My Dashboard'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* eCommerce Categories Navigation */}
      <section className="container mx-auto px-6 mb-10">
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500 bg-blue-500/10 px-3 py-1 rounded-md">Shop by Topic</span>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">What would you like to learn today?</h2>
        </div>
        <div className="w-full overflow-x-auto pb-4 scrollbar-none">
          <div className="flex justify-start md:justify-center items-center gap-6 md:gap-10 px-4 min-w-max mx-auto">
            {[
              { id: '', label: 'All Physics', icon: LayoutGrid, desc: 'Complete Catalog', color: 'from-blue-600 to-indigo-600', text: 'text-blue-500' },
              { id: 'mechanics', label: 'Mechanics', icon: Atom, desc: 'Motion & Forces', color: 'from-orange-500 to-red-600', text: 'text-orange-500' },
              { id: 'electromagnetism', label: 'Electricity', icon: Zap, desc: 'Charges & Magnetism', color: 'from-emerald-500 to-teal-500', text: 'text-emerald-500' },
              { id: 'optics', label: 'Optics', icon: BrainCircuit, desc: 'Ray & Wave Theory', color: 'from-indigo-500 to-purple-500', text: 'text-indigo-500' },
              { id: 'modern', label: 'Modern Physics', icon: GraduationCap, desc: 'Atoms & Relativity', color: 'from-pink-500 to-rose-500', text: 'text-pink-500' }
            ].map((subjectCard, i) => {
              const Icon = subjectCard.icon;
              const isSelected = selectedSubjectId === subjectCard.id;
              
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (subjectCard.id) {
                      setSelectedSubjectId(subjectCard.id);
                    } else {
                      setSelectedSubjectId('');
                    }
                    const catalogElem = document.getElementById('catalog-section');
                    if (catalogElem) {
                      catalogElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="flex flex-col items-center gap-3 group focus:outline-none focus:ring-0 select-none bg-transparent cursor-pointer"
                >
                  <div className={cn(
                    "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-555 shadow-md relative overflow-hidden",
                    isSelected 
                      ? `bg-gradient-to-br ${subjectCard.color} scale-110 shadow-lg ring-4 ring-white dark:ring-zinc-900 shadow-blue-500/10` 
                      : "bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-white/5 group-hover:scale-105 group-hover:border-blue-500/30"
                  )}>
                    {isSelected && (
                      <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
                    )}
                    <Icon className={cn(
                      "w-7 h-7 md:w-9 md:h-9 transition-all duration-500",
                      isSelected ? "text-white scale-110" : `${subjectCard.text} group-hover:rotate-6`
                    )} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-[10px] md:text-sm font-black uppercase tracking-wider",
                      isSelected ? "text-blue-500 dark:text-blue-400 font-extrabold" : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white"
                    )}>{subjectCard.label}</p>
                    <p className="text-[7px] md:text-[8px] opacity-60 font-medium uppercase tracking-widest leading-none mt-1 group-hover:opacity-100">{subjectCard.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium Product Catalog Section */}
      <section id="catalog-section" className="py-14 md:py-16 px-6 border-y border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-950/20">
        <div className="container mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md">
              <GraduationCap className="w-3 h-3 text-purple-500" />
              <span className="text-[8px] font-black uppercase tracking-widest text-purple-500">Academic Catalog</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-zinc-900 dark:text-white">
              Explore Our <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent italic">Offerings</span>
            </h2>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-xl mx-auto">
              Select from our wide range of professional course bundles, comprehensive chapter-wise study notes, recorded video lectures, and interactive live classes.
            </p>
          </div>

          {/* Catalog Sidebar & Content Layout */}
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24">
              <div className="hidden lg:block mb-3 px-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Collections</span>
              </div>
              
              {/* Desktop Vertical Sidebar */}
              <div className="hidden lg:flex flex-col gap-1.5 p-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-3xl shadow-sm">
                {[
                  { id: 'all', label: 'All Collections', icon: LayoutGrid, count: items.length + catalogNotes.length + catalogLectures.length + catalogLiveClasses.length },
                  { id: 'courses', label: 'Full Courses', icon: GraduationCap, count: items.length },
                  { id: 'notes', label: 'Unit PDFs', icon: FileText, count: catalogNotes.length },
                  { id: 'lectures', label: 'Video Lectures', icon: Video, count: catalogLectures.length },
                  { id: 'live', label: 'Live Lectures', icon: Radio, count: catalogLiveClasses.length },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeCatalogTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveCatalogTab(tab.id as any)}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3.5 border border-transparent rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer group text-left",
                        isActive 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10" 
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300")} />
                        <span>{tab.label}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded-full",
                        isActive 
                          ? "bg-white/20 text-white" 
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Horizontal Navigation */}
              <div className="lg:hidden w-full overflow-x-auto pb-4 scrollbar-none flex gap-1.5">
                <div className="inline-flex bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-100 dark:border-white/5 gap-1 shrink-0">
                  {[
                    { id: 'all', label: 'All', icon: LayoutGrid, count: items.length + catalogNotes.length + catalogLectures.length + catalogLiveClasses.length },
                    { id: 'courses', label: 'Courses', icon: GraduationCap, count: items.length },
                    { id: 'notes', label: 'PDFs', icon: FileText, count: catalogNotes.length },
                    { id: 'lectures', label: 'Lectures', icon: Video, count: catalogLectures.length },
                    { id: 'live', label: 'Live', icon: Radio, count: catalogLiveClasses.length },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeCatalogTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveCatalogTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer shrink-0",
                          isActive 
                            ? "bg-blue-600 text-white" 
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        <span className={cn(
                          "text-[8px] font-black px-1.5 py-0.5 rounded-full ml-1",
                          isActive 
                            ? "bg-white/20 text-white" 
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        )}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Catalog Content Area */}
            <div className="flex-1 w-full">
              {/* Scrollable Catalog Grid Area */}
              <div className="max-h-[720px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {/* Catalog Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                  {getFilteredCatalogItems().map((item) => (
                    <ProductCard key={item.id} item={item} />
                  ))}
                </div>
              </div>

              {/* Empty State */}
              {getFilteredCatalogItems().length === 0 && (
                <div className="py-24 text-center bg-white dark:bg-[#090909] rounded-[3rem] border border-dashed border-zinc-200 dark:border-white/5 max-w-2xl mx-auto w-full">
                  <FlaskConical className="w-12 h-12 text-zinc-300 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-black uppercase tracking-tight text-zinc-400">No materials listed</h3>
                  <p className="text-zinc-500 text-xs font-medium mt-2">Check back soon! We are curating new syllabus packages daily.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>



      {/* Everything You Need Section */}
      <section id="features" className="py-16 md:py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-6">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <Atom className="w-3 h-3 text-blue-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Core Ecosystem</span>
             </div>
             <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight">
               Everything you need to <br />
               <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent italic">Succeed Brilliantly</span>
             </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Comprehensive Notes', desc: 'Well-structured PDF notes specifically tailored for each course and subject.', icon: FileText, tag: 'NEW', tagColor: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5' },
              { title: 'Recorded Lectures', desc: 'Chapter-wise arranged high-quality videos for flexible learning at your own pace.', icon: Video, tag: 'COMING SOON', tagColor: 'text-amber-400 border-amber-400/20 bg-amber-400/5' },
              { title: 'Live Classes', desc: 'Join interactive real-time classes and interact directly with professional instructors.', icon: Radio, tag: 'ACTIVE', tagColor: 'text-rose-400 border-rose-400/20 bg-rose-400/5' }
            ].map((f, i) => (
              <div key={i} className="p-12 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-[3rem] group hover:border-blue-500/30 transition-all">
                <div className="flex justify-between items-start mb-12">
                   <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                      <f.icon className="w-8 h-8" />
                   </div>
                   <span className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border", f.tagColor)}>{f.tag}</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-4 text-zinc-900 dark:text-white">{f.title}</h3>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed mb-12">{f.desc}</p>
                <button className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-blue-500 transition-colors">
                  Explore More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Resources Section */}
      <section className="py-14 md:py-16 px-6 bg-blue-500/5">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16 p-12 lg:p-20 bg-white dark:bg-[#0a0a0a] border border-blue-500/10 rounded-[4rem] relative overflow-hidden shadow-2xl">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[100px] -z-10" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -z-10" />

            <div className="flex-1 space-y-8 relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                <Gift className="w-3 h-3 text-emerald-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Community Access</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                Start Your Journey <br />
                <span className="text-emerald-500 italic">Completely Free</span>
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg leading-relaxed max-w-xl">
                Access a curated selection of lecture videos, chapter-wise PDF notes, and previous year papers without spending a rupee. Quality education shouldn't have a barrier.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => navigate('/free-resources')}
                  className="px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 group"
                >
                  Explore Free Materials
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { label: 'FREE NOTES', count: '100+', color: 'emerald' },
                { label: 'FREE VIDEOS', count: '50+', color: 'blue' },
                { label: 'PYQ PAPERS', count: '10+', color: 'indigo' },
                { label: 'STUDY GUIDES', count: 'FREE', color: 'orange' }
              ].map((stat, i) => (
                <div key={i} className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 rounded-3xl text-center group hover:border-emerald-500/30 transition-all">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">{stat.label}</p>
                  <p className={cn("text-3xl font-black italic", 
                    stat.color === 'emerald' ? "text-emerald-500" :
                    stat.color === 'blue' ? "text-blue-500" :
                    stat.color === 'indigo' ? "text-indigo-500" : "text-orange-500"
                  )}>{stat.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* eCommerce Trust & Guarantee Ribbon */}
      <section className="container mx-auto px-6 mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-10 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-white/5 rounded-[2.5rem] shadow-sm">
          {[
            { icon: CheckCircle2, title: "SSL SECURED CHECKOUT", desc: "Encoded 256-bit safe Razorpay transaction gate", textClr: "text-indigo-500" },
            { icon: FileText, title: "IMMEDIATE ACCESS", desc: "No waiting. Get full premium Note PDFs & Lectures instantly", textClr: "text-blue-500" },
            { icon: Star, title: "EXPERT INSTRUCTION", desc: "Curated systematically by ranks and IIT experts", textClr: "text-amber-500" },
            { icon: Users, title: "DIRECT FACULTY HELPDESK", desc: "Raise doubts, feedback, get guided mentorship", textClr: "text-rose-500" }
          ].map((trust, i) => {
            const Icon = trust.icon;
            return (
              <div key={i} className="flex items-center gap-4 py-2 px-1">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5", trust.textClr)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[10px] md:text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white leading-tight">{trust.title}</h4>
                  <p className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-normal">{trust.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 md:py-20 px-6">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-24">
             <div className="flex-1 relative">
                <img 
                  src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=1200"
                  className="rounded-[4rem] aspect-[4/3] object-cover border border-zinc-200 dark:border-white/10 shadow-2xl transition-all duration-700 hover:scale-[1.01] opacity-95 dark:opacity-85"
                  alt="Vectonix Mission"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-blue-600 p-8 flex items-center justify-center text-center shadow-2xl border-8 border-white dark:border-[#050505]">
                   <span className="text-[10px] font-black uppercase leading-tight tracking-widest text-white">Authentic Learning Hub</span>
                </div>
             </div>
             <div className="flex-1 space-y-10">
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Our Mission</span>
                  <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-[1.1]">
                    {homepage?.missionTitle || 'Why Hundreds Choose Vectonix'}
                  </h2>
                  <p className="text-zinc-500 text-sm leading-relaxed max-w-lg">
                    {homepage?.missionDescription || 'Founded with the vision of making quality education accessible, Vectonix Classes bridges the gap between students and expert guidance.'}
                  </p>
                </div>
                <div className="space-y-6">
                   {(homepage?.missionPoints && homepage.missionPoints.length > 0 ? homepage.missionPoints : [
                     'Expertly crafted handwritten and digital notes',
                     'State-of-the-art secure digital infrastructure',
                     'Direct mentorship through live interactive sessions',
                     'Comprehensive student dashboards for progress tracking'
                   ]).map((item: string, i: number) => (
                     <div key={i} className="flex items-center gap-4 group">
                       <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                          <ArrowRight className="w-3 h-3" />
                       </div>
                       <span className="text-xs font-bold text-zinc-400">{item}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </section>



      {/* Testimonials Section */}
      <section className="py-16 md:py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-1 bg-blue-600/20 flex gap-2 overflow-hidden rounded-full">
                 <div className="w-1/3 bg-blue-500 h-full animate-[shimmer_2s_infinite]" />
              </div>
            </div>
            <div className="flex justify-center"><Plus className="w-12 h-12 text-blue-600/20" /></div>
            <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">Student <span className="text-zinc-500 italic">Success</span> Stories</h2>
            <p className="text-zinc-500 font-medium">Join thousands of students who have achieved excellence with Vectonix.</p>
            <button 
              onClick={() => setShowReviewModal(true)}
              className="px-8 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
            >
              Leave a Review
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews.map((review, idx) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="p-10 bg-zinc-50 dark:bg-[#0A0A0A] border border-zinc-100 dark:border-white/5 rounded-[3rem] space-y-10 group hover:border-blue-500/30 transition-all duration-500 flex flex-col h-full"
              >
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={cn("w-4 h-4", i < review.rating ? "text-amber-500 fill-amber-500" : "text-zinc-800")} />
                  ))}
                </div>
                <p className="text-zinc-400 italic font-medium leading-relaxed flex-1 italic">"{review.content}"</p>
                <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                   <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center border border-white/5 overflow-hidden">
                      <img src={review.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.userName}`} alt="" className="w-full h-full object-cover" />
                   </div>
                   <div>
                      <h4 className="text-white font-black uppercase tracking-tight text-sm">{review.userName}</h4>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Verified Student</p>
                   </div>
                </div>
              </motion.div>
            ))}
            {reviews.length === 0 && (
              <div className="col-span-full py-20 text-center bg-zinc-50 dark:bg-white/5 rounded-[3rem] border border-dashed border-zinc-200 dark:border-white/10">
                <Star className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Student feedback will appear here soon.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Get In Touch Section */}
      <section className="py-12 md:py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-8">
            <div className="space-y-8">
              <div className="flex justify-center">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] bg-blue-500/5 px-4 py-1.5 rounded-full border border-blue-500/10">Connect With Us</span>
              </div>
              <h2 className="text-3xl lg:text-5xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">
                Ready to <span className="text-blue-500 italic underline decoration-blue-500/20 underline-offset-8">Transform</span> Your Learning?
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed text-lg">
                Join thousands of students mastering complex subjects with ease. Our expertise is your bridge to academic excellence.
              </p>
            </div>

             <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-5xl mx-auto">
              {[
                { icon: Mail, label: 'EMAIL US', value: (settings.supportEmail || homepage?.contactEmail || 'vectonixclasses@gmail.com').toLowerCase(), href: `mailto:${settings.supportEmail || homepage?.contactEmail || 'vectonixclasses@gmail.com'}`, color: 'blue' },
                { icon: MessageCircle, label: 'WHATSAPP CHAT', value: 'CHAT WITH US', href: `https://wa.me/${(settings.supportPhone || '7060621439').replace(/\D/g, '')}`, color: 'emerald' },
                { icon: MapPin, label: 'LOCATION', value: settings.address || homepage?.contactLocation || 'Saharanpur, UP, India', color: 'amber' }
              ].map((info, i) => (
                <div key={i} className="flex flex-col gap-6 items-center p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 group hover:border-blue-500/50 transition-all shadow-sm">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110",
                    info.color === 'blue' ? "bg-blue-500/10 text-blue-500" : 
                    info.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500" : 
                    "bg-amber-500/10 text-amber-500"
                  )}>
                    <info.icon className="w-7 h-7" fill={info.color === 'emerald' ? 'currentColor' : 'none'} />
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{info.label}</p>
                    {info.href ? (
                      <a 
                        href={info.href} 
                        target={info.href.startsWith('http') ? '_blank' : undefined}
                        rel={info.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className={cn(
                          "text-zinc-900 dark:text-white font-black tracking-tight hover:text-blue-600 transition-colors text-sm md:text-base leading-tight",
                          info.color === 'blue' ? "lowercase font-bold" : "uppercase"
                        )}
                      >
                        {info.value}
                      </a>
                    ) : (
                      <p className="text-zinc-900 dark:text-white font-black tracking-tight uppercase text-sm md:text-base leading-tight">{info.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer is now handled globally in App.tsx */}
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
                    selectedNotice.type === 'news' ? "bg-blue-50 text-blue-600 border-blue-100" :
                    selectedNotice.type === 'update' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    "bg-indigo-50 text-indigo-600 border-indigo-100"
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
                 <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Official Broadcast • Academic Council</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Zoom Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-12 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="absolute inset-0 bg-zinc-950/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="w-full h-full flex flex-col gap-6 md:gap-10 items-center justify-center p-4">
                <div className="relative w-full h-[70vh] flex items-center justify-center">
                  <motion.img 
                    src={selectedImage.url} 
                    alt={selectedImage.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                    transition={{ duration: 0.3 }}
                  />
                </div>
                
                <div className="bg-white/10 backdrop-blur-md px-10 py-5 rounded-3xl text-center border border-white/10 max-w-2xl">
                  <h3 className="text-xl md:text-3xl font-display font-black text-white">{selectedImage.title}</h3>
                  <p className="text-zinc-400 text-xs md:text-sm font-bold uppercase tracking-[0.3em] mt-2">Visual Showcase</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LiveScheduleModal 
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReviewModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Share Experience</h3>
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 dark:text-white" />
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-4 text-center">Your Rating</label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button 
                        key={star}
                        onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                        className="transition-transform active:scale-90"
                      >
                        <Star className={cn(
                          "w-10 h-10",
                          star <= reviewForm.rating ? "text-amber-500 fill-amber-500" : "text-zinc-100 dark:text-zinc-800"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Message</label>
                  <textarea 
                    placeholder="Tell us what you liked about Vectonix Classes..."
                    value={reviewForm.content}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full min-h-[120px] p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-medium dark:text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all resize-none"
                  />
                </div>

                <div>
                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Subject (Optional)</label>
                   <select 
                    value={reviewForm.courseId}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, courseId: e.target.value }))}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest dark:text-white outline-none"
                   >
                     <option value="general">General Feedback</option>
                     {courses.map(c => (
                       <option key={c.id} value={c.id}>{c.title}</option>
                     ))}
                   </select>
                </div>

                <button 
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-blue-500/20"
                >
                  {submittingReview ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Testimonial'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl shadow-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-3 border border-indigo-500/20"
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-rose-500" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
