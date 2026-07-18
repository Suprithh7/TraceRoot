import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, FileText, X, Sparkles, ShieldAlert, Activity, Download } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { CASES, RISK_META } from "@/data/mockCases";
import { buildReportHtml } from "@/lib/reportPrint";

const formatMoney = (n, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

const formatWhen = (iso) => new Date(iso).toLocaleString();

export const CaseDetail = ({ caseId, onBack }) => {
  const c = CASES.find((x) => x.id === caseId);
  const [reportOpen, setReportOpen] = useState(false);

  if (!c) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/60">Case not found.</p>
          <button
            onClick={onBack}
            className="rounded-full bg-white text-black px-6 py-2 font-medium"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const meta = RISK_META[c.risk];
  const totalPoints = c.breakdown.reduce((s, b) => s + b.points, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <button
            data-testid="back-to-dashboard"
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono uppercase tracking-widest text-xs">Case Queue</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
              Case
            </span>
            <span className="text-sm font-mono">{c.id}</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10 space-y-10">
        {/* Header block */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap items-start justify-between gap-6"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meta.dot} ring-4 ${meta.ring}`} />
              <span
                data-testid="risk-badge"
                className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border ${meta.chip}`}
              >
                {meta.label}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" data-testid="case-subject">
              {c.subject}
            </h1>
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-white/50 font-mono">
              <span>Reported · {formatWhen(c.reportedAt)}</span>
              <span>Channel · {c.channel}</span>
              <span>Route · {c.country}</span>
              <span>Exposure · <span className="text-white">{formatMoney(c.amount, c.currency)}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Risk Score</div>
              <div className={`text-5xl font-semibold tracking-tight ${meta.text}`} data-testid="risk-score">
                {c.riskScore}<span className="text-white/30 text-2xl">/100</span>
              </div>
            </div>
            <button
              data-testid="generate-report-button"
              onClick={() => setReportOpen(true)}
              className="rounded-full bg-white text-black font-medium px-6 py-3 hover:bg-white/90 transition-all active:scale-[0.99] flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </motion.div>

        {/* Chain diagram */}
        <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-6 sm:p-8" data-testid="chain-diagram">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold tracking-tight">Fund flow chain</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
              {c.chain.length} nodes · reconstructed
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {c.chain.map((node, idx) => (
              <React.Fragment key={idx}>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className={`flex-1 border rounded-2xl p-4 min-w-[160px] ${
                    node.tag === "origin"
                      ? "border-white/20 bg-white/[0.04]"
                      : node.tag === "exit"
                      ? "border-red-500/30 bg-red-500/[0.05]"
                      : "border-amber-500/20 bg-amber-500/[0.03]"
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
                    {node.tag === "origin" ? "Source" : node.tag === "exit" ? "Cash Out" : `Layer ${idx}`}
                  </div>
                  <div className="text-base font-semibold mb-1">{node.label}</div>
                  <div className="text-xs font-mono text-white/50 mb-3 break-all">{node.id}</div>
                  <div className="text-sm font-mono text-white/90">{node.amount}</div>
                </motion.div>
                {idx < c.chain.length - 1 && (
                  <div className="flex items-center justify-center md:w-8">
                    <ArrowRight className="w-5 h-5 text-white/30 rotate-90 md:rotate-0" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Velocity timeline */}
        <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-6 sm:p-8" data-testid="velocity-timeline">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-white/60" />
              <h2 className="text-lg font-semibold tracking-tight">Transaction velocity · 24h</h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
              tx / hour · Δ from baseline
            </span>
          </div>
          <VelocityChart data={c.velocity} risk={c.risk} />
          <div className="mt-3 grid grid-cols-3 gap-4 text-[11px] font-mono">
            <VelocityStat label="Peak" value={Math.max(...c.velocity.map((p) => p.tx)).toFixed(1)} suffix="tx/h" />
            <VelocityStat label="Avg (24h)" value={(c.velocity.reduce((s, p) => s + p.tx, 0) / c.velocity.length).toFixed(1)} suffix="tx/h" />
            <VelocityStat label="Baseline" value="4.5" suffix="tx/h" />
          </div>
        </section>

        {/* Two column: breakdown + AI summary */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Breakdown */}
          <div className="lg:col-span-2 border border-white/10 rounded-2xl bg-white/[0.015] p-6" data-testid="risk-breakdown">
            <div className="flex items-center gap-2 mb-5">
              <ShieldAlert className="w-4 h-4 text-white/60" />
              <h2 className="text-lg font-semibold tracking-tight">Risk breakdown</h2>
            </div>
            <ul className="space-y-3">
              {c.breakdown.map((b, i) => (
                <li key={i} className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-b-0">
                  <div>
                    <div className="text-sm">{b.label}</div>
                    <div className="text-[11px] font-mono text-white/40 mt-0.5">{b.meta}</div>
                  </div>
                  <div className="text-sm font-mono text-white/90 whitespace-nowrap">
                    +{b.points}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Total</span>
              <span className={`text-2xl font-semibold ${meta.text}`}>
                {totalPoints}/100
              </span>
            </div>
          </div>

          {/* AI Summary */}
          <div className="lg:col-span-3 border border-white/10 rounded-2xl bg-white/[0.015] p-6" data-testid="ai-summary">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4 text-white/60" />
              <h2 className="text-lg font-semibold tracking-tight">AI investigator summary</h2>
              <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-white/40 border border-white/10 rounded-full px-2 py-0.5">
                model · tr-cortex 1.4
              </span>
            </div>
            <p className="text-[15px] leading-[1.75] text-white/80">
              {c.aiSummary}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Layering", "Cross-border", "Elder-fraud", "Structuring", "Mule chain"]
                .filter(() => c.risk !== "safe")
                .slice(0, c.risk === "freeze" ? 4 : 2)
                .map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono uppercase tracking-widest border border-white/10 rounded-full px-2.5 py-1 text-white/50"
                  >
                    #{tag}
                  </span>
                ))}
            </div>
          </div>
        </section>
      </main>

      {/* Report modal */}
      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setReportOpen(false)}
            data-testid="report-modal-backdrop"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden"
              data-testid="report-modal"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-white/60" />
                  <span className="text-sm font-mono uppercase tracking-widest text-white/70">
                    Investigation Report · {c.id}
                  </span>
                </div>
                <button
                  data-testid="close-report-button"
                  onClick={() => setReportOpen(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">Executive Summary</p>
                  <p className="text-sm text-white/80 leading-relaxed">{c.aiSummary}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ReportField label="Case ID" value={c.id} />
                  <ReportField label="Reported" value={formatWhen(c.reportedAt)} />
                  <ReportField label="Subject" value={c.subject} />
                  <ReportField label="Channel" value={c.channel} />
                  <ReportField label="Route" value={c.country} />
                  <ReportField label="Exposure" value={formatMoney(c.amount, c.currency)} />
                  <ReportField label="Risk Score" value={`${c.riskScore}/100`} />
                  <ReportField label="Recommendation" value={meta.label} />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">Signals</p>
                  <ul className="space-y-1.5">
                    {c.breakdown.map((b, i) => (
                      <li key={i} className="text-sm flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-white/80">{b.label}</span>
                        <span className="font-mono text-white/50">+{b.points}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 text-[10px] font-mono text-white/30 uppercase tracking-widest">
                  Generated {new Date().toLocaleString()} · TraceRoot v0.4.1 · demo
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
                <button
                  data-testid="close-report-button-footer"
                  onClick={() => setReportOpen(false)}
                  className="rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 px-5 py-2 text-sm transition-colors"
                >
                  Close
                </button>
                <button
                  data-testid="download-report-button"
                  onClick={() => {
                    const html = buildReportHtml(c, meta);
                    const w = window.open("", "_blank", "width=900,height=1000");
                    if (!w) return;
                    w.document.open();
                    w.document.write(html);
                    w.document.close();
                    w.focus();
                    // Give the new window a tick to render, then trigger print
                    setTimeout(() => {
                      try { w.print(); } catch (e) { /* noop */ }
                    }, 350);
                  }}
                  className="rounded-full bg-white text-black px-5 py-2 text-sm font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReportField = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{label}</div>
    <div className="text-sm text-white/90">{value}</div>
  </div>
);

const VelocityStat = ({ label, value, suffix }) => (
  <div className="border border-white/10 rounded-xl px-3 py-2 bg-white/[0.02]">
    <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
    <div className="text-sm text-white/90 mt-0.5">
      {value}
      <span className="text-white/40 ml-1">{suffix}</span>
    </div>
  </div>
);

const VelocityChart = ({ data, risk }) => {
  const stroke =
    risk === "freeze" ? "#f87171" : risk === "monitor" ? "#fbbf24" : "#34d399";
  const gradId = `vel-${risk}`;
  return (
    <div className="h-40 w-full" data-testid="velocity-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.5} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="hour"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickFormatter={(v) => (v === 0 ? "now" : `${v}h`)}
            interval={3}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <ReferenceLine y={4.5} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px",
              fontSize: "12px",
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
            itemStyle={{ color: stroke }}
            labelFormatter={(v) => (v === 0 ? "now" : `${v}h ago`)}
            formatter={(v) => [`${v} tx/h`, "velocity"]}
          />
          <Area
            type="monotone"
            dataKey="tx"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
