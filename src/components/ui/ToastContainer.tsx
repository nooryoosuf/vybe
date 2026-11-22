'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useVybe } from '@/context/VybeContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useVybe();

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const icon =
            toast.variant === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : toast.variant === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            ) : toast.variant === 'error' ? (
              <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="h-4 w-4 text-vybe-accentLight shrink-0" />
            );

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl bg-[#131624]/95 backdrop-blur-md border border-white/10 px-4 py-3 shadow-vybe-lg"
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white">{toast.title}</div>
                {toast.description && (
                  <div className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                    {toast.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-500 hover:text-white transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
