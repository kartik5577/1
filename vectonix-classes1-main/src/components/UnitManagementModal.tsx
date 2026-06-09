import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Save, Loader2, FileText, ImageIcon, Shield, Lock, ChevronUp, ChevronDown, DollarSign, Edit, BookOpen, Layers } from 'lucide-react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, getDoc, getDocs, query, where, orderBy, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cn, formatCurrency } from '../lib/utils';
import { useSettings } from '../hooks/useSettings';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error/Storage Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UnitManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  courseId?: string;
}

export default function UnitManagementModal({ isOpen, onClose, noteId, noteTitle, courseId }: UnitManagementModalProps) {
  const { settings } = useSettings();
  const [units, setUnits] = useState<any[]>([]);
  const [chapters, setChapters] = useState<{ [unitId: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddUnitForm, setShowAddUnitForm] = useState(false);
  const [showAddChapterForm, setShowAddChapterForm] = useState<{ unitId: string | null }>({ unitId: null });
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ id: string; type: 'unit' | 'chapter'; title: string; unitId?: string } | null>(null);

  const [unitFormData, setUnitFormData] = useState({
    title: '',
    order: 0,
    price: '',
    discount: '',
    discountPrice: '',
    isFree: false,
    pdfFile: null as File | null,
    pdfUrl: '',
    previewFiles: [] as File[],
    previewUrls: [] as string[],
    gstPercent: '' as string | number
  });

  const [chapterFormData, setChapterFormData] = useState({
    title: '',
    order: 0,
    pdfFile: null as File | null,
    pdfUrl: '',
    previewFiles: [] as File[],
    previewUrls: [] as string[]
  });

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'units'),
        where('noteId', '==', noteId)
      );
      const querySnapshot = await getDocs(q);
      const fetchedUnits = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setUnits(fetchedUnits);
      
      // Calculate total price and update main note
      const totalPrice = fetchedUnits.reduce((sum, u: any) => sum + (u.isFree ? 0 : Number(u.price) || 0), 0);
      const noteSnap = await getDoc(doc(db, 'notes', noteId));
      const noteData = noteSnap.exists() ? noteSnap.data() : null;
      const noteDiscount = noteData?.discount || 0;
      const noteIsFree = noteData?.isFree || false;
      const finalDiscountPrice = noteIsFree ? 0 : Math.max(0, totalPrice - noteDiscount);
      await updateDoc(doc(db, 'notes', noteId), { 
        price: totalPrice,
        discountPrice: finalDiscountPrice
      });

      // Fetch chapters for all units
      for (const unit of fetchedUnits) {
        await fetchChapters(unit.id);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async (unitId: string) => {
    try {
      const q = query(
        collection(db, 'chapters'),
        where('unitId', '==', unitId)
      );
      const querySnapshot = await getDocs(q);
      const sortedChapters = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setChapters(prev => ({
        ...prev,
        [unitId]: sortedChapters
      }));
    } catch (error) {
      console.error(`Error fetching chapters for unit ${unitId}:`, error);
    }
  };

  useEffect(() => {
    if (isOpen && noteId) {
      fetchUnits();
    }
  }, [isOpen, noteId]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      console.log('Current User:', auth.currentUser?.email, auth.currentUser?.uid);
      console.log('Storage Bucket:', storage.app.options.storageBucket);
      let finalPdfUrl = unitFormData.pdfUrl;
      if (unitFormData.pdfFile) {
        const path = `units/${noteId}/pdf_${Date.now()}_${unitFormData.pdfFile.name}`;
        const pdfRef = ref(storage, path);
        try {
          const snap = await uploadBytes(pdfRef, unitFormData.pdfFile);
          finalPdfUrl = await getDownloadURL(snap.ref);
        } catch (storageErr) {
          handleFirestoreError(storageErr, OperationType.WRITE, path);
        }
      }

      let uploadedPreviewUrls = [...unitFormData.previewUrls];
      
      if (unitFormData.previewFiles.length > 0) {
        for (let i = 0; i < unitFormData.previewFiles.length; i++) {
          const file = unitFormData.previewFiles[i];
          const path = `units/${noteId}/previews/${Date.now()}_${file.name}`;
          const imgRef = ref(storage, path);
          try {
            const snap = await uploadBytes(imgRef, file);
            const url = await getDownloadURL(snap.ref);
            uploadedPreviewUrls.push(url);
          } catch (storageErr) {
            handleFirestoreError(storageErr, OperationType.WRITE, path);
          }
        }
      }

      const unitPrice = Number(unitFormData.price) || 0;
      const unitDiscount = unitFormData.isFree ? 0 : (Number(unitFormData.discount) || 0);
      const unitDiscountPrice = unitFormData.isFree ? 0 : Math.max(0, unitPrice - unitDiscount);
      const unitGst = unitFormData.isFree ? 0 : (unitFormData.gstPercent !== '' ? Number(unitFormData.gstPercent) : (settings.gstPercent ?? 0));

      const unitData = {
        noteId,
        title: unitFormData.title,
        order: Number(unitFormData.order),
        price: unitPrice,
        discount: unitDiscount,
        discountPrice: unitDiscountPrice,
        isFree: unitFormData.isFree,
        previewImages: uploadedPreviewUrls,
        gstPercent: unitGst,
        updatedAt: new Date().toISOString()
      };

      let unitIdToUse = editingUnitId;
      if (editingUnitId) {
        await setDoc(doc(db, 'units', editingUnitId), unitData, { merge: true });
        setNotification({ message: 'Unit updated successfully!', type: 'success' });
      } else {
        const docRef = await addDoc(collection(db, 'units'), {
          ...unitData,
          createdAt: new Date().toISOString()
        });
        unitIdToUse = docRef.id;
        setNotification({ message: 'Unit added successfully!', type: 'success' });
      }

      if (unitIdToUse && finalPdfUrl) {
        await setDoc(doc(db, 'units', unitIdToUse, 'secure', 'content'), {
          pdfUrl: finalPdfUrl,
          updatedAt: new Date().toISOString()
        });
      }

      setUnitFormData({ 
        title: '', 
        order: units.length + 1, 
        price: '', 
        discount: '',
        discountPrice: '', 
        isFree: false,
        pdfFile: null,
        pdfUrl: '',
        previewFiles: [],
        previewUrls: [],
        gstPercent: ''
      });
      setEditingUnitId(null);
      setShowAddUnitForm(false);
      fetchUnits();
    } catch (err: any) {
      console.error('Error saving unit:', err);
      const errStr = err instanceof Error ? err.message : String(err);
      const isQuota = errStr.includes('quota-exceeded') || errStr.includes('Quota for bucket') || errStr.includes('Quota exceeded');
      if (isQuota) {
        setNotification({
          message: `⚠️ Firebase Storage Quota Exceeded! The Spark (Free) plan daily bandwidth limit for 'vectonix-db' has been reached today. Old uploads will temporarily fail to render and additions will revert to 404 until daily reset (or upgrading your Firebase project to the Blaze plan). Tip: You can paste direct online PDF/image URL links instead to completely bypass file uploads!`,
          type: 'error'
        });
      } else if (err?.code === 'storage/unauthorized') {
        const userEmail = auth.currentUser?.email || 'Not logged in';
        setNotification({ 
          message: `Storage Permission Denied. logged in as: ${userEmail}. Contact system administrator.`, 
          type: 'error' 
        });
      } else {
        setNotification({ message: 'Failed to save unit. Check connection or permissions.', type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const unitId = showAddChapterForm.unitId;
    if (!unitId) return;

    setSubmitting(true);
    try {
      let finalPdfUrl = chapterFormData.pdfUrl;
      const unitIdStr = unitId as string;
      if (chapterFormData.pdfFile) {
        const path = `chapters/${unitIdStr}/pdf_${Date.now()}_${chapterFormData.pdfFile.name}`;
        const pdfRef = ref(storage, path);
        try {
          const snap = await uploadBytes(pdfRef, chapterFormData.pdfFile);
          finalPdfUrl = await getDownloadURL(snap.ref);
        } catch (storageErr) {
          handleFirestoreError(storageErr, OperationType.WRITE, path);
        }
      }

      const finalPreviewUrls = [...chapterFormData.previewUrls];
      for (const file of chapterFormData.previewFiles) {
        const path = `chapters/${unitIdStr}/previews/img_${Date.now()}_${file.name}`;
        const previewRef = ref(storage, path);
        try {
          const snap = await uploadBytes(previewRef, file);
          const url = await getDownloadURL(snap.ref);
          finalPreviewUrls.push(url);
        } catch (storageErr) {
          handleFirestoreError(storageErr, OperationType.WRITE, path);
        }
      }

      const chapterData = {
        unitId,
        title: chapterFormData.title,
        order: Number(chapterFormData.order),
        previewImages: finalPreviewUrls,
        updatedAt: new Date().toISOString()
      };

      let chapterIdToUse = editingChapterId;
      if (editingChapterId) {
        await setDoc(doc(db, 'chapters', editingChapterId), chapterData, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, 'chapters'), {
          ...chapterData,
          createdAt: new Date().toISOString()
        });
        chapterIdToUse = docRef.id;
      }

      if (chapterIdToUse && finalPdfUrl) {
        await setDoc(doc(db, 'chapters', chapterIdToUse, 'secure', 'content'), {
          pdfUrl: finalPdfUrl,
          updatedAt: new Date().toISOString()
        });
      }

      setChapterFormData({ 
        title: '', 
        order: (chapters[unitId]?.length || 0) + 1, 
        pdfFile: null, 
        pdfUrl: '', 
        previewFiles: [], 
        previewUrls: [] 
      });
      setEditingChapterId(null);
      setShowAddChapterForm({ unitId: null });
      fetchChapters(unitId);
      setNotification({ message: editingChapterId ? 'Chapter updated successfully!' : 'Chapter added successfully!', type: 'success' });
    } catch (err: any) {
      console.error('Error saving chapter:', err);
      const errStr = err instanceof Error ? err.message : String(err);
      const isQuota = errStr.includes('quota-exceeded') || errStr.includes('Quota for bucket') || errStr.includes('Quota exceeded');
      if (isQuota) {
        setNotification({
          message: `⚠️ Firebase Storage Quota Exceeded! The Spark (Free) plan daily bandwidth limit for 'vectonix-db' has been reached today. Old uploads will temporarily fail to render and additions will revert to 404 until daily reset (or upgrading your Firebase project to the Blaze plan). Tip: You can paste direct online PDF/image URL links instead to completely bypass file uploads!`,
          type: 'error'
        });
      } else if (err?.code === 'storage/unauthorized') {
        const userEmail = auth.currentUser?.email || 'Not logged in';
        setNotification({ 
          message: `Storage Permission Denied (Chapters). logged in as: ${userEmail}.`, 
          type: 'error' 
        });
      } else {
        setNotification({ message: 'Failed to save chapter.', type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleDeleteUnit = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'units', id));
      // Try cleaning secure subcollection
      try {
        await deleteDoc(doc(db, 'units', id, 'secure', 'content'));
      } catch (e) {}

      setDeleteConfirmInfo(null);
      fetchUnits();
      setNotification({ message: 'Unit deleted successfully!', type: 'success' });
    } catch (error) {
      console.error('Error deleting unit:', error);
      setNotification({ message: 'Failed to delete unit.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async (unitId: string, chapterId: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'chapters', chapterId));
      // Try cleaning secure subcollection
      try {
        await deleteDoc(doc(db, 'chapters', chapterId, 'secure', 'content'));
      } catch (e) {}

      setDeleteConfirmInfo(null);
      fetchChapters(unitId);
      setNotification({ message: 'Chapter deleted successfully!', type: 'success' });
    } catch (error) {
      console.error('Error deleting chapter:', error);
      setNotification({ message: 'Failed to delete chapter.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditUnit = async (unit: any) => {
    setEditingUnitId(unit.id);
    
    let pdfUrl = '';
    try {
      const snap = await getDoc(doc(db, 'units', unit.id, 'secure', 'content'));
      if (snap.exists()) {
        pdfUrl = snap.data()?.pdfUrl || '';
      }
    } catch (e) {}

    const unitPrice = unit.price || 0;
    const unitDiscountPrice = unit.discountPrice !== undefined && unit.discountPrice !== null ? unit.discountPrice : unitPrice;
    const discountVal = unit.discount !== undefined ? unit.discount : Math.max(0, unitPrice - unitDiscountPrice);

    setUnitFormData({
      title: unit.title,
      order: unit.order,
      price: unitPrice.toString(),
      discount: discountVal.toString(),
      discountPrice: unitDiscountPrice.toString(),
      isFree: unit.isFree || false,
      pdfFile: null,
      pdfUrl: pdfUrl,
      previewFiles: [],
      previewUrls: unit.previewImages || [],
      gstPercent: unit.gstPercent !== undefined ? unit.gstPercent.toString() : ''
    });
    setShowAddUnitForm(true);
  };

  const openEditChapter = async (chapter: any) => {
    setEditingChapterId(chapter.id);
    
    let pdfUrl = chapter.pdfUrl || '';
    try {
      const snap = await getDoc(doc(db, 'chapters', chapter.id, 'secure', 'content'));
      if (snap.exists()) {
        pdfUrl = snap.data()?.pdfUrl || pdfUrl;
      }
    } catch (e) {}

    setChapterFormData({
      title: chapter.title,
      order: chapter.order,
      pdfFile: null,
      pdfUrl: pdfUrl,
      previewFiles: [],
      previewUrls: chapter.previewImages || []
    });
    setShowAddChapterForm({ unitId: chapter.unitId });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md cursor-pointer"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 z-20">
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-1">
                <Layers className="w-6 h-6 text-indigo-600" />
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Note Curriculum</h2>
              </div>
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{noteTitle}</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} 
              className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all group z-30 relative pointer-events-auto"
              title="Close Modal"
            >
              <X className="w-6 h-6 text-zinc-400 group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
            <AnimatePresence>
              {notification && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "p-4 rounded-2xl flex items-center justify-between gap-4 font-bold text-sm shadow-lg",
                    notification.type === 'success' ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    <span>{notification.message}</span>
                  </div>
                  <button onClick={() => setNotification(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {showAddUnitForm ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-50 dark:bg-zinc-950 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold dark:text-white">{editingUnitId ? 'Edit Unit' : 'Add New Unit'}</h3>
                  <button onClick={() => { setShowAddUnitForm(false); setEditingUnitId(null); }} className="text-zinc-500 font-bold hover:text-red-500">Cancel</button>
                </div>
                <form onSubmit={handleAddUnit} className="flex flex-col gap-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Unit Title</label>
                      <input 
                        required 
                        type="text" 
                        value={unitFormData.title} 
                        onChange={e => setUnitFormData({...unitFormData, title: e.target.value})}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:text-white font-bold"
                        placeholder="e.g., Algebra & Functions"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Order</label>
                      <input 
                        required 
                        type="number" 
                        value={unitFormData.order} 
                        onChange={e => setUnitFormData({...unitFormData, order: Number(e.target.value)})}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:text-white font-bold"
                      />
                    </div>
                  </div>

                   <div className="grid md:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest transition-colors group-focus-within:text-indigo-600">Price (INR)</label>
                      <input 
                        type="number"
                        disabled={unitFormData.isFree}
                        value={unitFormData.price}
                        onChange={e => {
                          const priceVal = e.target.value;
                          const discountVal = unitFormData.discount;
                          const discountPriceNum = Math.max(0, Number(priceVal || 0) - Number(discountVal || 0));
                          setUnitFormData({
                            ...unitFormData,
                            price: priceVal,
                            discountPrice: discountPriceNum.toString()
                          });
                        }}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 text-zinc-800 dark:text-zinc-100 font-bold transition-all disabled:opacity-85"
                        placeholder="Price"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest transition-colors group-focus-within:text-indigo-600">Discount (INR)</label>
                      <input 
                        type="number"
                        disabled={unitFormData.isFree}
                        value={unitFormData.discount}
                        placeholder="Discount Amount"
                        onChange={e => {
                          const discountVal = e.target.value;
                          const priceVal = unitFormData.price;
                          const discountPriceNum = Math.max(0, Number(priceVal || 0) - Number(discountVal || 0));
                          setUnitFormData({
                            ...unitFormData,
                            discount: discountVal,
                            discountPrice: discountPriceNum.toString()
                          });
                        }}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 text-zinc-800 dark:text-zinc-100 font-bold transition-all disabled:opacity-85"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest transition-colors group-focus-within:text-indigo-600">Price After Discount</label>
                      <input 
                        type="number"
                        disabled
                        value={unitFormData.discountPrice}
                        className="w-full px-5 py-4 bg-zinc-150 dark:bg-zinc-800 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-200 dark:disabled:text-zinc-200 font-black transition-all disabled:opacity-85"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest transition-colors group-focus-within:text-indigo-600">GST (%)</label>
                      <input 
                        type="number"
                        disabled={unitFormData.isFree}
                        value={unitFormData.gstPercent}
                        placeholder={(settings?.gstPercent ?? 0).toString()}
                        onChange={e => setUnitFormData({ ...unitFormData, gstPercent: e.target.value })}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 text-zinc-800 dark:text-zinc-100 font-bold transition-all disabled:opacity-85"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex flex-col gap-2 justify-center">
                      <label className="flex items-center gap-3 cursor-pointer group mt-2">
                        <div className="relative">
                          <input 
                            type="checkbox"
                            checked={unitFormData.isFree}
                            onChange={e => {
                              const isFreeChecked = e.target.checked;
                              const finalPrice = isFreeChecked ? '0' : unitFormData.price;
                              const finalDiscount = isFreeChecked ? '0' : unitFormData.discount;
                              const finalDiscountPrice = isFreeChecked ? '0' : (Math.max(0, Number(finalPrice) - Number(finalDiscount))).toString();
                              setUnitFormData({
                                ...unitFormData,
                                isFree: isFreeChecked,
                                price: finalPrice,
                                discount: finalDiscount,
                                discountPrice: finalDiscountPrice
                              });
                            }}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-12 h-6 rounded-full transition-all duration-300",
                            unitFormData.isFree ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"
                          )} />
                          <div className={cn(
                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 transform",
                            unitFormData.isFree ? "translate-x-6" : "translate-x-0"
                          )} />
                        </div>
                        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">Free Preview Unit</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Unit PDF (Optional)</label>
                       <div className="relative p-6 rounded-2xl border-2 border-dashed bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3">
                        <FileText className="w-8 h-8 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase text-zinc-400 text-center">
                          {unitFormData.pdfFile ? unitFormData.pdfFile.name : unitFormData.pdfUrl ? 'PDF Linked' : 'Upload Unit PDF'}
                        </span>
                        <input 
                          type="file" 
                          accept="application/pdf"
                          onChange={e => setUnitFormData({...unitFormData, pdfFile: e.target.files?.[0] || null})}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Preview Images (Gallery)</label>
                       <div className="grid grid-cols-3 gap-3">
                         {unitFormData.previewUrls.map((url, i) => (
                          <div key={i} className="relative group aspect-[3/4] bg-zinc-200 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800">
                             <img src={url} alt="Preview" className="w-full h-full object-cover" />
                             <button 
                              type="button"
                              onClick={() => setUnitFormData({...unitFormData, previewUrls: unitFormData.previewUrls.filter((_, idx) => idx !== i)})}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {unitFormData.previewFiles.map((file, i) => (
                          <div key={i} className="relative aspect-[3/4] bg-zinc-100 rounded-xl overflow-hidden shrink-0 border border-indigo-200">
                             <img src={URL.createObjectURL(file)} alt="New Preview" className="w-full h-full object-cover opacity-50" />
                             <div className="absolute inset-0 flex items-center justify-center font-black text-[8px] text-indigo-600 uppercase">New</div>
                          </div>
                        ))}
                        <div className="relative aspect-[3/4] bg-white dark:bg-zinc-900 rounded-xl flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 transition-colors cursor-pointer">
                          <Plus className="w-6 h-6 mb-1" />
                          <span className="text-[8px] font-black uppercase text-center">Add Image</span>
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*"
                            onChange={e => setUnitFormData({...unitFormData, previewFiles: [...unitFormData.previewFiles, ...Array.from(e.target.files || [])]})}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                       </div>
                    </div>
                  </div>

                  <button disabled={submitting} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl overflow-hidden relative">
                    {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-6 h-6" />}
                    {submitting ? 'Saving Unit...' : 'Save Unit Metadata'}
                  </button>
                </form>
              </motion.div>
            ) : showAddChapterForm.unitId ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-50 dark:bg-zinc-950 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold dark:text-white">{editingChapterId ? 'Edit Chapter' : 'Add New Chapter'}</h3>
                  <button onClick={() => { setShowAddChapterForm({ unitId: null }); setEditingChapterId(null); }} className="text-zinc-500 font-bold hover:text-red-500">Cancel</button>
                </div>
                <form onSubmit={handleAddChapter} className="flex flex-col gap-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Chapter Title</label>
                      <input 
                        required 
                        type="text" 
                        value={chapterFormData.title} 
                        onChange={e => setChapterFormData({...chapterFormData, title: e.target.value})}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:text-white font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Order</label>
                      <input 
                        required 
                        type="number" 
                        value={chapterFormData.order} 
                        onChange={e => setChapterFormData({...chapterFormData, order: Number(e.target.value)})}
                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-4">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Chapter PDF (Secret Content)</label>
                      <div className="relative p-6 rounded-[2rem] border-2 border-dashed bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3">
                        <FileText className="w-10 h-10 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase text-zinc-400">
                          {chapterFormData.pdfFile ? chapterFormData.pdfFile.name : chapterFormData.pdfUrl ? 'PDF Already Linked' : 'Upload Chapter PDF'}
                        </span>
                        <input 
                          type="file" 
                          accept="application/pdf"
                          onChange={e => setChapterFormData({...chapterFormData, pdfFile: e.target.files?.[0] || null})}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Preview Pages</label>
                       <div className="grid grid-cols-4 gap-2">
                         {chapterFormData.previewUrls.map((url, i) => (
                          <div key={i} className="relative group aspect-[3/4] bg-zinc-200 rounded-lg overflow-hidden shrink-0">
                            <img src={url} alt="Preview" className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={() => setChapterFormData({...chapterFormData, previewUrls: chapterFormData.previewUrls.filter((_, idx) => idx !== i)})}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 border border-dashed border-zinc-300">
                          <Plus className="w-6 h-6" />
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*"
                            onChange={e => setChapterFormData({...chapterFormData, previewFiles: [...chapterFormData.previewFiles, ...Array.from(e.target.files || [])]})}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button disabled={submitting} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3">
                    {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-6 h-6" />}
                    {submitting ? 'Saving Chapter...' : 'Save Chapter'}
                  </button>
                </form>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold dark:text-white uppercase tracking-tight">Units & Chapters</h3>
                  <button 
                    onClick={() => {
                      setUnitFormData({ 
                        title: '', 
                        order: units.length + 1,
                        price: '',
                        discount: '',
                        discountPrice: '',
                        isFree: false,
                        pdfFile: null,
                        pdfUrl: '',
                        previewFiles: [],
                        previewUrls: [],
                        gstPercent: ''
                      });
                      setShowAddUnitForm(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    New Unit
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {loading ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest italic">Syncing Curriculum...</p>
                    </div>
                  ) : units.map((unit, idx) => (
                    <div key={unit.id} className="flex flex-col gap-2">
                       <div className={cn(
                         "group bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 flex items-center gap-8 hover:border-indigo-600 transition-all",
                         expandedUnitId === unit.id && "border-indigo-600 bg-indigo-50/10"
                       )}>
                        <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-800 shrink-0">
                          <span className="text-[10px] font-black uppercase opacity-40">U</span>
                          <span className="text-lg font-black">{unit.order || idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-xl dark:text-white uppercase tracking-tight">{unit.title}</h4>
                          <div className="flex items-center gap-4 mt-0.5">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              {chapters[unit.id]?.length || 0} Chapters Included
                            </p>
                            <div className="flex items-center gap-2 text-indigo-600">
                              <DollarSign className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                {unit.isFree 
                                  ? 'Free Preview' 
                                  : (unit.discountPrice !== undefined && unit.discountPrice !== null && unit.discountPrice < unit.price)
                                    ? formatCurrency(unit.discountPrice)
                                    : formatCurrency(unit.price || 0)
                                }
                              </span>
                              {!unit.isFree && unit.discountPrice !== undefined && unit.discountPrice !== null && unit.discountPrice < unit.price && (
                                <span className="text-[9px] text-zinc-400 line-through font-bold">
                                  {formatCurrency(unit.price)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id)}
                            className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-indigo-600 rounded-xl transition-all"
                          >
                            {expandedUnitId === unit.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          <button onClick={() => openEditUnit(unit)} className="p-3 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all">
                            <Edit className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmInfo({ id: unit.id, type: 'unit', title: unit.title })} 
                            className="p-3 text-zinc-400 hover:text-red-500 hover:bg-zinc-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedUnitId === unit.id && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden pl-12 flex flex-col gap-2"
                          >
                            {chapters[unit.id]?.map((chapter, cIdx) => (
                              <div key={chapter.id} className="bg-zinc-50 dark:bg-zinc-800/20 p-4 rounded-2xl flex items-center gap-4 group/chapter border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all">
                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-black">{chapter.order || cIdx + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <h5 className="text-[13px] font-bold dark:text-white uppercase tracking-tight">{chapter.title}</h5>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                                      <FileText className="w-3 h-3" /> PDF
                                    </span>
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                                      <ImageIcon className="w-3 h-3" /> {chapter.previewImages?.length || 0} Pages
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover/chapter:opacity-100 transition-opacity">
                                  <button onClick={() => openEditChapter(chapter)} className="p-2 text-zinc-400 hover:text-indigo-600"><Edit className="w-4 h-4" /></button>
                                  <button 
                                    onClick={() => setDeleteConfirmInfo({ id: chapter.id, type: 'chapter', title: chapter.title, unitId: unit.id })} 
                                    className="p-2 text-zinc-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button 
                              onClick={() => {
                                setChapterFormData({ title: '', order: (chapters[unit.id]?.length || 0) + 1, pdfFile: null, pdfUrl: '', previewFiles: [], previewUrls: [] });
                                setShowAddChapterForm({ unitId: unit.id });
                              }}
                              className="w-full p-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all font-bold text-xs uppercase tracking-widest"
                            >
                              <Plus className="w-4 h-4" /> Add Chapter to {unit.title}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Warning */}
          <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-4">
            <Lock className="w-4 h-4 text-zinc-400" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Secured Study Note Delivery Infrastructure (Units &gt; Chapters)
            </p>
          </div>
        </motion.div>

        {/* Unified Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmInfo && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 max-w-md w-full border border-zinc-100 dark:border-zinc-800 shadow-2xl"
              >
                <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mb-6 mx-auto">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-center dark:text-white uppercase tracking-tight mb-2">Delete {deleteConfirmInfo.type}?</h3>
                <p className="text-sm font-medium text-zinc-500 text-center mb-8 uppercase tracking-widest leading-relaxed">
                  Are you sure you want to delete <span className="text-zinc-900 dark:text-white font-black">"{deleteConfirmInfo.title}"</span>? This action cannot be undone.
                  {deleteConfirmInfo.type === 'unit' && <span className="block mt-2 text-red-500">Caution: All chapters in this unit will also be affected.</span>}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      if (deleteConfirmInfo.type === 'unit') handleDeleteUnit(deleteConfirmInfo.id);
                      else if (deleteConfirmInfo.type === 'chapter' && deleteConfirmInfo.unitId) handleDeleteChapter(deleteConfirmInfo.unitId, deleteConfirmInfo.id);
                    }}
                    disabled={submitting}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Permanently'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmInfo(null)}
                    disabled={submitting}
                    className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
  );
}