import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface BreadcrumbItem {
  label: string;
  path?: string;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className }) => {
  return (
    <nav className={cn("flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 overflow-x-auto no-scrollbar py-2", className)}>
      <Link 
        to="/" 
        className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 shrink-0"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Home</span>
      </Link>
      
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
          {item.path && !item.active ? (
            <Link 
              to={item.path} 
              className="hover:text-indigo-600 transition-colors shrink-0 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn("shrink-0 whitespace-nowrap", item.active ? "text-indigo-600 font-extrabold" : "")}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
