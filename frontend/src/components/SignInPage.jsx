import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CanvasRevealEffect } from "@/components/CanvasRevealEffect";

export const SignInPage = ({ onSignIn }) => {
  const [email, setEmail] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setTransitioning(true);
    setTimeout(() => onSignIn(email), 900);
  };

  return (
    <div className="flex w-full flex-col min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        {!transitioning && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={3}
              containerClassName="bg-black"
              colors={[[255, 255, 255], [180, 220, 255]]}
              dotSize={6}
              reverse={false}
            />
          </div>
        )}
        {transitioning && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={4}
              containerClassName="bg-black"
              colors={[[255, 255, 255], [180, 220, 255]]}
              dotSize={6}
              reverse={true}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-8">
        <div className="flex items-center gap-2.5" data-testid="brand-logo">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white top-0 left-1/2 -translate-x-1/2 opacity-90" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white left-0 top-1/2 -translate-y-1/2 opacity-70" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white right-0 top-1/2 -translate-y-1/2 opacity-70" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white bottom-0 left-1/2 -translate-x-1/2 opacity-40" />
          </div>
          <span className="text-white text-sm tracking-[0.28em] font-mono uppercase">
            TraceRoot
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          SECURE / TLS 1.3
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key="email-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-8 text-center"
            >
              <div className="space-y-3">
                <p className="text-[0.7rem] tracking-[0.32em] text-white/40 font-mono uppercase">
                  Fraud Investigation Console
                </p>
                <h1 className="text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight text-white">
                  Sign in to TraceRoot
                </h1>
                <p className="text-base text-white/50 font-light">
                  Investigator access · demo environment
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    data-testid="login-email-input"
                    type="email"
                    placeholder="investigator@agency.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full backdrop-blur-sm text-white border border-white/15 rounded-full py-3.5 px-5 focus:outline-none focus:border-white/40 text-center bg-white/[0.03] placeholder-white/30"
                    required
                  />
                </div>

                <button
                  data-testid="login-submit-button"
                  type="submit"
                  className="w-full rounded-full bg-white text-black font-medium py-3.5 hover:bg-white/90 transition-all duration-200 active:scale-[0.99]"
                >
                  Sign In
                </button>
              </form>

              <p className="text-[11px] text-white/30 font-mono tracking-wide">
                DEMO · NO CREDENTIALS REQUIRED · ALL DATA IS SIMULATED
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 flex justify-between px-6 sm:px-10 pb-6 text-[10px] font-mono text-white/25 uppercase tracking-widest">
        <span>v0.4.1 · build 2026.02</span>
        <span>US-EAST-1</span>
      </div>
    </div>
  );
};
