"use client";

import { motion } from "motion/react";

type WelcomeScreenProps = {
  isExiting: boolean;
  onContinue: () => void;
};

export function WelcomeScreen({ isExiting, onContinue }: WelcomeScreenProps) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      aria-label="Welcome screen"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(124,110,248,0.28),transparent_42%),radial-gradient(circle_at_78%_12%,rgba(62,207,207,0.18),transparent_36%),linear-gradient(170deg,#080810_0%,#0b0c16_55%,#07070d_100%)]"
      />

      <div className="welcome-noise absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="welcome-halo absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.6, ease: "easeOut" }}
          className="text-balance text-[clamp(40px,6vw,72px)] font-bold tracking-[-0.02em] text-text"
        >
          Welcome to PromptForge
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.55, ease: "easeOut" }}
          className="mt-5 max-w-2xl text-balance text-base leading-8 text-text-muted sm:text-lg"
        >
          Transforming simple ideas into extraordinary AI prompts
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 0.74, y: 0 }}
          transition={{ delay: 0.74, duration: 0.55, ease: "easeOut" }}
          className="mt-8 space-y-1 text-sm leading-7 text-text-muted"
        >
          <p>A Skyle Project</p>
          <p>Developed by Hamza Malik with Team Skyle</p>
        </motion.div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: isExiting ? 1 : 1.01 }}
          whileTap={{ scale: isExiting ? 1 : 0.97 }}
          transition={{ delay: 0.96, duration: 0.45, ease: "easeOut" }}
          onClick={onContinue}
          disabled={isExiting}
          className="mt-12 inline-flex h-12 items-center justify-center rounded-full border border-primary/45 bg-primary/16 px-8 text-sm font-medium uppercase tracking-[0.12em] text-text transition duration-150 hover:border-primary/70 hover:bg-primary/22 disabled:cursor-not-allowed"
        >
          Continue
        </motion.button>
      </div>
    </motion.section>
  );
}
