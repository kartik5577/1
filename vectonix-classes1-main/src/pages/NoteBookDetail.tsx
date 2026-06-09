import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Shield, Lock, FileText, ChevronRight, Eye, CreditCard, CheckCircle2, Loader2, Sparkles, AlertCircle, ShoppingCart, Plus } from 'lucide-react';
import { cn, getItemImage } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { Breadcrumbs } from '../components/Breadcrumbs';
import SecurePDFViewer from '../components/SecurePDFViewer';
import NotePreviewModal from '../components/NotePreviewModal';
import { formatCurrency } from '../lib/utils';
import PriceDisplay from '../components/PriceDisplay';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

import { useCart, CartItem } from '../context/CartContext';

export default function NoteBookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { addToCart, isInCart } = useCart();
  
  const [book, setBook] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [chapters, setChapters] = useState<{ [unitId: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [viewerConfig, setViewerConfig] = useState<{ url: string, title: string, isOpen: boolean }>({
    url: '',
    title: '',
    isOpen: false
  });
  
  const [fetchingSecure, setFetchingSecure] = useState<string | null>(null);
  const [previewConfig, setPreviewConfig] = useState<{ images: string[], title: string, isOpen: boolean }>({
    images: [],
    title: '',
    isOpen: false
  });

  const unitsRef = React.useRef<HTMLDivElement>(null);

  const fetchSecureUrl = async (itemId: string, type: 'units' | 'chapters', fallbackUrl?: string) => {
    const path = `${type}/${itemId}/secure/content`;
    console.log(`[fetchSecureUrl] Requesting secure content. ItemId: ${itemId}, Type: ${type}, Fallback URL: ${fallbackUrl || 'none'}`);
    try {
      setFetchingSecure(itemId);
      const secureDocRef = doc(db, type, itemId, 'secure', 'content');
      const secureSnap = await getDoc(secureDocRef);
      
      if (secureSnap.exists()) {
        const data = secureSnap.data();
        console.log(`[fetchSecureUrl] Document found under secure subcollection. PDF Url: ${data.pdfUrl || 'none'}`);
        return data.pdfUrl || fallbackUrl;
      }
      console.log(`[fetchSecureUrl] Secure content document does not exist. Resorting to fallback URL: ${fallbackUrl || 'none'}`);
      return fallbackUrl;
    } catch (error: any) {
      console.error(`[fetchSecureUrl] Error fetching secure content document at path: "${path}". Code: ${error?.code}, Message: ${error?.message}`);
      if (error?.code === 'permission-denied') {
        console.warn(`[fetchSecureUrl] Permission Denied for path ${path}. Current User UID: ${user?.uid || 'Not Sign-in'}, Profile PurchasedItems: ${JSON.stringify(profile?.purchasedItems || [])}`);
        handleFirestoreError(error, OperationType.GET, path);
      }
      return fallbackUrl;
    } finally {
      setFetchingSecure(null);
    }
  };

  const remainingPrice = units.reduce((acc, unit) => {
    const isUnitPurchased = profile?.purchasedItems?.includes(unit.id);
    if (!isUnitPurchased && !unit.isFree) {
      return acc + (unit.price || 0);
    }
    return acc;
  }, 0);

  const handlePurchase = async (itemId?: string, isUnit: boolean = false) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const targetId = itemId || id;
    if (!targetId) return;

    const itemToBuy = isUnit ? units.find(u => u.id === itemId) : book;
    if (!itemToBuy) return;

    // Use current settings for price
    const cartItem: CartItem = {
      id: itemToBuy.id,
      title: itemToBuy.title,
      price: isUnit ? (itemToBuy.price || 0) : remainingPrice,
      discountPrice: isUnit ? itemToBuy.discountPrice : null,
      type: isUnit ? 'unit' as any : 'note',
      coverImage: itemToBuy.coverImage || itemToBuy.thumbnail || itemToBuy.imageUrl || itemToBuy.imgUrl || getItemImage(itemToBuy.title, book?.subject || itemToBuy.subject),
      courseId: id || 'individual',
      subject: book?.subject,
      gstPercent: 0
    };

    addToCart(cartItem);
    navigate('/cart');
  };

  const handleAddToCart = (e: React.MouseEvent, item: any, type: 'note' | 'unit') => {
    e.stopPropagation();
    const cartItem: CartItem = {
      id: item.id,
      title: item.title,
      price: item.price || 0,
      discountPrice: item.discountPrice,
      type: type === 'note' ? 'note' : 'unit' as any,
      coverImage: item.coverImage || item.thumbnail || item.imageUrl || item.imgUrl || getItemImage(item.title, book?.subject || item.subject),
      courseId: id || 'individual',
      subject: book?.subject,
      gstPercent: 0
    };
    addToCart(cartItem);
    setNotification({ message: 'Added to cart!', type: 'success' });
  };

  const scrollToUnits = () => {
    unitsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const bookSnap = await getDoc(doc(db, 'notes', id));
        if (bookSnap.exists()) {
          setBook({ id: bookSnap.id, ...bookSnap.data() });
          
          // Fetch units
          const unitsQuery = query(
            collection(db, 'units'),
            where('noteId', '==', id)
          );
          const unitsSnap = await getDocs(unitsQuery);
          const fetchedUnits = unitsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }) as any)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setUnits(fetchedUnits);

          // Fetch chapters for each unit
          const chaptersMap: { [key: string]: any[] } = {};
          for (const unit of fetchedUnits) {
            const chaptersQuery = query(
              collection(db, 'chapters'),
              where('unitId', '==', unit.id)
            );
            const chaptersSnap = await getDocs(chaptersQuery);
            chaptersMap[unit.id] = chaptersSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data() }) as any)
              .sort((a, b) => (a.order || 0) - (b.order || 0));
          }
          setChapters(chaptersMap);
        } else {
          navigate('/notes');
        }
      } catch (error) {
        console.error('Error fetching notebook:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const isPurchased = profile?.purchasedItems?.includes(id || '') || 
                     (book?.courseId && profile?.purchasedItems?.includes(book.courseId)) ||
                     isAdmin;

  const handleUnitClick = async (unit: any) => {
    // Scroll to unit chapters if needed
  };

  const handleOpenChapter = async (chapter: any) => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Check if unit is purchased or free preview
    const unitPurchased = profile?.purchasedItems?.includes(chapter.unitId) || 
                         profile?.purchasedItems?.includes(id || '') || 
                         (book?.courseId && profile?.purchasedItems?.includes(book.courseId)) ||
                         isAdmin;
    
    // Fetch unit to check isFree
    const unitSnap = await getDoc(doc(db, 'units', chapter.unitId));
    const unitData = unitSnap.data();

    if (unitPurchased || unitData?.isFree) {
      try {
        const url = await fetchSecureUrl(chapter.id, 'chapters', chapter.pdfUrl);
        if (url) {
          setViewerConfig({ url, title: chapter.title, isOpen: true });
        } else {
          setNotification({ message: 'Content URL not found in secure storage.', type: 'error' });
        }
      } catch (err) {
        console.error('Error in handleOpenChapter:', err);
        setNotification({ message: 'Failed to access secure content.', type: 'error' });
      }
    } else {
      setNotification({ message: 'Please purchase this unit to view content.', type: 'error' });
    }
  };

  const handleOpenUnitPDF = async (unit: any) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const unitPurchased = profile?.purchasedItems?.includes(unit.id) || 
                         profile?.purchasedItems?.includes(id || '') || 
                         (book?.courseId && profile?.purchasedItems?.includes(book.courseId)) ||
                         isAdmin;

    if (unitPurchased || unit.isFree) {
      try {
        const url = await fetchSecureUrl(unit.id, 'units', unit.pdfUrl);
        if (url) {
          setViewerConfig({ url, title: unit.title, isOpen: true });
        } else {
          setNotification({ message: 'PDF not found for this unit.', type: 'error' });
        }
      } catch (err) {
        console.error('Error in handleOpenUnitPDF:', err);
        setNotification({ message: 'Failed to access unit content.', type: 'error' });
      }
    } else {
      setNotification({ message: 'Please purchase this unit to read.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center dark:bg-zinc-950 gap-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 bg-indigo-600 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Decoding Notebook...</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Study Materials', path: '/study-material' },
    { label: book?.title || 'Notebook', active: true }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-4">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      {/* Header Banner */}
      <div className="relative h-[40vh] md:h-[50vh] overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={book?.coverImage || book?.thumbnail || book?.imageUrl || book?.imgUrl || getItemImage(book?.title, book?.subject)} 
            alt={book?.title} 
            className="w-full h-full object-cover blur-xl opacity-30 scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-50/80 to-zinc-50 dark:via-zinc-950/80 dark:to-zinc-950" />
        </div>

        <div className="container mx-auto px-4 h-full flex flex-col items-center justify-end relative z-10 pb-12">
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="absolute top-8 left-4 flex items-center gap-2 text-zinc-500 hover:text-indigo-600 transition-colors bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Home
          </motion.button>

          <div className="flex flex-col md:flex-row items-end gap-12 max-w-6xl w-full">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-72 md:w-80 h-96 md:h-[28rem] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white dark:border-zinc-900 group bg-zinc-100 dark:bg-zinc-800"
            >
              <img 
                src={book?.coverImage || book?.thumbnail || book?.imageUrl || book?.imgUrl || getItemImage(book?.title, book?.subject)} 
                alt={book?.title} 
                className="w-full h-full object-contain p-3 group-hover:scale-[1.02] transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-6 pb-4">
              <div className="flex items-center gap-4">
                <span className="px-5 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-sm">
                  {book?.subject || 'Education'}
                </span>
                {isPurchased && (
                  <span className="px-5 py-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Unlocked
                  </span>
                )}
              </div>
              
              <h1 className="text-4xl md:text-6xl font-display font-extrabold dark:text-white leading-tight">
                {book?.title}
              </h1>
              
              <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-xl">
                Comprehensive professional study notes with detailed analysis, unit-wise previews, and secure access protection.
              </p>

              {isPurchased ? (
                <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
                  <button 
                    onClick={scrollToUnits}
                    className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 dark:shadow-none flex items-center gap-3 active:scale-95"
                  >
                    <Eye className="w-6 h-6" />
                    Start Reading
                  </button>
                  <div className="flex items-center gap-2 px-6 py-4 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-emerald-600 font-black uppercase tracking-widest text-xs">
                    <CheckCircle2 className="w-5 h-5" />
                    Fully Owned
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-8 mt-4">
                  <div className="flex flex-col text-left font-sans">
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1.5">Total Value</span>
                    <PriceDisplay
                      price={book?.price || 0}
                      discountPrice={book?.discountPrice}
                      itemId={id}
                      isFree={book?.isFree}
                      size="xl"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
                    <button 
                      onClick={() => handlePurchase()}
                      disabled={purchasing || (profile?.purchasedItems?.includes(id || ''))}
                      className="px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                      {purchasing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-6 h-6" />
                      )}
                      {profile?.purchasedItems?.includes(id || '') ? 'Already Bought' : (book?.isFree ? 'Enroll Now' : 'Buy Notebook')}
                    </button>
                    {!isInCart(id || '') && !profile?.purchasedItems?.includes(id || '') && (
                      <button 
                        onClick={(e) => handleAddToCart(e, book, 'note')}
                        className="px-10 py-5 bg-white dark:bg-zinc-900 text-indigo-600 rounded-[2rem] font-black text-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all border-2 border-indigo-100 flex items-center gap-3 active:scale-95"
                      >
                        <Plus className="w-6 h-6" />
                        Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Units Section */}
      <div ref={unitsRef} className="container mx-auto px-4 mt-24 mb-32">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Curriculum</span>
              <h2 className="text-4xl font-black dark:text-white tracking-tight italic uppercase">Units & Chapters</h2>
              <div className="w-20 h-1.5 bg-indigo-600 rounded-full"></div>
            </div>
            {!isPurchased && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-8">
                <div className="flex flex-col font-sans">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Full Notebook</span>
                  <PriceDisplay
                    price={book?.price || 0}
                    discountPrice={book?.discountPrice}
                    itemId={id}
                    isFree={book?.isFree}
                    size="sm"
                  />
                </div>
                <button 
                  onClick={() => handlePurchase()}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95"
                >
                  {remainingPrice === 0 ? 'Enroll Complete' : 'Buy Complete'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-2xl shadow-zinc-200/50 dark:shadow-none">
            <div className="hidden md:grid grid-cols-12 gap-4 px-10 py-6 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Unit Title</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-4 text-right">Actions</div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {units.length > 0 ? (
                units.map((unit, index) => {
                  const unitPurchased = profile?.purchasedItems?.includes(unit.id) || isPurchased;
                  const unitChapters = chapters[unit.id] || [];
                  
                  return (
                    <div 
                      key={unit.id}
                      className={cn(
                        "flex flex-col gap-4 px-6 md:px-10 py-8 transition-all group border-b border-zinc-100 dark:border-zinc-800 last:border-b-0",
                        (unitPurchased || unit.isFree) ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/10"
                      )}
                    >
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Order */}
                        <div className="hidden md:block">
                          <span className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors text-lg">
                            {unit.order || index + 1}
                          </span>
                        </div>

                        {/* Title & Info */}
                        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-24 aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                              <img src={unit.previewImages?.[0] || unit.previewImage || unit.coverImage || unit.thumbnail || unit.imageUrl || unit.imgUrl || getItemImage(unit.title, book?.subject)} alt="Preview" className="w-full h-full object-contain p-1.5" />
                            </div>
                            <div className="flex flex-col">
                              <h3 className="text-xl font-black dark:text-white group-hover:text-indigo-600 transition-colors uppercase italic tracking-wide">
                                {unit.title}
                              </h3>
                              <div className="flex items-center gap-4 mt-1">
                                {unit.isFree && (
                                  <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-md uppercase tracking-widest leading-none">
                                    Free Preview
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                  {unitChapters.length} Chapters • Secure Access
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Status and Pricing */}
                            {!unitPurchased && !unit.isFree ? (
                              <div className="flex flex-col items-end gap-1 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/20 font-sans">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Unit Price</span>
                                <PriceDisplay
                                  price={unit.price || 0}
                                  discountPrice={unit.discountPrice}
                                  itemId={unit.id}
                                  size="sm"
                                  align="right"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-4">
                                {(unitPurchased || unit.isFree) && (
                                  <button 
                                    onClick={() => handleOpenUnitPDF(unit)}
                                    disabled={fetchingSecure === unit.id}
                                    className="flex items-center gap-3 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                  >
                                    {fetchingSecure === unit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                    Read PDF
                                  </button>
                                )}
                                {((unit.previewImages && unit.previewImages.length > 0) || unit.previewImage) && (
                                  <button 
                                    onClick={() => setPreviewConfig({ 
                                      images: unit.previewImages || [unit.previewImage], 
                                      title: unit.title, 
                                      isOpen: true 
                                    })}
                                    className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 rounded-2xl transition-all active:scale-95"
                                    title="Quick Preview"
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </button>
                                )}
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                  <CheckCircle2 className="w-4 h-4" />
                                  {unit.isFree ? 'Free Preview' : 'Purchased'}
                                </div>
                              </div>
                            )}

                             {/* Main Action for Unit */}
                            {!unitPurchased && !unit.isFree && (
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePurchase(unit.id, true);
                                  }}
                                  className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95"
                                >
                                  Unlock Unit
                                </button>
                                {!isInCart(unit.id) && (
                                  <button 
                                    onClick={(e) => handleAddToCart(e, unit, 'unit')}
                                    className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-indigo-600 rounded-2xl transition-all active:scale-95"
                                  >
                                    <ShoppingCart className="w-5 h-5" />
                                  </button>
                                )}
                                {((unit.previewImages && unit.previewImages.length > 0) || unit.previewImage) && (
                                  <button 
                                    onClick={() => setPreviewConfig({ 
                                      images: unit.previewImages || [unit.previewImage], 
                                      title: unit.title, 
                                      isOpen: true 
                                    })}
                                    className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 rounded-2xl transition-all active:scale-95"
                                    title="Quick Preview"
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            )}
                            {unitPurchased && !unit.isFree && (
                              <div className="flex items-center gap-2">
                                <button 
                                  disabled
                                  className="px-6 py-4 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-2xl font-black text-xs uppercase tracking-widest cursor-not-allowed flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Already Owned
                                </button>
                                {((unit.previewImages && unit.previewImages.length > 0) || unit.previewImage) && (
                                  <button 
                                    onClick={() => setPreviewConfig({ 
                                      images: unit.previewImages || [unit.previewImage], 
                                      title: unit.title, 
                                      isOpen: true 
                                    })}
                                    className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 rounded-2xl transition-all active:scale-95"
                                    title="Quick Preview"
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Chapters List */}
                      {(unitPurchased || unit.isFree) && unitChapters.length > 0 && (
                        <div className="mt-4 md:ml-20 flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-800/20 p-4 md:p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-700/50">
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 px-2">Chapters in this unit</h4>
                          <div className="grid gap-3">
                            {unitChapters.map((chapter, chapIndex) => (
                              <div 
                                key={chapter.id}
                                className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all shadow-sm group/chap"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 group-hover/chap:bg-indigo-50 group-hover/chap:text-indigo-600 transition-colors">
                                    {chapIndex + 1}
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm dark:text-white uppercase tracking-tight">{chapter.title}</div>
                                    <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Available in PDF</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => handleOpenChapter(chapter)}
                                    disabled={fetchingSecure === chapter.id}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white transition-all disabled:opacity-50"
                                  >
                                    {fetchingSecure === chapter.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                                    Read PDF
                                  </button>
                                  {chapter.previewImages && chapter.previewImages.length > 0 && (
                                    <button 
                                      onClick={() => setPreviewConfig({ images: chapter.previewImages, title: chapter.title, isOpen: true })}
                                      className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 rounded-xl transition-all"
                                      title="Quick Preview"
                                    >
                                      <Sparkles className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center">
                    <AlertCircle className="w-12 h-12 text-zinc-300" />
                  </div>
                  <div className="flex flex-col gap-2 max-w-sm">
                    <h3 className="text-xl font-black dark:text-white uppercase italic tracking-tight">Curriculum Pending</h3>
                    <p className="text-zinc-500 font-medium text-sm">
                      The units for this notebook are currently being digitized. Check back soon for the full curriculum.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10 mt-16">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center text-amber-600 shrink-0">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
              <h4 className="text-2xl font-bold dark:text-amber-500 italic font-display">Student Protection Policy</h4>
              <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed font-sans">
                Our content is end-to-end encrypted. We employ advanced anti-sharing watermarks and deep-linking protection to ensure your study material remains yours. Any attempt to pirate content will lead to immediate account termination.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SecurePDFViewer 
        isOpen={viewerConfig.isOpen}
        url={viewerConfig.url}
        title={viewerConfig.title}
        onClose={() => setViewerConfig({ ...viewerConfig, isOpen: false })}
      />

      <AnimatePresence>
        {previewConfig.isOpen && (
          <NotePreviewModal 
            isOpen={previewConfig.isOpen}
            images={previewConfig.images}
            title={previewConfig.title}
            onClose={() => setPreviewConfig(prev => ({ ...prev, isOpen: false }))}
          />
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 font-bold",
              notification.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-red-50 border-red-200 text-red-600"
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 /> : <AlertCircle />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
