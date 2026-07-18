import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CASES, RISK_META } from "@/data/mockCases";

const formatMoney = (n, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

const formatWhen = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const Dashboard = ({ email, onOpenCase, onSignOut }) => {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return CASES;
    return CASES.filter((c) => c.risk === filter);
  }, [filter]);

  const stats = useMemo(() => {
    return {
      total: CASES.length,
      freeze: CASES.filter((c) => c.risk === "freeze").length,
      monitor: CASES.filter((c) => c.risk === "monitor").length,
      safe: CASES.filter((c) => c.risk === "safe").length,
      exposure: CASES.filter((c) => c.risk === "freeze").reduce((s, c) => s + c.amount, 0),
    };
  }, []);

  const initials = (email || "IN").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6">
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white top-0 left-1/2 -translate-x-1/2 opacity-90" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white left-0 top-1/2 -translate-y-1/2 opacity-70" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white right-0 top-1/2 -translate-y-1/2 opacity-70" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white bottom-0 left-1/2 -translate-x-1/2 opacity-40" />
            </div>
            <span className="text-sm tracking-[0.28em] font-mono uppercase" data-testid="brand-logo">
              TraceRoot
            </span>
            <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-white/30 border border-white/10 rounded-full px-2 py-0.5 ml-2">
              Investigator Console
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE FEED · 12 sensors
            </div>
            <div className="flex items-center gap-2.5" data-testid="user-menu">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-mono">
                {initials}
              </div>
              <button
                data-testid="signout-button"
                onClick={onSignOut}
                className="text-xs font-mono text-white/50 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
        {/* Heading */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/40 mb-2">
              Case queue · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Good hunting, <span className="text-white/60">{email?.split("@")[0] || "investigator"}</span>.
            </h1>
          </div>
          <div className="text-xs font-mono text-white/40">
            Signed in as <span className="text-white/70">{email}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <StatCard label="Open cases" value={stats.total} tone="neutral" />
          <StatCard label="Freeze immediately" value={stats.freeze} tone="red" testId="stat-freeze" />
          <StatCard label="Monitor" value={stats.monitor} tone="amber" />
          <StatCard label="Frozen exposure" value={formatMoney(stats.exposure)} tone="neutral" small />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-5" data-testid="filter-bar">
          {[
            { k: "all", label: "All" },
            { k: "freeze", label: "Freeze" },
            { k: "monitor", label: "Monitor" },
            { k: "safe", label: "Safe" },
          ].map((f) => (
            <button
              key={f.k}
              data-testid={`filter-${f.k}`}
              onClick={() => setFilter(f.k)}
              className={`text-xs font-mono uppercase tracking-wider px-4 py-1.5 rounded-full border transition-colors ${
                filter === f.k
                  ? "bg-white text-black border-white"
                  : "border-white/15 text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cases table */}
        <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.015]">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/10">
            <div className="col-span-3">Case ID</div>
            <div className="col-span-3">Subject</div>
            <div className="col-span-2">Channel · Route</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1 text-right">Score</div>
            <div className="col-span-2 text-right">Risk</div>
          </div>
          <div data-testid="cases-list">
            {filtered.map((c, i) => {
              const meta = RISK_META[c.risk];
              return (
                <motion.button
                  key={c.id}
                  data-testid={`case-row-${c.id}`}
                  onClick={() => onOpenCase(c.id)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-5 items-center text-left border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${meta.dot} ring-4 ${meta.ring}`} />
                    <div>
                      <div className="text-sm font-mono tracking-tight">{c.id}</div>
                      <div className="text-[11px] font-mono text-white/30 md:hidden mt-0.5">
                        {c.subject}
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block col-span-3 text-sm text-white/80">
                    {c.subject}
                    <div className="text-[11px] text-white/40 mt-0.5">{formatWhen(c.reportedAt)}</div>
                  </div>
                  <div className="hidden md:block col-span-2 text-sm text-white/60 font-mono">
                    {c.channel}
                    <div className="text-[11px] text-white/30 mt-0.5">{c.country}</div>
                  </div>
                  <div className="col-span-6 md:col-span-1 text-right text-sm font-mono">
                    {formatMoney(c.amount, c.currency)}
                  </div>
                  <div className="hidden md:block col-span-1 text-right text-sm font-mono">
                    {c.riskScore}
                  </div>
                  <div className="col-span-6 md:col-span-2 flex md:justify-end">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-[11px] font-mono text-white/25 uppercase tracking-widest">
          Showing {filtered.length} of {CASES.length} · all data simulated for demo
        </p>
      </main>
    </div>
  );
};

const StatCard = ({ label, value, tone = "neutral", small = false, testId }) => {
  const toneMap = {
    red: "text-red-300",
    amber: "text-amber-300",
    neutral: "text-white",
  };
  return (
    <div
      data-testid={testId}
      className="border border-white/10 rounded-2xl bg-white/[0.015] px-5 py-4"
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
        {label}
      </div>
      <div className={`${small ? "text-xl" : "text-3xl"} font-semibold tracking-tight ${toneMap[tone]}`}>
        {value}
      </div>
    </div>
  );
};
