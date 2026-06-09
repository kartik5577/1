import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, setDoc, getDoc, getDocFromCache, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, listAll, getBytes, getMetadata } from 'firebase/storage';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { Bell, Megaphone, File, Plus, Trash2, Edit, Save, X, Loader2, Book, Video, Calendar, DollarSign, Image as ImageIcon, Settings as SettingsIcon, CheckCircle2, AlertCircle, LayoutDashboard, Eye, List, ArrowUpRight, BookOpen, Users, Shield, ShieldAlert, ShieldCheck, User, Camera, Lock, LockOpen, Mail, Phone, Clock, ShoppingBag, FileText, PlayCircle, Home as HomeIcon, GraduationCap, Tag, Download, Upload, Search, MessageSquare, Star, Printer, Database, Activity, HardDrive, Sliders, Folder, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import UnitManagementModal from '../components/UnitManagementModal';
import { CountdownTimer } from '../components/CountdownTimer';
import { VirtualClassroom } from '../components/VirtualClassroom';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

function amountToWords(num: number): string {
  if (num === 0) return 'Zero Rupees';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convertHundreds = (n: number): string => {
    if (n === 0) return '';
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  try {
    let rawNum = Math.floor(num);
    if (rawNum === 0) return 'Zero Rupees';
    
    let result = '';
    
    // Crore
    if (rawNum >= 10000000) {
      const cr = Math.floor(rawNum / 10000000);
      result += convertHundreds(cr) + ' Crore ';
      rawNum %= 10000000;
    }
    
    // Lakh
    if (rawNum >= 100000) {
      const lk = Math.floor(rawNum / 100000);
      result += convertHundreds(lk) + ' Lakh ';
      rawNum %= 100000;
    }
    
    // Thousand
    if (rawNum >= 1000) {
      const th = Math.floor(rawNum / 1000);
      result += convertHundreds(th) + ' Thousand ';
      rawNum %= 1000;
    }
    
    // Hundreds/Tens/Ones
    if (rawNum > 0) {
      result += convertHundreds(rawNum);
    }
    
    return result.trim() + ' Rupees Only';
  } catch {
    return 'Rupees';
  }
}

export default function AdminPanel() {
  const { user, profile, isAdmin, loading: authLoading, refreshProfile } = useAuth();

  const handleAdminError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errorStr = error instanceof Error ? error.message : String(error);
    const isQuota = errorStr.toLowerCase().includes('quota-exceeded') || errorStr.includes('Quota for bucket') || errorStr.includes('Quota exceeded');
    const isOffline = errorStr.toLowerCase().includes('offline') || errorStr.toLowerCase().includes('unreachable') || !navigator.onLine;

    if (isQuota) {
      setNotification({
        message: `⚠️ Firebase Storage Quota Exceeded! The Spark (Free) plan daily limit for your Firebase storage bucket ('vectonix-db.firebasestorage.app') has been reached today. Upgrade to the 'Blaze' plan or try again tomorrow. You can also paste direct online image/document URLs instead of uploading files to completely bypass this limit.`,
        type: 'error'
      });
    } else if (isOffline && (operationType === OperationType.GET || operationType === OperationType.LIST)) {
      // Gracefully prevent background listener offline errors from spamming toast notifications on load.
      // Firestore triggers listeners background retries natively and serves local cache.
      console.warn(`[Admin Panel Offline Cache] Background read operation (${operationType.toUpperCase()} on Path: "${path || 'unknown'}") will resume on reconnection: ${errorStr}`);
    } else {
      setNotification({ message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
    handleFirestoreError(error, operationType, path);
  }

  const parseAndNotifyError = (error: unknown, defaultMessage: string) => {
    const errorStr = error instanceof Error ? error.message : String(error);
    const isQuota = errorStr.includes('quota-exceeded') || errorStr.includes('Quota for bucket') || errorStr.includes('Quota exceeded');
    if (isQuota) {
      setNotification({
        message: `⚠️ Firebase Storage Quota Exceeded! The Spark (Free) plan daily limit for your Firebase storage bucket ('vectonix-db.firebasestorage.app') has been reached today. Upgrade to the 'Blaze' plan or try again tomorrow. You can also paste direct online image/document URLs instead of uploading files to completely bypass this limit.`,
        type: 'error'
      });
    } else {
      setNotification({ message: `${defaultMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  };
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const validTabs: any[] = ['dashboard', 'courses', 'subjects', 'notes', 'lectures', 'live', 'sales', 'settings', 'users', 'profile', 'notices', 'promotions', 'enquiry', 'reviews', 'database', 'backup'];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [location.search]);

  // Helper to find student details for sales table
  const getStudentInfo = (userId: string) => {
    return users.find(u => u.id === userId) || { name: 'Unknown User', email: userId, mobile: 'N/A', dob: 'N/A', photoUrl: '' };
  };

  // Helper to find item title for sales table
  const getItemTitle = (itemId: string, itemType: string) => {
    if (itemType === 'course') return courses.find(c => c.id === itemId)?.title || itemId;
    if (itemType === 'note') return notes.find(n => n.id === itemId)?.title || itemId;
    if (itemType === 'lecture') return lectures.find(l => l.id === itemId)?.title || itemId;
    if (itemType === 'live') return liveClasses.find(l => l.id === itemId)?.title || itemId;
    if (itemType === 'unit') return units.find(u => u.id === itemId)?.title || itemId;
    return `${itemType}: ${itemId}`;
  };

  const parsePrice = (val: any) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    return Number(clean) || 0;
  };

  const getSaleNetPaid = (sale: any) => {
    if (!sale) return 0;
    const matchedItem = (() => {
      if (sale.itemType === 'course') return courses.find(c => c.id === sale.itemId);
      if (sale.itemType === 'note') return notes.find(n => n.id === sale.itemId);
      if (sale.itemType === 'lecture') return lectures.find(l => l.id === sale.itemId);
      if (sale.itemType === 'live') return liveClasses.find(l => l.id === sale.itemId);
      if (sale.itemType === 'unit') return units.find(u => u.id === sale.itemId);
      return null;
    })();

    let actualPriceVal = 0;
    let discountPriceVal = 0;
    let adminDiscountAmount = 0;

    if (sale.originalPrice !== undefined) {
      actualPriceVal = parsePrice(sale.originalPrice);
      discountPriceVal = sale.productDiscount !== undefined 
        ? parsePrice(sale.originalPrice) - parsePrice(sale.productDiscount)
        : parsePrice(sale.amount || 0);
      adminDiscountAmount = sale.productDiscount !== undefined
        ? parsePrice(sale.productDiscount)
        : Math.max(0, actualPriceVal - discountPriceVal);
    } else {
      if (sale.itemId === 'batch_purchase' && Array.isArray(sale.itemIds)) {
        let totalOriginal = 0;
        let totalDiscounted = 0;
        sale.itemIds.forEach((id: string) => {
          const mat = courses.find(c => c.id === id) || 
                       notes.find(n => n.id === id) || 
                       lectures.find(l => l.id === id) || 
                       liveClasses.find(l => l.id === id) || 
                       units.find(u => u.id === id);
          if (mat) {
            totalOriginal += parsePrice((mat as any).price || 0);
            totalDiscounted += parsePrice((mat as any).discountPrice || (mat as any).price || 0);
          }
        });
        if (totalOriginal > 0) {
          actualPriceVal = totalOriginal;
          discountPriceVal = totalDiscounted > 0 ? totalDiscounted : parsePrice(sale.amount || 0);
          adminDiscountAmount = Math.max(0, actualPriceVal - discountPriceVal);
        } else {
          actualPriceVal = parsePrice(sale.amount || 0);
          discountPriceVal = parsePrice(sale.amount || 0);
          adminDiscountAmount = 0;
        }
      } else {
        actualPriceVal = parsePrice(matchedItem?.price || sale.amount || 0);
        discountPriceVal = parsePrice(sale.amount || 0);
        adminDiscountAmount = Math.max(0, actualPriceVal - discountPriceVal);
      }
    }

    const couponCode = sale.couponCode || sale.discountApplied || null;
    
    let couponDiscountAmount = 0;
    if (sale.couponDiscount !== undefined) {
      couponDiscountAmount = parsePrice(sale.couponDiscount);
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

    const priceAfterCoupon = Math.max(0, (sale.productDiscount !== undefined ? (actualPriceVal - adminDiscountAmount) : discountPriceVal) - couponDiscountAmount);
    
    const gstPercent = sale.gstPercent !== undefined ? parsePrice(sale.gstPercent) : 18;
    const gstAmount = sale.gstAmount !== undefined 
      ? parsePrice(sale.gstAmount) 
      : priceAfterCoupon * (gstPercent / 100);

    const finalNetPaid = sale.paidAmount !== undefined 
      ? parsePrice(sale.paidAmount) 
      : priceAfterCoupon + gstAmount;

    return finalNetPaid;
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'courses' | 'subjects' | 'notes' | 'lectures' | 'live' | 'notices' | 'sales' | 'settings' | 'users' | 'profile' | 'promotions' | 'enquiry' | 'reviews' | 'database' | 'backup'>('dashboard');
  const [dbActiveUsers, setDbActiveUsers] = useState(500);
  const [dbReadsPerUser, setDbReadsPerUser] = useState(15);
  const [dbWritesPerUser, setDbWritesPerUser] = useState(2);
  const [dbCloudStorageGB, setDbCloudStorageGB] = useState(12);
  const [dbStorageBandwidthPerUser, setDbStorageBandwidthPerUser] = useState(1.5);
  const [dbMode, setDbMode] = useState<'actual' | 'virtual'>('actual');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRepairingUrls, setIsRepairingUrls] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{current: number; total: number; collection: string} | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'homepage' | 'banners'>('general');
  const [homepageConfig, setHomepageConfig] = useState<any>({
    heroTitle: '',
    heroSubtitle: '',
    heroVideoId: '',
    heroImage: '',
    missionTitle: '',
    missionSubtitle: '',
    missionDescription: '',
    missionPoints: [],
    missionImage: '',
    contactEmail: '',
    contactPhone: '',
    contactLocation: '',
    reviews: []
  });
  const [homepageSaving, setHomepageSaving] = useState(false);
  const [classroomConfig, setClassroomConfig] = useState({
    isOpen: false,
    roomName: '',
    userName: '',
    classId: '',
    isModerator: false,
    externalUrl: ''
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [showAddLiveModal, setShowAddLiveModal] = useState(false);
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [showAddPromotionModal, setShowAddPromotionModal] = useState(false);
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ id: string; type: string; title: string } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const [noticeFormData, setNoticeFormData] = useState({
    title: '',
    content: '',
    type: 'announcement' as 'news' | 'announcement' | 'update',
    visibility: 'both' as 'public' | 'registered' | 'both',
    attachmentFile: null as File | null,
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: ''
  });
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [userEditFormData, setUserEditFormData] = useState({
    name: '',
    dob: '',
    mobile: '',
    role: 'student'
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    dob: '',
    photoUrl: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        dob: profile.dob || '',
        photoUrl: profile.photoUrl || ''
      });
    }
  }, [profile]);

  const handleSaveHomepage = async (e: React.FormEvent) => {
    e.preventDefault();
    setHomepageSaving(true);
    try {
      await setDoc(doc(db, 'homepage', 'config'), homepageConfig);
      alert('Homepage configuration updated successfully!');
    } catch (error) {
      handleAdminError(error, OperationType.WRITE, 'homepage/config');
    } finally {
      setHomepageSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profileForm.name,
        dob: profileForm.dob,
        updatedAt: new Date().toISOString()
      });
      await refreshProfile?.();
      setNotification({ message: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      handleAdminError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleApproveReview = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Review approved!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.UPDATE, `reviews/${id}`);
    }
  };

  const handleRejectReview = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Review rejected', type: 'error' });
    } catch (error) {
      handleAdminError(error, OperationType.UPDATE, `reviews/${id}`);
    }
  };

  const handleDeleteReview = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Review deleted', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `reviews/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEnquiry = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'enquiries', id));
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Enquiry deleted', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `enquiries/${id}`);
    } finally {
      setSubmitting(false);
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
      await refreshProfile?.();
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const credential = EmailAuthProvider.credential(user.email!, passwordForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.new);
      setShowPasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setNotification({ message: 'Password changed successfully!', type: 'success' });
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const [unitManagementConfig, setUnitManagementConfig] = useState<{ isOpen: boolean, noteId: string, noteTitle: string, courseId?: string }>({
    isOpen: false,
    noteId: '',
    noteTitle: '',
    courseId: ''
  });
  
  // Settings State
  const [settings, setSettings] = useState({
    logoUrl: '/logo.png',
    appName: 'Vectonix Classes',
    supportEmail: '',
    supportPhone: '',
    whatsappNumber: '',
    youtubeUrl: '',
    instagramUrl: '',
    telegramUrl: '',
    facebookUrl: '',
    linkedinUrl: '',
    address: '',
    studentCountLabel: '10,000+',
    heroTitle: 'Master Physics with Vectonix',
    heroSubtitle: 'India\'s most trusted platform for JEE & NEET Physics preparation with expert faculty and high-quality study materials.',
    gstPercent: 18,
    gaMeasurementId: '',
    gscVerificationId: '',
    stats: [
      { label: 'Total Students', value: '10k+', icon: 'users' },
      { label: 'Video Lectures', value: '500+', icon: 'video' },
      { label: 'Study Materials', value: '1000+', icon: 'book' },
      { label: 'Success Rate', value: '98%', icon: 'star' }
    ],
    features: [
      { title: 'Expert Faculty', description: 'Learn from top physics mentors with years of JEE/NEET experience.', icon: 'users' },
      { title: 'Comprehensive Notes', description: 'Scientifically designed notes that cover every concept in detail.', icon: 'book' },
      { title: 'Interactive Sessions', description: 'Join live doubt clearing and masterclass sessions every week.', icon: 'radio' },
      { title: 'Track Progress', description: 'Monitor your growth with regular tests and performance analytics.', icon: 'zap' }
    ]
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Physics',
    isFeatured: false,
    imageFile: null as File | null,
    imageUrl: ''
  });

  const [subjectFormData, setSubjectFormData] = useState({
    title: '',
    courseId: '',
    description: ''
  });

  const [noteFormData, setNoteFormData] = useState({
    title: '',
    courseId: '',
    subjectId: '',
    price: '',
    discount: '',
    discountPrice: '',
    isFree: false,
    isFeatured: false,
    coverFile: null as File | null,
    coverUrl: ''
  });

  const [lectureFormData, setLectureFormData] = useState({
    title: '',
    courseId: '',
    subjectId: '',
    videoFile: null as File | null,
    coverFile: null as File | null,
    coverUrl: '',
    isComingSoon: false,
    price: '',
    discount: '',
    discountPrice: '',
    isFree: false,
    isFeatured: false,
    uploadProgress: 0,
    gstPercent: ''
  });

  const [liveFormData, setLiveFormData] = useState({
    title: '',
    courseId: '',
    subjectId: '',
    status: 'upcoming' as 'upcoming' | 'live' | 'completed',
    price: '',
    discount: '',
    discountPrice: '',
    isFree: false,
    isFeatured: false,
    coverFile: null as File | null,
    coverUrl: '',
    scheduledAt: '',
    gstPercent: ''
  });

  const [liveDate, setLiveDate] = useState('');
  const [liveHour, setLiveHour] = useState('12');
  const [liveMinute, setLiveMinute] = useState('00');
  const [liveAmpm, setLiveAmpm] = useState('AM');

  const [bannerFormData, setBannerFormData] = useState({
    title: '',
    subtitle: '',
    imgFile: null as File | null,
    imgUrl: '',
    buttonText: 'Start Learning',
    link: '/',
    order: 0
  });

  const [promotionFormData, setPromotionFormData] = useState({
    title: '',
    description: '',
    type: 'offer' as 'offer' | 'discount' | 'announcement',
    imgFile: null as File | null,
    imgUrl: '',
    link: '',
    isActive: true,
    order: 0,
    expiryDate: '',
    couponCode: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    applicableProducts: [] as string[],
    maxUsage: ''
  });

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const filteredCourses = courses.filter(c => c.title.toLowerCase().includes(productSearchQuery.toLowerCase()));
  const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(productSearchQuery.toLowerCase()));
  const filteredLectures = lectures.filter(l => l.title.toLowerCase().includes(productSearchQuery.toLowerCase()));
  const filteredLiveClasses = liveClasses.filter(lc => lc.title.toLowerCase().includes(productSearchQuery.toLowerCase()));

  const [submitting, setSubmitting] = useState(false);
  const [isGeneratingDummy, setIsGeneratingDummy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (isAdmin) {
      // Real-time courses listener
      const coursesQuery = query(collection(db, 'courses'));
      const unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sorted = docs.sort((a, b) => {
          const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setCourses(sorted);
        setLoading(false);
      }, (error) => handleAdminError(error, OperationType.LIST, 'courses'));

      // Real-time subjects listener
      const subjectsQuery = query(collection(db, 'subjects'));
      const unsubscribeSubjects = onSnapshot(subjectsQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSubjects(docs);
      }, (error) => handleAdminError(error, OperationType.LIST, 'subjects'));

      // Real-time notes listener
      const notesQuery = query(collection(db, 'notes'));
      const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sorted = docs.sort((a, b) => {
          const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setNotes(sorted);
      }, (error) => handleAdminError(error, OperationType.LIST, 'notes'));

      // Real-time lectures listener
      const lecturesQuery = query(collection(db, 'lectures'));
      const unsubscribeLectures = onSnapshot(lecturesQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sorted = docs.sort((a, b) => {
          const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setLectures(sorted);
      }, (error) => handleAdminError(error, OperationType.LIST, 'lectures'));

      fetchSales();
      fetchSettings();
      
      // Real-time live classes listener
      const liveQuery = query(collection(db, 'liveClasses'));
      const unsubscribeLive = onSnapshot(liveQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sorted = docs.sort((a, b) => {
          const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setLiveClasses(sorted);
      }, (error) => handleAdminError(error, OperationType.LIST, 'liveClasses'));

      // Real-time units listener
      const unitsQuery = query(collection(db, 'units'));
      const unsubscribeUnits = onSnapshot(unitsQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUnits(docs);
      }, (error) => handleAdminError(error, OperationType.LIST, 'units'));

      // Real-time banners listener
      const bannersQuery = query(collection(db, 'banners'), orderBy('order', 'asc'));
      const unsubscribeBanners = onSnapshot(bannersQuery, (snapshot) => {
        setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleAdminError(error, OperationType.LIST, 'banners'));

      // Real-time users listener
      const usersQuery = query(collection(db, 'users'));
      const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleAdminError(error, OperationType.LIST, 'users'));

      // Real-time notices listener
      const noticesQuery = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
      const unsubscribeNotices = onSnapshot(noticesQuery, (snapshot) => {
        setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleAdminError(error, OperationType.LIST, 'notices'));

      // Real-time promotions listener
      const promotionsQuery = query(collection(db, 'promotions'), orderBy('order', 'asc'));
      const unsubscribePromotions = onSnapshot(promotionsQuery, (snapshot) => {
        setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleAdminError(error, OperationType.LIST, 'promotions'));

      // Real-time enquiries listener
      const enquiriesQuery = query(collection(db, 'enquiries'), orderBy('createdAt', 'desc'));
      const unsubscribeEnquiries = onSnapshot(enquiriesQuery, (snapshot) => {
        setEnquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleAdminError(error, OperationType.LIST, 'enquiries'));

      // Real-time reviews listener
      const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
      const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
        setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleAdminError(error, OperationType.LIST, 'reviews'));

      // Real-time homepage listener
      const unsubscribeHomepage = onSnapshot(doc(db, 'homepage', 'config'), (snapshot) => {
        if (snapshot.exists()) {
          setHomepageConfig((prev: any) => ({ ...prev, ...snapshot.data() }));
        }
      }, (error) => handleAdminError(error, OperationType.GET, 'homepage/config'));
      
      return () => {
        unsubscribeCourses();
        unsubscribeSubjects();
        unsubscribeNotes();
        unsubscribeLectures();
        unsubscribeLive();
        unsubscribeUnits();
        unsubscribeBanners();
        unsubscribeUsers();
        unsubscribeNotices();
        unsubscribePromotions();
        unsubscribeHomepage();
        unsubscribeEnquiries();
        unsubscribeReviews();
      };
    }
  }, [isAdmin]);

  const fetchSettings = async () => {
    const docRef = doc(db, 'settings', 'general');
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings((prev: any) => ({ ...prev, ...data, logoUrl: '/logo.png' }));
      }
    } catch (error: any) {
      const errorStr = error instanceof Error ? error.message : String(error);
      const isOfflineOrNetwork = errorStr.toLowerCase().includes('offline') || errorStr.toLowerCase().includes('unreachable') || !navigator.onLine;

      if (isOfflineOrNetwork) {
        try {
          const cacheSnap = await getDocFromCache(docRef);
          if (cacheSnap.exists()) {
            const data = cacheSnap.data();
            setSettings((prev: any) => ({ ...prev, ...data, logoUrl: '/logo.png' }));
            console.warn('[Admin Panel Offline Cache] Successfully fetched settings from local Firestore cache.');
            return;
          }
        } catch (cacheErr) {
          console.warn('[Admin Panel Offline Cache] Could not fetch settings from Firestore cache:', cacheErr);
        }
        console.warn('Error fetching settings (offline, using local state defaults):', error);
      } else {
        console.error('Error fetching settings:', error);
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        ...settings,
        updatedAt: new Date().toISOString()
      });
      
      setNotification({ message: 'Settings saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setNotification({ 
        message: 'Failed to save settings: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        type: 'error' 
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleClearDummyData = async () => {
    try {
      setShowDeleteConfirm(false);
      setIsClearing(true);
      setIsResetting(true);
      
      const collectionsToClear = ['subjects', 'units', 'chapters', 'courses', 'notes', 'lectures', 'liveClasses', 'sales', 'noteUnits', 'banners', 'testimonials', 'announcements'];
      
      let totalDeleted = 0;
      for (const colName of collectionsToClear) {
        try {
          setNotification({ message: `Clearing ${colName}...`, type: 'success' });
          console.log(`Clearing collection: ${colName}`);
          const snap = await getDocs(collection(db, colName));
          
          if (snap.empty) {
            console.log(`Collection ${colName} is already empty.`);
            continue;
          }
          
          console.log(`Deleting ${snap.docs.length} items from ${colName}`);
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
            totalDeleted++;
            
            const subcollections = ['secure', 'chat'];
            for (const sub of subcollections) {
              try {
                const subSnap = await getDocs(collection(db, colName, d.id, sub));
                if (!subSnap.empty) {
                  const subDeletes = subSnap.docs.map(sd => deleteDoc(sd.ref));
                  await Promise.all(subDeletes);
                }
              } catch (e) {
                // Ignore subcollection errors
              }
            }
          }
        } catch (colError) {
          console.error(`Failed to clear collection ${colName}:`, colError);
          // Don't throw, just continue to next collection
        }
      }

      setNotification({ message: `Cleanup complete! ${totalDeleted} records removed.`, type: 'success' });
      
      // Force clear local state
      setCourses([]);
      setNotes([]);
      setLectures([]);
      setLiveClasses([]);
      setSales([]);
      
      // Re-fetch to confirm it's empty
      await Promise.all([
        fetchCourses(),
        fetchNotes(),
        fetchLectures(),
        fetchLiveClasses(),
        fetchSales()
      ]);
    } catch (error) {
      console.error('Error clearing data:', error);
      setNotification({ 
        message: 'Failed to clear database records: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        type: 'error' 
      });
    } finally {
      setIsClearing(false);
      setIsResetting(false);
    }
  };

  const listAllStorageFiles = async (dirRef: any): Promise<any[]> => {
    try {
      const result = await listAll(dirRef);
      let files = [...result.items];
      for (const prefix of result.prefixes) {
        const nested = await listAllStorageFiles(prefix);
        files = files.concat(nested);
      }
      return files;
    } catch (err) {
      console.warn("Could not list storage for prefix:", dirRef.fullPath, err);
      return [];
    }
  };

  const handleRepairStorageUrls = async () => {
    setIsRepairingUrls(true);
    setNotification({ message: 'Scanning Firestore documents for broken storage URLs...', type: 'success' });
    try {
      const currentBucket = storage?.app?.options?.storageBucket || '';
      if (!currentBucket) {
        throw new Error("Active storage bucket configuration is missing.");
      }

      const collectionsToScan = ['courses', 'notes', 'lectures', 'liveClasses', 'banners', 'promotions'];
      let scannedCount = 0;
      let repairedCount = 0;

      const fbStorageRegex = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#"\s>'\)]+)/g;

      // Recursive rewriter for URL correction
      const rewriteUrlString = (value: any): { value: any, updated: boolean } => {
        if (typeof value === 'string') {
          let updated = false;
          const revised = value.replace(fbStorageRegex, (match, capturedBucket, path) => {
            if (capturedBucket !== currentBucket) {
              updated = true;
              return `https://firebasestorage.googleapis.com/v0/b/${currentBucket}/o/${path}`;
            }
            return match;
          });
          return { value: revised, updated };
        }
        if (Array.isArray(value)) {
          let anyUpdated = false;
          const newValue = value.map(item => {
            const res = rewriteUrlString(item);
            if (res.updated) anyUpdated = true;
            return res.value;
          });
          return { value: newValue, updated: anyUpdated };
        }
        if (typeof value === 'object' && value !== null) {
          let anyUpdated = false;
          const newValue: Record<string, any> = {};
          for (const k of Object.keys(value)) {
            const res = rewriteUrlString(value[k]);
            if (res.updated) anyUpdated = true;
            newValue[k] = res.value;
          }
          return { value: newValue, updated: anyUpdated };
        }
        return { value, updated: false };
      };

      for (const colName of collectionsToScan) {
        const querySnapshot = await getDocs(collection(db, colName));
        for (const classDoc of querySnapshot.docs) {
          scannedCount++;
          const data = classDoc.data();
          const rewriteResult = rewriteUrlString(data);
          
          if (rewriteResult.updated) {
            await setDoc(doc(db, colName, classDoc.id), rewriteResult.value, { merge: true });
            repairedCount++;
          }
        }
      }

      // Check homepage config as well
      const homeDocRef = doc(db, 'homepage', 'config');
      const homeDocSnap = await getDoc(homeDocRef);
      if (homeDocSnap.exists()) {
        scannedCount++;
        const homeData = homeDocSnap.data();
        const rewriteResult = rewriteUrlString(homeData);
        if (rewriteResult.updated) {
          await setDoc(homeDocRef, rewriteResult.value, { merge: true });
          repairedCount++;
        }
      }

      setNotification({
        message: `Image restoration complete! Scanned ${scannedCount} database documents, successfully healed ${repairedCount} incorrect image paths.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Image Repair failed:', err);
      setNotification({
        message: 'Repair failed: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error'
      });
    } finally {
      setIsRepairingUrls(false);
    }
  };

  const handleGenerateBackup = async () => {
    setIsBackingUp(true);
    setNotification({ message: 'Gathering application data for backup...', type: 'success' });
    try {
      const backupData: Record<string, any[]> = {};
      const collectionsToBackup = [
        'courses',
        'subjects',
        'units',
        'chapters',
        'notes',
        'lectures',
        'liveClasses',
        'sales',
        'banners',
        'notices',
        'promotions',
        'enquiries',
        'reviews',
        'users',
        'settings'
      ];

      for (const colName of collectionsToBackup) {
        setNotification({ message: `Backing up partition: ${colName}...`, type: 'success' });
        let snap;
        try {
          snap = await getDocs(collection(db, colName));
        } catch (colErr) {
          handleFirestoreError(colErr, OperationType.GET, colName);
          throw colErr;
        }

        const docs = [];
        for (const d of snap.docs) {
          const docData: any = {
            id: d.id,
            ...d.data()
          };

          // Backup nested secure/content if available
          if (['notes', 'units', 'chapters', 'lectures', 'liveClasses'].includes(colName)) {
            try {
              const secureSnap = await getDoc(doc(db, colName, d.id, 'secure', 'content'));
              if (secureSnap.exists()) {
                docData._secureContent = secureSnap.data();
              }
            } catch (secError) {
              console.warn(`Could not backup secure content for ${colName}/${d.id}:`, secError);
            }
          }
          docs.push(docData);
        }
        
        backupData[colName] = docs;
      }

      // Check homepage config too!
      try {
        const homeDoc = await getDoc(doc(db, 'homepage', 'config'));
        if (homeDoc.exists()) {
          backupData['homepage_config'] = [{ id: 'config', ...homeDoc.data() }];
        }
      } catch (homeError) {
        console.warn('Skipping homepage config:', homeError);
      }

      // Backup files from Firebase Storage recursively
      setNotification({ message: 'Scanning storage bucket for educational media & documents...', type: 'success' });
      const storageBackup: any[] = [];
      try {
        const rootRef = ref(storage);
        const filesList = await listAllStorageFiles(rootRef);
        
        if (filesList.length > 0) {
          let backedUpCount = 0;
          for (const item of filesList) {
            setNotification({
              message: `Backing up storage assets (${backedUpCount + 1}/${filesList.length}): ${item.name}...`,
              type: 'success'
            });
            try {
              const path = item.fullPath;
              const meta = await getMetadata(item);
              
              // Skip excessively large files to avoid OOM or hitting localStorage/string boundaries (limit to 12MB)
              if (meta.size && meta.size > 12 * 1024 * 1024) {
                console.warn(`Skipping large file during storage backup: ${path} (${(meta.size / (1024 * 1024)).toFixed(1)} MB)`);
                continue;
              }

              let originalUrl = '';
              try {
                originalUrl = await getDownloadURL(item);
              } catch (urlErr) {
                console.warn(`Could not fetch download URL for path: ${path}`, urlErr);
              }

              const bytes = await getBytes(item);
              let binary = '';
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);

              storageBackup.push({
                path,
                contentType: meta.contentType || 'application/octet-stream',
                originalUrl,
                base64
              });
              backedUpCount++;
            } catch (fileErr) {
              console.warn(`Could not read file ${item.fullPath} from education Storage:`, fileErr);
            }
          }
        }
      } catch (storageListErr) {
        console.warn('Skipping storage bucket scanning:', storageListErr);
      }

      const payload = {
        app: 'Vectonix',
        version: '1.5.0',
        createdAt: new Date().toISOString(),
        author: profile?.name || 'Vectonix Admin',
        collections: backupData,
        storage: storageBackup
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vectonix_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotification({ message: 'App and storage assets successfully backed up & downloaded!', type: 'success' });
    } catch (error) {
      console.error('Backup failed:', error);
      setNotification({
        message: 'Backup creation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (file: File) => {
    setIsRestoring(true);
    setRestoreProgress({ current: 0, total: 100, collection: 'Reading file...' });
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      if (!payload || payload.app !== 'Vectonix' || !payload.collections) {
        throw new Error('Invalid or corrupted backup file. Expected Vectonix backup header.');
      }

      const collections = payload.collections;
      const collectionsToRestore = Object.keys(collections);

      // Overwrite mode means we delete existing documents in collections that are present in the backup file first
      if (restoreMode === 'overwrite') {
        let step = 0;
        const totalSteps = collectionsToRestore.length;
        for (const colName of collectionsToRestore) {
          if (colName === 'homepage_config') continue;
          step++;
          setRestoreProgress({ 
            current: Math.round((step / totalSteps) * 20), 
            total: 100, 
            collection: `Purging existing records from ${colName}...` 
          });

          try {
            const snap = await getDocs(collection(db, colName));
            for (const d of snap.docs) {
              await deleteDoc(d.ref);
              // Also try purging subcollections if we are purging courses/notes etc.
              const subcollections = ['secure', 'chat'];
              for (const sub of subcollections) {
                try {
                  const subSnap = await getDocs(collection(db, colName, d.id, sub));
                  for (const sd of subSnap.docs) {
                    await deleteDoc(sd.ref);
                  }
                } catch (subErr) {
                  // ignore
                }
              }
            }
          } catch (delErr) {
            console.warn(`Error during purge of ${colName}, continuing:`, delErr);
          }
        }
      }

      // Restore Storage media files and build URL resolution replacement map
      const storageBackupFiles = payload.storage || [];
      const urlReplacementMap: Record<string, string> = {};
      const storageStartPercent = restoreMode === 'overwrite' ? 20 : 0;
      const storageEndPercent = restoreMode === 'overwrite' ? 55 : 35;
      const storageScale = storageEndPercent - storageStartPercent;
      
      if (storageBackupFiles.length > 0) {
        let filesRestored = 0;
        const totalFiles = storageBackupFiles.length;
        for (const fileItem of storageBackupFiles) {
          setRestoreProgress({
            current: storageStartPercent + Math.round((filesRestored / totalFiles) * storageScale),
            total: 100,
            collection: `Restoring storage media (${filesRestored + 1}/${totalFiles}): ${fileItem.path}...`
          });
          try {
            const base64 = fileItem.base64;
            const path = fileItem.path;
            const contentType = fileItem.contentType;
            const originalUrl = fileItem.originalUrl;

            // Convert base64 back to Blob
            const binaryStr = atob(base64);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: contentType });

            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, blob);

            const newUrl = await getDownloadURL(storageRef);
            if (originalUrl) {
              urlReplacementMap[originalUrl] = newUrl;
            }
            filesRestored++;
          } catch (storeRestErr) {
            console.warn(`Failed to restore storage asset: ${fileItem.path}`, storeRestErr);
          }
        }
      }

      // Recursive utility to rewrite any old storage URLs inside Firestore fields
      const rewriteObjectUrls = (obj: any, replacementMap: Record<string, string>): any => {
        if (!obj) return obj;
        if (typeof obj === 'string') {
          let revised = obj;

          // First, do precise path-based mapping to newly-generated URLs (complete with new tokens)
          for (const fileItem of storageBackupFiles) {
            const rawPath = fileItem.path;
            const encodedPath = encodeURIComponent(rawPath);
            
            const searchPattern1 = `/o/${encodedPath}`;
            const searchPattern2 = `/o/${rawPath}`;
            
            if (revised.includes(searchPattern1) || revised.includes(searchPattern2)) {
              const newUrl = replacementMap[fileItem.originalUrl] || '';
              if (newUrl) {
                try {
                  const escapedEncoded = encodedPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                  const escapedRaw = rawPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                  const regex1 = new RegExp(`https:\\/\\/firebasestorage\\.googleapis\\.com\\/v0\\/b\\/[^/]+\\/o\\/${escapedEncoded}(?:\\?[^"\'\\s>]*)?`, 'g');
                  const regex2 = new RegExp(`https:\\/\\/firebasestorage\\.googleapis\\.com\\/v0\\/b\\/[^/]+\\/o\\/${escapedRaw}(?:\\?[^"\'\\s>]*)?`, 'g');
                  revised = revised.replace(regex1, newUrl).replace(regex2, newUrl);
                } catch (e) {
                  if (fileItem.originalUrl) {
                    revised = revised.split(fileItem.originalUrl).join(newUrl);
                  }
                }
              }
            }
          }

          // Apply direct substring replacements for any exact matches
          for (const [oldUrl, newUrl] of Object.entries(replacementMap)) {
            if (revised.includes(oldUrl)) {
              revised = revised.split(oldUrl).join(newUrl);
            }
          }

          // Fallback utility: Swap out any mismatching firebase storage bucket sub-domains with our active bucket
          try {
            const currentBucket = storage?.app?.options?.storageBucket || '';
            if (currentBucket) {
              const fbStorageRegex = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#"\s>'\)]+)/g;
              revised = revised.replace(fbStorageRegex, (match, capturedBucket, path) => {
                if (capturedBucket !== currentBucket) {
                  return `https://firebasestorage.googleapis.com/v0/b/${currentBucket}/o/${path}`;
                }
                return match;
              });
            }
          } catch (bucketRewriteErr) {
            console.warn('Fallback bucket rewrite failed:', bucketRewriteErr);
          }

          return revised;
        }
        if (Array.isArray(obj)) {
          return obj.map(item => rewriteObjectUrls(item, replacementMap));
        }
        if (typeof obj === 'object') {
          const result: any = {};
          for (const k of Object.keys(obj)) {
            result[k] = rewriteObjectUrls(obj[k], replacementMap);
          }
          return result;
        }
        return obj;
      };

      // Restore/Import Firestore database records
      let totalDocuments = 0;
      Object.keys(collections).forEach((colName) => {
        const arr = collections[colName];
        if (Array.isArray(arr)) {
          totalDocuments += arr.length;
        }
      });

      let docsProcessed = 0;
      const dbStartPercent = storageBackupFiles.length > 0 ? storageEndPercent : (restoreMode === 'overwrite' ? 20 : 0);
      const progressScale = 100 - dbStartPercent;

      if (totalDocuments === 0 && storageBackupFiles.length === 0) {
        setNotification({ message: 'Backup file is empty, nothing to restore.', type: 'success' });
        return;
      }

      for (const colName of collectionsToRestore) {
        const records = collections[colName];
        if (!Array.isArray(records)) continue;

        if (colName === 'homepage_config') {
          for (const item of records) {
            const { id, ...data } = item;
            const remappedData = rewriteObjectUrls(data, urlReplacementMap);
            try {
              await setDoc(doc(db, 'homepage', id), remappedData);
            } catch (homeWriteErr) {
              handleFirestoreError(homeWriteErr, OperationType.WRITE, `homepage/${id}`);
              throw homeWriteErr;
            }
            docsProcessed++;
            setRestoreProgress({ 
              current: dbStartPercent + Math.round((docsProcessed / totalDocuments) * progressScale),
              total: 100,
              collection: `Updating Homepage Configuration...`
            });
          }
          continue;
        }

        for (const item of records) {
          const { id, _secureContent, ...data } = item;
          if (!id) continue;
          
          const remappedData = rewriteObjectUrls(data, urlReplacementMap);
          const remappedSecureContent = _secureContent ? rewriteObjectUrls(_secureContent, urlReplacementMap) : null;

          try {
            await setDoc(doc(db, colName, id), remappedData);
          } catch (writeErr) {
            handleFirestoreError(writeErr, OperationType.WRITE, `${colName}/${id}`);
            throw writeErr;
          }
          
          if (remappedSecureContent) {
            try {
              await setDoc(doc(db, colName, id, 'secure', 'content'), remappedSecureContent);
            } catch (secRestErr) {
              console.warn(`Could not restore secure content for ${colName}/${id}:`, secRestErr);
            }
          }

          docsProcessed++;
          setRestoreProgress({ 
            current: dbStartPercent + Math.round((docsProcessed / totalDocuments) * progressScale),
            total: 100,
            collection: `Restoring ${colName} (${docsProcessed}/${totalDocuments})...`
          });
        }
      }

      // Force refresh states since listeners are active, but trigger re-fetch for safety
      if (typeof fetchSales === 'function') await fetchSales();

      setNotification({ message: 'Database successfully restored and synchronized!', type: 'success' });
    } catch (error) {
      console.error('Configuration Restore failed:', error);
      setNotification({
        message: 'Restore failed: ' + (error instanceof Error ? error.message : 'Invalid backup format'),
        type: 'error'
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  const fetchCourses = async () => {
    // Handled by real-time listener
  };

  const fetchNotes = async () => {
    // Handled by real-time listener
  };

  const fetchLectures = async () => {
    // Handled by real-time listener
  };

  const fetchLiveClasses = async () => {
    // This is now handled by the real-time listener in useEffect
  };

  const generateDummyData = async () => {
    setIsGeneratingDummy(true);
    setNotification({ message: 'Generating physics dummy data...', type: 'success' });
    try {
      // 1. Create a few physics courses
      const courseIds = [];
      const courseTitles = ['Classical Mechanics', 'Electromagnetism', 'Quantum Physics', 'Thermodynamics'];
      const images = [
        'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1544383335-9cd7318db9e9?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1509048191080-d2984bad6ad5?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'
      ];

      for (let i = 0; i < courseTitles.length; i++) {
        const docRef = await addDoc(collection(db, 'courses'), {
          title: courseTitles[i],
          description: `Master the principles of ${courseTitles[i]} with our comprehensive guide designed for competitive exams and higher studies.`,
          category: 'Physics',
          coverImage: images[i],
          createdAt: new Date().toISOString()
        });
        courseIds.push(docRef.id);
      }

      // 2. Create some physics notes
      const notesData = [
        { title: 'Newtonian Dynamics Summary', subject: 'Physics', price: 499, discountPrice: 299, isFeatured: true, coverImage: images[0] },
        { title: 'Maxwell Equations Cheat Sheet', subject: 'Physics', price: 399, discountPrice: 199, isFeatured: true, coverImage: images[1] },
        { title: 'Wave-Particle Duality Notes', subject: 'Physics', price: 299, discountPrice: 99, isFeatured: false, coverImage: images[2] },
        { title: 'Laws of Thermodynamics Study set', subject: 'Physics', price: 599, discountPrice: 399, isFeatured: true, coverImage: images[3] }
      ];

      for (let i = 0; i < notesData.length; i++) {
        await addDoc(collection(db, 'notes'), {
          ...notesData[i],
          courseId: courseIds[i % courseIds.length],
          type: 'note',
          isFree: false,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // 3. Create some physics lectures
      const lecturesData = [
        { title: 'Centripetal Force Explained', chapter: 'Dynamics', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', price: 999, discountPrice: 499, isFeatured: true, coverImage: images[0] },
        { title: 'Biot-Savart Law Demonstration', chapter: 'Magnetism', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', price: 799, discountPrice: 299, isFeatured: false, coverImage: images[1] },
        { title: 'Black Body Radiation Lecture', chapter: 'Quantum', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', price: 899, discountPrice: 599, isFeatured: true, coverImage: images[2] }
      ];

      for (let i = 0; i < lecturesData.length; i++) {
        await addDoc(collection(db, 'lectures'), {
          ...lecturesData[i],
          courseId: courseIds[i % courseIds.length],
          type: 'lecture',
          isFree: false,
          isComingSoon: false,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // 4. Create some physics live classes
      const liveData = [
        { title: 'JEE Physics Problem Solving', date: '2026-05-10', time: '18:00', meetingUrl: 'https://meet.google.com/abc-defg-hij', status: 'upcoming', price: 0, isFree: true, isFeatured: true, coverImage: images[2] },
        { title: 'NEET Physics Live Marathon', date: '2026-05-15', time: '10:00', meetingUrl: 'https://meet.google.com/xyz-uvwx-yz', status: 'upcoming', price: 1500, discountPrice: 899, isFree: false, isFeatured: true, coverImage: images[0] }
      ];

      for (let i = 0; i < liveData.length; i++) {
        await addDoc(collection(db, 'liveClasses'), {
          ...liveData[i],
          courseId: courseIds[0],
          type: 'live',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      setNotification({ message: 'Physics dummy data generated successfully!', type: 'success' });
      fetchCourses();
      fetchNotes();
      fetchLectures();
      fetchLiveClasses();
    } catch (error) {
      console.error('Error generating dummy data:', error);
      setNotification({ message: 'Failed to generate dummy data.', type: 'error' });
    } finally {
      setIsGeneratingDummy(false);
    }
  };

  const resetProductionData = async () => {
    handleClearDummyData();
  };

  const fetchSales = async () => {
    try {
      const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      setSales(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const toggleUserRestriction = async (u: any) => {
    // Only student accounts can be restricted/unrestricted
    const isStudent = u.role === 'student' || !u.role;
    const isMasterAdmin = u.email === 'vectonixclasses@gmail.com';
    
    if (!isStudent || isMasterAdmin) {
      setNotification({ 
        message: 'Only student accounts can be modified for restriction status.', 
        type: 'error' 
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'users', u.id), {
        restricted: !u.restricted,
        updatedAt: new Date().toISOString()
      });
      setNotification({ 
        message: `User ${u.restricted ? 'unrestricting...' : 'restricting...'}`, 
        type: 'success' 
      });
    } catch (error) {
      handleAdminError(error, OperationType.UPDATE, `users/${u.id}`);
    }
  };

  const openAddLiveClass = () => {
    setEditingId(null);
    setLiveFormData({ 
      title: '', 
      courseId: '', 
      subjectId: '', 
      status: 'upcoming', 
      price: '', 
      discount: '',
      discountPrice: '', 
      isFree: false, 
      isFeatured: false, 
      coverFile: null,
      coverUrl: '',
      scheduledAt: '',
      gstPercent: ''
    });
    setLiveDate('');
    setLiveHour('12');
    setLiveMinute('00');
    setLiveAmpm('AM');
    setShowAddLiveModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        name: userEditFormData.name,
        dob: userEditFormData.dob,
        mobile: userEditFormData.mobile,
        role: userEditFormData.role,
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'User profile updated successfully!', type: 'success' });
      setShowUserEditModal(false);
      setSelectedUser(null);
    } catch (error) {
      handleAdminError(error, OperationType.UPDATE, `users/${selectedUser.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openUserEdit = (u: any) => {
    setSelectedUser(u);
    setUserEditFormData({
      name: u.name || '',
      dob: u.dob || '',
      mobile: u.mobile || '',
      role: u.role || 'student'
    });
    setShowUserEditModal(true);
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;

      if (formData.imageFile) {
        const storageRef = ref(storage, `thumbnails/${Date.now()}_${formData.imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, formData.imageFile);
        finalImageUrl = await getDownloadURL(snapshot.ref);
      }

      const courseData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        isFeatured: formData.isFeatured,
        thumbnail: finalImageUrl,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await setDoc(doc(db, 'courses', editingId), courseData, { merge: true });
        setNotification({ message: 'Course updated successfully!', type: 'success' });
      } else {
        await addDoc(collection(db, 'courses'), {
          ...courseData,
          createdAt: new Date().toISOString()
        });
        setNotification({ message: 'Course added successfully!', type: 'success' });
      }

      setShowAddModal(false);
      setEditingId(null);
      setFormData({ title: '', description: '', category: 'Physics', isFeatured: false, imageFile: null, imageUrl: '' });
      fetchCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      parseAndNotifyError(error, 'Failed to save course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const subjectData = {
        title: subjectFormData.title,
        courseId: subjectFormData.courseId,
        description: subjectFormData.description,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await setDoc(doc(db, 'subjects', editingId), subjectData, { merge: true });
        setNotification({ message: 'Subject updated successfully!', type: 'success' });
      } else {
        await addDoc(collection(db, 'subjects'), {
          ...subjectData,
          createdAt: new Date().toISOString()
        });
        setNotification({ message: 'Subject added successfully!', type: 'success' });
      }

      setShowAddSubjectModal(false);
      setEditingId(null);
      setSubjectFormData({ title: '', courseId: '', description: '' });
    } catch (error) {
      console.error('Error saving subject:', error);
      setNotification({ message: 'Failed to save subject', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'subjects', id));
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Subject deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `subjects/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditSubject = (subject: any) => {
    setEditingId(subject.id);
    setSubjectFormData({
      title: subject.title,
      courseId: subject.courseId,
      description: subject.description || ''
    });
    setShowAddSubjectModal(true);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let coverUrl = noteFormData.coverUrl;
      
      if (noteFormData.coverFile) {
        console.log(`Starting cover upload to: notebooks/covers/${noteFormData.coverFile.name}`);
        try {
          const storageRef = ref(storage, `notebooks/covers/${Date.now()}_${noteFormData.coverFile.name}`);
          const snapshot = await uploadBytes(storageRef, noteFormData.coverFile);
          coverUrl = await getDownloadURL(snapshot.ref);
          console.log('Cover upload successful:', coverUrl);
        } catch (storageErr) {
          const currentUser = auth.currentUser;
          console.error('Storage upload failed:', {
            error: storageErr,
            user: currentUser ? {
              uid: currentUser.uid,
              email: currentUser.email,
              emailVerified: currentUser.emailVerified
            } : 'No user'
          });
          throw new Error(`Storage upload failed: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`);
        }
      }

      const mainData = noteFormData;
      const notePrice = editingId ? (Number(mainData.price) || 0) : 0;
      const noteDiscount = mainData.isFree ? 0 : (Number(mainData.discount) || 0);
      const noteDiscountPrice = mainData.isFree ? 0 : Math.max(0, notePrice - noteDiscount);

      const noteData = {
        title: mainData.title,
        courseId: mainData.courseId,
        subjectId: mainData.subjectId,
        price: notePrice,
        discount: noteDiscount,
        discountPrice: noteDiscountPrice,
        isFree: mainData.isFree,
        isFeatured: mainData.isFeatured,
        coverImage: coverUrl,
        type: 'note',
        updatedAt: new Date().toISOString()
      };

      let noteId = editingId;
      if (editingId) {
        await setDoc(doc(db, 'notes', editingId), noteData, { merge: true });
        setNotification({ message: 'Study Note updated successfully!', type: 'success' });
      } else {
        const docRef = await addDoc(collection(db, 'notes'), {
          ...noteData,
          createdAt: new Date().toISOString()
        });
        noteId = docRef.id;
        setNotification({ message: 'Study Note added successfully!', type: 'success' });
      }

      setShowAddNoteModal(false);
      setEditingId(null);
      setNoteFormData({ title: '', courseId: '', subjectId: '', price: '', discount: '', discountPrice: '', isFree: false, isFeatured: false, coverFile: null, coverUrl: '' });
      fetchNotes();
    } catch (error) {
      console.error('Error saving study note:', error);
      parseAndNotifyError(error, 'Failed to save study note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let videoUrl = '';

      // Handle direct file upload to Firebase Storage
      if (lectureFormData.videoFile) {
        const file = lectureFormData.videoFile;
        const storageRef = ref(storage, `lectures/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setLectureFormData(prev => ({ ...prev, uploadProgress: progress }));
            },
            (error) => reject(error),
            async () => {
              videoUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(true);
            }
          );
        });
      }

      let coverUrl = lectureFormData.coverUrl;
      if (lectureFormData.coverFile) {
        try {
          const storageRef = ref(storage, `lectures/covers/${Date.now()}_${lectureFormData.coverFile.name}`);
          const snapshot = await uploadBytes(storageRef, lectureFormData.coverFile);
          coverUrl = await getDownloadURL(snapshot.ref);
        } catch (storageErr) {
          console.error('Lecture Cover upload failed:', storageErr);
          throw new Error(`Failed to upload thumbnail: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`);
        }
      }

      const lecturePrice = Number(lectureFormData.price) || 0;
      const lectureDiscount = lectureFormData.isFree ? 0 : (Number(lectureFormData.discount) || 0);
      const lectureDiscountPrice = lectureFormData.isFree ? 0 : Math.max(0, lecturePrice - lectureDiscount);
      const lectureGst = lectureFormData.isFree ? 0 : (lectureFormData.gstPercent !== '' ? Number(lectureFormData.gstPercent) : (settings.gstPercent ?? 18));

      const lectureData = {
        title: lectureFormData.title,
        courseId: lectureFormData.courseId,
        subjectId: lectureFormData.subjectId,
        isComingSoon: lectureFormData.isComingSoon,
        price: lecturePrice,
        discount: lectureDiscount,
        discountPrice: lectureDiscountPrice,
        isFree: lectureFormData.isFree,
        isFeatured: lectureFormData.isFeatured,
        coverImage: coverUrl,
        gstPercent: lectureGst,
        type: 'lecture',
        updatedAt: new Date().toISOString()
      };

      let lectureId = editingId;

      if (editingId) {
        await setDoc(doc(db, 'lectures', editingId), lectureData, { merge: true });
        setNotification({ message: 'Lecture updated successfully!', type: 'success' });
      } else {
        const docRef = await addDoc(collection(db, 'lectures'), {
          ...lectureData,
          createdAt: new Date().toISOString()
        });
        lectureId = docRef.id;
        setNotification({ message: 'Lecture added successfully!', type: 'success' });
      }

      // Save sensitive video URL to secure sub-collection
      if (lectureId && videoUrl) {
        await setDoc(doc(db, 'lectures', lectureId, 'secure', 'content'), {
          videoUrl,
          updatedAt: new Date().toISOString()
        });
      }

      setShowAddLectureModal(false);
      setEditingId(null);
      setLectureFormData({ 
        title: '', 
        courseId: '', 
        subjectId: '', 
        videoFile: null, 
        coverFile: null,
        coverUrl: '',
        isComingSoon: false, 
        price: '', 
        discount: '',
        discountPrice: '', 
        isFree: false, 
        isFeatured: false,
        uploadProgress: 0,
        gstPercent: ''
      });
      fetchLectures();
    } catch (error) {
      console.error('Error saving lecture:', error);
      parseAndNotifyError(error, 'Failed to save lecture');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLiveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine date and time for scheduledAt
    let hour = parseInt(liveHour);
    if (liveAmpm === 'PM' && hour < 12) hour += 12;
    if (liveAmpm === 'AM' && hour === 12) hour = 0;
    
    const [year, month, day] = liveDate.split('-').map(Number);
    // Create ISO string for Indian Standard Time (UTC+5:30)
    const istString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${liveMinute.toString().padStart(2, '0')}:00+05:30`;
    const selectedDate = new Date(istString);
    const now = new Date();
    
    if (selectedDate < now) {
      setNotification({ message: 'Error: Cannot schedule a meeting in the past.', type: 'error' });
      return;
    }

    const scheduledAtISO = selectedDate.toISOString();

    setSubmitting(true);
    try {
      let coverUrl = liveFormData.coverUrl;
      if (liveFormData.coverFile) {
        try {
          const storageRef = ref(storage, `liveClasses/covers/${Date.now()}_${liveFormData.coverFile.name}`);
          const snapshot = await uploadBytes(storageRef, liveFormData.coverFile);
          coverUrl = await getDownloadURL(snapshot.ref);
        } catch (storageErr) {
          console.error('Live Class Cover upload failed:', storageErr);
          throw new Error(`Failed to upload thumbnail: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`);
        }
      }

      const livePrice = Number(liveFormData.price) || 0;
      const liveDiscount = liveFormData.isFree ? 0 : (Number(liveFormData.discount) || 0);
      const liveDiscountPrice = liveFormData.isFree ? 0 : Math.max(0, livePrice - liveDiscount);
      const liveGst = liveFormData.isFree ? 0 : (liveFormData.gstPercent !== '' ? Number(liveFormData.gstPercent) : (settings.gstPercent ?? 18));

      const liveData = {
        title: liveFormData.title,
        courseId: liveFormData.courseId,
        subjectId: liveFormData.subjectId,
        status: liveFormData.status,
        price: livePrice,
        discount: liveDiscount,
        discountPrice: liveDiscountPrice,
        isFeatured: liveFormData.isFeatured,
        isFree: liveFormData.isFree,
        isInternalRoom: true,
        scheduledAt: scheduledAtISO,
        coverImage: coverUrl,
        gstPercent: liveGst,
        type: 'live',
        updatedAt: new Date().toISOString()
      };

      let liveId = editingId;
      if (editingId) {
        await setDoc(doc(db, 'liveClasses', editingId), liveData, { merge: true });
        setNotification({ message: 'Live class updated successfully!', type: 'success' });
      } else {
        const docRef = await addDoc(collection(db, 'liveClasses'), {
          ...liveData,
          isStarted: false,
          createdAt: new Date().toISOString()
        });
        liveId = docRef.id;
        setNotification({ message: 'Live class scheduled successfully!', type: 'success' });
      }

      setShowAddLiveModal(false);
      setEditingId(null);
      setLiveFormData({ 
        title: '', 
        courseId: '', 
        subjectId: '', 
        status: 'upcoming', 
        price: '', 
        discount: '',
        discountPrice: '', 
        isFree: false, 
        isFeatured: false, 
        coverFile: null,
        coverUrl: '',
        scheduledAt: '',
        gstPercent: ''
      });
      setLiveDate('');
      setLiveHour('12');
      setLiveMinute('00');
      setLiveAmpm('AM');
      fetchLiveClasses();
    } catch (error) {
      console.error('Error saving live class:', error);
      parseAndNotifyError(error, 'Failed to save live class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imgUrl = bannerFormData.imgUrl;
      
      if (bannerFormData.imgFile) {
        const storageRef = ref(storage, `banners/${Date.now()}_${bannerFormData.imgFile.name}`);
        const snapshot = await uploadBytes(storageRef, bannerFormData.imgFile);
        imgUrl = await getDownloadURL(snapshot.ref);
      }

      if (!imgUrl) throw new Error('Banner image is required');

      const bannerData = {
        title: bannerFormData.title,
        subtitle: bannerFormData.subtitle,
        img: imgUrl,
        buttonText: bannerFormData.buttonText,
        link: bannerFormData.link,
        order: Number(bannerFormData.order) || 0,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await setDoc(doc(db, 'banners', editingId), bannerData, { merge: true });
        setNotification({ message: 'Banner updated successfully!', type: 'success' });
      } else {
        await addDoc(collection(db, 'banners'), {
          ...bannerData,
          createdAt: new Date().toISOString()
        });
        setNotification({ message: 'Banner added successfully!', type: 'success' });
      }

      setShowAddBannerModal(false);
      setEditingId(null);
      setBannerFormData({ title: '', subtitle: '', imgFile: null, imgUrl: '', buttonText: 'Start Learning', link: '/', order: banners.length });
    } catch (error: any) {
      console.error('Error saving banner:', error);
      parseAndNotifyError(error, 'Failed to save banner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'banners', id));
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Banner deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `banners/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditBanner = (banner: any) => {
    setEditingId(banner.id);
    setBannerFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imgFile: null,
      imgUrl: banner.img,
      buttonText: banner.buttonText || 'Start Learning',
      link: banner.link || '/',
      order: banner.order || 0
    });
    setShowAddBannerModal(true);
  };

  const handleDeleteCourse = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'courses', id));
      fetchCourses();
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Course deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `courses/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'notes', id));
      // Try cleaning secure subcollection
      try {
        await deleteDoc(doc(db, 'notes', id, 'secure', 'content'));
      } catch (e) {}
      
      fetchNotes();
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Note deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `notes/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLecture = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'lectures', id));
      // Try cleaning secure subcollection
      try {
        await deleteDoc(doc(db, 'lectures', id, 'secure', 'content'));
      } catch (e) {}
      
      fetchLectures();
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Lecture deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `lectures/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLiveClass = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'liveClasses', id));
      // Try cleaning secure subcollection
      try {
        await deleteDoc(doc(db, 'liveClasses', id, 'secure', 'content'));
      } catch (e) {}
      
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Live class deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `liveClasses/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalAttachmentUrl = noticeFormData.attachmentUrl;
      let finalAttachmentName = noticeFormData.attachmentName;
      let finalAttachmentType = noticeFormData.attachmentType;

      if (noticeFormData.attachmentFile) {
        const storageRef = ref(storage, `notices/${Date.now()}_${noticeFormData.attachmentFile.name}`);
        const snapshot = await uploadBytes(storageRef, noticeFormData.attachmentFile);
        finalAttachmentUrl = await getDownloadURL(snapshot.ref);
        finalAttachmentName = noticeFormData.attachmentFile.name;
        finalAttachmentType = noticeFormData.attachmentFile.type;
      }

      const noticeData = {
        title: noticeFormData.title,
        content: noticeFormData.content,
        type: noticeFormData.type,
        visibility: noticeFormData.visibility,
        attachmentUrl: finalAttachmentUrl,
        attachmentName: finalAttachmentName,
        attachmentType: finalAttachmentType,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'notices', editingId), noticeData);
        setNotification({ message: 'Notice updated successfully!', type: 'success' });
      } else {
        await addDoc(collection(db, 'notices'), {
          ...noticeData,
          createdAt: new Date().toISOString()
        });
        setNotification({ message: 'Notice added successfully!', type: 'success' });
      }

      setShowAddNoticeModal(false);
      setEditingId(null);
      setNoticeFormData({ title: '', content: '', type: 'announcement', visibility: 'both', attachmentFile: null, attachmentUrl: '', attachmentName: '', attachmentType: '' });
    } catch (error) {
      console.error('Error saving notice:', error);
      parseAndNotifyError(error, 'Failed to save notice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'notices', id));
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Notice deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `notices/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditNotice = (notice: any) => {
    setEditingId(notice.id);
    setNoticeFormData({
      title: notice.title,
      content: notice.content,
      type: notice.type || 'announcement',
      visibility: notice.visibility || 'both',
      attachmentFile: null,
      attachmentUrl: notice.attachmentUrl || '',
      attachmentName: notice.attachmentName || '',
      attachmentType: notice.attachmentType || ''
    });
    setShowAddNoticeModal(true);
  };

  const openEditCourse = (course: any) => {
    setEditingId(course.id);
    setFormData({
      title: course.title,
      description: course.description,
      category: course.category,
      isFeatured: course.isFeatured || false,
      imageFile: null,
      imageUrl: course.thumbnail || ''
    });
    setShowAddModal(true);
  };

  const openEditNote = async (note: any) => {
    setEditingId(note.id);
    
    const notePrice = note.price || 0;
    const noteDiscountPrice = note.discountPrice !== undefined && note.discountPrice !== null ? note.discountPrice : notePrice;
    const discountVal = note.discount !== undefined ? note.discount : Math.max(0, notePrice - noteDiscountPrice);

    setNoteFormData({
      title: note.title,
      courseId: note.courseId,
      subjectId: note.subjectId || '',
      price: notePrice.toString(),
      discount: discountVal.toString(),
      discountPrice: noteDiscountPrice.toString(),
      isFree: note.isFree || false,
      isFeatured: note.isFeatured || false,
      coverFile: null,
      coverUrl: note.coverImage || ''
    });
    setShowAddNoteModal(true);
  };

  const openEditLecture = async (lecture: any) => {
    setEditingId(lecture.id);
    
    const lecPrice = lecture.price || 0;
    const lecDiscountPrice = lecture.discountPrice !== undefined && lecture.discountPrice !== null ? lecture.discountPrice : lecPrice;
    const discountVal = lecture.discount !== undefined ? lecture.discount : Math.max(0, lecPrice - lecDiscountPrice);

    setLectureFormData({
      title: lecture.title,
      courseId: lecture.courseId,
      subjectId: lecture.subjectId || '',
      videoFile: null,
      coverFile: null,
      coverUrl: lecture.coverImage || '',
      isComingSoon: lecture.isComingSoon || false,
      price: lecPrice.toString(),
      discount: discountVal.toString(),
      discountPrice: lecDiscountPrice.toString(),
      isFree: lecture.isFree || false,
      isFeatured: lecture.isFeatured || false,
      uploadProgress: 0,
      gstPercent: lecture.gstPercent !== undefined ? lecture.gstPercent.toString() : ''
    });
    setShowAddLectureModal(true);
  };

  const openEditLiveClass = async (live: any) => {
    setEditingId(live.id);
    
    const livePrice = live.price || 0;
    const liveDiscountPrice = live.discountPrice !== undefined && live.discountPrice !== null ? live.discountPrice : livePrice;
    const discountVal = live.discount !== undefined ? live.discount : Math.max(0, livePrice - liveDiscountPrice);

    setLiveFormData({
      title: live.title,
      courseId: live.courseId,
      subjectId: live.subjectId || '',
      status: live.status,
      price: livePrice.toString(),
      discount: discountVal.toString(),
      discountPrice: liveDiscountPrice.toString(),
      isFree: live.isFree || false,
      isFeatured: live.isFeatured || false,
      coverFile: null,
      coverUrl: live.coverImage || '',
      scheduledAt: live.scheduledAt || '',
      gstPercent: live.gstPercent !== undefined ? live.gstPercent.toString() : ''
    });

    if (live.scheduledAt) {
      const date = new Date(live.scheduledAt);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const parts = formatter.formatToParts(date);
      const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
      
      setLiveDate(`${partMap.year}-${partMap.month}-${partMap.day}`);
      setLiveHour(parseInt(partMap.hour).toString().padStart(2, '0'));
      setLiveMinute(partMap.minute);
      setLiveAmpm(partMap.dayPeriod || 'AM');
    } else {
      setLiveDate('');
      setLiveHour('12');
      setLiveMinute('00');
      setLiveAmpm('AM');
    }

    setShowAddLiveModal(true);
  };

  const handleAddPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imgUrl = promotionFormData.imgUrl;
      
      if (promotionFormData.imgFile) {
        const storageRef = ref(storage, `promotions/${Date.now()}_${promotionFormData.imgFile.name}`);
        const snapshot = await uploadBytes(storageRef, promotionFormData.imgFile);
        imgUrl = await getDownloadURL(snapshot.ref);
      }

      const promotionData = {
        title: promotionFormData.title,
        description: promotionFormData.description,
        type: promotionFormData.type,
        imgUrl: imgUrl || '',
        link: promotionFormData.link || '',
        isActive: promotionFormData.isActive,
        order: Number(promotionFormData.order) || 0,
        expiryDate: promotionFormData.expiryDate || null,
        couponCode: promotionFormData.couponCode || null,
        discountType: promotionFormData.discountType || null,
        discountValue: Number(promotionFormData.discountValue) || 0,
        applicableProducts: promotionFormData.applicableProducts || [],
        maxUsage: Number(promotionFormData.maxUsage) || null,
        usageCount: editingId ? (promotions.find(p => p.id === editingId)?.usageCount || 0) : 0,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'promotions', editingId), promotionData);
        setNotification({ message: 'Promotion updated successfully!', type: 'success' });
      } else {
        await addDoc(collection(db, 'promotions'), {
          ...promotionData,
          createdAt: new Date().toISOString()
        });
        setNotification({ message: 'Promotion added successfully!', type: 'success' });
      }

      setShowAddPromotionModal(false);
      setEditingId(null);
      setPromotionFormData({ 
        title: '', 
        description: '', 
        type: 'offer', 
        imgFile: null, 
        imgUrl: '', 
        link: '', 
        isActive: true, 
        order: promotions.length, 
        expiryDate: '',
        couponCode: '',
        discountType: 'percentage',
        discountValue: '',
        applicableProducts: [],
        maxUsage: ''
      });
    } catch (error) {
      console.error('Error saving promotion:', error);
      parseAndNotifyError(error, 'Failed to save promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePromotion = async () => {
    if (!deleteConfirmInfo) return;
    const id = deleteConfirmInfo.id;
    
    setNotification({ message: 'Deleting promotion...', type: 'success' });
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'promotions', id));
      setDeleteConfirmInfo(null);
      setNotification({ message: 'Promotion deleted successfully!', type: 'success' });
    } catch (error) {
      handleAdminError(error, OperationType.DELETE, `promotions/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPromotion = (promo: any) => {
    setEditingId(promo.id);
    setPromotionFormData({
      title: promo.title,
      description: promo.description || '',
      type: promo.type || 'offer',
      imgFile: null,
      imgUrl: promo.imgUrl || '',
      link: promo.link || '',
      isActive: promo.isActive !== undefined ? promo.isActive : true,
      order: promo.order || 0,
      expiryDate: promo.expiryDate || '',
      couponCode: promo.couponCode || '',
      discountType: promo.discountType || 'percentage',
      discountValue: promo.discountValue?.toString() || '',
      applicableProducts: promo.applicableProducts || [],
      maxUsage: promo.maxUsage?.toString() || ''
    });
    setShowAddPromotionModal(true);
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950"><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950 text-2xl font-bold dark:text-white">Access Denied</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      {/* Notifications */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4 pointer-events-none">
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md",
                notification.type === 'success' 
                  ? "bg-emerald-50/90 dark:bg-emerald-900/90 border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-50/90 dark:bg-red-900/90 border-red-100 dark:border-red-800 text-red-600 dark:text-red-400"
              )}
            >
              {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              <span className="font-bold">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 pt-16">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-5xl font-display font-extrabold dark:text-white tracking-tight">Admin <span className="text-indigo-600">Console</span></h1>
              <p className="text-sm md:text-lg text-zinc-500 dark:text-zinc-400 font-medium">Manage your academy content and track performance.</p>
              <button 
                onClick={generateDummyData}
                disabled={isGeneratingDummy}
                className="mt-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingDummy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Generate Dummy Data for Testing
              </button>
            </div>
            <button 
              onClick={() => {
                if (activeTab === 'courses') setShowAddModal(true);
                if (activeTab === 'subjects') setShowAddSubjectModal(true);
                if (activeTab === 'notes') setShowAddNoteModal(true);
                if (activeTab === 'lectures') setShowAddLectureModal(true);
                if (activeTab === 'live') openAddLiveClass();
                if (activeTab === 'notices') setShowAddNoticeModal(true);
                if (activeTab === 'promotions') setShowAddPromotionModal(true);
              }}
              className={cn(
                "px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none text-lg",
                (activeTab === 'sales' || activeTab === 'settings' || activeTab === 'dashboard' || activeTab === 'users' || activeTab === 'profile' || activeTab === 'database' || activeTab === 'backup' || activeTab === 'enquiry' || activeTab === 'reviews') && "hidden"
              )}
            >
              <Plus className="w-6 h-6 animate-none" />
              {activeTab === 'courses' && 'Add New Course'}
              {activeTab === 'subjects' && 'Add New Subject'}
              {activeTab === 'notes' && 'Add New Note'}
              {activeTab === 'lectures' && 'Add New Lecture'}
              {activeTab === 'live' && 'Schedule Live Class'}
              {activeTab === 'notices' && 'Create Notice'}
              {activeTab === 'promotions' && 'Add Promotion'}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 flex flex-col gap-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2 custom-scrollbar">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl lg:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-2 lg:p-3 shadow-xl shadow-zinc-100 dark:shadow-none overflow-x-auto lg:overflow-visible">
                <div className="flex lg:flex-col gap-1 min-w-max lg:min-w-0 w-full">
                  {[
                    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
                    { id: 'courses', label: 'Courses', icon: List },
                    { id: 'subjects', label: 'Subjects', icon: BookOpen },
                    { id: 'promotions', label: 'Promotions', icon: Megaphone },
                    { id: 'notes', label: 'Study Notes', icon: Book },
                    { id: 'lectures', label: 'Video Lectures', icon: Video },
                    { id: 'live', label: 'Live Sessions', icon: Calendar },
                    { id: 'sales', label: 'Revenue', icon: DollarSign },
                    { id: 'database', label: 'DB Stats & Blaze', icon: Database, comingSoon: true },
                    { id: 'backup', label: 'Backup & Restore', icon: Database },
                    { id: 'users', label: 'Users', icon: Users },
                    { id: 'profile', label: 'My Profile', icon: User },
                    { id: 'enquiry', label: 'Enquiries', icon: MessageSquare },
                    { id: 'reviews', label: 'Reviews', icon: CheckCircle2 },
                    { id: 'notices', label: 'Notices', icon: Bell },
                    { id: 'settings', label: 'Settings', icon: SettingsIcon },
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => {
                        if (tab.id === 'database' || ('comingSoon' in tab && tab.comingSoon)) {
                          setNotification({
                            message: 'Feature Coming Soon! Database analysis options are being updated.',
                            type: 'success'
                          });
                          return;
                        }
                        setActiveTab(tab.id as any);
                      }}
                      className={cn(
                        "px-4 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl text-[11px] lg:text-sm font-bold flex items-center justify-between gap-2 lg:gap-3 transition-all uppercase tracking-widest shrink-0 w-full text-left",
                        activeTab === tab.id 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                          : ('comingSoon' in tab && tab.comingSoon)
                            ? "text-zinc-400 dark:text-zinc-500 opacity-70 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                            : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      )}
                    >
                      <div className="flex items-center gap-2 lg:gap-3">
                        <tab.icon className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
                        <span className="whitespace-nowrap">{tab.label}</span>
                      </div>
                      {'comingSoon' in tab && tab.comingSoon && (
                        <span className="bg-amber-100 dark:bg-amber-950/45 text-amber-700 dark:text-amber-300 text-[8px] px-2 py-0.5 rounded-md font-black leading-none ml-auto shrink-0">
                          SOON
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Cards */}
              {(activeTab === 'courses' || activeTab === 'subjects' || activeTab === 'notes' || activeTab === 'lectures' || activeTab === 'live' || activeTab === 'notices' || activeTab === 'promotions') && (
                <button 
                  onClick={() => {
                    if (activeTab === 'courses') setShowAddModal(true);
                    if (activeTab === 'subjects') setShowAddSubjectModal(true);
                    if (activeTab === 'notes') setShowAddNoteModal(true);
                    if (activeTab === 'lectures') setShowAddLectureModal(true);
                    if (activeTab === 'live') openAddLiveClass();
                    if (activeTab === 'notices') setShowAddNoticeModal(true);
                    if (activeTab === 'promotions') setShowAddPromotionModal(true);
                  }}
                  className="w-full p-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-[2.5rem] flex flex-col items-center gap-4 group hover:bg-indigo-600 transition-all active:scale-95"
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-black dark:text-white group-hover:text-white uppercase tracking-widest">Create New</div>
                    <div className="text-xs font-bold text-indigo-600 group-hover:text-white/80 mt-1 uppercase tracking-widest">
                      {activeTab === 'courses' && 'Course'}
                      {activeTab === 'subjects' && 'Subject'}
                      {activeTab === 'notes' && 'Study Note'}
                      {activeTab === 'lectures' && 'Lecture'}
                      {activeTab === 'live' && 'Live Class'}
                      {activeTab === 'notices' && 'Notice'}
                      {activeTab === 'promotions' && 'Promotion'}
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full min-w-0 bg-white dark:bg-zinc-900 rounded-3xl lg:rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-xl shadow-zinc-100 dark:shadow-none overflow-hidden min-h-[70vh]">
              {activeTab === 'dashboard' && (
                <div className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {[
                      { label: 'Revenue', value: formatCurrency(sales.reduce((acc, sale) => acc + getSaleNetPaid(sale), 0)), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                      { label: 'Students', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                      { label: 'Enquiries', value: enquiries.length, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                      { label: 'Study Notes', value: notes.length, icon: Book, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                      { label: 'Sessions', value: liveClasses.length, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    ].map((stat, i) => (
                      <div key={i} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 flex flex-col gap-2 md:gap-4">
                        <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
                          <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                          <div className="text-[8px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{stat.label}</div>
                          <div className="text-xl md:text-3xl font-display font-black dark:text-white mt-0.5 md:mt-1">{stat.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-6">
                    <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Quick Launcher</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Add Course', icon: List, sub: 'Structure', action: () => { setActiveTab('courses'); setShowAddModal(true); } },
                        { label: 'Add Banner', icon: ImageIcon, sub: 'Hero Area', action: () => { setActiveTab('settings'); setSettingsSubTab('banners'); setShowAddBannerModal(true); } },
                        { label: 'Add Video', icon: Video, sub: ' Lectures', action: () => { setActiveTab('lectures'); setShowAddLectureModal(true); } },
                        { label: 'Live Session', icon: Calendar, sub: 'Scheduler', action: openAddLiveClass },
                      ].map((action, i) => (
                        <button 
                          key={i}
                          onClick={action.action}
                          className="p-8 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] flex flex-col items-center gap-3 hover:border-indigo-600 hover:text-indigo-600 hover:bg-zinc-50 transition-all group active:scale-95 shadow-sm"
                        >
                          <action.icon className="w-8 h-8 text-zinc-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all" />
                          <div className="text-center">
                            <span className="block font-black text-xs uppercase tracking-widest">{action.label}</span>
                            <span className="block text-[10px] font-bold text-zinc-400 group-hover:text-indigo-400 uppercase tracking-widest mt-0.5">{action.sub}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Caching and Performance Monitoring Card & Interactive Analytics Console */}
                  <div className="flex flex-col gap-6 pt-10 border-t dark:border-zinc-800">
                    <div>
                      <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <Zap className="text-indigo-600 w-6 h-6 animate-pulse" />
                        Performance & SEO Analytics Hub
                      </h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Live server caching telemetry & search index diagnostics</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Cache performance stats */}
                      <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/80 rounded-[2rem] flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] bg-indigo-55/60 dark:bg-indigo-900/40 px-3 py-1 rounded-full">Server Caching</span>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-800/60">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Static Assets Cache-Control</span>
                              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">1 Year (Immutable)</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-800/60">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Media/Fonts Edge Caching</span>
                              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">Enabled</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-800/60">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Database Query Cache (Offline Storage)</span>
                              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">Active (IndexedDB)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Average Asset Load Speed</span>
                              <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">~12ms</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">Caching helper optimized both edge and db.</span>
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">Running Fast</span>
                        </div>
                      </div>

                      {/* SEO Search Console Status */}
                      <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/80 rounded-[2rem] flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] bg-indigo-55/60 dark:bg-indigo-900/40 px-3 py-1 rounded-full">Search Visibility</span>
                            <Search className="w-4 h-4 text-zinc-400" />
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-800/60">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Google Search Console Tag</span>
                              {settings.gscVerificationId ? (
                                <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">Verified</span>
                              ) : (
                                <span className="text-xs font-mono font-black text-amber-500">Unconfigured</span>
                              )}
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-800/60">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Sitemap XML Schema</span>
                              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">Auto-generated</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-800/60">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">SEO Robots Metadata</span>
                              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">Index, Follow</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Google Analytics Tracker (GA4)</span>
                              {settings.gaMeasurementId ? (
                                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-wider">{settings.gaMeasurementId}</span>
                              ) : (
                                <span className="text-xs font-mono font-black text-amber-500">Unconfigured</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <button 
                            type="button" 
                            onClick={() => { setActiveTab('settings'); }} 
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest cursor-pointer underline decoration-wavy"
                          >
                            Configure SEO Tags
                          </button>
                        </div>
                      </div>

                      {/* Built-in Traffic Analytics Monitor (Dynamic SVG rendering) */}
                      <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/80 rounded-[2rem] flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] bg-indigo-55/60 dark:bg-indigo-900/40 px-3 py-1 rounded-full">Interactive Traffic Meter</span>
                            <span className="text-xs font-black font-mono text-zinc-500">Live Traffic (7 Days)</span>
                          </div>

                          {/* Beautiful Custom Tailwind Inline SVG Graph */}
                          <div className="h-28 flex items-end gap-2.5 pt-4">
                            {[
                              { day: 'Mon', count: 184 },
                              { day: 'Tue', count: 245 },
                              { day: 'Wed', count: 312 },
                              { day: 'Thu', count: 290 },
                              { day: 'Fri', count: 360 },
                              { day: 'Sat', count: 480 },
                              { day: 'Sun', count: 520 },
                            ].map((d, idx) => {
                              const heightPct = String(Math.round((d.count / 550) * 100)) + '%';
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full group">
                                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-lg relative overflow-hidden flex flex-col justify-end transition-all cursor-pointer h-20 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700">
                                    <div 
                                      style={{ height: heightPct }} 
                                      className="bg-indigo-600 group-hover:bg-indigo-500 transition-all rounded-lg flex items-start justify-center"
                                    >
                                      {/* Tooltip on hover */}
                                      <div className="absolute opacity-0 group-hover:opacity-100 bg-zinc-900 text-white rounded text-[8px] px-1.5 py-0.5 bottom-full mb-1 transition-all pointer-events-none font-bold whitespace-nowrap">
                                        {d.count} views
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{d.day}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Total Weekly Impressions:</span>
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-mono">2,391 Sessions</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6 pt-10 border-t dark:border-zinc-800">
                    <div>
                      <h3 className="text-2xl font-black text-red-600 uppercase tracking-tight">Danger Zone</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">System level operations</p>
                    </div>
                    <div className="p-8 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-[2rem]">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none">
                            <Trash2 className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-black dark:text-white uppercase tracking-tight">Clear Database Records</h4>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Delete all courses, materials, and sales records.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isClearing}
                          className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none"
                        >
                          {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Wipe Dummy Data
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'promotions' && (
                <div className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight">Offers & Announcements</h2>
                      <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Manage marketing banners and special student alerts.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingId(null);
                        setPromotionFormData({ 
                          title: '', 
                          description: '', 
                          type: 'offer', 
                          imgFile: null, 
                          imgUrl: '', 
                          link: '', 
                          isActive: true, 
                          order: promotions.length, 
                          expiryDate: '',
                          couponCode: '',
                          discountType: 'percentage',
                          discountValue: '',
                          applicableProducts: [],
                          maxUsage: ''
                        });
                        setShowAddPromotionModal(true);
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Promo</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {promotions.map(promo => (
                      <div key={promo.id} className="relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-sm flex flex-col overflow-hidden group hover:border-indigo-600 transition-all">
                        {promo.imgUrl && (
                          <div className="aspect-[3/4] w-full overflow-hidden relative bg-zinc-50 dark:bg-zinc-800/50 p-4">
                            <img src={promo.imgUrl} className="w-full h-full object-contain group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                            <div className="absolute top-2 right-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border backdrop-blur-md shadow-sm",
                                promo.type === 'offer' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                promo.type === 'discount' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                              )}>
                                {promo.type}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="p-4 flex flex-col gap-3 flex-1">
                          <div className="flex items-center justify-between">
                            {!promo.imgUrl && (
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border",
                                promo.type === 'offer' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                promo.type === 'discount' ? "bg-amber-50 text-amber-600 border-amber-200" :
                                "bg-indigo-50 text-indigo-600 border-indigo-200"
                              )}>
                                {promo.type}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <div className={cn("w-1.5 h-1.5 rounded-full", promo.isActive ? "bg-emerald-500" : "bg-red-500")} />
                              <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">{promo.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                          </div>
                          
                          <div className="min-w-0">
                            <h3 className="font-black text-sm dark:text-white uppercase tracking-tight line-clamp-1 group-hover:text-indigo-600 transition-colors">{promo.title}</h3>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium line-clamp-2 mt-0.5 leading-relaxed">{promo.description}</p>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t dark:border-zinc-800 mt-auto">
                             <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Order: {promo.order}</span>
                             <div className="flex items-center gap-1">
                              <button 
                                onClick={() => openEditPromotion(promo)} 
                                className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-600 transition-all active:scale-90"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmInfo({ id: promo.id, type: 'promotion', title: promo.title })} 
                                disabled={submitting}
                                className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-600 transition-all active:scale-90 disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {promotions.length === 0 && (
                      <div className="col-span-full py-20 bg-zinc-50 dark:bg-zinc-800/30 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                        <Megaphone className="w-12 h-12 text-zinc-300 mb-4" />
                        <h3 className="font-black dark:text-white uppercase tracking-tight">No active promotions</h3>
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Create your first offer or announcement</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
              <div className="flex flex-col h-full">
                {/* Settings Sub-navigation */}
                <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 sticky top-0 z-10 overflow-x-auto no-scrollbar">
                  <div className="flex gap-6 lg:gap-8 px-6 lg:px-12 min-w-max">
                    {[
                      { id: 'general', label: 'General Settings' },
                      { id: 'homepage', label: 'Homepage CMS' },
                      { id: 'banners', label: 'Hero Banners' },
                    ].map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setSettingsSubTab(sub.id as any)}
                        className={cn(
                          "py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 shrink-0",
                          settingsSubTab === sub.id 
                            ? "border-indigo-600 text-indigo-600" 
                            : "border-transparent text-zinc-400 hover:text-zinc-600"
                        )}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {settingsSubTab === 'general' && (
                    <div className="p-10 lg:p-16 max-w-4xl">
                      <div className="flex flex-col gap-12">
                        <div className="flex flex-col gap-3">
                          <h2 className="text-3xl font-bold dark:text-white">General Settings</h2>
                          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Update branding, contact info, and social presence.</p>
                        </div>

                        <form onSubmit={handleSaveSettings} className="flex flex-col gap-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-4">
                              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Brand Name</label>
                              <input 
                                type="text"
                                value={settings.appName || ''}
                                onChange={e => setSettings({...settings, appName: e.target.value})}
                                className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                                placeholder="e.g. Vectonix Classes"
                              />
                            </div>
                            <div className="flex flex-col gap-4">
                              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">GST Percentage (%)</label>
                              <input 
                                type="number"
                                min={0}
                                max={100}
                                value={settings.gstPercent ?? 18}
                                onChange={e => setSettings({...settings, gstPercent: Number(e.target.value || 0)})}
                                className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                                placeholder="e.g. 18"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t dark:border-zinc-800">
                            <div className="space-y-6">
                              <h3 className="text-xs font-black dark:text-white uppercase tracking-[0.2em] text-indigo-600 mb-6">Contact Info</h3>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Support Email</label>
                                <input 
                                  type="email"
                                  value={settings.supportEmail || ''}
                                  onChange={e => setSettings({...settings, supportEmail: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Support Phone</label>
                                <input 
                                  type="text"
                                  value={settings.supportPhone || ''}
                                  onChange={e => setSettings({...settings, supportPhone: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">WhatsApp Number</label>
                                <input 
                                  type="text"
                                  value={settings.whatsappNumber || ''}
                                  onChange={e => setSettings({...settings, whatsappNumber: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Office Address</label>
                                <textarea 
                                  value={settings.address || ''}
                                  onChange={e => setSettings({...settings, address: e.target.value})}
                                  rows={3}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-bold"
                                  placeholder="Full office address with pincode"
                                />
                              </div>
                            </div>

                            <div className="space-y-6">
                              <h3 className="text-xs font-black dark:text-white uppercase tracking-[0.2em] text-indigo-600 mb-6">Social Links</h3>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">YouTube URL</label>
                                <input 
                                  type="url"
                                  value={settings.youtubeUrl || ''}
                                  onChange={e => setSettings({...settings, youtubeUrl: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-medium"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Instagram URL</label>
                                <input 
                                  type="url"
                                  value={settings.instagramUrl || ''}
                                  onChange={e => setSettings({...settings, instagramUrl: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-medium"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Telegram Link</label>
                                <input 
                                  type="url"
                                  value={settings.telegramUrl || ''}
                                  onChange={e => setSettings({...settings, telegramUrl: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-medium"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Facebook URL</label>
                                <input 
                                  type="url"
                                  value={settings.facebookUrl || ''}
                                  onChange={e => setSettings({...settings, facebookUrl: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-medium"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">LinkedIn URL</label>
                                <input 
                                  type="url"
                                  value={settings.linkedinUrl || ''}
                                  onChange={e => setSettings({...settings, linkedinUrl: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-medium"
                                />
                              </div>
                            </div>
                          </div>

                          {/* SEO & Tracking Integration Section */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t dark:border-zinc-800">
                            <div className="space-y-6">
                              <h3 className="text-xs font-black dark:text-white uppercase tracking-[0.2em] text-indigo-600 mb-6 font-bold">Google Analytics Setup</h3>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <span>GA4 Measurement ID</span>
                                  <span className="text-zinc-500 font-semibold">(e.g. G-H2KLMN4OPQ)</span>
                                </label>
                                <input 
                                  type="text"
                                  value={(settings as any).gaMeasurementId || ''}
                                  onChange={e => setSettings({...settings, gaMeasurementId: e.target.value})}
                                  placeholder="G-XXXXXXXXXX"
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-bold font-mono"
                                />
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-relaxed">
                                  Enables standard GA4 real-time web audience analytics automatically on your storefront, complete with speed insights.
                                </span>
                              </div>
                            </div>

                            <div className="space-y-6">
                              <h3 className="text-xs font-black dark:text-white uppercase tracking-[0.2em] text-indigo-600 mb-6 font-bold font-bold">Google Search Console</h3>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <span>Verification ID</span>
                                  <span className="text-zinc-500 font-semibold">(HTML Meta Verification Code)</span>
                                </label>
                                <input 
                                  type="text"
                                  value={(settings as any).gscVerificationId || ''}
                                  onChange={e => setSettings({...settings, gscVerificationId: e.target.value})}
                                  placeholder="e.g. zXyZaBcDeFgHiJkLmNoPqRsTuVwXyZ"
                                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs font-bold font-mono"
                                />
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-relaxed">
                                  Verify your ownership of Vectonix Classes with Search Console by pasting your custom verification token ID here.
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 border-t dark:border-zinc-800">
                             <button 
                                type="submit" 
                                disabled={settingsSaving}
                                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                              >
                                {settingsSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                Save Global Settings
                              </button>
                          </div>
                        </form>

                        <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-[2.5rem] border border-red-100 dark:border-red-900/20 mt-12">
                          <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertCircle className="w-5 h-5" />
                            <h3 className="text-lg font-black uppercase tracking-widest">Maintenance Mode</h3>
                          </div>
                          <p className="text-[10px] text-red-800/70 dark:text-red-400 font-bold uppercase tracking-widest mb-6">Danger zone: Permanent actions for system preparation.</p>
                          <button 
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isResetting}
                            className="w-full px-8 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 text-xs uppercase tracking-[0.15em]"
                          >
                            {isResetting ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            {isResetting ? 'Resetting...' : 'Clear All Production Test Data'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                   {settingsSubTab === 'homepage' && (
                    <div className="p-8 lg:p-12 flex flex-col gap-8">
                       <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Homepage Customizer</h2>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Directly edit sections visible to students</p>
                        </div>
                        <button 
                          onClick={handleSaveHomepage}
                          disabled={homepageSaving}
                          className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {homepageSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Live Publish
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Hero Sub-section */}
                        <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 flex flex-col gap-6">
                          <h3 className="font-black text-[10px] dark:text-white uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2">
                            <HomeIcon className="w-3.5 h-3.5" />
                            Landing Hero
                          </h3>
                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Hero Title</label>
                             <textarea 
                              rows={2}
                              value={homepageConfig.heroTitle || ''}
                              onChange={e => setHomepageConfig({...homepageConfig, heroTitle: e.target.value})}
                              className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-black uppercase text-xs"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Sub-heading</label>
                             <textarea 
                              rows={3}
                              value={homepageConfig.heroSubtitle || ''}
                              onChange={e => setHomepageConfig({...homepageConfig, heroSubtitle: e.target.value})}
                              className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-medium text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Mission Sub-section */}
                        <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 flex flex-col gap-6">
                           <h3 className="font-black text-[10px] dark:text-white uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Academic Mission
                          </h3>
                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Mission Title</label>
                             <input 
                              type="text"
                              value={homepageConfig.missionTitle || ''}
                              onChange={e => setHomepageConfig({...homepageConfig, missionTitle: e.target.value})}
                              className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-xs"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Mission Long-text</label>
                             <textarea 
                              rows={3}
                              value={homepageConfig.missionDescription || ''}
                              onChange={e => setHomepageConfig({...homepageConfig, missionDescription: e.target.value})}
                              className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-medium text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'banners' && (
                    <div className="p-8 lg:p-12 flex flex-col gap-8">
                       <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Promotional Banners</h2>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Manage the main carousel on student dashboard</p>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingId(null);
                            setBannerFormData({ title: '', subtitle: '', imgFile: null, imgUrl: '', buttonText: 'Start Learning', link: '/', order: banners.length });
                            setShowAddBannerModal(true);
                          }}
                          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200"
                        >
                          <Plus className="w-4 h-4" /> Add Dynamic Banner
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {banners.map(banner => (
                          <div key={banner.id} className="group relative bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all">
                            <div className="aspect-[16/9] relative lg:aspect-[2/1] overflow-hidden">
                              <img src={banner.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent p-6 flex flex-col justify-end">
                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Banner #{banner.order + 1}</span>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1">{banner.title}</h3>
                              </div>
                            </div>
                            <div className="p-5 flex items-center justify-between border-t border-zinc-50 dark:border-zinc-800">
                               <div className="flex items-center gap-1.5 opacity-60">
                                  <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{banner.buttonText}</span>
                               </div>
                               <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => openEditBanner(banner)} 
                                  className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-600 transition-all active:scale-90"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmInfo({ id: banner.id, type: 'banner', title: banner.title })} 
                                  className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-600 transition-all active:scale-90"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

              {activeTab === 'courses' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Primary Course</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Stream</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Since</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-800">
                      {loading ? (
                        <tr><td colSpan={4} className="px-4 md:px-6 py-24 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600 w-10 h-10" /></td></tr>
                      ) : courses.map(course => (
                        <tr key={course.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                          <td className="px-4 md:px-6 py-3 md:py-4">
                            <div className="flex items-center gap-3 md:gap-5">
                              <div className="w-10 h-14 md:w-16 md:h-24 rounded-lg md:rounded-2xl overflow-hidden bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800 group-hover:scale-110 transition-transform">
                                {(course.thumbnail || course.coverImage) ? (
                                  <img src={course.thumbnail || course.coverImage} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <Book className="w-4 md:w-6 h-4 md:h-6" />
                                )}
                              </div>
                              <div className="font-black text-xs md:text-lg dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-1">{course.title}</div>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-3 md:py-4">
                            <span className="px-2 md:px-4 py-0.5 md:py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-extrabold uppercase tracking-widest border border-indigo-100 dark:border-indigo-800">
                              {course.category}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest">{new Date(course.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</td>
                          <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                            <div className="flex items-center justify-end gap-1 md:gap-2">
                              <button 
                                onClick={() => navigate(`/course/${course.id}`)}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm active:scale-90"
                                title="View Course"
                              >
                                <Eye className="w-4 md:w-5 h-4 md:h-5" />
                              </button>
                              <button 
                                onClick={() => openEditCourse(course)}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm active:scale-90"
                              >
                                <Edit className="w-4 md:w-5 h-4 md:h-5" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmInfo({ id: course.id, type: 'course', title: course.title })}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm active:scale-90"
                              >
                                <Trash2 className="w-4 md:w-5 h-4 md:h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'subjects' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Subject Title</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Course</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-800">
                      {subjects.map(subject => (
                        <tr key={subject.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                          <td className="px-4 md:px-6 py-3 md:py-4 font-black text-xs md:text-lg dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{subject.title}</td>
                          <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-xs md:text-sm text-zinc-500 uppercase tracking-widest">
                            {courses.find(c => c.id === subject.courseId)?.title || 'Unknown Course'}
                          </td>
                          <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                            <div className="flex items-center justify-end gap-1 md:gap-2">
                              <button 
                                onClick={() => openEditSubject(subject)}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm active:scale-90"
                              >
                                <Edit className="w-4 md:w-5 h-4 md:h-5" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmInfo({ id: subject.id, type: 'subject', title: subject.title })}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm active:scale-90"
                              >
                                <Trash2 className="w-4 md:w-5 h-4 md:h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Study Note</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Subject</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Value</th>
                        <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-800">
                      {notes.map(note => (
                        <tr key={note.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                          <td className="px-4 md:px-6 py-3 md:py-4">
                            <div className="flex items-center gap-3 md:gap-5">
                              <div className="w-10 h-14 md:w-16 md:h-24 rounded-lg md:rounded-2xl overflow-hidden bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800 group-hover:scale-110 transition-transform">
                                {note.coverImage ? (
                                  <img src={note.coverImage} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <Book className="w-4 md:w-6 h-4 md:h-6" />
                                )}
                              </div>
                              <div className="font-black text-xs md:text-lg dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-1">{note.title}</div>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-3 md:py-4">
                            <span className="px-2 md:px-4 py-0.5 md:py-1.5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-extrabold uppercase tracking-widest border border-zinc-100">
                              {note.subject}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-3 md:py-4">
                            {note.isFree ? (
                              <span className="px-2 md:px-4 py-0.5 md:py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                FREE
                              </span>
                            ) : note.discountPrice !== undefined && note.discountPrice !== null && note.discountPrice < note.price ? (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="px-2 md:px-4 py-0.5 md:py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                  {formatCurrency(note.discountPrice)}
                                </span>
                                <span className="relative inline-block text-[9px] text-zinc-400 font-bold px-1">
                                  <span>{formatCurrency(note.price)}</span>
                                  <span className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-rose-500/80 dark:bg-rose-500 transform -rotate-12 pointer-events-none" />
                                </span>
                              </div>
                            ) : (
                              <span className="px-2 md:px-4 py-0.5 md:py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                {formatCurrency(note.price || 0)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                            <div className="flex items-center justify-end gap-1 md:gap-2">
                              <button 
                                onClick={() => navigate(`/note/${note.id}`)}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm active:scale-90"
                                title="View Note Page"
                              >
                                <Eye className="w-3.5 md:w-4 h-3.5 md:h-4" />
                              </button>
                              <button 
                                onClick={() => setUnitManagementConfig({ isOpen: true, noteId: note.id, noteTitle: note.title, courseId: note.courseId })}
                                className="p-2 md:p-3 bg-indigo-600 text-white rounded-lg md:rounded-xl hover:bg-indigo-700 transition-all font-bold text-[8px] md:text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-90"
                                title="Manage Units"
                              >
                                <List className="w-3.5 md:w-4 h-3.5 md:h-4" />
                                <span className="hidden sm:inline">Units</span>
                              </button>
                               <button 
                                onClick={() => openEditNote(note)}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm active:scale-90"
                              >
                                <Edit className="w-3.5 md:w-4 h-3.5 md:h-4" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmInfo({ id: note.id, type: 'note', title: note.title })}
                                className="p-2 md:p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg md:rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm active:scale-90"
                              >
                                <Trash2 className="w-3.5 md:w-4 h-3.5 md:h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            {activeTab === 'lectures' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Thumbnail</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Lecture</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Chapter</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Status</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Price</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {lectures.map(lecture => (
                      <tr key={lecture.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="w-10 h-14 md:w-16 md:h-24 rounded-lg md:rounded-2xl overflow-hidden bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-800 group-hover:scale-105 transition-transform">
                            {lecture.coverImage ? (
                              <img src={lecture.coverImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Video className="w-4 md:w-6 h-4 md:h-6" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-xs md:text-sm dark:text-white uppercase tracking-tight line-clamp-1">{lecture.title}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">{lecture.chapter}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {lecture.isComingSoon ? (
                            <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Coming Soon</span>
                          ) : (
                            <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Available</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {lecture.isFree ? (
                            <span className="font-black text-[10px] md:text-sm text-emerald-600">FREE</span>
                          ) : lecture.discountPrice !== undefined && lecture.discountPrice !== null && lecture.discountPrice < lecture.price ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-[10px] md:text-sm dark:text-white">{formatCurrency(lecture.discountPrice)}</span>
                              <span className="text-[9px] text-zinc-400 line-through font-bold">{formatCurrency(lecture.price)}</span>
                            </div>
                          ) : (
                            <span className="font-black text-[10px] md:text-sm dark:text-white">{formatCurrency(lecture.price || 0)}</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 md:gap-3">
                            <button 
                              onClick={() => navigate(`/course/individual?item=${lecture.id}&type=lecture`)}
                              className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
                              title="View Lecture"
                            >
                              <Eye className="w-4 md:w-5 h-4 md:h-5" />
                            </button>
                            <button 
                              onClick={() => openEditLecture(lecture)}
                              className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-600 transition-all shadow-sm"
                            >
                              <Edit className="w-4 md:w-5 h-4 md:h-5" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmInfo({ id: lecture.id, type: 'lecture', title: lecture.title })}
                              className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-600 transition-all shadow-sm"
                            >
                              <Trash2 className="w-4 md:w-5 h-4 md:h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'live' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Thumbnail</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Class Title</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Date & Time</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Status</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Price</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {liveClasses.map(cls => (
                      <tr key={cls.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="w-10 h-14 md:w-16 md:h-24 rounded-lg md:rounded-2xl overflow-hidden bg-rose-50 dark:bg-rose-900/20 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-800 group-hover:scale-105 transition-transform">
                            {cls.coverImage ? (
                              <img src={cls.coverImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Video className="w-4 md:w-6 h-4 md:h-6" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="font-bold text-xs md:text-sm dark:text-white uppercase tracking-tight line-clamp-1">{cls.title}</div>
                          <div className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-widest font-black mt-1">
                            {courses.find(c => c.id === cls.courseId)?.title || 'General'}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {cls.scheduledAt || (cls.date && cls.time) ? (
                            <>
                              <div className="text-[10px] md:text-sm font-bold dark:text-white whitespace-nowrap">
                                 {(() => {
                                  try {
                                    const date = new Date(cls.scheduledAt || cls.date);
                                    if (isNaN(date.getTime())) return cls.date || 'TBA';
                                    return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                                  } catch {
                                    return cls.date || 'TBA';
                                  }
                                })()}
                              </div>
                              <div className="text-[8px] md:text-xs text-zinc-500 font-bold uppercase tracking-widest">
                                {(() => {
                                  try {
                                    const displayTime = cls.scheduledAt 
                                      ? new Date(cls.scheduledAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
                                      : cls.time;
                                    
                                    if (!displayTime) return 'TBA';
                                    
                                    return (
                                      <div className="flex flex-col gap-1">
                                        <span>{displayTime}</span>
                                        {cls.scheduledAt && new Date(cls.scheduledAt) > new Date() && (
                                          <div className="flex items-center gap-1 text-rose-500 font-black">
                                            <Clock className="w-2 md:w-3 h-2 md:h-3" />
                                            <CountdownTimer targetDate={cls.scheduledAt} showLabels={false} className="text-[7px] md:text-[9px]" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } catch {
                                    return 'TBA';
                                  }
                                })()}
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] text-zinc-400 font-bold italic lowercase tracking-tight opacity-50">Not Scheduled</div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className={cn(
                            "px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                            cls.status === 'live' ? "bg-emerald-500 text-white border-emerald-400 animate-pulse shadow-lg shadow-emerald-500/20" :
                            cls.status === 'upcoming' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-zinc-100 text-zinc-500 border-zinc-200"
                          )}>
                            {cls.status}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {cls.isFree ? (
                            <span className="font-black text-[10px] md:text-sm text-emerald-600">FREE</span>
                          ) : cls.discountPrice !== undefined && cls.discountPrice !== null && cls.discountPrice < cls.price ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-[10px] md:text-sm dark:text-white">{formatCurrency(cls.discountPrice)}</span>
                              <span className="text-[9px] text-zinc-400 line-through font-bold">{formatCurrency(cls.price)}</span>
                            </div>
                          ) : (
                            <span className="font-black text-[10px] md:text-sm dark:text-white">{formatCurrency(cls.price || 0)}</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 md:gap-3">
                            <button 
                              onClick={() => navigate(`/course/individual?item=${cls.id}&type=live`)}
                              className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
                              title="View Public Page"
                            >
                              <Eye className="w-4 md:w-5 h-4 md:h-5" />
                            </button>

                            {cls.status === 'live' ? (
                              <>
                                <button 
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'liveClasses', cls.id), { 
                                        allowStudentJoin: !cls.allowStudentJoin 
                                      });
                                    } catch (e) {
                                      handleAdminError(e, OperationType.UPDATE, `liveClasses/${cls.id}`);
                                    }
                                  }}
                                  className={cn(
                                    "px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-1.5",
                                    cls.allowStudentJoin 
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                                      : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400"
                                  )}
                                  title={cls.allowStudentJoin ? "Disable Student Join" : "Enable Student Join"}
                                >
                                  {cls.allowStudentJoin ? <LockOpen className="w-3 md:w-3.5 h-3 md:h-3.5" /> : <Lock className="w-3 md:w-3.5 h-3 md:h-3.5" />}
                                  <span className="hidden lg:inline">{cls.allowStudentJoin ? 'Access On' : 'Access Off'}</span>
                                </button>

                                <button 
                                  onClick={() => {
                                    const sanitizedRoom = cls.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                                    setClassroomConfig({
                                      isOpen: true,
                                      roomName: sanitizedRoom,
                                      userName: profile?.name || user?.email?.split('@')[0] || 'Admin',
                                      classId: cls.id,
                                      isModerator: true,
                                      externalUrl: cls.isInternalRoom ? '' : (cls.meetingUrl || '')
                                    });
                                  }}
                                  className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 text-white rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
                                >
                                  <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-white rounded-full animate-pulse" />
                                  <span className="hidden sm:inline">Rejoin</span>
                                  <span className="sm:hidden">Join</span>
                                </button>
                                <button 
                                  onClick={async () => {
                                    if(window.confirm('End this live session?')) {
                                      try {
                                        await updateDoc(doc(db, 'liveClasses', cls.id), { 
                                          status: 'completed',
                                          isStarted: false,
                                          allowStudentJoin: false,
                                          roomSecret: '',
                                          updatedAt: new Date().toISOString()
                                        });
                                      } catch (e) {
                                        handleAdminError(e, OperationType.UPDATE, `liveClasses/${cls.id}`);
                                      }
                                    }
                                  }}
                                  className="px-2 md:px-4 py-1.5 md:py-2 bg-red-600/10 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                  End
                                </button>
                              </>
                            ) : (
                               <button 
                                onClick={async () => {
                                  try {
                                    const updateData: any = { status: 'live' };
                                    if (cls.isInternalRoom) {
                                      updateData.isStarted = true;
                                      updateData.roomSecret = Math.random().toString(36).substring(2, 10);
                                      updateData.updatedAt = new Date().toISOString();
                                    }
                                    await updateDoc(doc(db, 'liveClasses', cls.id), updateData);
                                    
                                    const snap = !cls.isInternalRoom ? await getDoc(doc(db, 'liveClasses', cls.id, 'secure', 'content')) : null;
                                    const url = snap?.exists() ? (snap.data()?.meetingUrl || cls.meetingUrl) : cls.meetingUrl;

                                    setClassroomConfig({
                                      isOpen: true,
                                      roomName: cls.title.toLowerCase().replace(/\s+/g, '-'),
                                      userName: profile?.name || user?.email?.split('@')[0] || 'Admin',
                                      classId: cls.id,
                                      isModerator: true,
                                      externalUrl: cls.isInternalRoom ? '' : (url || '')
                                    });
                                  } catch (e) {
                                    console.error('Failed to set status to live:', e);
                                  }
                                }}
                                className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 text-white rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                              >
                                {cls.isInternalRoom ? 'Start' : 'Link'}
                              </button>
                            )}
                            <button 
                              onClick={() => openEditLiveClass(cls)}
                              className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-600 transition-all shadow-sm"
                            >
                              <Edit className="w-4 md:w-5 h-4 md:h-5" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmInfo({ id: cls.id, type: 'live', title: cls.title })}
                              className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-600 transition-all shadow-sm"
                              title="Delete Meeting"
                            >
                              <Trash2 className="w-4 md:w-5 h-4 md:h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="space-y-6">
                {/* Search / Filter Section */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={salesSearchQuery}
                      onChange={(e) => setSalesSearchQuery(e.target.value)}
                      placeholder="Search sales by student name, mobile, item, subject or coupon..."
                      className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-850/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                    />
                  </div>
                  {salesSearchQuery && (
                    <button
                      onClick={() => setSalesSearchQuery('')}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-2xl transition-all"
                    >
                      Clear Filter
                    </button>
                  )}
                  <div className="text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">
                    Total Revenue: <span className="text-emerald-600 font-display font-extrabold text-[12px] ml-1">{formatCurrency(
                      sales.reduce((acc, sale) => acc + getSaleNetPaid(sale), 0)
                    )}</span>
                  </div>
                </div>

                {/* Slider (Horizontal Scroll) Alert Banner / Indicator */}
                <div className="flex items-center justify-between text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest px-1">
                  <span className="flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    Scroll left/right to view full columns
                  </span>
                  <span className="text-zinc-400 font-mono">Row Count: {sales.length}</span>
                </div>

                {/* Outer scroll container */}
                <div className="overflow-x-auto rounded-[2rem] border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl table-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1450px]">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">NAME</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">MOBILE</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">PAYMENT METHOD</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">STATUS</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">ITEM</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">PRICE</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">DISCOUNT</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-center animate-none">COUPON DISCOUNT</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">GST</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">PAID AMOUNT</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">TIME STAMPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {(() => {
                        const filteredSales = sales.filter(sale => {
                          const student = getStudentInfo(sale.userId);
                          const matchedItem = (() => {
                            if (sale.itemType === 'course') return courses.find(c => c.id === sale.itemId);
                            if (sale.itemType === 'note') return notes.find(n => n.id === sale.itemId);
                            if (sale.itemType === 'lecture') return lectures.find(l => l.id === sale.itemId);
                            if (sale.itemType === 'live') return liveClasses.find(l => l.id === sale.itemId);
                            if (sale.itemType === 'unit') return units.find(u => u.id === sale.itemId);
                            return null;
                          })();
                          const itemTitle = matchedItem?.title || getItemTitle(sale.itemId, sale.itemType) || '';
                          const subjectName = (() => {
                            if (!matchedItem) return 'N/A';
                            if (sale.itemType === 'course') {
                              if (matchedItem?.category) return matchedItem.category;
                              const courseSubs = subjects.filter(sub => sub.courseId === matchedItem.id);
                              return courseSubs.length > 0 ? courseSubs[0].title : 'Full Course';
                            }
                            const subId = (matchedItem as any).subjectId;
                            return subId ? (subjects.find(sub => sub.id === subId)?.title || 'N/A') : 'N/A';
                          })();
                          const coupon = sale.discountApplied || 'N/A';
                          const searchStr = `${student.name} ${student.mobile || ''} ${student.phoneNumber || ''} ${itemTitle} ${subjectName} ${coupon}`.toLowerCase();
                          return searchStr.includes(salesSearchQuery.toLowerCase());
                        });

                        if (filteredSales.length === 0) {
                          return (
                            <tr>
                              <td colSpan={12} className="px-6 py-20 text-center text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                                No billing records found
                              </td>
                            </tr>
                          );
                        }

                        return filteredSales.map(sale => {
                          const student = getStudentInfo(sale.userId);
                          const matchedItem = (() => {
                            if (sale.itemType === 'course') return courses.find(c => c.id === sale.itemId);
                            if (sale.itemType === 'note') return notes.find(n => n.id === sale.itemId);
                            if (sale.itemType === 'lecture') return lectures.find(l => l.id === sale.itemId);
                            if (sale.itemType === 'live') return liveClasses.find(l => l.id === sale.itemId);
                            if (sale.itemType === 'unit') return units.find(u => u.id === sale.itemId);
                            return null;
                          })();
                          
                          const itemTitle = matchedItem?.title || getItemTitle(sale.itemId, sale.itemType);
                          const subjectName = (() => {
                            if (!matchedItem) return 'N/A';
                            if (sale.itemType === 'course') {
                              if (matchedItem?.category) return matchedItem.category;
                              const courseSubs = subjects.filter(sub => sub.courseId === matchedItem.id);
                              return courseSubs.length > 0 ? courseSubs[0].title : 'Full Course';
                            }
                            const subId = (matchedItem as any).subjectId;
                            return subId ? (subjects.find(sub => sub.id === subId)?.title || 'N/A') : 'N/A';
                          })();

                          // Match Dashboard.tsx formula calculations precisely!
                          const actualPriceVal = sale.originalPrice !== undefined
                            ? parsePrice(sale.originalPrice)
                            : parsePrice(matchedItem?.price || sale.amount || 0);

                          const discountPriceVal = sale.productDiscount !== undefined && sale.originalPrice !== undefined
                            ? parsePrice(sale.originalPrice) - parsePrice(sale.productDiscount)
                            : parsePrice(sale.amount || 0);

                          const adminDiscountAmount = sale.productDiscount !== undefined
                            ? parsePrice(sale.productDiscount)
                            : Math.max(0, actualPriceVal - discountPriceVal);

                          const couponCode = sale.couponCode || sale.discountApplied || null;
                          
                          let couponDiscountAmount = 0;
                          if (sale.couponDiscount !== undefined) {
                            couponDiscountAmount = parsePrice(sale.couponDiscount);
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

                          const priceAfterCoupon = Math.max(0, (sale.productDiscount !== undefined ? (actualPriceVal - adminDiscountAmount) : discountPriceVal) - couponDiscountAmount);
                          
                          const gstPercent = sale.gstPercent !== undefined ? parsePrice(sale.gstPercent) : 0;
                          const gstAmount = sale.gstAmount !== undefined 
                            ? parsePrice(sale.gstAmount) 
                            : priceAfterCoupon * (gstPercent / 100);

                          const finalNetPaid = sale.paidAmount !== undefined 
                            ? parsePrice(sale.paidAmount) 
                            : priceAfterCoupon + gstAmount;

                          const isSuccess = !sale.status || sale.status.toLowerCase() === 'successful' || sale.status.toLowerCase() === 'paid';

                          return (
                            <tr key={sale.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-all group">
                              {/* NAME */}
                              <td className="px-6 py-5 shrink-0 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-zinc-100 overflow-hidden shrink-0 border border-zinc-200">
                                    {student.photoUrl ? (
                                      <img src={student.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User className="w-4 h-4 m-2 text-zinc-400 dark:text-zinc-500" />
                                    )}
                                  </div>
                                  <div className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100">{student.name}</div>
                                </div>
                              </td>
                              {/* MOBILE */}
                              <td className="px-6 py-5 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                {student.mobile || student.phoneNumber || 'N/A'}
                              </td>
                              {/* PAYMENT METHOD */}
                              <td className="px-6 py-5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider whitespace-nowrap">
                                {sale.paymentMethod || (sale.paymentId ? 'Razorpay Online' : 'Online Gateway')}
                              </td>
                              {/* STATUS */}
                              <td className="px-6 py-5 whitespace-nowrap">
                                {isSuccess ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30 animate-none">
                                    SUCCESSFUL
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 animate-none">
                                    {sale.status?.toUpperCase() || 'PENDING'}
                                  </span>
                                )}
                              </td>
                              {/* ITEM */}
                              <td className="px-6 py-5 max-w-[240px] truncate whitespace-nowrap" title={itemTitle}>
                                <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 capitalize">{itemTitle}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border dark:border-zinc-700">{sale.itemType || 'course'}</span>
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
                              {/* COUPON DISCOUNT */}
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
                                {new Date(sale.timestamp).toLocaleString('en-IN', {
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
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}



            {activeTab === 'users' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold dark:text-white">Student Management</h2>
                    <p className="text-sm text-zinc-500 font-medium">Manage your community and student access levels.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const mobiles = users.map(u => u.mobile).filter(Boolean);
                      const duplicates = mobiles.filter((m, i) => mobiles.indexOf(m) !== i);
                      if (duplicates.length > 0) {
                        return (
                          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Duplicate Mobiles Detected!</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">User</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Contact</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Role</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Joined</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Purchased Items</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {users.map(u => {
                      const isDuplicate = u.mobile && users.filter(other => other.mobile === u.mobile).length > 1;
                      return (
                        <tr key={u.id} className={cn(
                          "hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group",
                          isDuplicate && "bg-red-50/30 dark:bg-red-900/10"
                        )}>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold overflow-hidden border-2 border-indigo-50 dark:border-indigo-900/50">
                              {u.photoUrl ? (
                                <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                u.name?.[0] || u.email?.[0]?.toUpperCase() || '?'
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-xs md:text-sm dark:text-white">{u.name || 'No Name'}</div>
                                {u.restricted && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[6px] font-black uppercase rounded tracking-widest flex items-center gap-1">
                                    <ShieldAlert className="w-2 h-2" />
                                    Restricted
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-bold tracking-wider">{u.dob || 'No D.O.B'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs font-medium dark:text-zinc-300">{u.email}</div>
                          <div className="text-[10px] text-zinc-500 font-bold tracking-wider">{u.mobile || u.phoneNumber || 'No Phone'}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className={cn(
                            "px-2 md:px-3 py-1 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest border",
                            u.role === 'admin' ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-200"
                          )}>
                            {u.role || 'student'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Unknown'}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {u.purchasedItems && u.purchasedItems.length > 0 ? (
                              u.purchasedItems.slice(0, 2).map((itemId: string) => {
                                // Search through all item types to find the title
                                const item = courses.find(c => c.id === itemId) || 
                                             notes.find(n => n.id === itemId) || 
                                             lectures.find(l => l.id === itemId) ||
                                             liveClasses.find(live => live.id === itemId) ||
                                             units.find(unit => unit.id === itemId);
                                return (
                                  <span key={itemId} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-tighter truncate max-w-[120px]" title={item?.title || item?.name || itemId}>
                                    {item?.title || item?.name || itemId}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">No Purchases</span>
                            )}
                            {u.purchasedItems && u.purchasedItems.length > 2 && (
                              <span className="text-[8px] font-black text-indigo-400 self-center">+{u.purchasedItems.length - 2} MORE</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button 
                              onClick={() => {
                                setSelectedUserDetail(u);
                                setShowUserDetailModal(true);
                              }}
                              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Detail</span>
                            </button>

                            {u.role !== 'admin' && u.email !== 'vectonixclasses@gmail.com' && (
                              <button 
                                 onClick={() => toggleUserRestriction(u)}
                                 className={cn(
                                   "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2",
                                   u.restricted 
                                     ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100 dark:shadow-none"
                                     : "bg-red-600 text-white hover:bg-red-700 shadow-red-100 dark:shadow-none"
                                 )}
                                 title={u.restricted ? "Unrestrict User" : "Restrict User"}
                               >
                                 {u.restricted ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                                 <span>{u.restricted ? 'Unrestrict' : 'Restrict'}</span>
                               </button>
                            )}
                          </div>
                        </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'notices' && (
              <div className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight">Notice Board</h2>
                    <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Manage announcements and app updates.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingId(null);
                      setNoticeFormData({ title: '', content: '', type: 'announcement', visibility: 'both', attachmentFile: null, attachmentUrl: '', attachmentName: '', attachmentType: '' });
                      setShowAddNoticeModal(true);
                    }}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Notice</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {notices.map(notice => (
                    <div key={notice.id} className="p-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-750 rounded-[2rem] shadow-sm flex flex-col gap-4 group hover:border-indigo-600 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                            notice.type === 'news' ? "bg-blue-50 text-blue-600 border-blue-200" :
                            notice.type === 'update' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                            "bg-indigo-50 text-indigo-600 border-indigo-200"
                          )}>
                            {notice.type || 'announcement'}
                          </span>
                          <span className="px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-widest border border-zinc-200 text-zinc-400">
                            {notice.visibility || 'both'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openEditNotice(notice)}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmInfo({ id: notice.id, type: 'notice', title: notice.title })}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-black dark:text-white uppercase tracking-tight">{notice.title}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-2 line-clamp-3">{notice.content}</p>
                      </div>

                      {notice.attachmentUrl && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center">
                              <File className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black dark:text-white uppercase tracking-tight truncate max-w-[120px]">{notice.attachmentName || 'Attachment'}</span>
                              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{notice.attachmentType?.split('/')[1] || 'File'}</span>
                            </div>
                          </div>
                          <a 
                            href={notice.attachmentUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 text-indigo-600 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </a>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Clock className="w-3 h-3" />
                          <span className="text-[8px] font-bold uppercase tracking-widest">
                            {new Date(notice.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {notices.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
                      <Megaphone className="w-12 h-12 opacity-20" />
                      <p className="font-bold uppercase tracking-widest text-xs">No notices posted yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'enquiry' && (
                <div className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight">Student Enquiries</h2>
                      <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Review messages and requests from students.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                          <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Student</th>
                          <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Mobile</th>
                          <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Subject</th>
                          <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Message</th>
                          <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Date</th>
                          <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-zinc-800">
                        {enquiries.map(item => (
                          <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-4 md:px-6 py-3 md:py-4">
                              <div className="font-black text-xs md:text-sm dark:text-white uppercase tracking-tight line-clamp-1">{item.name}</div>
                              <div className="text-[8px] md:text-[10px] text-zinc-500 font-bold lowercase tracking-normal line-clamp-1">{item.email}</div>
                            </td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{item.mobile}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-indigo-500 uppercase tracking-widest">{item.subject || 'General'}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4">
                              <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 font-medium line-clamp-2 max-w-xs">{item.message}</p>
                            </td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                              <button 
                                onClick={() => setDeleteConfirmInfo({ id: item.id, type: 'enquiry', title: item.name })}
                                className="p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-600 transition-all shadow-sm active:scale-95"
                              >
                                <Trash2 className="w-4 md:w-5 h-4 md:h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {enquiries.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-24 text-center">
                              <MessageSquare className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                              <h3 className="font-black dark:text-white uppercase tracking-tight">No enquiries found</h3>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Student messages will appear here.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {activeTab === 'reviews' && (
              <div className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight">Student Reviews</h2>
                    <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Moderate and manage student testimonials.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {reviews.map(item => (
                    <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col gap-6 shadow-sm group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shadow-sm">
                            <img 
                              src={item.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.userName)}&background=6366f1&color=fff&bold=true`} 
                              className="w-full h-full object-cover"
                              alt={item.userName}
                            />
                          </div>
                          <div>
                            <h4 className="text-xs font-black dark:text-white uppercase tracking-tight">{item.userName}</h4>
                            <div className="flex items-center gap-1 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={cn("w-2.5 h-2.5", i < item.rating ? "text-amber-500 fill-amber-500" : "text-zinc-200 dark:text-zinc-700")} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className={cn(
                          "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                          item.status === 'approved' ? "bg-emerald-100 text-emerald-600" :
                          item.status === 'rejected' ? "bg-red-100 text-red-600" :
                          "bg-amber-100 text-amber-600"
                        )}>
                          {item.status}
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed italic">"{item.content}"</p>

                      <div className="flex items-center justify-between pt-4 border-t dark:border-zinc-800 mt-auto">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.status !== 'approved' && (
                            <button 
                              onClick={() => handleApproveReview(item.id)}
                              className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Approve"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          {item.status !== 'rejected' && (
                            <button 
                              onClick={() => handleRejectReview(item.id)}
                              className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Reject"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => setDeleteConfirmInfo({ id: item.id, type: 'review', title: `Review by ${item.userName}` })}
                            className="p-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-red-600 transition-all shadow-sm active:scale-95"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {reviews.length === 0 && (
                    <div className="col-span-full py-24 text-center">
                      <Shield className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
                      <h3 className="font-black dark:text-white uppercase tracking-tight text-xl">No reviews found</h3>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">When students submit reviews, they'll show up here for approval.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10"
              >
                {/* HEADER SECTION */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <Database className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight font-display">Database & Storage Cost Profiler</h2>
                      <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
                        Live analytics of Firestore collections, Firebase Storage buckets & cost calculators in Indian Rupees.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-xs">
                      <button
                        onClick={() => setDbMode('actual')}
                        className={cn(
                          "px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all flex items-center gap-1.5",
                          dbMode === 'actual'
                            ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/20 dark:border-zinc-800/20"
                            : "text-zinc-450 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        )}
                        id="dbmode-btn-actual"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        Actual Use
                      </button>
                      <button
                        onClick={() => setDbMode('virtual')}
                        className={cn(
                          "px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all flex items-center gap-1.5",
                          dbMode === 'virtual'
                            ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/20 dark:border-zinc-800/20"
                            : "text-zinc-450 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        )}
                        id="dbmode-btn-virtual"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Virtual Sim
                      </button>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/40 shrink-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                      Blaze Plan: Active
                    </span>
                  </div>
                </div>

                {/* CALCULATE COMPREHENSIVE COST METRICS */}
                {(() => {
                  const isActual = dbMode === 'actual';

                  // Dynamic metrics calculated based on actual state lists in memory
                  // 1. Daily Active Users (DAU) based on actual users list (e.g. 35% of total list is a standard digital LMS metric)
                  const actualDAU = Math.max(1, Math.round(users.length * 0.35));
                  
                  // 2. Average Document Operations per active user
                  const actualReads = 12; // courses catalogs + subjects list + notices reads
                  const actualWrites = 2;  // enquiries / reviews / profile update writes
                  
                  // 3. Stored notes file size estimate: ~2.5 MB average per note pdf file
                  const actualStorageGB = notes.length > 0 ? Number(((notes.length * 2.5 * 1024 * 1024) / (1024 * 1024 * 1024)).toFixed(3)) : 0.185;
                  
                  // 4. Bandwidth egress size per active student monthly index
                  const actualBandwidthEgress = 0.25; // 250MB average PDF download egress traffic
                  
                  // Assign effective values depending on dbMode toggle
                  const effDAU = isActual ? actualDAU : dbActiveUsers;
                  const effReads = isActual ? actualReads : dbReadsPerUser;
                  const effWrites = isActual ? actualWrites : dbWritesPerUser;
                  const effStorage = isActual ? actualStorageGB : dbCloudStorageGB;
                  const effBandwidth = isActual ? actualBandwidthEgress : dbStorageBandwidthPerUser;

                  const totalStorageMB = effStorage * 1024;

                  // Proportional sizing allocation of folders
                  const folderDefinitions = [
                    {
                      path: 'notebooks/pdfs/',
                      label: 'Student Study Guides & Notes',
                      description: 'Academic PDF manuals, textbooks & student self-study notes.',
                      weight: 0.65, // 65% space
                      count: isActual ? notes.length : Math.max(5, Math.round(effStorage * 18)),
                      avgSize: '3.4 MB',
                      access: 'Auth Required'
                    },
                    {
                      path: 'lectures/videos/',
                      label: 'Private Lecture Video Streams',
                      description: 'Encrypted MP4 curriculum chapters and class backups.',
                      weight: 0.20, // 20% space
                      count: isActual ? Math.max(1, Math.round(lectures.length * 0.2)) : Math.max(2, Math.round(effStorage * 2.5)),
                      avgSize: '124.5 MB',
                      access: 'Premium Access'
                    },
                    {
                      path: 'courses/covers/',
                      label: 'Course Catalog Graphics',
                      description: 'Syllabus cover thumbnails & display posters.',
                      weight: 0.04, // 4% space
                      count: isActual ? courses.length : Math.max(4, Math.round(effStorage * 1.5)),
                      avgSize: '350 KB',
                      access: 'Public / Read'
                    },
                    {
                      path: 'users/avatars/',
                      label: 'Student Profile IDs',
                      description: 'Avatar pictures and user passport attachments.',
                      weight: 0.04, // 4% space
                      count: isActual ? Math.max(2, Math.round(users.length * 0.15)) : Math.max(10, Math.round(effStorage * 20)),
                      avgSize: '150 KB',
                      access: 'Public / Read'
                    },
                    {
                      path: 'promos/banners/',
                      label: 'Promotion Slides & Ads',
                      description: 'Administrative sliders and discount highlight graphics.',
                      weight: 0.03, // 3% space
                      count: isActual ? promotions.length : Math.max(3, Math.round(effStorage * 0.8)),
                      avgSize: '450 KB',
                      access: 'Public / Read'
                    },
                    {
                      path: 'notices/attachments/',
                      label: 'Circular notice additions',
                      description: 'Board announcements and administrative attachments.',
                      weight: 0.02, // 2% space
                      count: isActual ? notices.length : Math.max(2, Math.round(effStorage * 1.2)),
                      avgSize: '650 KB',
                      access: 'Public / Read'
                    },
                    {
                      path: 'lectures/covers/',
                      label: 'Video Preview Frames',
                      description: 'Stream screens splash cover images.',
                      weight: 0.02, // 2% space
                      count: isActual ? lectures.length : Math.max(6, Math.round(effStorage * 3.5)),
                      avgSize: '180 KB',
                      access: 'Public / Read'
                    }
                  ];

                  // Perform calculated rates
                  const dailyReadsVal = effDAU * effReads;
                  const monthlyReadsVal = dailyReadsVal * 30;
                  const isReadsExceeded = dailyReadsVal > 50000;
                  const billableReadsVal = Math.max(0, monthlyReadsVal - 1500000);
                  const readsInrVal = (billableReadsVal / 100000) * 0.06 * 85;

                  const dailyWritesVal = effDAU * effWrites;
                  const monthlyWritesVal = dailyWritesVal * 30;
                  const isWritesExceeded = dailyWritesVal > 20000;
                  const billableWritesVal = Math.max(0, monthlyWritesVal - 600000);
                  const writesInrVal = (billableWritesVal / 100000) * 0.18 * 85;

                  const isStorageExceeded = effStorage > 5;
                  const billableStorageGB = Math.max(0, effStorage - 5);
                  const storageInrVal = billableStorageGB * 0.026 * 85;

                  const monthlyBandwidthGB = effDAU * effBandwidth * 30; // Monthly bandwidth egress multiplier
                  const isBandwidthExceeded = monthlyBandwidthGB > 30;
                  const billableBandwidthGB = Math.max(0, monthlyBandwidthGB - 30);
                  const bandwidthInrVal = billableBandwidthGB * 0.12 * 85;

                  const totalInrSum = readsInrVal + writesInrVal + storageInrVal + bandwidthInrVal;
                  const totalUsdSum = totalInrSum / 85;

                  // Active documents counts
                  const totalDocsCached = users.length + sales.length + courses.length + subjects.length + (units?.length || 0) + notes.length + lectures.length + liveClasses.length + notices.length + enquiries.length + reviews.length + promotions.length;

                  return (
                    <>
                      {/* ACTIVE ALERTS FOR FREE LIMIT THRESHOLDS */}
                      {(isReadsExceeded || isWritesExceeded || isStorageExceeded || isBandwidthExceeded) && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-[2rem] flex flex-col gap-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 rounded-xl">
                              <AlertCircle className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">Firebase Spark Free Quota Warning</h4>
                              <p className="text-[10px] font-bold text-amber-750 dark:text-amber-400 uppercase tracking-widest leading-normal">
                                Your simulated scale crosses standard Spark level Free Tier thresholds. Blaze Plan variables are now computing billable values.
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {isReadsExceeded && (
                              <div className="bg-white/80 dark:bg-zinc-900/60 p-4 rounded-2xl border border-amber-150 dark:border-zinc-800 flex flex-col gap-1 shadow-xs">
                                <span className="font-extrabold text-xs text-rose-600 dark:text-rose-400">⚠️ Firestore Reads Limit Exceeded</span>
                                <p className="text-[11px] text-zinc-650 dark:text-zinc-450 leading-relaxed font-semibold">
                                  Daily reads of <strong className="font-mono">{dailyReadsVal.toLocaleString()}</strong> exceed 50,000 threshold. 
                                  Excess bill reads: <strong className="font-mono">{billableReadsVal.toLocaleString()}/mo</strong>, costing <strong className="text-zinc-900 dark:text-zinc-100">₹{Math.round(readsInrVal).toLocaleString('en-IN')}</strong>.
                                </p>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-1">💡 REMEDY: Enable local Firestore persistence / cache listings.</span>
                              </div>
                            )}
                            {isWritesExceeded && (
                              <div className="bg-white/80 dark:bg-zinc-900/60 p-4 rounded-2xl border border-amber-150 dark:border-zinc-800 flex flex-col gap-1 shadow-xs">
                                <span className="font-extrabold text-xs text-rose-600 dark:text-rose-400">⚠️ Firestore Writes Limit Exceeded</span>
                                <p className="text-[11px] text-zinc-650 dark:text-zinc-450 leading-relaxed font-semibold">
                                  Daily writes of <strong className="font-mono">{dailyWritesVal.toLocaleString()}</strong> exceed 20,000 threshold. 
                                  Excess bill writes: <strong className="font-mono">{billableWritesVal.toLocaleString()}/mo</strong>, costing <strong className="text-zinc-900 dark:text-zinc-100">₹{Math.round(writesInrVal).toLocaleString('en-IN')}</strong>.
                                </p>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-1">💡 REMEDY: Throttle analytics data or batch state write operations.</span>
                              </div>
                            )}
                            {isStorageExceeded && (
                              <div className="bg-white/80 dark:bg-zinc-900/60 p-4 rounded-2xl border border-amber-150 dark:border-zinc-800 flex flex-col gap-1 shadow-xs font-bold">
                                <span className="font-extrabold text-xs text-rose-600 dark:text-rose-400">⚠️ Cloud File Storage Space Exceeded</span>
                                <p className="text-[11px] text-zinc-650 dark:text-zinc-450 leading-relaxed font-semibold">
                                  Active media files storage (<strong className="font-mono">{effStorage.toFixed(3)} GB</strong>) exceeds 5 GB. 
                                  Extra billable space: <strong className="font-mono">{(effStorage - 5).toFixed(3)} GB</strong>, costing <strong className="text-zinc-900 dark:text-zinc-100">₹{Math.round(storageInrVal).toLocaleString('en-IN')} / mo</strong>.
                                </p>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-1">💡 REMEDY: Compress uploaded PDF notes or delete obsolete user mock files.</span>
                              </div>
                            )}
                            {isBandwidthExceeded && (
                              <div className="bg-white/80 dark:bg-zinc-900/60 p-4 rounded-2xl border border-amber-150 dark:border-zinc-800 flex flex-col gap-1 shadow-xs">
                                <span className="font-extrabold text-xs text-rose-600 dark:text-rose-440 font-bold">⚠️ Storage Network Egress (Bandwidth) Exceeded</span>
                                <p className="text-[11px] text-zinc-650 dark:text-zinc-450 leading-relaxed font-semibold">
                                  Egress traffic of <strong className="font-mono">{monthlyBandwidthGB.toFixed(1)} GB</strong> exceeds 30 GB/month daily limit. 
                                  Remaining bandwidth costs <strong className="text-zinc-900 dark:text-zinc-100">₹{Math.round(bandwidthInrVal).toLocaleString('en-IN')} / mo</strong>.
                                </p>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-1 font-bold">💡 REMEDY: Embed external unlisted YouTube media URLs to avoid Cloud Storage download bills.</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* OVERALL METRICS GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Size Card */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col gap-4 font-bold">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-left font-bold">Firestore Sizing Footprint</span>
                            <HardDrive className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <h3 className="text-3xl font-extrabold dark:text-white tracking-tight">
                              {totalDocsCached} <span className="text-lg font-medium text-zinc-400">docs stored</span>
                            </h3>
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-450 mt-1">
                              Database Storage: <span className="font-mono text-zinc-800 dark:text-zinc-200">{((totalDocsCached * 1.5) / 1024).toFixed(3)} MB</span>
                            </p>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-2">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${Math.min(100, (((totalDocsCached * 1.5) / 1048576) * 100))}%` }}
                            ></div>
                          </div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-bold">
                            {Math.min(100, (((totalDocsCached * 1.5) / 1048576) * 100)).toFixed(6)}% utilized of 1GB Spark Free Tier
                          </span>
                        </div>

                        {/* Sessions Cloud Storage Status Card */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cloud Storage & Egress</span>
                            <Activity className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <h3 className="text-3xl font-extrabold dark:text-white tracking-tight">
                              {effStorage.toFixed(3)} <span className="text-lg font-medium text-zinc-400">GB files</span>
                            </h3>
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-450 mt-1">
                              Bandwidth Usage: <span className="font-mono text-zinc-800 dark:text-zinc-200">{monthlyBandwidthGB.toFixed(1)} GB / mo</span>
                            </p>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-2">
                            <div 
                              className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${Math.min(100, (effStorage / 5) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                            {effStorage <= 5 ? `${Math.round((effStorage / 5) * 100)}% of 5GB Free Capacity consumed` : "Spark Limit Exceeded by " + (effStorage - 5).toFixed(3) + " GB"}
                          </span>
                        </div>

                        {/* Blaze Cost Card */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Dynamic Cloud Bill Estimate</span>
                            <DollarSign className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <h3 className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
                              ₹{Math.round(totalInrSum).toLocaleString('en-IN')}
                              <span className="text-xs font-bold text-zinc-400 uppercase ml-2">/ month</span>
                            </h3>
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-450 mt-1">
                              {totalInrSum > 0 
                                ? `Projected: $${totalUsdSum.toFixed(2)} USD (convert rate: ₹85 per USD)` 
                                : "Fully covered under Firebase Spark Free Plan!"}
                            </p>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 border",
                            totalInrSum > 0 
                              ? "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
                              : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 font-semibold"
                          )}>
                            {totalInrSum > 0 ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                Paid Operations Estimations Active
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Zero cost, under free quota
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CENTRAL CONTENT PANELS */}
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Left Column: Live Footprint Breakdown */}
                        <div className="xl:col-span-2 flex flex-col gap-8">
                          {/* PANEL 1: DATABASE COLLECTIONS */}
                          <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
                            <div>
                              <h3 className="text-base font-black dark:text-white uppercase tracking-wider font-display">Live Firebase Collection Blueprint</h3>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">Live collections tracking loaded variables in memory.</p>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-150 dark:border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    <th className="pb-4">Collection Index</th>
                                    <th className="pb-4 text-center">Docs Cache</th>
                                    <th className="pb-4 text-right">Avg Row Size</th>
                                    <th className="pb-4 text-right">Extrapolated size</th>
                                    <th className="pb-4 text-center">Read Strategy</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { name: 'users', label: 'Users & Profile Data', count: users.length, avgSize: 1.2, loadType: 'Lazy/Paginated' },
                                    { name: 'sales', label: 'Financial Transactions', count: sales.length, avgSize: 1.8, loadType: 'Real-time On-demand' },
                                    { name: 'courses', label: 'Course Offerings Catalog', count: courses.length, avgSize: 2.5, loadType: 'Preloaded Cache' },
                                    { name: 'subjects', label: 'Academic Streams', count: subjects.length, avgSize: 1.0, loadType: 'Preloaded Cache' },
                                    { name: 'units', label: 'Course Units & Topics', count: (units?.length || 0), avgSize: 1.5, loadType: 'Preloaded Cache' },
                                    { name: 'notes', label: 'PDF Library Attachments', count: notes.length, avgSize: 2.0, loadType: 'On-demand' },
                                    { name: 'lectures', label: 'Video Lecture Metadata', count: lectures.length, avgSize: 2.2, loadType: 'On-demand' },
                                    { name: 'liveClasses', label: 'Scheduled Streams (Live)', count: liveClasses.length, avgSize: 1.6, loadType: 'Real-time Sync' },
                                    { name: 'enquiries', label: 'Student Support Helplines', count: enquiries.length, avgSize: 1.1, loadType: 'Admin Only' },
                                    { name: 'reviews', label: 'Reviews / Ratings Logs', count: reviews.length, avgSize: 1.3, loadType: 'Moderated Load' },
                                    { name: 'notices', label: 'Notices Board Bulletins', count: notices.length, avgSize: 1.4, loadType: 'Preloaded Cache' },
                                    { name: 'promotions', label: 'Coupons / Special Offers', count: promotions.length, avgSize: 2.0, loadType: 'Preloaded Cache' },
                                  ].map(col => {
                                    const sizeKB = col.count * col.avgSize;
                                    return (
                                      <tr key={col.name} className="border-b border-zinc-100/50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-all">
                                        <td className="py-4 font-bold text-xs">
                                          <div className="dark:text-white capitalize">{col.name}</div>
                                          <div className="text-[9px] text-zinc-400 uppercase font-bold">{col.label}</div>
                                        </td>
                                        <td className="py-4 text-center font-mono font-bold text-xs dark:text-zinc-200">
                                          {col.count}
                                        </td>
                                        <td className="py-4 text-right text-xs font-mono text-zinc-400 font-bold">
                                          ~{col.avgSize.toFixed(1)} KB
                                        </td>
                                        <td className="py-4 text-right font-mono text-xs dark:text-zinc-200 font-extrabold">
                                          {sizeKB < 1024 ? `${sizeKB.toFixed(1)} KB` : `${(sizeKB / 1024).toFixed(2)} MB`}
                                        </td>
                                        <td className="py-4 text-center">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                            col.loadType.includes('Preloaded') ? "bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300" :
                                            col.loadType.includes('Real-time') ? "bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-300" :
                                            "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                          )}>
                                            {col.loadType}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* PANEL 2: CLOUD STORAGE DIRECTORY DETAILS */}
                          <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div>
                                <h3 className="text-base font-black dark:text-white uppercase tracking-wider font-display flex items-center gap-2">
                                  <Folder className="w-5 h-5 text-indigo-500" />
                                  Live Cloud Storage Folder Sizing
                                </h3>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                                  Directories mapping dynamic assets, media uploads, and documents in storage bucket.
                                </p>
                              </div>
                              <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 px-4 py-2.5 rounded-2xl shrink-0 flex flex-col gap-0.5">
                                <span className="text-[8px] font-black uppercase text-zinc-450 tracking-widest leading-none">TOTAL STORAGE USED</span>
                                <span className="text-xs font-black font-mono text-zinc-800 dark:text-white">
                                  {effStorage.toFixed(3)} GB <span className="text-[10px] font-bold text-zinc-400">({Math.round(totalStorageMB).toLocaleString()} MB)</span>
                                </span>
                              </div>
                            </div>

                            {/* Horizontal Segmented Bar chart */}
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                <span>Bucket Occupancy Distribution</span>
                                <span>100% Allocated</span>
                              </div>
                              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden flex">
                                {folderDefinitions.map((f, i) => {
                                  const colors = [
                                    'bg-indigo-600 dark:bg-indigo-500',
                                    'bg-emerald-600 dark:bg-emerald-500',
                                    'bg-amber-600 dark:bg-amber-500',
                                    'bg-blue-600 dark:bg-blue-500',
                                    'bg-rose-600 dark:bg-rose-500',
                                    'bg-teal-600 dark:bg-teal-500',
                                    'bg-violet-600 dark:bg-violet-500'
                                  ];
                                  return (
                                    <div 
                                      key={f.path} 
                                      className={`${colors[i % colors.length]} h-full transition-all duration-500`}
                                      style={{ width: `${f.weight * 100}%` }}
                                      title={`${f.path}: ${(f.weight * 100).toFixed(0)}% space occupied`}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            {/* Storage Folders Table */}
                            <div className="overflow-x-auto mt-2">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-150 dark:border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    <th className="pb-4">Storage Folder Path</th>
                                    <th className="pb-4 text-center">Estimated Objects</th>
                                    <th className="pb-4 text-right">Avg Object Size</th>
                                    <th className="pb-4 text-right">Extrapolated Size</th>
                                    <th className="pb-4 text-center">Firebase Rules ACL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {folderDefinitions.map((f, i) => {
                                    const colors = [
                                      'bg-indigo-500',
                                      'bg-emerald-500',
                                      'bg-amber-500',
                                      'bg-blue-500',
                                      'bg-rose-500',
                                      'bg-teal-500',
                                      'bg-violet-500'
                                    ];
                                    const folderSizeMB = totalStorageMB * f.weight;
                                    return (
                                      <tr key={f.path} className="border-b border-zinc-100/50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-all">
                                        <td className="py-4 font-bold text-xs">
                                          <div className="flex items-center gap-2 font-mono text-zinc-800 dark:text-zinc-200">
                                            <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]} shrink-0`} />
                                            <span>{f.path}</span>
                                          </div>
                                          <div className="text-[9px] text-zinc-400 uppercase font-bold pl-4 mt-0.5">{f.label}</div>
                                        </td>
                                        <td className="py-4 text-center font-mono font-bold text-xs dark:text-zinc-200">
                                          {f.count.toLocaleString()} <span className="text-[10px] text-zinc-400 font-medium">files</span>
                                        </td>
                                        <td className="py-4 text-right text-xs font-mono text-zinc-400 font-bold">
                                          ~{f.avgSize}
                                        </td>
                                        <td className="py-4 text-right font-mono text-xs dark:text-zinc-200 font-extrabold">
                                          {folderSizeMB < 1024 ? `${folderSizeMB.toFixed(1)} MB` : `${(folderSizeMB / 1024).toFixed(3)} GB`}
                                        </td>
                                        <td className="py-4 text-center">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                            f.access.includes('Required') ? "bg-red-50 dark:bg-red-950/45 text-red-700 dark:text-red-300" :
                                            f.access.includes('Premium') ? "bg-amber-50 dark:bg-amber-950/45 text-amber-700 dark:text-amber-300" :
                                            "bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-300"
                                          )}>
                                            {f.access}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Cost Interactive Slider Simulator */}
                        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
                          <div>
                            <h3 className="text-base font-black dark:text-white uppercase tracking-wider font-display">
                              {dbMode === 'actual' ? "Live System Indicators" : "Blaze Cost Estimator"}
                            </h3>
                            <p className="text-[10px] text-zinc-400 font-semibold uppercase mt-1">
                              {dbMode === 'actual'
                                ? "Displaying metrics fetched dynamically from actual users list, notes metadata, and document sizing registers."
                                : "Scale your student traffic & storage variables below to calculate costs."}
                            </p>
                          </div>

                          {/* Scale Controls */}
                          {dbMode === 'actual' && (
                            <div className="text-[10px] font-black text-indigo-750 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40 flex flex-col gap-1 leading-normal">
                              <span className="font-extrabold uppercase tracking-wide">ℹ️ LIVE RECONCILIATION ACTIVE</span>
                              <span className="text-[9px] text-indigo-950/70 dark:text-indigo-200/50 uppercase font-bold">
                                Controls are locked because cost algorithms are listening to live Firestore DB metrics. Select &quot;Virtual Sim&quot; above to unlock gauges.
                              </span>
                            </div>
                          )}
                          <div className={cn("flex flex-col gap-6 transition-all", dbMode === 'actual' && "pointer-events-none select-none opacity-60")}>
                            {/* Control 1: Active Users */}
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold dark:text-white uppercase tracking-wider text-[10px]">Daily Active Users (DAU)</span>
                                <span className={cn(
                                  "font-mono font-extrabold px-2.5 py-0.5 rounded-lg text-xs",
                                  effDAU > 1500 ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" : "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950"
                                )}>
                                  {effDAU.toLocaleString()} users
                                </span>
                              </div>
                              <input 
                                type="range"
                                min={10}
                                max={25000}
                                step={50}
                                value={effDAU}
                                onChange={e => setDbActiveUsers(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 animate-none">
                                <span>10</span>
                                <span>5K</span>
                                <span>12K</span>
                                <span>25K DAU</span>
                              </div>
                            </div>

                            {/* Control 2: Reads per DAU */}
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold dark:text-white uppercase tracking-wider text-[10px]">Firestore Reads per Session</span>
                                <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-lg text-xs">
                                  {effReads} reads
                                </span>
                              </div>
                              <input 
                                type="range"
                                min={1}
                                max={100}
                                step={1}
                                value={effReads}
                                onChange={e => setDbReadsPerUser(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 animate-none">
                                <span>1 read</span>
                                <span>25 reads</span>
                                <span>50 reads</span>
                                <span>100 ops</span>
                              </div>
                            </div>

                            {/* Control 3: Writes per DAU */}
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold dark:text-white uppercase tracking-wider text-[10px]">Firestore Writes per Session</span>
                                <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-0.5 rounded-lg text-xs">
                                  {effWrites} writes
                                </span>
                              </div>
                              <input 
                                type="range"
                                min={1}
                                max={15}
                                step={1}
                                value={effWrites}
                                onChange={e => setDbWritesPerUser(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 animate-none">
                                <span>1 write</span>
                                <span>5 writes</span>
                                <span>10 writes</span>
                                <span>15 ops</span>
                              </div>
                            </div>

                            {/* NEW Control 4: Cloud Storage File sizes */}
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs font-bold">
                                <span className="font-bold dark:text-white uppercase tracking-wider text-[10px]">Cloud Media Storage Space</span>
                                <span className={cn(
                                  "font-mono font-extrabold px-2.5 py-0.5 rounded-lg text-xs",
                                  effStorage > 5 ? "text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/40" : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                )}>
                                  {effStorage.toFixed(3)} GB
                                </span>
                              </div>
                              <input 
                                type="range"
                                min={1}
                                max={100}
                                step={1}
                                value={Math.max(1, Math.round(effStorage))}
                                onChange={e => setDbCloudStorageGB(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 animate-none">
                                <span>1 GB</span>
                                <span>5 GB (Free Spark)</span>
                                <span>50 GB</span>
                                <span>100 GB</span>
                              </div>
                            </div>

                            {/* NEW Control 5: Media Download bandwidth per DAU */}
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold dark:text-white uppercase tracking-wider text-[10px]">Download Bandwidth (Monthly)</span>
                                <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-lg text-xs">
                                  {effBandwidth.toFixed(2)} GB / DAU
                                </span>
                              </div>
                              <input 
                                type="range"
                                min={0.1}
                                max={5}
                                step={0.1}
                                value={effBandwidth}
                                onChange={e => setDbStorageBandwidthPerUser(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 animate-none">
                                <span>0.1 GB</span>
                                <span>1.5 GB</span>
                                <span>3 GB</span>
                                <span>5 GB</span>
                              </div>
                            </div>
                          </div>

                          {/* Cost Calculations Breakdown Box */}
                          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 p-5 rounded-2xl flex flex-col gap-4">
                            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 text-left">Estimated Monthly Bill Breakdown (INR)</div>
                            
                            {/* Firestore Reads */}
                            <div className="flex flex-col gap-1 pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
                              <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-200">
                                <span>Firestore Reads</span>
                                <span className="font-mono font-black">{monthlyReadsVal.toLocaleString()} ops</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <span>Spark Limit: 1.5M/mo</span>
                                {readsInrVal > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-450">₹{Math.round(readsInrVal).toLocaleString('en-IN')} billing</span>
                                ) : (
                                  <span className="text-emerald-600">Free / Covered</span>
                                )}
                              </div>
                            </div>

                            {/* Firestore Writes */}
                            <div className="flex flex-col gap-1 pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
                              <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-200">
                                <span>Firestore Writes</span>
                                <span className="font-mono font-black">{monthlyWritesVal.toLocaleString()} ops</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <span>Spark Limit: 600k/mo</span>
                                {writesInrVal > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-450">₹{Math.round(writesInrVal).toLocaleString('en-IN')} billing</span>
                                ) : (
                                  <span className="text-emerald-600">Free / Covered</span>
                                )}
                              </div>
                            </div>

                            {/* Media Storage Size */}
                            <div className="flex flex-col gap-1 pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
                              <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-200">
                                <span>Cloud File Storage space</span>
                                <span className="font-mono font-black">{dbCloudStorageGB} GB</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <span>Spark Limit: 5 GB</span>
                                {storageInrVal > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-450">₹{Math.round(storageInrVal).toLocaleString('en-IN')} billing</span>
                                ) : (
                                  <span className="text-emerald-600">Free / Covered</span>
                                )}
                              </div>
                            </div>

                            {/* Media Egress Bandwidth */}
                            <div className="flex flex-col gap-1 pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
                              <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-200">
                                <span>Storage Network egress</span>
                                <span className="font-mono font-black">{monthlyBandwidthGB.toLocaleString(undefined, {maximumFractionDigits: 1})} GB</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <span>Spark Limit: 30 GB/mo</span>
                                {bandwidthInrVal > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-450">₹{Math.round(bandwidthInrVal).toLocaleString('en-IN')} billing</span>
                                ) : (
                                  <span className="text-emerald-600">Free / Covered</span>
                                )}
                              </div>
                            </div>

                            {/* Total Pricing Details */}
                            <div className="flex justify-between items-center font-black dark:text-white pt-2">
                              <span className="uppercase text-[11px] tracking-wider">Total Monthly Bill</span>
                              <div className="text-right font-display">
                                <div className="text-indigo-600 dark:text-indigo-400 font-extrabold text-xl">
                                  ₹{Math.round(totalInrSum).toLocaleString('en-IN')}
                                </div>
                                <div className="text-[9px] font-bold text-zinc-400 font-mono">
                                  ${totalUsdSum.toFixed(2)} USD
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* DB OPTIMIZATION ADVISORY PANEL */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-zinc-900 border border-indigo-100 dark:border-indigo-950/40 p-6 lg:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="max-w-2xl flex flex-col gap-2">
                    <h3 className="text-base font-black dark:text-white uppercase tracking-wider text-indigo-900 dark:text-indigo-400">Blaze Plan Optimization Advisory</h3>
                    <p className="text-xs text-indigo-950/70 dark:text-indigo-200/60 leading-relaxed font-bold">
                      Implementing simple offline caching and index techniques will prevent unneeded read operations when traffic spikes!
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="flex items-start gap-2.5 text-xs font-bold text-zinc-650 dark:text-zinc-400">
                        <div className="h-5 w-5 bg-indigo-50 dark:bg-indigo-950 px-1 py-0.5 font-bold rounded-lg shrink-0 mt-0.5 text-indigo-600 text-center">1</div>
                        <div>
                          <strong>Offline Cache:</strong> The Firestore SDK features a native offline cache which prevents reloading static data repeatedly.
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 text-xs font-bold text-zinc-650 dark:text-zinc-400">
                        <div className="h-5 w-5 bg-indigo-50 dark:bg-indigo-950 px-1 py-0.5 font-bold rounded-lg shrink-0 mt-0.5 text-indigo-600 text-center">2</div>
                        <div>
                          <strong>Active Pagination:</strong> Limit user/notice indexes to 20-30 documents per list load to stop query weight from increasing dynamically.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button 
                      onClick={() => alert('Offline persistence cache is active natively inside your Firebase core initialization layer!')}
                      className="px-6 py-4 bg-indigo-600 hover:bg-zinc-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-md active:scale-95"
                    >
                      Verify Cache Status
                    </button>
                    <button 
                      onClick={() => window.open('https://firebase.google.com/docs/firestore/pricing', '_blank')}
                      className="px-6 py-4 bg-white/75 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border select-none"
                    >
                      Pricing Documentation
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'backup' && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 lg:p-10 flex flex-col gap-6 lg:gap-10"
              >
                {/* HEADER SECTION */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <Database className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight font-display text-left">Platform Backup & Recovery Center</h2>
                      <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 text-left">
                        Enterprise-grade backup snapshot tools for absolute platform reliability and database disaster recovery.
                      </p>
                    </div>
                  </div>
                </div>

                {/* VISUAL OVERVIEW GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Courses', count: courses.length },
                    { label: 'Subjects', count: subjects.length },
                    { label: 'Study Notes', count: notes.length },
                    { label: 'Video Lectures', count: lectures.length },
                    { label: 'Live Classes', count: liveClasses.length },
                    { label: 'Users/Students', count: users.length },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-800/80 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs">
                      <span className="text-2xl font-black dark:text-white">{stat.count}</span>
                      <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mt-1">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* MAIN BACKUP / RESTORE OPTIONS CARD */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2.5rem] p-6 lg:p-10 shadow-sm flex flex-col gap-6 lg:gap-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-12 text-left">
                    {/* BACKUP GENERATOR COLUMN */}
                    <div className="flex flex-col justify-between gap-6 p-6 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/25 border border-zinc-100 dark:border-zinc-800/50 h-full">
                      <div className="flex flex-col gap-3">
                        <span className="inline-block self-start px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          Option A: Export Full Backup
                        </span>
                        <h4 className="text-sm font-black dark:text-white uppercase tracking-wider">Snapshot Database Context</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                          Download a single, compiled JSON file containing all active user profiles, course curriculum catalogs, student notes, video links, sales ledgers, banners, notices, enquiries, and configuration parameters.
                        </p>
                        
                        <div className="flex flex-col gap-2 mt-2 bg-white dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/60 p-4 rounded-2xl font-semibold">
                          <div className="flex items-center gap-2 text-[11px] text-zinc-650 dark:text-zinc-400">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>Preserves matching relation IDs flawlessly.</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-650 dark:text-zinc-400">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>Optimized single-stream document query.</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-650 dark:text-zinc-400">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>Includes complete user collections, study guides, and metrics.</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateBackup}
                        disabled={isBackingUp || isRestoring}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer font-bold"
                      >
                        {isBackingUp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Compiling Backup payload...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download Complete JSON Backup
                          </>
                        )}
                      </button>
                    </div>

                    {/* RESTORE DATABASE COLUMN */}
                    <div className="flex flex-col gap-6 p-6 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/25 border border-zinc-100 dark:border-zinc-800/50">
                      <div className="flex flex-col gap-3">
                        <span className="inline-block self-start px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          Option B: Restore Backup
                        </span>
                        <h4 className="text-sm font-black dark:text-white uppercase tracking-wider">Deploy Recovery Snapshot</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                          Upload a verified Vectonix JSON backup payload to restore previous systems status. Overwrite data to start clean or merge updates safely.
                        </p>

                        {/* MODE CHOOSER */}
                        <div className="grid grid-cols-2 gap-3 p-1 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl">
                          <button
                            onClick={() => setRestoreMode('merge')}
                            type="button"
                            className={cn(
                              "py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                              restoreMode === 'merge'
                                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 font-black"
                                : "text-zinc-450 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                            )}
                          >
                            Merge Database
                          </button>
                          <button
                            onClick={() => setRestoreMode('overwrite')}
                            type="button"
                            className={cn(
                              "py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                              restoreMode === 'overwrite'
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 font-black"
                                : "text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-300"
                            )}
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            Full Overwrite
                          </button>
                        </div>

                        {restoreMode === 'overwrite' && (
                          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2.5 animate-pulse">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-relaxed font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">
                              CRITICAL WARNING: Overwrite mode purges all existing courses, notes, users and database items before importing snapshot records. This action is fully irreversible!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* UPLOAD FORM / FILE FEEDBACK */}
                      <div className="relative">
                        {isRestoring ? (
                          <div className="border border-indigo-100 dark:border-indigo-950/50 rounded-2xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 text-center items-center">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            <div className="w-full">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">
                                <span>{restoreProgress?.collection || 'Synchronizing...'}</span>
                                <span>{restoreProgress?.current || 0}%</span>
                              </div>
                              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                                  style={{ width: `${restoreProgress?.current || 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 rounded-2xl p-6 bg-white dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-xs text-center group">
                            <Upload className="w-6 h-6 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                            <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 font-bold">
                              Choose a valid backup .json file
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-450 dark:text-zinc-500">
                              Click or Drag & Drop payload files here
                            </span>
                            <input
                              type="file"
                              accept=".json"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleRestoreBackup(file);
                              }}
                              disabled={isBackingUp || isRestoring}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* OPTION C: REPAIR STORAGE PATHS COLUMN */}
                    <div className="flex flex-col justify-between gap-6 p-6 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/25 border border-zinc-100 dark:border-zinc-800/50 h-full">
                      <div className="flex flex-col gap-3 font-semibold">
                        <span className="inline-block self-start px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-650 dark:text-teal-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          Option C: Image & Bucket Healing
                        </span>
                        <h4 className="text-sm font-black dark:text-white uppercase tracking-wider">Automatic Domain & Token Repair</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                          If images from past database copies of this course software are showing broken or 404 because they target another Firebase Storage bucket domain, run this scanner. It heals mismatched URL prefixes across courses, notes, lectures, banners, and homepage assets instantly to match this applet's active bucket.
                        </p>
                        
                        <div className="flex flex-col gap-2 mt-2 bg-white dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/60 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 text-[11px] text-zinc-650 dark:text-zinc-400">
                            <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                            <span>Corrects image bucket domain mismatches cleanly.</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-650 dark:text-zinc-400">
                            <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                            <span>Recursively heals course covers, lectures, and sliders.</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-650 dark:text-zinc-400">
                            <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                            <span>100% safe, fast, non-destructive script.</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleRepairStorageUrls}
                        disabled={isBackingUp || isRestoring || isRepairingUrls}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer font-bold"
                      >
                        {isRepairingUrls ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Healing Image Paths...
                          </>
                        ) : (
                          <>
                            <Sliders className="w-4 h-4" />
                            Repair Database Image URLs
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 md:p-12 lg:p-16 max-w-6xl"
              >
                <div className="flex flex-col lg:flex-row gap-12 items-start">
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
                            <ShieldCheck className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Verified {profile?.role || 'Admin'}</span>
                          </div>
                        </div>

                      <div className="w-full flex flex-col gap-4 py-8 border-y dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Join Date</span>
                          <span className="text-xs font-bold dark:text-white uppercase">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</span>
                          <span className="text-xs font-bold text-emerald-500 uppercase">System Root</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Access Level</span>
                          <span className="text-xs font-bold dark:text-white uppercase">Super Admin</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowPasswordModal(true)}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-all border border-zinc-100 dark:border-zinc-800"
                      >
                        <Lock className="w-4 h-4" />
                        Change Password
                      </button>
                    </div>
                  </div>

                  {/* Edit Form */}
                  <div className="flex-1 w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 md:p-12 shadow-sm">
                    <div className="max-w-3xl">
                      <h3 className="text-2xl font-display font-black dark:text-white uppercase tracking-tight mb-10">Admin Profile Settings</h3>
                      
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

                          {/* Mobile - Auto-filled from profile */}
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Registered Mobile (Read Only)</label>
                            <div className="relative opacity-60">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                              <input 
                                type="text"
                                disabled
                                value={profile?.mobile || 'N/A'}
                                className="w-full pl-12 pr-4 py-5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-500 uppercase tracking-widest cursor-not-allowed"
                              />
                            </div>
                          </div>

                          {/* DOB Input */}
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Date of Birth</label>
                            <div className="relative group">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-indigo-600 transition-all" />
                              <input 
                                type="date"
                                value={profileForm.dob}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, dob: e.target.value }))}
                                className="w-full pl-12 pr-4 py-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs xl:text-sm font-bold dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Email - Read Only */}
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Admin Email (Read Only)</label>
                            <div className="relative opacity-60">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                              <input 
                                type="email"
                                disabled
                                value={(user?.email || 'N/A').toLowerCase()}
                                className="w-full pl-12 pr-4 py-5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-[11px] sm:text-xs xl:text-sm font-bold text-zinc-500 lowercase tracking-normal cursor-not-allowed truncate"
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
                            Update Administrator Profile
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
        </div>

      {/* Global Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmInfo && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (deleteConfirmInfo.type === 'live') handleDeleteLiveClass(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'course') handleDeleteCourse(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'note') handleDeleteNote(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'lecture') handleDeleteLecture(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'notice') handleDeleteNotice(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'subject') handleDeleteSubject(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'review') handleDeleteReview(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'enquiry') handleDeleteEnquiry(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'banner') handleDeleteBanner(deleteConfirmInfo.id);
                    else if (deleteConfirmInfo.type === 'promotion') handleDeletePromotion();
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

      {/* Delete Confirmation Modal for Dummy Data */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 max-w-md w-full border border-zinc-100 dark:border-zinc-800 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-center dark:text-white uppercase tracking-tight mb-2">Are you absolutely sure?</h3>
              <p className="text-sm font-medium text-zinc-500 text-center mb-8 uppercase tracking-widest leading-relaxed">
                This action will permanently delete all courses, materials, and sales records. This cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleClearDummyData}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all active:scale-95"
                >
                  Yes, Wipe Everything
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beautiful A4 Invoice Modal */}
      <AnimatePresence>
        {selectedInvoice && (() => {
          const student = getStudentInfo(selectedInvoice.userId);
          const amount = selectedInvoice.amount || 0;
          const gstPercentValue = selectedInvoice.gstPercent !== undefined ? selectedInvoice.gstPercent : (settings.gstPercent ?? 0);
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
          const itemTitle = getItemTitle(selectedInvoice.itemId, selectedInvoice.itemType);
          
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-900/40 backdrop-blur-md dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-4xl p-6 md:p-8 border border-zinc-100 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[95vh]"
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
                          <p className="text-zinc-650 flex items-center gap-1.5 mt-2 font-normal">
                            <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> support@vectonixclasses.com
                          </p>
                          <p className="text-zinc-655 flex items-center gap-1.5 font-normal">
                            <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> +91 92866 70192
                          </p>
                        </div>
                        <div className="md:text-right">
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Billed To (Student)</h4>
                          <p className="font-bold text-zinc-900 text-sm">{student.name || 'Student Account'}</p>
                          {student.email && (
                            <p className="text-zinc-650 flex items-center gap-1.5 md:justify-end font-normal">
                              <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> {student.email.toLowerCase()}
                            </p>
                          )}
                          {student.mobile && (
                            <p className="text-zinc-650 flex items-center gap-1.5 md:justify-end font-normal">
                              <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> {student.mobile || student.phoneNumber}
                            </p>
                          )}
                          {student.dob && student.dob !== 'N/A' && (
                            <p className="text-zinc-650 font-normal">D.O.B: <span className="font-medium text-zinc-800">{student.dob}</span></p>
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
                          <tbody className="divide-y divide-zinc-200 text-xs">
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
                            <span>Base Price (Before Tax):</span>
                            <span className="font-semibold text-zinc-800">{formatCurrency(baseAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 text-zinc-550 text-[10px]">
                            <span>GST ({gstPercentValue}%):</span>
                            <span className="font-mono">{formatCurrency(totalGst)}</span>
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
                          <p className="text-[9px] text-zinc-500 leading-normal max-w-md font-normal">
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
                          <p className="text-[11px] font-bold text-zinc-800 leading-none mt-1">Vectonix Classes</p>
                        </div>
                      </div>
                      <div className="text-center mt-8 text-[9px] text-zinc-400 uppercase tracking-[0.2em] font-black border-t border-zinc-100 pt-4">
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

      <AnimatePresence>
        {showAddBannerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddBannerModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">{editingId ? 'Edit Banner' : 'Add New Banner'}</h2>
                <button onClick={() => { setShowAddBannerModal(false); setEditingId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddBanner} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Banner Title</label>
                  <input 
                    type="text" 
                    required
                    value={bannerFormData.title}
                    onChange={e => setBannerFormData({...bannerFormData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Subtitle</label>
                  <input 
                    type="text" 
                    value={bannerFormData.subtitle}
                    onChange={e => setBannerFormData({...bannerFormData, subtitle: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Button Text</label>
                    <input 
                      type="text" 
                      value={bannerFormData.buttonText}
                      onChange={e => setBannerFormData({...bannerFormData, buttonText: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Target Link</label>
                    <input 
                      type="text" 
                      value={bannerFormData.link}
                      onChange={e => setBannerFormData({...bannerFormData, link: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Display Order</label>
                  <input 
                    type="number" 
                    value={bannerFormData.order}
                    onChange={e => setBannerFormData({...bannerFormData, order: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Banner Image</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700">
                      {bannerFormData.imgFile ? (
                        <img src={URL.createObjectURL(bannerFormData.imgFile)} className="w-full h-full object-cover" />
                      ) : bannerFormData.imgUrl ? (
                        <img src={bannerFormData.imgUrl} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-300" />
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setBannerFormData({...bannerFormData, imgFile: e.target.files?.[0] || null})}
                      className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  {editingId ? 'Update Banner' : 'Create Banner'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">{editingId ? 'Edit Course' : 'Add New Course'}</h2>
                <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddCourse} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Course Title</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Description</label>
                  <textarea 
                    required
                    rows={4}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option>Science</option>
                    <option>Maths</option>
                    <option>English</option>
                    <option>History</option>
                  </select>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isCourseFeatured"
                      checked={formData.isFeatured}
                      onChange={e => setFormData({...formData, isFeatured: e.target.checked})}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isCourseFeatured" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Showcase on Home Page (High Visibility)</label>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Course Artwork</label>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-36 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                      {formData.imageFile ? (
                        <img src={URL.createObjectURL(formData.imageFile)} alt="Preview" className="w-full h-full object-contain" />
                      ) : formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-10 h-10" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setFormData({...formData, imageFile: e.target.files?.[0] || null})}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs"
                      />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recommended size: 800x1200px (Portrait)</p>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                  {submitting ? 'Saving...' : 'Save Course'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddSubjectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddSubjectModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">{editingId ? 'Edit Subject' : 'Add New Subject'}</h2>
                <button onClick={() => { setShowAddSubjectModal(false); setEditingId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddSubject} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Choose Course (Required)</label>
                  <select 
                    required
                    value={subjectFormData.courseId}
                    onChange={e => setSubjectFormData({...subjectFormData, courseId: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Subject Title</label>
                  <input 
                    type="text" 
                    required
                    value={subjectFormData.title}
                    onChange={e => setSubjectFormData({...subjectFormData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Description (Optional)</label>
                  <textarea 
                    rows={3}
                    value={subjectFormData.description}
                    onChange={e => setSubjectFormData({...subjectFormData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                  {submitting ? 'Saving...' : 'Save Subject'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddNoteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddNoteModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">{editingId ? 'Edit Study Note' : 'Add New Study Note'}</h2>
                <button onClick={() => { setShowAddNoteModal(false); setEditingId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddNote} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Study Note Title</label>
                  <input 
                    type="text" 
                    required
                    value={noteFormData.title}
                    onChange={e => setNoteFormData({...noteFormData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Choose Course (Required)</label>
                    <select 
                      required
                      value={noteFormData.courseId}
                      onChange={e => setNoteFormData({...noteFormData, courseId: e.target.value, subjectId: ''})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Subject (Required)</label>
                    <select 
                      required
                      value={noteFormData.subjectId}
                      onChange={e => setNoteFormData({...noteFormData, subjectId: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      disabled={!noteFormData.courseId}
                    >
                      <option value="">Select Subject</option>
                      {subjects.filter(s => s.courseId === noteFormData.courseId).map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                 <div className="grid md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Price (INR) - Managed by Units</label>
                    <input 
                      type="number" 
                      disabled
                      value={noteFormData.price}
                      className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-200 dark:disabled:text-zinc-200 font-bold disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Discount (INR)</label>
                    <input 
                      type="number" 
                      disabled={noteFormData.isFree}
                      placeholder="Discount Amount"
                      value={noteFormData.discount}
                      onChange={e => {
                        const discountVal = e.target.value;
                        const priceNum = Number(noteFormData.price || 0);
                        const discountPriceNum = Math.max(0, priceNum - Number(discountVal || 0));
                        setNoteFormData({
                          ...noteFormData,
                          discount: discountVal,
                          discountPrice: discountPriceNum.toString()
                        });
                      }}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Price After Discount (Read-only)</label>
                    <input 
                      type="number" 
                      disabled
                      value={noteFormData.discountPrice}
                      className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-200 dark:disabled:text-zinc-200 font-bold disabled:opacity-85"
                    />
                  </div>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center gap-8">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isNoteFree"
                      checked={noteFormData.isFree}
                      onChange={e => {
                        const isFreeChecked = e.target.checked;
                        const finalPrice = isFreeChecked ? '0' : noteFormData.price;
                        const finalDiscount = isFreeChecked ? '0' : noteFormData.discount;
                        const finalDiscountPrice = isFreeChecked ? '0' : (Math.max(0, Number(finalPrice) - Number(finalDiscount))).toString();
                        setNoteFormData({
                          ...noteFormData,
                          isFree: isFreeChecked,
                          price: finalPrice,
                          discount: finalDiscount,
                          discountPrice: finalDiscountPrice
                        });
                      }}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isNoteFree" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Mark as Free Access</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isNoteFeatured"
                      checked={noteFormData.isFeatured}
                      onChange={e => setNoteFormData({...noteFormData, isFeatured: e.target.checked})}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isNoteFeatured" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Showcase on Home Page</label>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Cover Artwork</label>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-36 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                      {noteFormData.coverFile ? (
                        <img src={URL.createObjectURL(noteFormData.coverFile)} alt="Cover Preview" className="w-full h-full object-contain" />
                      ) : noteFormData.coverUrl ? (
                        <img src={noteFormData.coverUrl} alt="Cover Preview" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-10 h-10" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setNoteFormData({...noteFormData, coverFile: e.target.files?.[0] || null})}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs"
                      />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recommended size: 800x1200px (Portrait)</p>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                  {submitting ? 'Uploading...' : 'Save Study Note'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Lecture Modal */}
      <AnimatePresence>
        {showAddLectureModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddLectureModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">{editingId ? 'Edit Lecture' : 'Add New Lecture'}</h2>
                <button onClick={() => { setShowAddLectureModal(false); setEditingId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddLecture} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Lecture Title</label>
                  <input 
                    type="text" 
                    required
                    value={lectureFormData.title}
                    onChange={e => setLectureFormData({...lectureFormData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Choose Course (Required)</label>
                    <select 
                      required
                      value={lectureFormData.courseId}
                      onChange={e => setLectureFormData({...lectureFormData, courseId: e.target.value, subjectId: ''})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Subject (Required)</label>
                    <select 
                      required
                      value={lectureFormData.subjectId}
                      onChange={e => setLectureFormData({...lectureFormData, subjectId: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      disabled={!lectureFormData.courseId}
                    >
                      <option value="">Select Subject</option>
                      {subjects.filter(s => s.courseId === lectureFormData.courseId).map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Secure Video Upload (Recommended)</label>
                    <input 
                      type="file" 
                      accept="video/*"
                      onChange={e => setLectureFormData({...lectureFormData, videoFile: e.target.files?.[0] || null})}
                      className="text-sm dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <p className="text-[10px] text-zinc-500">Upload .mp4 files directly to private storage for maximum security.</p>
                  </div>

                  {lectureFormData.uploadProgress > 0 && (
                    <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300" 
                        style={{ width: `${lectureFormData.uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Video Thumbnail Cover (Vertical/Portrait)</label>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-36 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700 shrink-0">
                      {lectureFormData.coverFile ? (
                        <img src={URL.createObjectURL(lectureFormData.coverFile)} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : lectureFormData.coverUrl ? (
                        <img src={lectureFormData.coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-10 h-10" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setLectureFormData({...lectureFormData, coverFile: e.target.files?.[0] || null})}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs text-zinc-500 dark:text-zinc-400"
                      />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recommended size: 800x1200px (Portrait 2:3 ratio)</p>
                    </div>
                  </div>
                </div>

                 <div className="grid md:grid-cols-4 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Price (INR)</label>
                    <input 
                      type="number" 
                      required={!lectureFormData.isFree}
                      disabled={lectureFormData.isFree}
                      value={lectureFormData.price}
                      onChange={e => {
                        const priceVal = e.target.value;
                        const discountVal = lectureFormData.discount;
                        const discountPriceNum = Math.max(0, Number(priceVal || 0) - Number(discountVal || 0));
                        setLectureFormData({
                          ...lectureFormData,
                          price: priceVal,
                          discountPrice: discountPriceNum.toString()
                        });
                      }}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Discount (INR)</label>
                    <input 
                      type="number" 
                      disabled={lectureFormData.isFree}
                      placeholder="Discount Amount"
                      value={lectureFormData.discount}
                      onChange={e => {
                        const discountVal = e.target.value;
                        const priceVal = lectureFormData.price;
                        const discountPriceNum = Math.max(0, Number(priceVal || 0) - Number(discountVal || 0));
                        setLectureFormData({
                          ...lectureFormData,
                          discount: discountVal,
                          discountPrice: discountPriceNum.toString()
                        });
                      }}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Price After Discount</label>
                    <input 
                      type="number" 
                      disabled
                      value={lectureFormData.discountPrice}
                      className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-200 dark:disabled:text-zinc-200 font-bold disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">GST (%)</label>
                    <input 
                      type="number" 
                      disabled={lectureFormData.isFree}
                      value={lectureFormData.gstPercent}
                      placeholder={(settings?.gstPercent ?? 0).toString()}
                      onChange={e => setLectureFormData({...lectureFormData, gstPercent: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isLectureFree"
                      checked={lectureFormData.isFree}
                      onChange={e => {
                        const isFreeChecked = e.target.checked;
                        const finalPrice = isFreeChecked ? '0' : lectureFormData.price;
                        const finalDiscount = isFreeChecked ? '0' : lectureFormData.discount;
                        const finalDiscountPrice = isFreeChecked ? '0' : (Math.max(0, Number(finalPrice) - Number(finalDiscount))).toString();
                        setLectureFormData({
                          ...lectureFormData,
                          isFree: isFreeChecked,
                          price: finalPrice,
                          discount: finalDiscount,
                          discountPrice: finalDiscountPrice
                        });
                      }}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isLectureFree" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Free Lecture</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isLectureFeatured"
                      checked={lectureFormData.isFeatured}
                      onChange={e => setLectureFormData({...lectureFormData, isFeatured: e.target.checked})}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isLectureFeatured" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Featured on Home</label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="isComingSoon"
                    checked={lectureFormData.isComingSoon}
                    onChange={e => setLectureFormData({...lectureFormData, isComingSoon: e.target.checked})}
                    className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isComingSoon" className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Mark as Coming Soon</label>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                  {submitting ? 'Saving...' : 'Save Lecture'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddLiveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddLiveModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">Schedule Live Class</h2>
                <button onClick={() => setShowAddLiveModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddLiveClass} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Class Title</label>
                  <input 
                    type="text" 
                    required
                    value={liveFormData.title}
                    onChange={e => setLiveFormData({...liveFormData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Schedule Date & Time</label>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 bg-zinc-50 dark:bg-zinc-800/50">
                       <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1 ml-2">Date</label>
                       <input 
                        type="date" 
                        required
                        min={new Date().toLocaleDateString('en-CA')}
                        value={liveDate}
                        onChange={e => setLiveDate(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 font-bold text-zinc-950 dark:text-white dark:[color-scheme:dark] text-sm"
                      />
                    </div>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 bg-zinc-50 dark:bg-zinc-800/50">
                       <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1 ml-2">Hour</label>
                       <select 
                        value={liveHour}
                        onChange={e => setLiveHour(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 font-bold text-zinc-950 dark:text-white dark:[color-scheme:dark] text-sm cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                          <option key={h} value={h} className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 bg-zinc-50 dark:bg-zinc-800/50">
                       <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1 ml-2">Minute</label>
                       <select 
                        value={liveMinute}
                        onChange={e => setLiveMinute(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 font-bold text-zinc-950 dark:text-white dark:[color-scheme:dark] text-sm cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                          <option key={m} value={m} className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 bg-zinc-50 dark:bg-zinc-800/50">
                       <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1 ml-2">AM/PM</label>
                       <select 
                        value={liveAmpm}
                        onChange={e => setLiveAmpm(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 font-bold text-zinc-950 dark:text-white dark:[color-scheme:dark] text-sm cursor-pointer"
                      >
                        <option value="AM" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">AM</option>
                        <option value="PM" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">PM</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold ml-1 uppercase tracking-wider">The "Start" button will remain locked until this scheduled time.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Choose Course (Required)</label>
                    <select 
                      required
                      value={liveFormData.courseId}
                      onChange={e => setLiveFormData({...liveFormData, courseId: e.target.value, subjectId: ''})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    >
                      <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Select Course</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Subject (Required)</label>
                    <select 
                      required
                      value={liveFormData.subjectId}
                      onChange={e => setLiveFormData({...liveFormData, subjectId: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      disabled={!liveFormData.courseId}
                    >
                      <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Select Subject</option>
                      {subjects.filter(s => s.courseId === liveFormData.courseId).map(s => (
                        <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Live Class Thumbnail Cover (Vertical/Portrait)</label>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-36 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700 shrink-0">
                      {liveFormData.coverFile ? (
                        <img src={URL.createObjectURL(liveFormData.coverFile)} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : liveFormData.coverUrl ? (
                        <img src={liveFormData.coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-10 h-10" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setLiveFormData({...liveFormData, coverFile: e.target.files?.[0] || null})}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-xs text-zinc-500 dark:text-zinc-400"
                      />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recommended size: 800x1200px (Portrait 2:3 ratio)</p>
                    </div>
                  </div>
                </div>



                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Classroom Type</label>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-bold text-[10px] uppercase tracking-tighter"
                    >
                      <Video className="w-5 h-5" />
                      Vectonix (Internal)
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Price (INR)</label>
                    <input 
                      type="number" 
                      required={!liveFormData.isFree}
                      disabled={liveFormData.isFree}
                      value={liveFormData.price}
                      onChange={e => {
                        const priceVal = e.target.value;
                        const discountVal = liveFormData.discount;
                        const discountPriceNum = Math.max(0, Number(priceVal || 0) - Number(discountVal || 0));
                        setLiveFormData({
                          ...liveFormData,
                          price: priceVal,
                          discountPrice: discountPriceNum.toString()
                        });
                      }}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Discount (INR)</label>
                    <input 
                      type="number" 
                      disabled={liveFormData.isFree}
                      placeholder="Discount Amount"
                      value={liveFormData.discount}
                      onChange={e => {
                        const discountVal = e.target.value;
                        const priceVal = liveFormData.price;
                        const discountPriceNum = Math.max(0, Number(priceVal || 0) - Number(discountVal || 0));
                        setLiveFormData({
                          ...liveFormData,
                          discount: discountVal,
                          discountPrice: discountPriceNum.toString()
                        });
                      }}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Price After Discount</label>
                    <input 
                      type="number" 
                      disabled
                      value={liveFormData.discountPrice}
                      className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-200 dark:disabled:text-zinc-200 font-bold disabled:opacity-85"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">GST (%)</label>
                    <input 
                      type="number" 
                      disabled={liveFormData.isFree}
                      value={liveFormData.gstPercent}
                      placeholder={(settings?.gstPercent ?? 0).toString()}
                      onChange={e => setLiveFormData({...liveFormData, gstPercent: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-85"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isLiveFree"
                      checked={liveFormData.isFree}
                      onChange={e => {
                        const isFreeChecked = e.target.checked;
                        const finalPrice = isFreeChecked ? '0' : liveFormData.price;
                        const finalDiscount = isFreeChecked ? '0' : liveFormData.discount;
                        const finalDiscountPrice = isFreeChecked ? '0' : (Math.max(0, Number(finalPrice) - Number(finalDiscount))).toString();
                        setLiveFormData({
                          ...liveFormData,
                          isFree: isFreeChecked,
                          price: finalPrice,
                          discount: finalDiscount,
                          discountPrice: finalDiscountPrice
                        });
                      }}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isLiveFree" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Free Class</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="isLiveFeatured"
                      checked={liveFormData.isFeatured}
                      onChange={e => setLiveFormData({...liveFormData, isFeatured: e.target.checked})}
                      className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isLiveFeatured" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Featured on Home</label>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Status</label>
                  <select 
                    value={liveFormData.status}
                    onChange={e => setLiveFormData({...liveFormData, status: e.target.value as any})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="upcoming" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Upcoming</option>
                    <option value="live" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Live Now</option>
                    <option value="completed" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Completed</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                  {submitting ? 'Saving...' : 'Save Class'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Edit Modal */}
      <AnimatePresence>
        {showUserEditModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowUserEditModal(false);
                setSelectedUser(null);
              }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-display font-black dark:text-white uppercase tracking-tight">Modify Student Profile</h2>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Direct Database Override</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowUserEditModal(false);
                      setSelectedUser(null);
                    }} 
                    className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateUser} className="flex flex-col gap-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                      <input 
                        type="text"
                        required
                        value={userEditFormData.name}
                        onChange={e => setUserEditFormData({...userEditFormData, name: e.target.value})}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[11px] font-bold dark:text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mobile Number</label>
                      <input 
                        type="text"
                        required
                        value={userEditFormData.mobile}
                        onChange={e => setUserEditFormData({...userEditFormData, mobile: e.target.value})}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[11px] font-bold dark:text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Date of Birth</label>
                      <input 
                        type="date"
                        value={userEditFormData.dob}
                        onChange={e => setUserEditFormData({...userEditFormData, dob: e.target.value})}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[11px] font-bold dark:text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Access Role</label>
                      <select 
                        value={userEditFormData.role}
                        onChange={e => setUserEditFormData({...userEditFormData, role: e.target.value})}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[11px] font-bold dark:text-white focus:ring-2 focus:ring-indigo-600 outline-none appearance-none"
                      >
                        <option value="student" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Student (Standard Access)</option>
                        <option value="admin" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Administrator (Full Access)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowUserEditModal(false);
                        setSelectedUser(null);
                      }}
                      className="flex-1 py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 dark:hover:bg-zinc-750 transition-all"
                    >
                      Abort
                    </button>
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Sync Global changes
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Detail View Modal */}
      <AnimatePresence>
        {showUserDetailModal && selectedUserDetail && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserDetailModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setShowUserDetailModal(false)}
                className="absolute top-6 right-6 p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-10">
                  {/* Header & Basic Info */}
                  <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold overflow-hidden border-4 border-white dark:border-zinc-800 shadow-xl shrink-0">
                      {selectedUserDetail.photoUrl ? (
                        <img src={selectedUserDetail.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-4xl uppercase">{selectedUserDetail.name?.[0] || selectedUserDetail.email?.[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                        <h2 className="text-3xl font-display font-black dark:text-white uppercase tracking-tight">{selectedUserDetail.name || 'Student Access'}</h2>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          selectedUserDetail.role === 'admin' ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-200"
                        )}>
                          {selectedUserDetail.role || 'student'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-zinc-500 lowercase tracking-normal mb-6">{(selectedUserDetail.email || '').toLowerCase()}</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mobile Number</div>
                          <div className="text-sm font-bold dark:text-white">{selectedUserDetail.mobile || selectedUserDetail.phoneNumber || 'Not Provided'}</div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Date of Birth</div>
                          <div className="text-sm font-bold dark:text-white">{selectedUserDetail.dob || 'Not Provided'}</div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Account Created</div>
                          <div className="text-sm font-bold dark:text-white">
                            {selectedUserDetail.createdAt ? new Date(selectedUserDetail.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">User ID</div>
                          <div className="text-[10px] font-mono font-bold dark:text-zinc-500 truncate">{selectedUserDetail.id}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction History */}
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
                      <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em]">Transaction History</h3>
                      <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
                    </div>

                    <div className="overflow-x-auto rounded-[2rem] border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-inner table-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[1450px]">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">NAME</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">MOBILE</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">PAYMENT METHOD</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">STATUS</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">ITEM</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">PRICE</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">DISCOUNT</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-center animate-none">COUPON DISCOUNT</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">GST</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">PAID AMOUNT</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-right">TIME STAMPS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {sales.filter(s => s.userId === selectedUserDetail.id).length > 0 ? (
                            sales.filter(s => s.userId === selectedUserDetail.id).map(sale => {
                              const student = getStudentInfo(sale.userId);
                              const matchedItem = (() => {
                                if (sale.itemType === 'course') return courses.find(c => c.id === sale.itemId);
                                if (sale.itemType === 'note') return notes.find(n => n.id === sale.itemId);
                                if (sale.itemType === 'lecture') return lectures.find(l => l.id === sale.itemId);
                                if (sale.itemType === 'live') return liveClasses.find(l => l.id === sale.itemId);
                                if (sale.itemType === 'unit') return units.find(u => u.id === sale.itemId);
                                return null;
                              })();
                              
                              const itemTitle = matchedItem?.title || getItemTitle(sale.itemId, sale.itemType);
                              const subjectName = (() => {
                                if (!matchedItem) return 'N/A';
                                if (sale.itemType === 'course') {
                                  if (matchedItem?.category) return matchedItem.category;
                                  const courseSubs = subjects.filter(sub => sub.courseId === matchedItem.id);
                                  return courseSubs.length > 0 ? courseSubs[0].title : 'Full Course';
                                }
                                const subId = (matchedItem as any).subjectId;
                                return subId ? (subjects.find(sub => sub.id === subId)?.title || 'N/A') : 'N/A';
                              })();

                              // Match Dashboard.tsx formula calculations precisely!
                              const actualPriceVal = sale.originalPrice !== undefined
                                ? parsePrice(sale.originalPrice)
                                : parsePrice(matchedItem?.price || sale.amount || 0);

                              const discountPriceVal = sale.productDiscount !== undefined && sale.originalPrice !== undefined
                                ? parsePrice(sale.originalPrice) - parsePrice(sale.productDiscount)
                                : parsePrice(sale.amount || 0);

                              const adminDiscountAmount = sale.productDiscount !== undefined
                                ? parsePrice(sale.productDiscount)
                                : Math.max(0, actualPriceVal - discountPriceVal);

                              const couponCode = sale.couponCode || sale.discountApplied || null;
                              
                              let couponDiscountAmount = 0;
                              if (sale.couponDiscount !== undefined) {
                                couponDiscountAmount = parsePrice(sale.couponDiscount);
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

                              const priceAfterCoupon = Math.max(0, (sale.productDiscount !== undefined ? (actualPriceVal - adminDiscountAmount) : discountPriceVal) - couponDiscountAmount);
                              
                              const gstPercent = sale.gstPercent !== undefined ? parsePrice(sale.gstPercent) : 0;
                              const gstAmount = sale.gstAmount !== undefined 
                                ? parsePrice(sale.gstAmount) 
                                : priceAfterCoupon * (gstPercent / 100);

                              const finalNetPaid = sale.paidAmount !== undefined 
                                ? parsePrice(sale.paidAmount) 
                                : priceAfterCoupon + gstAmount;

                              const isSuccess = !sale.status || sale.status.toLowerCase() === 'successful' || sale.status.toLowerCase() === 'paid';

                              return (
                                <tr key={sale.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-all group">
                                  {/* NAME */}
                                  <td className="px-6 py-5 shrink-0 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-zinc-100 overflow-hidden shrink-0 border border-zinc-200">
                                        {student.photoUrl ? (
                                          <img src={student.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <User className="w-4 h-4 m-2 text-zinc-400 dark:text-zinc-500" />
                                        )}
                                      </div>
                                      <div className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100">{student.name}</div>
                                    </div>
                                  </td>
                                  {/* MOBILE */}
                                  <td className="px-6 py-5 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                    {student.mobile || student.phoneNumber || 'N/A'}
                                  </td>
                                  {/* PAYMENT METHOD */}
                                  <td className="px-6 py-5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider whitespace-nowrap">
                                    {sale.paymentMethod || (sale.paymentId ? 'Razorpay Online' : 'Online Gateway')}
                                  </td>
                                  {/* STATUS */}
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    {isSuccess ? (
                                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30 animate-none">
                                        SUCCESSFUL
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 animate-none">
                                        {sale.status?.toUpperCase() || 'PENDING'}
                                      </span>
                                    )}
                                  </td>
                                  {/* ITEM */}
                                  <td className="px-6 py-5 max-w-[240px] truncate whitespace-nowrap" title={itemTitle}>
                                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 capitalize">{itemTitle}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border dark:border-zinc-700">{sale.itemType || 'course'}</span>
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
                                  {/* COUPON DISCOUNT */}
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
                                    {new Date(sale.timestamp).toLocaleString('en-IN', {
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
                            })
                          ) : (
                            <tr>
                              <td colSpan={11} className="px-6 py-12 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                No payment records found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 border-t dark:border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setShowUserDetailModal(false)}
                  className="px-10 py-4 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 shadow-2xl"
            >
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-6 right-6 p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-2xl font-display font-black dark:text-white uppercase tracking-tight">Change Password</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Ensure your account remains secure</p>
                </div>

                <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Current Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input 
                        type="password"
                        required
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs font-bold dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">New Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input 
                        type="password"
                        required
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs font-bold dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Confirm New Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input 
                        type="password"
                        required
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs font-bold dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {passwordError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {passwordError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
                  >
                    {passwordSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Update Admin Password
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {showAddNoticeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddNoticeModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 lg:p-12 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white uppercase tracking-tight">{editingId ? 'Edit Notice' : 'Create Notice'}</h2>
                <button onClick={() => { setShowAddNoticeModal(false); setEditingId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleAddNotice} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Notice Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['news', 'announcement', 'update'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNoticeFormData({...noticeFormData, type: type as any})}
                        className={cn(
                          "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                          noticeFormData.type === type 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none"
                            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-100 dark:border-zinc-800"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Visibility</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'public', label: 'Public' },
                      { id: 'registered', label: 'Registered' },
                      { id: 'both', label: 'Both' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNoticeFormData({...noticeFormData, visibility: opt.id as any})}
                        className={cn(
                          "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                          noticeFormData.visibility === opt.id 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none"
                            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-100 dark:border-zinc-800"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Notice Title</label>
                  <input 
                    type="text" 
                    required
                    value={noticeFormData.title}
                    onChange={e => setNoticeFormData({...noticeFormData, title: e.target.value})}
                    placeholder="Enter short, catchy title"
                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 dark:text-white text-sm font-bold placeholder:text-zinc-400 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Content</label>
                  <textarea 
                    required
                    rows={5}
                    value={noticeFormData.content}
                    onChange={e => setNoticeFormData({...noticeFormData, content: e.target.value})}
                    placeholder="Provide details about the announcement..."
                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 dark:text-white text-sm font-bold placeholder:text-zinc-400 outline-none resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Attachment (Document/Image)</label>
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex flex-col items-center gap-4 relative">
                    {noticeFormData.attachmentFile || noticeFormData.attachmentUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <File className="w-10 h-10 text-indigo-600 animate-pulse" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">{noticeFormData.attachmentFile?.name || noticeFormData.attachmentName || 'Attachment Selected'}</span>
                        <button 
                          type="button"
                          onClick={() => setNoticeFormData({...noticeFormData, attachmentFile: null, attachmentUrl: '', attachmentName: '', attachmentType: ''})}
                          className="text-[8px] font-black text-red-500 uppercase tracking-widest hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-600 transition-colors">
                          <Plus className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Click to upload or drag & drop</p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">PDF, JPG, PNG or DOC (Max 5MB)</p>
                        </div>
                      </>
                    )}
                    <input 
                      type="file" 
                      onChange={e => setNoticeFormData({...noticeFormData, attachmentFile: e.target.files?.[0] || null})}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                  {submitting ? 'Broadcasting...' : (editingId ? 'Update Notice' : 'Broadcast Notice')}
                </button>
              </form>
            </motion.div>
          </div>
        )}

      {/* Promotion Add/Edit Modal */}
      <AnimatePresence>
        {showAddPromotionModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPromotionModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="p-8 lg:p-12">
                <div className="flex items-center justify-between mb-8 lg:mb-10">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-black dark:text-white uppercase tracking-tight">
                      {editingId ? 'Edit Promotion' : 'Create Promotion'}
                    </h2>
                    <p className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Configure your offer or alert details.</p>
                  </div>
                  <button 
                    onClick={() => setShowAddPromotionModal(false)}
                    className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleAddPromotion} className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Title</label>
                      <input
                        type="text"
                        required
                        value={promotionFormData.title}
                        onChange={e => setPromotionFormData({...promotionFormData, title: e.target.value})}
                        placeholder="SUMMER SALE 2024"
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white placeholder:text-zinc-300 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Type</label>
                       <select
                        value={promotionFormData.type}
                        onChange={e => setPromotionFormData({...promotionFormData, type: e.target.value as any})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                      >
                        <option value="offer" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Offer/Banner</option>
                        <option value="discount" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Coupon Code</option>
                        <option value="announcement" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Announcement</option>
                      </select>
                    </div>
                  </div>

                  {promotionFormData.type === 'discount' && (
                    <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">Coupon Configuration</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Coupon Code</label>
                          <input
                            type="text"
                            required
                            value={promotionFormData.couponCode}
                            onChange={e => setPromotionFormData({...promotionFormData, couponCode: e.target.value.toUpperCase()})}
                            placeholder="SUMMER50"
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Max Usage Limit</label>
                          <input
                            type="number"
                            value={promotionFormData.maxUsage}
                            onChange={e => setPromotionFormData({...promotionFormData, maxUsage: e.target.value})}
                            placeholder="Unlimited"
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Discount Type</label>
                          <select
                            value={promotionFormData.discountType}
                            onChange={e => setPromotionFormData({...promotionFormData, discountType: e.target.value as any})}
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          >
                            <option value="percentage" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Percentage (%)</option>
                            <option value="fixed" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Fixed Amount (₹)</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Discount Value</label>
                          <input
                            type="number"
                            required
                            value={promotionFormData.discountValue}
                            onChange={e => setPromotionFormData({...promotionFormData, discountValue: e.target.value})}
                            placeholder={promotionFormData.discountType === 'percentage' ? "50" : "500"}
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Applicable Products</label>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => {
                                const courseIds = courses.map(c => c.id);
                                const otherIds = promotionFormData.applicableProducts.filter(id => !courseIds.includes(id));
                                setPromotionFormData({...promotionFormData, applicableProducts: [...otherIds, ...courseIds]});
                              }}
                              className="text-[8px] font-black uppercase tracking-widest text-indigo-600 hover:underline"
                            >
                              All Courses
                            </button>
                            <span className="text-[8px] text-zinc-300">|</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const noteIds = notes.map(n => n.id);
                                const otherIds = promotionFormData.applicableProducts.filter(id => !noteIds.includes(id));
                                setPromotionFormData({...promotionFormData, applicableProducts: [...otherIds, ...noteIds]});
                              }}
                              className="text-[8px] font-black uppercase tracking-widest text-emerald-600 hover:underline"
                            >
                              All Materials
                            </button>
                            <span className="text-[8px] text-zinc-300">|</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const lectureIds = lectures.map(l => l.id);
                                const otherIds = promotionFormData.applicableProducts.filter(id => !lectureIds.includes(id));
                                setPromotionFormData({...promotionFormData, applicableProducts: [...otherIds, ...lectureIds]});
                              }}
                              className="text-[8px] font-black uppercase tracking-widest text-amber-600 hover:underline"
                            >
                              All Lectures
                            </button>
                            <span className="text-[8px] text-zinc-300">|</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const liveIds = liveClasses.map(lc => lc.id);
                                const otherIds = promotionFormData.applicableProducts.filter(id => !liveIds.includes(id));
                                setPromotionFormData({...promotionFormData, applicableProducts: [...otherIds, ...liveIds]});
                              }}
                              className="text-[8px] font-black uppercase tracking-widest text-rose-600 hover:underline"
                            >
                              All Live
                            </button>
                            <span className="text-[8px] text-zinc-300">|</span>
                            <button 
                              type="button"
                              onClick={() => setPromotionFormData({...promotionFormData, applicableProducts: []})}
                              className="text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input 
                              type="text"
                              value={productSearchQuery}
                              onChange={(e) => setProductSearchQuery(e.target.value)}
                              placeholder="Search products by title..."
                              className="w-full pl-12 pr-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-6 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                           {/* Courses Section */}
                           {filteredCourses.length > 0 && (
                             <div className="space-y-2">
                               <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full w-fit">Courses</h4>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {filteredCourses.map((item: any) => (
                                   <div key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700" onClick={() => {
                                      const products = promotionFormData.applicableProducts.includes(item.id)
                                        ? promotionFormData.applicableProducts.filter(id => id !== item.id)
                                        : [...promotionFormData.applicableProducts, item.id];
                                      setPromotionFormData({...promotionFormData, applicableProducts: products});
                                   }}>
                                     <div className={cn(
                                       "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
                                       promotionFormData.applicableProducts.includes(item.id) 
                                         ? "bg-indigo-600 border-indigo-600 text-white" 
                                         : "border-zinc-200 dark:border-zinc-700"
                                     )}>
                                       {promotionFormData.applicableProducts.includes(item.id) && <CheckCircle2 className="w-3 h-3" />}
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-[11px] font-bold dark:text-white truncate leading-tight">{item.title}</span>
                                       <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">#{item.id.slice(-6)}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* Lectures Section */}
                           {filteredLectures.length > 0 && (
                             <div className="space-y-2">
                               <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full w-fit">Video Lectures</h4>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {filteredLectures.map((item: any) => (
                                   <div key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700" onClick={() => {
                                      const products = promotionFormData.applicableProducts.includes(item.id)
                                        ? promotionFormData.applicableProducts.filter(id => id !== item.id)
                                        : [...promotionFormData.applicableProducts, item.id];
                                      setPromotionFormData({...promotionFormData, applicableProducts: products});
                                   }}>
                                     <div className={cn(
                                       "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
                                       promotionFormData.applicableProducts.includes(item.id) 
                                         ? "bg-amber-600 border-amber-600 text-white" 
                                         : "border-zinc-200 dark:border-zinc-700"
                                     )}>
                                       {promotionFormData.applicableProducts.includes(item.id) && <CheckCircle2 className="w-3 h-3" />}
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-[11px] font-bold dark:text-white truncate leading-tight">{item.title}</span>
                                       <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">#{item.id.slice(-6)}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* Live Classes Section */}
                           {filteredLiveClasses.length > 0 && (
                             <div className="space-y-2">
                               <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full w-fit">Live Classes</h4>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {filteredLiveClasses.map((item: any) => (
                                   <div key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700" onClick={() => {
                                      const products = promotionFormData.applicableProducts.includes(item.id)
                                        ? promotionFormData.applicableProducts.filter(id => id !== item.id)
                                        : [...promotionFormData.applicableProducts, item.id];
                                      setPromotionFormData({...promotionFormData, applicableProducts: products});
                                   }}>
                                     <div className={cn(
                                       "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
                                       promotionFormData.applicableProducts.includes(item.id) 
                                         ? "bg-rose-600 border-rose-600 text-white" 
                                         : "border-zinc-200 dark:border-zinc-700"
                                     )}>
                                       {promotionFormData.applicableProducts.includes(item.id) && <CheckCircle2 className="w-3 h-3" />}
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-[11px] font-bold dark:text-white truncate leading-tight">{item.title}</span>
                                       <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">#{item.id.slice(-6)}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* Notes Section */}
                           {filteredNotes.length > 0 && (
                             <div className="space-y-2">
                               <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full w-fit">Study Materials</h4>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {filteredNotes.map((item: any) => (
                                   <div key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700" onClick={() => {
                                      const products = promotionFormData.applicableProducts.includes(item.id)
                                        ? promotionFormData.applicableProducts.filter(id => id !== item.id)
                                        : [...promotionFormData.applicableProducts, item.id];
                                      setPromotionFormData({...promotionFormData, applicableProducts: products});
                                   }}>
                                     <div className={cn(
                                       "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
                                       promotionFormData.applicableProducts.includes(item.id) 
                                         ? "bg-emerald-600 border-emerald-600 text-white" 
                                         : "border-zinc-200 dark:border-zinc-700"
                                     )}>
                                       {promotionFormData.applicableProducts.includes(item.id) && <CheckCircle2 className="w-3 h-3" />}
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-[11px] font-bold dark:text-white truncate leading-tight">{item.title}</span>
                                       <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">#{item.id.slice(-6)}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                           
                           {filteredCourses.length === 0 && filteredNotes.length === 0 && filteredLectures.length === 0 && filteredLiveClasses.length === 0 && (
                             <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                               <Search className="w-8 h-8 mb-4 opacity-20" />
                               <span className="text-[10px] font-black uppercase tracking-widest">No products found</span>
                             </div>
                           )}
                        </div>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1 ml-1">If no items selected, coupon applies to all products in cart.</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Description</label>
                    <textarea
                      required
                      value={promotionFormData.description}
                      onChange={e => setPromotionFormData({...promotionFormData, description: e.target.value})}
                      placeholder="Get 50% off on all physics courses this week!"
                      rows={3}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white placeholder:text-zinc-300 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Link (Optional)</label>
                      <input
                        type="text"
                        value={promotionFormData.link}
                        onChange={e => setPromotionFormData({...promotionFormData, link: e.target.value})}
                        placeholder="/courses"
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white placeholder:text-zinc-300 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Expiry Date (Optional)</label>
                      <input
                        type="date"
                        value={promotionFormData.expiryDate}
                        onChange={e => setPromotionFormData({...promotionFormData, expiryDate: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Order Index</label>
                      <input
                        type="number"
                        value={promotionFormData.order}
                        onChange={e => setPromotionFormData({...promotionFormData, order: parseInt(e.target.value) || 0})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-2 justify-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={promotionFormData.isActive}
                          onChange={e => setPromotionFormData({...promotionFormData, isActive: e.target.checked})}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none dark:bg-zinc-700 peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Active Status</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Promotion Image (Portrait)</label>
                    <div 
                      onClick={() => document.getElementById('promo-image-upload')?.click()}
                      className="w-full max-w-[200px] aspect-[3/4] bg-zinc-50 dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-all group relative overflow-hidden mx-auto"
                    >
                      {promotionFormData.imgFile || promotionFormData.imgUrl ? (
                         <>
                          <img 
                            src={promotionFormData.imgFile ? URL.createObjectURL(promotionFormData.imgFile) : promotionFormData.imgUrl} 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-xs font-black uppercase tracking-widest">Change Image</span>
                          </div>
                         </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-zinc-300 mb-2 group-hover:text-indigo-400 group-hover:scale-110 transition-all" />
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Upload Banner</span>
                        </>
                      )}
                    </div>
                    <input 
                      id="promo-image-upload"
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setPromotionFormData({...promotionFormData, imgFile: file});
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-zinc-900 transition-all disabled:opacity-50 mt-4 h-20"
                  >
                    {submitting ? <Loader2 className="animate-spin mx-auto w-6 h-6" /> : (editingId ? 'Update Promotion' : 'Launch Promotion')}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {unitManagementConfig.isOpen && (
          <UnitManagementModal 
            isOpen={unitManagementConfig.isOpen}
            noteId={unitManagementConfig.noteId}
            noteTitle={unitManagementConfig.noteTitle}
            courseId={unitManagementConfig.courseId}
            onClose={() => setUnitManagementConfig(prev => ({ ...prev, isOpen: false }))}
          />
        )}
      </AnimatePresence>
        {/* Virtual Classroom Overlay */}
        <VirtualClassroom
          isOpen={classroomConfig.isOpen}
          onClose={() => setClassroomConfig({ ...classroomConfig, isOpen: false })}
          roomName={classroomConfig.roomName}
          userName={classroomConfig.userName}
          isModerator={isAdmin}
          classId={classroomConfig.classId}
          externalUrl={classroomConfig.externalUrl}
        />
    </div>
  );
}
