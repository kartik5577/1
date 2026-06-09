import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CourseCardProps {
  key?: string | number;
  course: {
    id: string;
    title: string;
    description: string;
    category: string;
  };
}

export default function CourseCard({ course }: CourseCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row items-center p-4 md:p-6 gap-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 shrink-0">
        <BookOpen className="w-8 h-8" />
      </div>
      
      <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {course.category}
          </span>
        </div>
        <h3 className="text-xl font-bold dark:text-white">{course.title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{course.description}</p>
      </div>
      
      <div className="shrink-0 w-full md:w-auto">
        <Link to={`/course/${course.id}`} className="block w-full">
          <button className="w-full md:w-auto px-6 py-3 bg-zinc-50 dark:bg-zinc-800 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-bold flex items-center justify-center gap-2">
            Preview
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}
