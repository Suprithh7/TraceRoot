// Case workspace: header + tabs (Graph, Risk, Copilot, Timeline, Recs) + PDF download.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, ShieldAlert, Sparkles, Activity, Network, ClipboardCheck, Loader2, Users, ClipboardList, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { CaseGraph } from "@/features/graph/CaseGraph";
import { CopilotPanel } from "@/features/copilot/CopilotPanel";
import { CaseTimeline } from "@/features/timeline/CaseTimeline";
import { SharingPanel } from "@/features/sharing/SharingPanel";
import { AuditPanel } from "@/features/audit/AuditPanel";
import { useCaseWebSocket } from "@/lib/useCaseWebSocket";

const RISK_META = {
  freeze:  { label: "Freeze Immediately", chip: "bg-red-500/10 border-red-500/30 text-red-300", text: "text-red-300", dot: "bg-red-400" },
  monitor: { label: "Monitor",             chip: "bg-amber-500/10 border-amber-500/30 text-amber-300", text: "text-amber-300", dot: "bg-amber-400" },
  safe:    { label: "Safe",                chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", text: "text-emerald-300", dot: "bg-emerald-400" },
};

const fmtMoney = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export const CaseWorkspace = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("graph");
  const [state, setState] = useState({ loading: true });
  const [liveNotice, setLiveNotice] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const [c, r, g, t, recs] = await Promise.all([
        api.getCase(caseId), api.getRisk(caseId), api.getGraph(caseId),
        api.getTransactions(caseId), api.getRecommendations(caseId),
      ]);
      setState((prev) => ({ ...prev, loading: false, case: c, risk: r, graph: g, txs: t, recs }));
    } catch (e) {
      setState((prev) => ({ ...prev, loading: false, error: e.message }));
    }
  }, [caseId]);

  useEffect(() => { refetch(); }, [refetch]);

  const handleWsEvent = useCallback((evt) => {
    if (!evt?.event || evt.event === "connected") return;
    refetch();
    const labels = {
      status_changed:    `Status → ${evt.payload?.to}`,
      case_rescored:     `Risk rescored · ${evt.payload?.risk} (${evt.payload?.risk_score})`,
      csv_uploaded:      `CSV ingested by ${evt.payload?.by || "someone"} · ${evt.payload?.accepted} tx`,
      copilot_started:   `AI copilot started (${evt.payload?.kind})`,
      copilot_finished:  `AI copilot finished (${evt.payload?.kind})`,
      case_shared:       `Case shared with ${evt.payload?.email}`,
      case_unshared:     `Access revoked for ${evt.payload?.email}`,
      report_downloaded: `PDF downloaded by ${evt.payload?.by || "someone"}`,
    };
    const msg = labels[evt.event];
    if (msg) {
      setLiveNotice(msg);
      setTimeout(() => setLiveNotice(null), 4000);
    }
  }, [refetch]);

  const { connected, polling } = useCaseWebSocket(caseId, handleWsEvent, refetch);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/40" />
          <p className="text-sm text-white/50 font-mono">Loading case…</p>
        </div>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-white/60">Failed to load case: {state.error}</p>
          <button onClick={() => navigate("/dashboard")} className="rounded-full bg-white text-black px-5 py-2 text-sm font-medium">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const { case: c, risk, graph, txs, recs } = state;
  const meta = RISK_META[risk.risk] || RISK_META.safe;

  const tabs = [
    { k: "graph",     label: "Graph",           icon: <Network className="w-3.5 h-3.5" /> },
    { k: "risk",      label: "Risk",            icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { k: "copilot",   label: "Copilot",         icon: <Sparkles className="w-3.5 h-3.5" /> },
    { k: "timeline",  label: "Timeline",        icon: <Activity className="w-3.5 h-3.5" /> },
    { k: "recs",      label: "Recommendations", icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    { k: "sharing",   label: "Sharing",         icon: <Users className="w-3.5 h-3.5" /> },
    { k: "audit",     label: "Audit",           icon: <ClipboardList className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <button
            data-testid="back-to-dashboard"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono uppercase tracking-widest text-xs">Case Queue</span>
          </button>
          <div className="flex items-center gap-4">
            <div
              data-testid="ws-status"
              title={connected ? "Live updates via WebSocket" : polling ? "WebSocket down — polling every 10s" : "Connecting…"}
              className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest ${
                connected ? "text-emerald-300" : polling ? "text-amber-300" : "text-white/40"
              }`}
            >
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? "Live" : polling ? "Polling" : "…"}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Case</span>
              <span className="text-sm font-mono">{c.case_id.replace("case_", "")}</span>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {liveNotice && (
            <motion.div
              key={liveNotice}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="max-w-[1400px] mx-auto px-6 sm:px-10 pb-3"
            >
              <div className="text-xs font-mono text-white/70 border border-white/10 rounded-full px-3 py-1 bg-white/[0.03] inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {liveNotice}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10 space-y-8">
        {/* Header block */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
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
              <span>Reported · {new Date(c.reported_at).toLocaleString()}</span>
              <span>Channel · {c.channel}</span>
              <span>Route · {c.country}</span>
              <span>Exposure · <span className="text-white">{fmtMoney(c.amount)}</span></span>
              <span>Transactions · {c.tx_count}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Risk Score</div>
              <div className={`text-5xl font-semibold tracking-tight ${meta.text}`} data-testid="risk-score">
                {risk.total}<span className="text-white/30 text-2xl">/100</span>
              </div>
            </div>
            <a
              data-testid="download-report-button"
              href={api.reportUrl(c.case_id)}
              className="rounded-full bg-white text-black font-medium px-6 py-3 hover:bg-white/90 transition-all active:scale-[0.99] flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 -mb-4">
          {tabs.map((t) => (
            <button
              key={t.k}
              data-testid={`tab-${t.k}`}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.k
                  ? "border-white text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {tab === "graph" && (
              <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-4">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h2 className="text-sm font-medium">Money-flow graph</h2>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                    {graph.nodes.length} accounts · {graph.edges.length} edges · click a node to focus
                  </span>
                </div>
                <CaseGraph graph={graph} transactions={txs} />
              </section>
            )}

            {tab === "risk" && (
              <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-6" data-testid="risk-breakdown">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-4 h-4 text-white/60" />
                  <h2 className="text-lg font-semibold tracking-tight">Risk breakdown</h2>
                </div>
                {risk.factors.length === 0 ? (
                  <p className="text-white/50 text-sm">No risk signals fired for this case.</p>
                ) : (
                  <ul className="space-y-3">
                    {risk.factors.map((b, i) => (
                      <li key={i} className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-b-0">
                        <div>
                          <div className="text-sm">{b.label}</div>
                          <div className="text-[11px] font-mono text-white/40 mt-0.5">{b.meta}</div>
                        </div>
                        <div className="text-sm font-mono text-white/90 whitespace-nowrap">+{b.points}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Total</span>
                  <span className={`text-2xl font-semibold ${meta.text}`}>{risk.total}/100</span>
                </div>
              </section>
            )}

            {tab === "copilot" && <CopilotPanel caseId={c.case_id} />}

            {tab === "timeline" && (
              <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-white/60" />
                  <h2 className="text-lg font-semibold tracking-tight">Case timeline</h2>
                </div>
                <CaseTimeline transactions={txs} />
              </section>
            )}

            {tab === "recs" && (
              <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-6" data-testid="recommendations">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardCheck className="w-4 h-4 text-white/60" />
                  <h2 className="text-lg font-semibold tracking-tight">Account recommendations</h2>
                </div>
                <div className="border border-white/10 rounded-xl divide-y divide-white/5">
                  {recs.map((r) => {
                    const rm = RISK_META[r.verdict] || RISK_META.safe;
                    return (
                      <div key={r.account_id} className="flex items-start gap-4 px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <span className={`w-2 h-2 rounded-full ${rm.dot}`} />
                          <span className="text-sm font-mono">{r.label}</span>
                        </div>
                        <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full border h-fit ${rm.chip}`}>
                          {r.verdict}
                        </span>
                        <p className="flex-1 text-xs text-white/60">{r.reason}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-amber-300/70">
                  Final decision is made by the investigator — these are recommendations only.
                </p>
              </section>
            )}

            {tab === "sharing" && (
              <SharingPanel
                caseId={c.case_id}
                currentStatus={c.status}
                onStatusChange={(s) => setState((prev) => ({ ...prev, case: { ...prev.case, status: s } }))}
              />
            )}

            {tab === "audit" && <AuditPanel caseId={c.case_id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
