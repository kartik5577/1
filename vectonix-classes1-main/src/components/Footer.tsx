import React from 'react';
import { Link } from 'react-router-dom';
import { Atom, Instagram, Youtube, Send, Mail, Phone, MessageCircle } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';

export default function Footer() {
  const { settings } = useSettings();
  const { user } = useAuth();

  if (user) return null;

  return (
    <footer className="py-24 bg-white dark:bg-[#050505] border-t border-zinc-100 dark:border-white/5 transition-colors duration-300">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
          <div className="space-y-8">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="h-10 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="h-full w-auto object-contain"
                  />
                </div>
                <span className="text-xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  {settings.appName || 'Vectonix Classes'}
                </span>
             </Link>
             <p className="text-zinc-500 text-xs font-medium leading-relaxed max-w-xs">
                Empowering students with quality education and expert guidance for a brighter future. Join our {settings.studentCountLabel || '10,000+'} community.
             </p>
             <div className="flex flex-wrap gap-4">
                {settings.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-[#E4405F] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {settings.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-[#1877F2] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
                {settings.linkedinUrl && (
                   <a href={settings.linkedinUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-[#0A66C2] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                   </a>
                )}
                {settings.youtubeUrl && (
                  <a href={settings.youtubeUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-[#FF0000] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {settings.telegramUrl && (
                  <a href={settings.telegramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-[#0088cc] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                    <Send className="w-4 h-4" />
                  </a>
                )}
                {settings.whatsappNumber && (
                  <a href={`https://wa.me/${settings.whatsappNumber.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-[#25D366] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                )}
             </div>
          </div>
          
          <div className="space-y-8">
             <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Quick Links</h4>
             <ul className="space-y-4">
                {[
                  { name: 'Home', path: '/' },
                  { name: 'Courses', path: '/courses' },
                  { name: 'About Us', path: '/about' },
                  { name: 'Contact', path: '/contact' }
                ].map(link => (
                  <li key={link.name}>
                    <Link to={link.path} className="text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">{link.name}</Link>
                  </li>
                ))}
             </ul>
          </div>

          <div className="space-y-8">
             <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Legal</h4>
             <ul className="space-y-4">
                {[
                  { name: 'Terms & Conditions', path: '/terms-conditions' },
                  { name: 'Privacy Policy', path: '/privacy-policy' },
                  { name: 'Refund Policy', path: '/refund-policy' },
                  { name: 'Cookies Policy', path: '/cookies-policy' },
                  { name: 'Disclaimer', path: '/disclaimer' }
                ].map(link => (
                  <li key={link.name}>
                    <Link to={link.path} className="text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">{link.name}</Link>
                  </li>
                ))}
             </ul>
          </div>

          <div className="space-y-8">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Contact Us</h4>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Email</p>
                    <a href={`mailto:${settings.supportEmail || 'vectonixclasses@gmail.com'}`} className="text-xs font-bold text-zinc-900 dark:text-white hover:text-blue-500 transition-colors lowercase">
                      {(settings.supportEmail || 'vectonixclasses@gmail.com').toLowerCase()}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-emerald-500" fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">WhatsApp</p>
                    <a href={`https://wa.me/${(settings.supportPhone || '7060621439').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-zinc-900 dark:text-white hover:text-emerald-500 transition-colors">
                      Chat with Us
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Our Office</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white leading-relaxed">
                      {settings.address || 'Saharanpur, Uttar Pradesh, India - 247554'}
                    </p>
                  </div>
                </div>
              </div>
          </div>
        </div>

        <div className="pt-10 border-t border-zinc-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
            © {new Date().getFullYear()} {settings.appName || 'Vectonix Classes'}. All rights reserved.
          </p>
          <div className="flex items-center gap-8">
             {[
               { name: 'Privacy', path: '/privacy-policy' },
               { name: 'Terms', path: '/terms-conditions' },
               { name: 'Cookies', path: '/cookies-policy' }
             ].map(item => (
               <Link key={item.name} to={item.path} className="text-[9px] font-black text-zinc-600 hover:text-blue-500 uppercase tracking-widest transition-colors">{item.name}</Link>
             ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
