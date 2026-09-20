"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Define the props for the WelcomeScreen component
interface WelcomeScreenProps {
  imageUrl: string;
  title: React.ReactNode;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  secondaryActionText?: React.ReactNode;
  onSecondaryActionClick?: () => void;
  className?: string;
}

/**
 * A responsive and animated welcome screen component matching the
 * Doorin-style onboarding card: large hero image on top, bold centred
 * title, description, dark pill CTA, and secondary link.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  imageUrl,
  title,
  description,
  buttonText,
  onButtonClick,
  secondaryActionText,
  onSecondaryActionClick,
  className,
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.25 },
    },
  };

  const itemVariants = {
    hidden: { y: 18, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 120, damping: 16 },
    },
  };

  const imageVariants = {
    hidden: { scale: 1.08, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: "spring" as const, duration: 0.7 },
    },
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center bg-white",
        className
      )}
    >
      {/* ── Hero image ─────────────────────────────────────────────── */}
      <motion.div
        className="w-full shrink-0 overflow-hidden px-3 pt-3"
        initial="hidden"
        animate="visible"
        variants={imageVariants}
      >
        <img
          src={imageUrl}
          alt="Welcome"
          className="aspect-video w-full rounded-xl object-cover"
        />
      </motion.div>

      {/* ── Text content ───────────────────────────────────────────── */}
      <motion.div
        className="flex flex-col items-center space-y-2 px-7 pt-5 pb-4 text-center"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.h2
          className="font-display text-[26px] font-semibold leading-tight text-blue"
          variants={itemVariants}
        >
          {title}
        </motion.h2>

        <motion.p
          className="max-w-[30ch] text-[13px] leading-relaxed text-ink-muted"
          variants={itemVariants}
        >
          {description}
        </motion.p>
      </motion.div>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <motion.div
        className="w-full space-y-3 px-7 pb-6"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Primary — dark pill button */}
        <motion.div variants={itemVariants}>
          <button
            type="button"
            onClick={onButtonClick}
            className="w-full rounded-full bg-blue-deep py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-blue"
          >
            {buttonText}
          </button>
        </motion.div>

        {/* Secondary link */}
        {secondaryActionText && onSecondaryActionClick && (
          <motion.div variants={itemVariants} className="text-center">
            <button
              type="button"
              onClick={onSecondaryActionClick}
              className="text-[13px] text-ink-muted transition-colors hover:text-blue"
            >
              {secondaryActionText}
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Modal wrapper – displays WelcomeScreen as a dialog overlay                */
/* -------------------------------------------------------------------------- */

interface AuthWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * A modal that wraps the WelcomeScreen, presenting it as a popup overlay.
 * Uses AnimatePresence for smooth mount/unmount transitions.
 */
export function AuthWelcomeModal({ open, onClose }: AuthWelcomeModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — fixed, full viewport */}
          <motion.div
            className="fixed inset-0 z-[100] bg-blue/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Centering wrapper */}
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            {/* Modal panel */}
            <motion.div
              className="pointer-events-auto relative w-full max-w-[360px] overflow-hidden rounded-3xl border border-line bg-white shadow-2xl"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 text-ink-muted backdrop-blur hover:text-ink"
                aria-label="Close"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <WelcomeScreen
                imageUrl="https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80&auto=format&fit=crop"
                title={
                  <>
                    Welcome To{" "}
                    <span className="text-brand">Memories in Prints</span>
                  </>
                }
                description="Discover and create beautifully printed stationery for life's most meaningful moments."
                buttonText="Let's get started"
                onButtonClick={() => {
                  window.location.href = "/login";
                }}
                secondaryActionText={
                  <>
                    Already have an account?{" "}
                    <span className="font-semibold text-accent-text">
                      Login Now
                    </span>
                  </>
                }
                onSecondaryActionClick={() => {
                  window.location.href = "/login";
                }}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
