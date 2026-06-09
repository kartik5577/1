import React from 'react';
import { motion } from 'motion/react';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 border border-zinc-100 dark:border-zinc-800 shadow-sm"
        >
          <h1 className="text-4xl font-display font-extrabold dark:text-white mb-8">Refund Policy – Vectonix Classes</h1>
          
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <h2 className="text-2xl font-bold mt-8 mb-4">1. Scope:</h2>
            <p>This policy applies only to purchases made within India.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">2. Refund Eligibility:</h2>
            <p>Refunds may be granted in cases such as:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Duplicate payment</li>
              <li>Technical issues preventing access</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">3. Non-Refundable Cases:</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Change of mind</li>
              <li>Partial or full course consumption</li>
              <li>Failure to understand course content</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">4. Refund Request:</h2>
            <p>To request a refund, email <a href="mailto:vectonixclasses@gmail.com" className="text-indigo-600 hover:underline">vectonixclasses@gmail.com</a> within 3–5 days of purchase.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">5. Processing Time:</h2>
            <p>Approved refunds will be processed within 7–10 business days via Razorpay.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">6. Final Decision:</h2>
            <p>Vectonix Classes reserves the right to approve or reject any refund request.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
