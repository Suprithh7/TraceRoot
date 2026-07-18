// Dashboard: sidebar + case queue + upload/create panel + seed button.
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LogOut, Upload, Sparkles, Trash2, Plus, FolderOpen, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const RISK_META = {
  freeze:  { label: "Freeze Immediately", chip: "bg-red-500/10 border-red-500/30 text-red-300", dot: "bg-red-400" },
  monitor: { label: "Monitor",             chip: "bg-amber-500/10 border-amber-500/30 text-amber-300", dot: "bg-amber-400" },
  safe:    { label: "Safe",                chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400" },
};

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // "seed" | "upload"
  const [newSubject, setNewSubject] = useState("");
  const [uploadCaseId, setUploadCaseId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCases(await api.listCases()); }
    catch { setCases([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setBusy("seed");
    try {
      const r = await api.seed();
      setNotice(r.count ? `Seeded ${r.count} demo cases` : "Demo cases already loaded");
      await load();
    } catch (e) {
      setNotice(`Seed failed: ${e.message}`);
    } finally { setBusy(null); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    setBusy("create");
    try {
      const c = await api.createCase({ subject: newSubject.trim(), channel: "Wire", country: "US → US" });
      setNewSubject("");
      setUploadCaseId(c.case_id);
      await load();
    } finally { setBusy(null); }
  };

  const handleUpload = async (caseId, file) => {
    if (!file) return;
    setBusy("upload");
    try {
      const r = await api.uploadCsv(caseId, file);
      setNotice(`Uploaded ${r.accepted} transactions${r.rejected ? `, ${r.rejected} rejected` : ""}`);
      setUploadCaseId(null);
      // Small delay lets the background task finish scoring
      setTimeout(load, 1200);
    } catch (e) {
      setNotice(`Upload failed: ${e.message}`);
    } finally { setBusy(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this case and all its transactions?")) return;
    await api.deleteCase(id);
    await load();
  };

  const stats = {
    total: cases.length,
    freeze: cases.filter((c) => c.risk === "freeze").length,
    monitor: cases.filter((c) => c.risk === "monitor").length,
    exposure: cases.filter((c) => c.risk === "freeze").reduce((s, c) => s + (c.amount || 0), 0),
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col shrink-0 hidden md:flex">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="relative w-5 h-5">
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white top-0 left-1/2 -translate-x-1/2 opacity-90" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white left-0 top-1/2 -translate-y-1/2 opacity-70" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white right-0 top-1/2 -translate-y-1/2 opacity-70" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-white bottom-0 left-1/2 -translate-x-1/2 opacity-40" />
            </div>
            <span className="text-sm tracking-[0.28em] font-mono uppercase">TraceRoot</span>
          </div>
        </div>
        <nav className="p-4 space-y-1 text-sm flex-1">
          <SideItem active icon={<FolderOpen className="w-4 h-4" />} label="Cases" />
          <SideItem icon={<Upload className="w-4 h-4" />} label="Ingest" />
          <SideItem icon={<Sparkles className="w-4 h-4" />} label="Copilot" />
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 py-2">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-mono">
                {(user.name || user.email || "IN").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{user.name}</div>
                <div className="text-[10px] font-mono text-white/40 truncate">{user.email}</div>
              </div>
            </div>
          )}
          <button
            data-testid="signout-button"
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-2 text-xs font-mono text-white/50 hover:text-white transition-colors py-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/40 mb-2">
                Case queue
              </p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
                Good hunting{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                data-testid="seed-button"
                onClick={handleSeed}
                disabled={busy === "seed"}
                className="rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {busy === "seed" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Seed demo cases
              </button>
            </div>
          </div>

          {notice && (
            <div className="mb-6 text-xs font-mono text-white/60 border border-white/10 rounded-xl px-4 py-2 bg-white/[0.02]">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard label="Open cases" value={stats.total} />
            <StatCard label="Freeze" value={stats.freeze} tone="red" />
            <StatCard label="Monitor" value={stats.monitor} tone="amber" />
            <StatCard label="Frozen exposure" value={fmtMoney(stats.exposure)} small />
          </div>

          {/* Create + upload panel */}
          <div className="border border-white/10 rounded-2xl bg-white/[0.015] p-5 mb-6" data-testid="ingestion-panel">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-white/60" />
              <h2 className="text-sm font-medium">New case + CSV ingestion</h2>
            </div>
            <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-center">
              <input
                data-testid="new-case-subject"
                type="text"
                placeholder="Case subject (e.g. 'SMB — Northgate Logistics')"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="flex-1 min-w-[240px] bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-white/30"
              />
              <button
                data-testid="create-case-button"
                type="submit"
                disabled={busy === "create"}
                className="rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Create case
              </button>
            </form>
            {uploadCaseId && (
              <div className="mt-3 text-xs font-mono text-white/60">
                Case created: <span className="text-white">{uploadCaseId}</span> — upload a CSV to score it.
                <label className="ml-3 inline-flex items-center gap-2 text-white cursor-pointer underline hover:no-underline">
                  <input
                    data-testid="upload-csv-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleUpload(uploadCaseId, e.target.files?.[0])}
                  />
                  <Upload className="w-3 h-3" /> Upload CSV
                </label>
              </div>
            )}
            <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-white/30">
              CSV columns · date, sender, receiver, amount [, currency, description]
            </p>
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
              {loading && (
                <div className="p-8 text-center text-white/40 text-sm font-mono">Loading cases…</div>
              )}
              {!loading && cases.length === 0 && (
                <div className="p-10 text-center">
                  <p className="text-white/60 text-sm">No cases yet.</p>
                  <p className="text-white/40 text-xs mt-1">
                    Click <b>Seed demo cases</b> above, or create a new case and upload a CSV.
                  </p>
                </div>
              )}
              {cases.map((c, i) => {
                const meta = RISK_META[c.risk] || RISK_META.safe;
                return (
                  <motion.div
                    key={c.case_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-12 gap-4 px-6 py-5 items-center border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors group"
                  >
                    <button
                      data-testid={`case-row-${c.case_id}`}
                      onClick={() => navigate(`/cases/${c.case_id}`)}
                      className="col-span-12 md:col-span-3 flex items-center gap-3 text-left"
                    >
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <div>
                        <div className="text-sm font-mono">{c.case_id.replace("case_", "")}</div>
                        <div className="text-[11px] font-mono text-white/30 md:hidden mt-0.5">
                          {c.subject}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => navigate(`/cases/${c.case_id}`)}
                      className="hidden md:block col-span-3 text-left text-sm text-white/80"
                    >
                      {c.subject}
                      <div className="text-[11px] text-white/40 mt-0.5">{fmtWhen(c.reported_at)}</div>
                    </button>
                    <div className="hidden md:block col-span-2 text-sm text-white/60 font-mono">
                      {c.channel}
                      <div className="text-[11px] text-white/30 mt-0.5">{c.country}</div>
                    </div>
                    <div className="col-span-4 md:col-span-1 text-right text-sm font-mono">
                      {fmtMoney(c.amount)}
                    </div>
                    <div className="hidden md:block col-span-1 text-right text-sm font-mono">
                      {c.risk_score}
                    </div>
                    <div className="col-span-4 md:col-span-2 flex md:justify-end items-center gap-2">
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${meta.chip}`}>
                        {meta.label}
                      </span>
                      <button
                        data-testid={`delete-case-${c.case_id}`}
                        onClick={() => handleDelete(c.case_id)}
                        className="text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ label, value, tone = "neutral", small = false }) => {
  const c = { red: "text-red-300", amber: "text-amber-300", neutral: "text-white" }[tone];
  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.015] px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">{label}</div>
      <div className={`${small ? "text-xl" : "text-3xl"} font-semibold tracking-tight ${c}`}>{value}</div>
    </div>
  );
};

const SideItem = ({ active, icon, label }) => (
  <button className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
    {icon}<span>{label}</span>
  </button>
);
