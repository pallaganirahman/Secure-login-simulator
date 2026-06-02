import React from 'react';
import { motion } from 'motion/react';

interface SecureCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  id?: string;
}

export function SecureCard({ children, title, subtitle, className = '', id }: SecureCardProps) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`bg-white border border-[#E4E4E7] rounded-xl shadow-sm p-6 overflow-hidden ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-5 border-b border-[#F4F4F5] pb-4">
          {title && <h3 className="text-lg font-semibold text-[#18181B] tracking-tight">{title}</h3>}
          {subtitle && <p className="text-sm text-[#71717A] mt-1 font-sans">{subtitle}</p>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
