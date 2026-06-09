import React from 'react';
import { motion } from 'motion/react';

export default function TermsConditions() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 border border-zinc-100 dark:border-zinc-800 shadow-sm"
        >
          <h1 className="text-4xl font-display font-extrabold dark:text-white mb-8">Terms & Conditions – Vectonix Classes</h1>
          
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <h2 className="text-2xl font-bold mt-8 mb-4">1. Eligibility:</h2>
            <p>Our services are intended only for users located in India. By using this website, you confirm that you are accessing from India.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">2. Use of Website:</h2>
            <p>You agree to use this website only for lawful purposes and in accordance with these terms.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">3. Products & Services:</h2>
            <p>Vectonix Classes provides educational courses, notes, and related services. We reserve the right to modify or discontinue any service at any time without prior notice.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">4. Payments:</h2>
            <p>All payments must be made in Indian Rupees (INR) through Razorpay. Access to courses will be granted only after successful payment. We do not support international transactions.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">5. Intellectual Property:</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>All content on this website, including courses, videos, notes, and branding, is the property of Vectonix Classes and is protected under applicable copyright laws.</li>
              <li>You may not copy, reproduce, distribute, or resell any content without permission.</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">6. Online Course Terms:</h2>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.1 Course Access:</h3>
            <p>Upon successful payment, users will receive access to the purchased course as specified (lifetime or limited duration).</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.2 Account Responsibility:</h3>
            <p>Users are responsible for maintaining the confidentiality of their login credentials. Account sharing is strictly prohibited.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.3 No Sharing / Reselling:</h3>
            <p>Course content is for personal use only. You may NOT:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Share login credentials</li>
              <li>Upload content on other platforms</li>
              <li>Resell or distribute materials</li>
            </ul>
            <p className="font-bold">Violation may result in:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Immediate suspension or termination</li>
              <li>Legal action</li>
            </ul>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.4 Refund Policy:</h3>
            <p>Courses are non-refundable once accessed, except in cases defined in our Refund Policy.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.5 Course Updates:</h3>
            <p>We may update or modify course content at any time.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.6 Technical Issues:</h3>
            <p>We are not responsible for issues caused by user devices or internet connectivity, but reasonable support will be provided.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">6.7 No Guarantee:</h3>
            <p>We do not guarantee any specific results, outcomes, or success from our courses.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">7. Limitation of Liability:</h2>
            <p>Vectonix Classes shall not be liable for any direct, indirect, or incidental damages arising from the use of our website or services.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">8. Termination:</h2>
            <p>We reserve the right to suspend or terminate user access if any terms are violated.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">9. Governing Law:</h2>
            <p>These Terms shall be governed by and interpreted in accordance with the laws of India.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">10. Contact Information:</h2>
            <p>Email: <a href="mailto:vectonixclasses@gmail.com" className="text-indigo-600 hover:underline">vectonixclasses@gmail.com</a></p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
