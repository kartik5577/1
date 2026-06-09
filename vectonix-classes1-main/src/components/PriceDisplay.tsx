import React from 'react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../lib/utils';
import { Tag } from 'lucide-react';

interface PriceDisplayProps {
  price: number;
  discountPrice?: number;
  itemId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'center' | 'right';
  className?: string;
  isFree?: boolean;
}

export default function PriceDisplay({
  price,
  discountPrice,
  itemId,
  size = 'md',
  align = 'left',
  className = '',
  isFree = false,
}: PriceDisplayProps) {
  const { promotions } = useCart();

  const numericPrice = typeof price === 'number' ? price : Number(price);
  const isPriceZero = isNaN(numericPrice) || numericPrice <= 0;

  if (isFree || isPriceZero) {
    return null;
  }

  const parsedDiscountPrice = discountPrice !== undefined && discountPrice !== null 
    ? (typeof discountPrice === 'number' ? discountPrice : Number(discountPrice))
    : numericPrice;

  const finalDiscountPrice = isNaN(parsedDiscountPrice) ? numericPrice : parsedDiscountPrice;
  const hasDiscount = finalDiscountPrice < numericPrice;

  // Find best promotion (applicable coupon) with percentage discount
  const applicableCoupons = promotions.filter(promo => {
    // Basic checks
    if (!promo.isActive) return false;
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) return false;
    
    // Check item applicability
    if (itemId) {
      if (promo.applicableProducts && promo.applicableProducts.length > 0) {
        return promo.applicableProducts.includes(itemId);
      }
    }
    return true;
  });

  // Sort by highest discount value if percentage, or just get coupon
  const percentageCoupons = applicableCoupons.filter(c => c.discountType === 'percentage');
  const bestCoupon = percentageCoupons.length > 0 
    ? percentageCoupons.sort((a, b) => b.discountValue - a.discountValue)[0] 
    : applicableCoupons[0];

  const savingsPercent = hasDiscount ? Math.round((1 - (finalDiscountPrice / numericPrice)) * 100) : 0;
  const savingsAmount = numericPrice - finalDiscountPrice;

  // Size text classes
  const sizeClasses = {
    xs: {
      current: 'text-xs font-black text-indigo-650 dark:text-indigo-400 tabular-nums',
      original: 'text-[9px] text-zinc-400 font-bold',
      badge: 'text-[8px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-1 py-0.5 rounded border border-rose-100 dark:border-rose-900/30'
    },
    sm: {
      current: 'text-sm font-black text-indigo-650 dark:text-indigo-400 tabular-nums',
      original: 'text-[10px] text-zinc-400 font-bold',
      badge: 'text-[8px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-900/30'
    },
    md: {
      current: 'text-base font-black text-indigo-600 dark:text-indigo-400 tabular-nums',
      original: 'text-xs text-zinc-400 font-bold',
      badge: 'text-[9px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900/30'
    },
    lg: {
      current: 'text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums',
      original: 'text-sm text-zinc-400 font-bold',
      badge: 'text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-900/30'
    },
    xl: {
      current: 'text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums',
      original: 'text-lg text-zinc-400 font-bold',
      badge: 'text-xs font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-full border border-rose-100 dark:border-rose-900/30'
    }
  }[size];

  const alignmentClasses = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[align];

  return (
    <div className={`flex flex-col gap-1.5 ${alignmentClasses} ${className}`}>
      {/* Price block */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={sizeClasses.current}>
          {formatCurrency(finalDiscountPrice)}
        </span>
        
        {hasDiscount && (
          <span className={`relative inline-block ${sizeClasses.original}`}>
            <span>{formatCurrency(numericPrice)}</span>
            <span className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-rose-500/80 dark:bg-rose-500 transform -rotate-12 pointer-events-none" />
          </span>
        )}

        {hasDiscount && (
          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            {savingsPercent}% OFF
          </span>
        )}
      </div>

      {hasDiscount && (
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          Save {formatCurrency(savingsAmount)}
        </span>
      )}

      {bestCoupon && (
        <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/30 mt-0.5">
          <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            Coupon <span className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">{bestCoupon.couponCode}</span> gets you {bestCoupon.discountType === 'percentage' ? `${bestCoupon.discountValue}%` : formatCurrency(bestCoupon.discountValue)} extra off!
          </span>
        </div>
      )}
    </div>
  );
}
