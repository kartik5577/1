import React, { useState } from 'react';
import { useCart, CartItem } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, CreditCard, Loader2, CheckCircle2, AlertCircle, Tag, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { cn, formatCurrency, getItemImage } from '../lib/utils';
import PriceDisplay from '../components/PriceDisplay';
import { db } from '../firebase';
import { updateDoc, doc, arrayUnion, collection, addDoc, query, where, getDocs, increment } from 'firebase/firestore';

export default function CartPage() {
  const { items, removeFromCart, clearCart, total, itemCount, promotions } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [showDemoPayment, setShowDemoPayment] = useState<any | null>(null);

  const applyCouponByCode = async (codeToApply: string) => {
    if (!codeToApply.trim()) return;
    setCheckingCoupon(true);
    setError(null);
    setCouponSuccess(null);
    setAppliedCoupon(null);

    try {
      const q = query(
        collection(db, 'promotions'),
        where('couponCode', '==', codeToApply.trim().toUpperCase()),
        where('isActive', '==', true),
        where('type', '==', 'discount')
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError('Invalid or expired coupon code.');
        return;
      }

      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

      // Check expiry
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setError('This coupon has expired.');
        return;
      }

      // Check usage limit
      if (coupon.maxUsage && (coupon.usageCount || 0) >= coupon.maxUsage) {
        setError('This coupon usage limit has been reached.');
        return;
      }

      // Check product applicability
      const applicableItems = coupon.applicableProducts?.length > 0 
        ? items.filter(item => coupon.applicableProducts.includes(item.id))
        : items;

      if (applicableItems.length === 0) {
        setError('This coupon is not applicable to the items in your cart.');
        return;
      }

      setAppliedCoupon(coupon);
      setCouponSuccess(`Coupon "${coupon.couponCode}" applied!`);
    } catch (err: any) {
      console.error('Coupon error:', err);
      setError('Error validating coupon. Please try again.');
    } finally {
      setCheckingCoupon(false);
    }
  };

  const handleApplyCoupon = async () => {
    await applyCouponByCode(couponCode);
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    const applicableItems = appliedCoupon.applicableProducts?.length > 0 
      ? items.filter(item => appliedCoupon.applicableProducts.includes(item.id))
      : items;

    const applicableTotal = applicableItems.reduce((acc, item) => acc + (item.discountPrice || item.price), 0);
    
    if (appliedCoupon.discountType === 'percentage') {
      return (applicableTotal * appliedCoupon.discountValue) / 100;
    } else {
      // For fixed, if it exceeds applicable total, just return applicable total
      return Math.min(appliedCoupon.discountValue, applicableTotal);
    }
  };

  const discountAmount = calculateDiscount();
  const originalSubtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const productDiscount = originalSubtotal - total;
  const couponDiscount = discountAmount;
  const gstPercent = 0;
  const priceBeforeTax = Math.max(0, total - couponDiscount);
  const gstAmount = 0;
  const finalTotal = priceBeforeTax;
  const baseValue = priceBeforeTax;

  const isCouponApplicable = (promo: any) => {
    if (!promo.applicableProducts || promo.applicableProducts.length === 0) return true;
    return items.some(item => promo.applicableProducts.includes(item.id));
  };

  const availableCoupons = (promotions || []).filter(promo => {
    return (
      promo.isActive !== false &&
      promo.type === 'discount' &&
      promo.couponCode &&
      (!promo.expiryDate || new Date(promo.expiryDate) >= new Date()) &&
      (!promo.maxUsage || (promo.usageCount || 0) < promo.maxUsage)
    );
  });

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login?redirect=/cart');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      // Check if any items in cart are already owned
      const ownedItemsInCart = items.filter(item => 
        profile?.purchasedItems?.includes(item.id) || 
        (item.courseId && profile?.purchasedItems?.includes(item.courseId))
      );

      if (ownedItemsInCart.length > 0) {
        setError(`You already own some items in your cart: ${ownedItemsInCart.map(i => i.title).join(', ')}. Please remove them to proceed.`);
        setPurchasing(false);
        return;
      }

      // Direct checkout for demo purposes or integrate real payment here
      // Multi-item purchase logic with Razorpay integration
      
      const keyId = (import.meta as any).env.VITE_RAZORPAY_KEY_ID;
      
      // If there are free items, just process them
      const freeItems = items.filter(i => Number(i.discountPrice || i.price || 0) <= 0);
      const paidItemsCount = items.length - freeItems.length;

      if (isNaN(finalTotal)) {
        setError('Invalid total amount. Please check your items.');
        setPurchasing(false);
        return;
      }

      if (paidItemsCount === 0 || finalTotal <= 0) {
        // All items are free after discount or originally free
        await updateDoc(doc(db, 'users', user.uid), {
          purchasedItems: arrayUnion(...items.map(i => i.id))
        });
        
        if (appliedCoupon) {
          await updateDoc(doc(db, 'promotions', appliedCoupon.id), {
            usageCount: increment(1)
          });
        }

        setSuccess(true);
        clearCart();
        return;
      }

      // Handle paid items with Razorpay
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalTotal,
          receipt: `cart_${user.uid.substring(0, 8)}_${Date.now().toString().slice(-6)}`,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || 'Payment gateway order creation failed');
      }

      const order = await response.json();

      if (order.isDemo) {
        setShowDemoPayment({
          orderId: order.id,
          amount: finalTotal,
          fallbackMessage: order.fallbackMessage,
          onSuccess: async () => {
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                purchasedItems: arrayUnion(...items.map(i => i.id))
              });
              
              if (appliedCoupon) {
                await updateDoc(doc(db, 'promotions', appliedCoupon.id), {
                  usageCount: increment(1)
                });
              }

              for (const item of items) {
                const isApplicable = !appliedCoupon || !appliedCoupon.applicableProducts?.length || appliedCoupon.applicableProducts.includes(item.id);
                
                const itemOriginalPrice = Number(item.price || 0);
                const itemDiscountedPrice = Number(item.discountPrice || item.price || 0);
                const itemProductDiscount = Math.max(0, itemOriginalPrice - itemDiscountedPrice);
                
                let itemCouponDiscount = 0;
                if (appliedCoupon && isApplicable) {
                  const applicableItems = appliedCoupon.applicableProducts?.length > 0 
                    ? items.filter(i => appliedCoupon.applicableProducts?.includes(i.id))
                    : items;
                  const applicableTotal = applicableItems.reduce((acc, i) => acc + Number(i.discountPrice || i.price || 0), 0);
                  
                  if (appliedCoupon.discountType === 'percentage') {
                    itemCouponDiscount = (itemDiscountedPrice * Number(appliedCoupon.discountValue)) / 100;
                  } else {
                    if (applicableTotal > 0) {
                      const totalFixedDiscount = Math.min(Number(appliedCoupon.discountValue), applicableTotal);
                      itemCouponDiscount = (itemDiscountedPrice / applicableTotal) * totalFixedDiscount;
                    }
                  }
                }
                
                const finalCouponDiscount = Math.round(itemCouponDiscount * 100) / 100;
                const priceAfterCoupon = Math.max(0, itemDiscountedPrice - finalCouponDiscount);
                const finalGstPercent = 0;
                const itemGstAmount = 0;
                const itemPaidAmount = priceAfterCoupon;
                
                await addDoc(collection(db, 'sales'), {
                  userId: user.uid,
                  itemId: item.id,
                  itemType: item.type,
                  amount: itemDiscountedPrice, 
                  originalPrice: itemOriginalPrice,
                  productDiscount: itemProductDiscount,
                  couponCode: isApplicable ? (appliedCoupon?.couponCode || null) : null,
                  couponDiscount: finalCouponDiscount,
                  gstAmount: itemGstAmount,
                  paidAmount: itemPaidAmount,
                  discountApplied: isApplicable ? (appliedCoupon?.couponCode || null) : null,
                  paymentId: 'pay_demo_' + Math.random().toString(36).substring(2, 11),
                  orderId: order.id,
                  gstPercent: finalGstPercent,
                  timestamp: new Date().toISOString()
                });
              }
              
              setSuccess(true);
              clearCart();
            } catch (err: any) {
              console.error('Demo payment upgrade error:', err);
              setError('Error updating user library. Please contact support.');
            } finally {
              setPurchasing(false);
              setShowDemoPayment(null);
            }
          },
          onCancel: () => {
            setPurchasing(false);
            setShowDemoPayment(null);
          }
        });
        return;
      }
      const options = {
        key: order.key_id || keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Vectonix Classes',
        description: `Purchase ${itemCount} items`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              purchasedItems: arrayUnion(...items.map(i => i.id))
            });
            
            // Increment coupon usage
            if (appliedCoupon) {
              await updateDoc(doc(db, 'promotions', appliedCoupon.id), {
                usageCount: increment(1)
              });
            }

            // Log each sale
            for (const item of items) {
              const isApplicable = !appliedCoupon || !appliedCoupon.applicableProducts?.length || appliedCoupon.applicableProducts.includes(item.id);
              
              const itemOriginalPrice = Number(item.price || 0);
              const itemDiscountedPrice = Number(item.discountPrice || item.price || 0);
              const itemProductDiscount = Math.max(0, itemOriginalPrice - itemDiscountedPrice);
              
              let itemCouponDiscount = 0;
              if (appliedCoupon && isApplicable) {
                const applicableItems = appliedCoupon.applicableProducts?.length > 0 
                  ? items.filter(i => appliedCoupon.applicableProducts?.includes(i.id))
                  : items;
                const applicableTotal = applicableItems.reduce((acc, i) => acc + Number(i.discountPrice || i.price || 0), 0);
                
                if (appliedCoupon.discountType === 'percentage') {
                  itemCouponDiscount = (itemDiscountedPrice * Number(appliedCoupon.discountValue)) / 100;
                } else {
                  // Fixed discount distributed proportionally
                  if (applicableTotal > 0) {
                    const totalFixedDiscount = Math.min(Number(appliedCoupon.discountValue), applicableTotal);
                    itemCouponDiscount = (itemDiscountedPrice / applicableTotal) * totalFixedDiscount;
                  }
                }
              }
              
              // Round values to 2 decimal places
              const finalCouponDiscount = Math.round(itemCouponDiscount * 100) / 100;
              const priceAfterCoupon = Math.max(0, itemDiscountedPrice - finalCouponDiscount);
              const finalGstPercent = 0;
              const itemGstAmount = 0;
              const itemPaidAmount = priceAfterCoupon;
              
              await addDoc(collection(db, 'sales'), {
                userId: user.uid,
                itemId: item.id,
                itemType: item.type,
                amount: itemDiscountedPrice, // original field compatibility
                originalPrice: itemOriginalPrice,
                productDiscount: itemProductDiscount,
                couponCode: isApplicable ? (appliedCoupon?.couponCode || null) : null,
                couponDiscount: finalCouponDiscount,
                gstAmount: itemGstAmount,
                paidAmount: itemPaidAmount,
                discountApplied: isApplicable ? (appliedCoupon?.couponCode || null) : null,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                gstPercent: finalGstPercent,
                timestamp: new Date().toISOString()
              });
            }
            
            setSuccess(true);
            clearCart();
          } catch (err) {
            setError('Error updating profile. Please contact support.');
          } finally {
            setPurchasing(false);
          }
        },
        prefill: {
          name: profile?.name || '',
          email: (profile?.email || '').toLowerCase(),
          contact: profile?.mobile || '',
        },
        theme: { color: '#4f46e5' },
        modal: { ondismiss: () => setPurchasing(false) }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setPurchasing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-zinc-900 p-12 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-black dark:text-white mb-4 uppercase tracking-tight">Payment Successful!</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-10 text-lg">Your items have been added to your library. You can start learning right away.</p>
          <Link to="/dashboard" className="block w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
            Go to My Library
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20 pt-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Breadcrumbs items={[{ label: 'Shopping Cart', active: true }]} className="mb-8 mt-12 md:mt-20" />
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Main Cart Content */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-black dark:text-white uppercase tracking-tight">Shopping Cart</h1>
                <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[10px]">{itemCount} Items Selected</p>
              </div>
            </div>

            {itemCount === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-300">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold dark:text-white mb-2">Your cart is empty</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-8">Check out our latest courses and study notes.</p>
                <Link to="/" className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">
                  Browse Courses <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-6 group hover:shadow-xl transition-all"
                    >
                      <div className={cn(
                        "w-20 h-24 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                        item.type === 'note' ? "bg-red-50 dark:bg-red-900/20" : 
                        item.type === 'course' ? "bg-indigo-50 dark:bg-indigo-900/20" :
                        "bg-emerald-50 dark:bg-emerald-900/20"
                      )}>
                        <img src={item.coverImage || getItemImage(item.title, item.subject)} className="w-full h-full object-cover" alt="" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                            item.type === 'note' ? "bg-red-100 text-red-600" :
                            item.type === 'course' ? "bg-indigo-100 text-indigo-600" :
                            "bg-emerald-100 text-emerald-600"
                          )}>
                            {item.type === 'course' ? 'Premium Course' : 'Study Notes'}
                          </span>
                          {(profile?.purchasedItems?.includes(item.id) || (item.courseId && profile?.purchasedItems?.includes(item.courseId))) && (
                            <span className="px-2 py-0.5 bg-red-500 text-white rounded text-[8px] font-black uppercase tracking-widest animate-pulse">
                              Already Owned
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black dark:text-white truncate group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Single User License</p>
                      </div>

                      <div className="flex flex-col items-end gap-2 pr-4 font-sans">
                        <PriceDisplay
                          price={item.price}
                          discountPrice={item.discountPrice}
                          itemId={item.id}
                          size="md"
                          align="right"
                        />
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                <div className="mt-8 p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
                  <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-white mb-1">Secure & Trusted Purchase</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">All content is strictly protected and for personal educational use only. Sharing or copying is strictly prohibited.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Checkout Summary */}
          <div className="w-full lg:w-96 shrink-0">
            <div className="sticky top-28 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xl font-display font-black dark:text-white uppercase tracking-tight mb-6">Order Summary</h3>
                  
                  <div className="space-y-4 font-sans text-xs">
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="font-bold uppercase tracking-widest text-[10px]">Total Original Price</span>
                      <span className="relative inline-block font-bold tabular-nums mt-0.5 text-zinc-400">
                        <span>{formatCurrency(originalSubtotal)}</span>
                        <span className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-rose-500/80 dark:bg-rose-500 transform -rotate-12 pointer-events-none" />
                      </span>
                    </div>

                    {productDiscount > 0 && (
                      <div className="flex justify-between items-center text-rose-600 bg-rose-50/40 dark:bg-rose-950/10 p-2.5 border border-rose-100/50 dark:border-rose-900/10 rounded-xl">
                        <span className="font-bold uppercase tracking-widest text-[10px]">Product Discount</span>
                        <span className="font-bold tabular-nums">-{formatCurrency(productDiscount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-850/40 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-800">
                      <span className="font-bold uppercase tracking-widest text-[10px]">Price After Discount</span>
                      <span className="font-bold tabular-nums text-zinc-900 dark:text-white">{formatCurrency(total)}</span>
                    </div>

                    {appliedCoupon && (
                      <>
                        <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5" />
                            <span className="font-bold uppercase tracking-widest text-[10px]">Coupon Discount ({appliedCoupon.couponCode})</span>
                          </div>
                          <span className="font-bold tabular-nums">-{formatCurrency(couponDiscount)}</span>
                        </div>

                        <div className="flex justify-between items-center text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/10">
                          <span className="font-bold uppercase tracking-widest text-[10px]">Amount After Coupon</span>
                          <span className="font-bold tabular-nums text-indigo-950 dark:text-indigo-200">{formatCurrency(priceBeforeTax)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                      <span className="font-bold uppercase tracking-widest text-[10px]">Processing Fee</span>
                      <span className="font-bold tabular-nums text-emerald-600">FREE</span>
                    </div>

                    <div className="h-px bg-zinc-150 dark:bg-zinc-800 w-full my-4" />
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-display font-black dark:text-white uppercase">Grand Total</span>
                      <span className="text-3xl font-display font-black text-indigo-650 dark:text-indigo-400 tabular-nums">
                        {formatCurrency(finalTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Have a coupon code?</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="ENTER CODE"
                        className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                      <button 
                        onClick={handleApplyCoupon}
                        disabled={checkingCoupon || !couponCode.trim()}
                        className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                      >
                        {checkingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {couponSuccess && <p className="text-[10px] font-bold text-emerald-600 ml-1 uppercase tracking-widest">{couponSuccess}</p>}
                    
                    {availableCoupons.length > 0 && (
                      <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3 ml-1 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                          Student Coupons Available
                        </h4>
                        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                          {availableCoupons.map((coupon) => {
                            const isApp = isCouponApplicable(coupon);
                            const isCurrentlyApplied = appliedCoupon?.couponCode?.toUpperCase() === coupon.couponCode.toUpperCase();
                            
                            return (
                              <label 
                                key={coupon.id} 
                                className={cn(
                                  "p-3 rounded-xl border transition-all text-left flex gap-3 cursor-pointer select-none",
                                  isCurrentlyApplied 
                                    ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800"
                                    : isApp
                                      ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500"
                                      : "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-150 dark:border-zinc-805 opacity-60 cursor-not-allowed"
                                )}
                              >
                                <div className="mt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    disabled={!isApp}
                                    checked={isCurrentlyApplied}
                                    onChange={() => {
                                      if (isCurrentlyApplied) {
                                        setAppliedCoupon(null);
                                        setCouponSuccess(null);
                                      } else {
                                        applyCouponByCode(coupon.couponCode);
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed dark:border-zinc-750 dark:bg-zinc-900"
                                  />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className={cn(
                                      "font-mono text-xs font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                                      isCurrentlyApplied
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200"
                                        : "bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-750"
                                    )}>
                                      {coupon.couponCode}
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                                    </span>
                                  </div>
                                  
                                  <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-tight">
                                    {coupon.title || coupon.description}
                                  </p>
                                  
                                  <div className="flex items-center justify-between mt-1 text-[9px]">
                                    {coupon.expiryDate ? (
                                      <span className="text-zinc-400 font-bold uppercase tracking-wider">
                                        Exp: {new Date(coupon.expiryDate).toLocaleDateString()}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 font-bold uppercase tracking-wider">Never Expires</span>
                                    )}
                                    
                                    {isCurrentlyApplied ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
                                        <Check className="w-3 h-3 stroke-[3px]" /> Applied
                                      </span>
                                    ) : isApp ? (
                                      <span className="text-indigo-605 dark:text-indigo-400 font-black uppercase tracking-widest">
                                        Check to apply
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 font-extrabold uppercase tracking-wider text-[8px]">
                                        Not Applicable
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50">
                  <button 
                    disabled={itemCount === 0 || purchasing}
                    onClick={handleCheckout}
                    className={cn(
                      "w-full py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                      itemCount > 0 
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none" 
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    )}
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-6 h-6" />
                        Checkout Now
                      </>
                    )}
                  </button>

                  <div className="mt-6 flex items-center justify-center gap-4 text-zinc-400">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg" className="h-4 opacity-50 grayscale" alt="Razorpay" />
                    <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                    <span className="text-[8px] font-black uppercase tracking-widest">SSL Encrypted</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-center gap-3 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              )}

              <Link to="/" className="flex items-center justify-center gap-2 text-zinc-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest text-xs">
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Marketplace
              </Link>
            </div>
          </div>

        </div>
      </div>
      
      {/* Demo Razorpay Payment Simulator Modal */}
      <AnimatePresence>
        {showDemoPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
              
              <div className="flex items-center justify-between mb-5 mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                    S
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xs dark:text-white uppercase tracking-tight">Vectonix Simulator</h3>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">SECURE PAY SIMULATION</p>
                  </div>
                </div>
                <button 
                  onClick={() => showDemoPayment.onCancel()}
                  className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 text-xs mb-6">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/20 rounded-xl text-amber-800 dark:text-amber-300">
                  <p className="font-black text-[10px] uppercase tracking-wider mb-0.5">Demo Checkout Mode</p>
                  <p className="text-[9px] leading-relaxed opacity-90">
                    No active Razorpay API key-pair was configured in AI Studio environments. A simulated sandbox is loaded so you can test content access without real charges.
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-850/50 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-1.5 font-sans text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-450 uppercase tracking-widest text-[8px] font-bold">Simulator Merchant</span>
                    <span className="font-mono text-zinc-600 dark:text-zinc-300 font-bold">Vectonix Pay_Sandbox</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-450 uppercase tracking-widest text-[8px] font-bold">Order Token</span>
                    <span className="font-mono text-zinc-600 dark:text-zinc-300">{showDemoPayment.orderId}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-zinc-200 dark:border-zinc-750">
                    <span className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[9px]">TOTAL DUE</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {formatCurrency(showDemoPayment.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => showDemoPayment.onCancel()}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-205 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-black uppercase tracking-widest text-[9px] rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const btn = e.currentTarget;
                    btn.innerText = "SIMULATING SUCCESS...";
                    btn.disabled = true;
                    setTimeout(() => {
                      showDemoPayment.onSuccess();
                    }, 1200);
                  }}
                  className="flex-1.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center animate-pulse"
                >
                  Proceed with Success
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
