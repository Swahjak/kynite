"use client";

import { motion } from "framer-motion";

interface NavigationProgressProps {
  isLoading: boolean;
  progress: number;
}

export function NavigationProgress({
  isLoading,
  progress,
}: NavigationProgressProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      className="fixed top-0 right-0 left-0 z-[100] h-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="bg-primary h-full shadow-[0_0_10px_var(--primary)]"
        initial={{ width: "0%" }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: 0.3,
          ease: "easeOut",
        }}
      />
    </motion.div>
  );
}
