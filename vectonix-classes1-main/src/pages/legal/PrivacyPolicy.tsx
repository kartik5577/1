import React from 'react';
import { motion } from 'motion/react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 border border-zinc-100 dark:border-zinc-800 shadow-sm"
        >
          <h1 className="text-4xl font-display font-extrabold dark:text-white mb-8">Privacy Policy – Vectonix Classes</h1>
          
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p>We Vectonix Classes operates www.vectonixclasses.com.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">1. Scope of Services:</h2>
            <p>Our services are strictly intended for users residing in India. We do not knowingly offer services to users outside India.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">2. Information We Collect:</h2>
            <p>We may collect:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Payment information (processed securely via Razorpay)</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">3. How We Use Your Information:</h2>
            <p>We use your data to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Provide and manage our services</li>
              <li>Process payments</li>
              <li>Communicate with you</li>
              <li>Improve our offerings</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">4. Payment Processing:</h2>
            <p>All payments are securely processed through Razorpay. We do not store your card or banking details.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">5. Data Sharing:</h2>
            <p>We do not sell or rent your personal data. Information may be shared only with trusted service providers (e.g., payment gateway) for operational purposes.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">6. Data Protection:</h2>
            <p>We implement reasonable security measures to protect your information.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">7. Your Rights:</h2>
            <p>You may request:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Access to your data</li>
              <li>Correction of your data</li>
              <li>Deletion of your data</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">8. External Access:</h2>
            <p>If you access our website from outside India, you do so at your own risk. We are not responsible for compliance with laws outside India.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">9. Contact Us:</h2>
            <p>Email: <a href="mailto:vectonixclasses@gmail.com" className="text-indigo-600 hover:underline">vectonixclasses@gmail.com</a></p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
