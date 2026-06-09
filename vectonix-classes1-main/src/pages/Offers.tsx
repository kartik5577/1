import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';
import { Tag, Clock, Ticket, Sparkles, ChevronRight, Copy, Check } from 'lucide-react';
import { cn, getItemImage } from '../lib/utils';

interface Promotion {
  id: string;
  title: string;
  description: string;
  couponCode: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expiryDate?: string;
  imgUrl?: string;
  type?: string;
  isActive: boolean;
}

export default function Offers() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'promotions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promos = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Promotion))
        .filter(p => p.isActive !== false); // Default to true if undefined
      setPromotions(promos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] pt-32 pb-20 px-6">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col items-center text-center mb-16 space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-[2rem] bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2"
          >
            <Ticket className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter dark:text-white"
          >
            Exclusive <span className="text-rose-500 italic">Offers</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs md:text-sm max-w-2xl"
          >
            Boost your learning with our latest discounts and promotional packages. 
            Select a coupon code to use at checkout.
          </motion.p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : promotions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {promotions.map((promo, idx) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-none hover:border-rose-500/30 transition-all flex flex-col"
              >
                {/* Visual Header */}
                <div className="aspect-[3/4] w-full relative overflow-hidden bg-rose-50 dark:bg-rose-900/10 p-4">
                  <img 
                    src={promo.imgUrl || getItemImage(promo.title, promo.type || 'offer')} 
                    alt={promo.title} 
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-md text-[8px] font-black uppercase tracking-widest text-rose-500 border border-rose-100 dark:border-rose-900/30">
                      {promo.type || 'Special'}
                    </span>
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-4">
                    {promo.expiryDate && (
                      <div className="flex items-center gap-1.5 text-[8px] font-black text-rose-400 uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5" />
                        Expires: {new Date(promo.expiryDate).toLocaleDateString()}
                      </div>
                    )}
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                    </div>
                  </div>

                  <h3 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2 group-hover:text-rose-500 transition-colors">
                    {promo.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed line-clamp-3 mb-6">
                    {promo.description}
                  </p>

                  <div className="mt-auto">
                    {promo.couponCode && (
                      <div className="relative group/copy">
                        <button 
                          onClick={() => copyToClipboard(promo.couponCode, promo.id)}
                          className="w-full p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-between group hover:bg-rose-50 dark:hover:bg-rose-500/5 hover:border-rose-200 transition-all cursor-pointer"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Coupon Code</span>
                            <span className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">{promo.couponCode}</span>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-rose-500 transition-all shadow-sm">
                            {copiedId === promo.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </div>
                        </button>
                        {copiedId === promo.id && (
                          <motion.span 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: -20 }}
                            className="absolute left-1/2 -translate-x-1/2 text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-800"
                          >
                            Copied!
                          </motion.span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-[3rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-200 mb-8 shadow-inner">
              <Tag className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-display font-black text-zinc-400 uppercase tracking-tight">No Active Offers</h2>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest max-w-xs mt-4 leading-relaxed">
              We're currently preparing new educational deals for you. Check back soon!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
