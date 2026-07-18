// Login page. Preserves the animated dot-matrix shader background.
// Adds:
//  - Google sign-in (Emergent-managed OAuth) as primary
//  - Email + Sign In → mocked 6-digit OTP → success → dashboard
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CanvasRevealEffect } from "@/components/CanvasRevealEffect";
import { useAuth } from "@/lib/auth";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const goToGoogle = () => {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export const SignInPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState("email"); // email | otp | success
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [reverseCanvas, setReverseCanvas] = useState(false);
  const inputs = useRef([]);

  // Already logged in — go straight to dashboard.
  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => inputs.current[0]?.focus(), 500);
  }, [step]);

  const handleEmail = (e) => {
    e.preventDefault();
    if (!email) return;
    setStep("otp");
  };

  const handleCode = (i, v) => {
    if (v.length > 1) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
    if (i === 5 && v && next.every((d) => d)) {
      // Fire the outro shader, then show success (mocked OTP — any 6 digits work)
      setReverseCanvas(true);
      setTimeout(() => setStep("success"), 1400);
    }
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  return (
    <div className="flex w-full flex-col min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        {!reverseCanvas && (
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
        {reverseCanvas && (
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

      {/* Floating pill navbar */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-8">
        <div className="flex items-center gap-2.5">
          <div className="relative w-6 h-6">
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white top-0 left-1/2 -translate-x-1/2 opacity-90" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white left-0 top-1/2 -translate-y-1/2 opacity-70" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white right-0 top-1/2 -translate-y-1/2 opacity-70" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-white bottom-0 left-1/2 -translate-x-1/2 opacity-40" />
          </div>
          <span className="text-white text-sm tracking-[0.28em] font-mono uppercase">TraceRoot</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          SECURE / TLS 1.3
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}
                className="space-y-7 text-center"
              >
                <div className="space-y-2">
                  <p className="text-[0.7rem] tracking-[0.32em] text-white/40 font-mono uppercase">
                    Fraud Investigation Console
                  </p>
                  <h1 className="text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-white">
                    Sign in to TraceRoot
                  </h1>
                  <p className="text-lg text-white/50 font-light">
                    Investigator access
                  </p>
                </div>

                <button
                  data-testid="google-signin-button"
                  onClick={goToGoogle}
                  className="backdrop-blur-[2px] w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full py-3 px-4 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-400 to-red-400" />
                  <span>Continue with Google</span>
                </button>

                <div className="flex items-center gap-4">
                  <div className="h-px bg-white/10 flex-1" />
                  <span className="text-white/40 text-sm">or</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                <form onSubmit={handleEmail}>
                  <div className="relative">
                    <input
                      data-testid="login-email-input"
                      type="email"
                      placeholder="investigator@agency.gov"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center bg-white/[0.02] placeholder-white/30"
                    />
                    <button
                      data-testid="login-submit-button"
                      type="submit"
                      className="absolute right-1.5 top-1.5 text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      →
                    </button>
                  </div>
                </form>

                <p className="text-[11px] text-white/30 font-mono tracking-wide">
                  DEMO OTP · ANY 6 DIGITS WILL WORK
                </p>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }} transition={{ duration: 0.35 }}
                className="space-y-6 text-center"
              >
                <div className="space-y-2">
                  <h1 className="text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-white">
                    We sent you a code
                  </h1>
                  <p className="text-lg text-white/50 font-light">
                    Enter any 6 digits · demo mode
                  </p>
                </div>

                <div className="rounded-full py-4 px-5 border border-white/10 bg-transparent">
                  <div className="flex items-center justify-center">
                    {code.map((digit, i) => (
                      <div key={i} className="flex items-center">
                        <input
                          ref={(el) => (inputs.current[i] = el)}
                          data-testid={`otp-input-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCode(i, e.target.value)}
                          onKeyDown={(e) => handleKey(i, e)}
                          className="w-8 text-center text-xl bg-transparent text-white border-none focus:outline-none"
                        />
                        {i < 5 && <span className="text-white/20 text-xl">|</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  data-testid="otp-back-button"
                  onClick={() => { setCode(["","","","","",""]); setStep("email"); }}
                  className="text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  ← Use a different email
                </button>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="space-y-6 text-center"
              >
                <div className="space-y-2">
                  <h1 className="text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-white">
                    You're in.
                  </h1>
                  <p className="text-lg text-white/50 font-light">Loading investigator console</p>
                </div>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="py-6"
                >
                  <div className="mx-auto w-14 h-14 rounded-full bg-white flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </motion.div>
                {/* After mock OTP success, funnel to real Google auth — the OTP
                    is a design showcase; only Google produces a real session. */}
                <motion.button
                  data-testid="continue-with-google"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  onClick={goToGoogle}
                  className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors"
                >
                  Continue with Google
                </motion.button>
                <p className="text-[11px] text-white/30 font-mono tracking-wide">
                  Real authentication happens via Google — the OTP was a UI demo.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 flex justify-between px-6 sm:px-10 pb-6 text-[10px] font-mono text-white/25 uppercase tracking-widest">
        <span>v0.5.0 · build 2026.02</span>
        <span>US-EAST-1</span>
      </div>
    </div>
  );
};
