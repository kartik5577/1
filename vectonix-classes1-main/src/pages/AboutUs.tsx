import React from 'react';
import { motion } from 'motion/react';
import { Target, Users, BookOpen, ShieldCheck, GraduationCap, Atom, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { APP_LOGO_URL } from '../constants';

const stats = [
  { label: 'Students Empowered', value: '10,000+', icon: Users },
  { label: 'Courses Available', value: '50+', icon: BookOpen },
  { label: 'Expert Instructors', value: '20+', icon: GraduationCap },
  { label: 'Success Rate', value: '98%', icon: ShieldCheck },
];

export default function AboutUs() {
  const { settings } = useSettings();

  return (
    <div className="bg-white dark:bg-[#050505] min-h-screen text-zinc-900 dark:text-white transition-colors duration-300 pt-32 pb-24">
      <div className="container mx-auto px-6 mb-8">
        <Breadcrumbs items={[{ label: 'About Us', active: true }]} />
      </div>
      {/* Hero Section */}
      <section className="container mx-auto px-6 mb-24">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-500">
              Our Story
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-tight">
              Shaping the <span className="text-blue-500 italic">Future</span> of Digital Learning
            </h1>
            <p className="text-zinc-500 text-lg font-medium leading-relaxed max-w-xl">
              Vectonix Classes was founded with a single mission: to make high-quality education accessible to every student, regardless of their location. We combine traditional teaching excellence with modern digital tools.
            </p>
          </div>
          <div className="flex-1 relative">
            <div className="aspect-square rounded-[4rem] overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200" 
                alt="Students learning" 
                className="w-full h-full object-cover transition-all duration-700 hover:scale-[1.02] opacity-95 dark:opacity-85"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600 rounded-[2.5rem] flex items-center justify-center p-8 text-center shadow-2xl transform -rotate-12 border-8 border-white dark:border-[#050505]">
              <span className="text-white text-xs font-black uppercase tracking-widest leading-tight">Trust of 10k+ Students</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="bg-zinc-50 dark:bg-[#0a0a0a] border-y border-zinc-100 dark:border-white/5 py-24 mb-24">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-stats gap-12 lg:gap-0 lg:flex lg:justify-between items-center">
            {stats.map((stat, i) => (
              <div key={i} className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center mx-auto text-blue-500 mb-4">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-3xl font-black tracking-tighter">{stat.value}</div>
                <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="container mx-auto px-6 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="p-12 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[3rem] space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-blue-500">
              <Target className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black uppercase tracking-tight">Our Mission</h3>
            <p className="text-zinc-500 font-medium leading-relaxed">
              To empower the next generation of leaders by providing them with the highest quality educational resources, expert guidance, and a community that fosters growth and excellence.
            </p>
          </div>
          <div className="p-12 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[3rem] space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-emerald-500">
              <Atom className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black uppercase tracking-tight">Our Vision</h3>
            <p className="text-zinc-500 font-medium leading-relaxed">
              To become the world's most student-centric learning platform where every learner finds the path to their academic and professional success through innovation and integrity.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Core Values</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase">What we <span className="text-blue-500 italic">Stand For</span></h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Quality First', desc: 'We never compromise on the quality of our content and teaching pedigree.' },
            { title: 'Student Support', desc: 'Our dedicated support team is always ready to help you overcome any hurdle.' },
            { title: 'Innovation', desc: 'We constantly update our techniques to match the evolving educational landscape.' }
          ].map((value, i) => (
            <div key={i} className="flex gap-6 items-start">
              <div className="shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <CheckCircle2 className="text-white w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black uppercase tracking-tight">{value.title}</h4>
                <p className="text-zinc-500 font-medium text-sm leading-relaxed">{value.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
