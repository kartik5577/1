import React from 'react';
import { motion } from 'motion/react';

export default function CookiesPolicy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 border border-zinc-100 dark:border-zinc-800 shadow-sm"
        >
          <h1 className="text-4xl font-display font-extrabold dark:text-white mb-8">Cookies Policy</h1>
          
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p>This Cookie Policy explains how we uses cookies and similar technologies when you visit or use our website.</p>
            <p>By continuing to browse or use our website, you agree to our use of cookies in accordance with this policy.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">1. What Are Cookies:</h2>
            <p>Cookies are small text files that are placed on your device (computer, smartphone, or other electronic device) when you access a website. They allow the website to recognize your device and store certain information about your preferences or past actions.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">2. Types of Cookies We Use:</h2>
            <p>We use the following categories of cookies:</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">a) Strictly Necessary Cookies:</h3>
            <p>These cookies are essential for the operation of our website. They enable core functionalities such as security, network management, payment processing, and account access. Without these cookies, certain parts of the website may not function properly.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">b) Performance and Analytics Cookies:</h3>
            <p>These cookies help us understand how users interact with our website by collecting and reporting information anonymously. This allows us to improve website performance and user experience. We may use third-party tools such as Google Analytics for this purpose.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">c) Functional Cookies:</h3>
            <p>These cookies enable the website to remember choices you make (such as language preferences or login details) and provide enhanced, more personalized features.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">d) Advertising and Targeting Cookies:</h3>
            <p>These cookies may be used to deliver relevant advertisements and track the effectiveness of marketing campaigns. They may also limit how many times you see an advertisement. These cookies may be set by third-party advertising platforms.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">3. Third-Party Cookies:</h2>
            <p>Some cookies may be placed by third-party services that appear on our website or are used to provide certain functionalities. These third parties may collect information about your browsing activities across different websites over time.</p>
            <p>We do not control these cookies. You are advised to review the respective privacy policies of these third-party providers.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">4. Legal Basis for Using Cookies:</h2>
            <p>We use cookies:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>To perform our contractual obligations to users</li>
              <li>To comply with legal obligations</li>
              <li>For our legitimate business interests, including improving our services</li>
              <li>Based on user consent, where required</li>
            </ul>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">5. Managing and Controlling Cookies:</h2>
            <p>You have the right to accept or reject cookies.</p>
            <p>You can manage your cookie preferences through your browser settings. Most browsers allow you to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>View stored cookies</li>
              <li>Delete cookies</li>
              <li>Block cookies from specific or all websites</li>
            </ul>
            <p>Please note that disabling certain cookies may affect the functionality and performance of the website.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">6. Data Collected Through Cookies:</h2>
            <p>Cookies may collect information such as:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Pages visited and time spent</li>
              <li>Referring URLs</li>
            </ul>
            <p>This information is generally used in an aggregated and anonymized manner.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">7. Updates to This Policy:</h2>
            <p>We reserve the right to update or modify this Cookie Policy at any time. Any changes will be effective immediately upon posting on this page. We encourage users to review this policy periodically.</p>
            
            <h2 className="text-2xl font-bold mt-8 mb-4">8. Contact Information:</h2>
            <p>If you have any questions about this Cookie Policy or our data practices, you may contact us at:</p>
            <p className="font-bold mt-4">Vectonix Classes</p>
            <p>Email: <a href="mailto:vectonixclasses@gmail.com" className="text-indigo-600 hover:underline">vectonixclasses@gmail.com</a></p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
