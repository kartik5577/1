import React from 'react';
import { motion } from 'motion/react';

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 border border-zinc-100 dark:border-zinc-800 shadow-sm"
        >
          <h1 className="text-4xl font-display font-extrabold dark:text-white mb-8">Disclaimer – Vectonix Classes</h1>
          
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <ul className="list-disc pl-6 space-y-4">
              <li>The content and services provided by Vectonix Classes are for educational purposes only.</li>
              <li>We do not guarantee specific results, outcomes, or performance improvements.</li>
              <li>All users are responsible for how they use the information provided.</li>
              <li>Our services are intended for users in India. Access from other regions is at the user's own discretion.</li>
              <li>We are not liable for any losses or damages resulting from the use of our services.</li>
              <li>Contact: <a href="mailto:vectonixclasses@gmail.com" className="text-indigo-600 hover:underline">vectonixclasses@gmail.com</a></li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
