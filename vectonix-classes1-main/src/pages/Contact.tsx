import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, MapPin, Zap, Instagram, Youtube, CheckCircle2, FileText, Send, Check, MessageCircle } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Contact() {
  const { settings } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    subject: '',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      // Only allow 10 digits
      const cleaned = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: cleaned }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.mobile || !formData.message) {
      alert('Please fill in all required fields.');
      return;
    }

    if (formData.mobile.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'enquiries'), {
        ...formData,
        createdAt: new Date().toISOString(),
        status: 'new'
      });
      setIsSuccess(true);
      setFormData({ name: '', email: '', mobile: '', subject: '', message: '' });
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      alert('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#050505] min-h-screen text-zinc-900 dark:text-white transition-colors duration-300 pt-32 pb-24">
      <div className="container mx-auto px-6 mb-8 uppercase tracking-widest text-[10px] font-black italic">
        <Breadcrumbs items={[{ label: 'Contact Us', active: true }]} />
      </div>
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-500 mb-8">
            Connect With Us
          </div>
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] mb-8">
            Have a <span className="text-blue-500 italic decoration-blue-500/20 underline underline-offset-[12px]">Question?</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg lg:text-xl font-medium leading-relaxed max-w-xl">
            We're building the future of academic excellence. Reach out through any of our official channels below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          {/* Contact Details */}
          <div className="lg:col-span-5 space-y-8">
            <div className="grid grid-cols-1 gap-6">
               <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 space-y-6 hover:border-blue-500/50 transition-all shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-sm">
                    <Mail className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Email Support</p>
                    <a href={`mailto:${settings.supportEmail || 'vectonixclasses@gmail.com'}`} className="font-bold text-lg md:text-xl lg:text-2xl hover:text-blue-500 transition-colors lowercase break-all decoration-blue-500/20 underline underline-offset-4 leading-tight block">{(settings.supportEmail || 'vectonixclasses@gmail.com').toLowerCase()}</a>
                  </div>
               </div>
               <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 space-y-6 hover:border-emerald-500/50 transition-all shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-sm">
                    <MessageCircle className="w-7 h-7" fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">WhatsApp Support</p>
                    <a href={`https://wa.me/${(settings.supportPhone || '7060621439').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-black text-lg md:text-xl lg:text-2xl hover:text-emerald-500 transition-colors uppercase break-all decoration-emerald-500/20 underline underline-offset-4 leading-tight block">Chat With Us</a>
                  </div>
               </div>
               <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 space-y-6 hover:border-amber-500/50 transition-all shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-sm">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Office Address</p>
                    <p className="font-black text-lg md:text-xl lg:text-2xl leading-tight uppercase">{settings.address || 'Vectonix Classes, Saharanpur, Uttar Pradesh, India - 247554'}</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="p-10 lg:p-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[3.5rem] shadow-sm relative overflow-hidden">
              <AnimatePresence>
                {isSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-10 text-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20 shadow-lg">
                      <Check className="w-10 h-10" />
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 italic text-zinc-900 dark:text-white">Message Sent!</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs max-w-sm leading-relaxed">
                      Thank you for reaching out. Our academic counselors will get back to you within 24 hours.
                    </p>
                    <button 
                      onClick={() => setIsSuccess(false)}
                      className="mt-8 px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                    >
                      Send Another
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <h2 className="text-3xl font-black uppercase tracking-tighter mb-8 italic">Send a Message</h2>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      className="w-full bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email Address</label>
                    <input 
                      type="email" 
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      className="w-full bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Mobile Number (10 Digits)</label>
                    <input 
                      type="tel" 
                      name="mobile"
                      required
                      value={formData.mobile}
                      onChange={handleChange}
                      placeholder="Enter 10 digit number"
                      className="w-full bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Subject</label>
                    <input 
                      type="text" 
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="Category of inquiry"
                      className="w-full bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Message</label>
                  <textarea 
                    rows={4}
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Describe your requirement..."
                    className="w-full bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-xl shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Inquiry'} <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

