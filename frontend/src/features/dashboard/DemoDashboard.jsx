// Static-data demo dashboard reached via the mocked OTP flow.
// This preserves the original demo experience for users who don't want
// to authenticate — it uses the same UI as the real dashboard but reads
// from the local mock data.
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, ArrowLeft } from "lucide-react";
import { CASES, RISK_META } from "@/data/mockCases";

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export const DemoDashboard = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || "demo@traceroot.ai";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <button onClick={() => navigate("/")} className="text-sm text-white/70 hover:text-white flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono uppercase tracking-widest text-xs">Sign out</span>
          </button>
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300/80 border border-amber-500/30 bg-amber-500/10 rounded-full px-3 py-1">
            Demo mode · no real session
          </span>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
        <h1 className="text-4xl font-semibold tracking-tight mb-2">Demo case queue</h1>
        <p className="text-white/50 text-sm mb-8">Signed in as <span className="text-white/80">{email}</span> · static demo data</p>
        <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.015]">
          {CASES.map((c) => {
            const meta = RISK_META[c.risk];
            return (
              <div key={c.id} className="grid grid-cols-12 gap-4 px-6 py-5 items-center border-b border-white/5 last:border-b-0">
                <div className="col-span-3 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="text-sm font-mono">{c.id}</span>
                </div>
                <div className="col-span-4 text-sm text-white/80">{c.subject}</div>
                <div className="col-span-2 text-sm text-white/60 font-mono">{c.channel}</div>
                <div className="col-span-1 text-right text-sm font-mono">{fmtMoney(c.amount)}</div>
                <div className="col-span-2 flex justify-end">
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${meta.chip}`}>
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-xs font-mono text-white/40">
          For the full experience with real ingestion, LLM copilot, and Cytoscape graph, sign in with Google.
        </p>
      </main>
    </div>
  );
};
