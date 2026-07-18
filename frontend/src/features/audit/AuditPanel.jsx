// Audit log view — chronological list of every action taken on a case.
import { useEffect, useState } from "react";
import { ClipboardList, User, Loader2, RefreshCw, FileText, FileJson } from "lucide-react";
import { api } from "@/lib/api";

const ACTION_LABEL = {
  case_created:       { label: "Case created",           color: "text-white/80" },
  csv_uploaded:       { label: "Transactions ingested",  color: "text-white/80" },
  copilot_generated:  { label: "AI copilot ran",         color: "text-blue-300" },
  report_downloaded:  { label: "PDF report downloaded",  color: "text-emerald-300" },
  status_changed:     { label: "Status changed",         color: "text-amber-300" },
  case_shared:        { label: "Case shared",            color: "text-white/80" },
  case_unshared:      { label: "Access revoked",         color: "text-white/60" },
  case_deleted:       { label: "Case deleted",           color: "text-red-300" },
  audit_exported:     { label: "Audit exported",         color: "text-blue-300" },
};

const fmtWhen = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

const summarizeMeta = (action, meta) => {
  if (!meta || !Object.keys(meta).length) return "";
  if (action === "copilot_generated") {
    return `${meta.kind} · ${meta.language}${meta.stream ? " · streamed" : ""}`;
  }
  if (action === "csv_uploaded") {
    return `${meta.accepted ?? 0} accepted${meta.rejected ? ` · ${meta.rejected} rejected` : ""}${meta.filename ? ` · ${meta.filename}` : ""}`;
  }
  if (action === "status_changed") return `${meta.from} → ${meta.to}`;
  if (action === "case_shared") return `${meta.email} · ${meta.role}`;
  if (action === "case_unshared") return meta.email || "";
  if (action === "report_downloaded") return `${(meta.bytes / 1024).toFixed(1)} KB`;
  if (action === "case_created") return meta.subject || "";
  if (action === "audit_exported") return `${meta.format}${meta.algorithm ? ` · ${meta.algorithm}` : ""}`;
  return "";
};

export const AuditPanel = ({ caseId }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setEntries(await api.getAudit(caseId)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [caseId]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="border border-white/10 rounded-2xl bg-white/[0.015] p-6" data-testid="audit-panel">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ClipboardList className="w-4 h-4 text-white/60" />
        <h2 className="text-lg font-semibold tracking-tight">Audit log</h2>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-white/40">
          {entries.length} event{entries.length === 1 ? "" : "s"} · court-usable
        </span>
        <a
          data-testid="export-audit-csv"
          href={api.auditExportUrl(caseId, "csv")}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3 py-1.5 transition-colors"
          title="Flat CSV — internal review"
        >
          <FileText className="w-3.5 h-3.5" /> CSV
        </a>
        <a
          data-testid="export-audit-signed"
          href={api.auditExportUrl(caseId, "json")}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3 py-1.5 transition-colors"
          title="Tamper-evident, HMAC-SHA256 signed"
        >
          <FileJson className="w-3.5 h-3.5" /> Signed JSON
        </a>
        <button
          data-testid="audit-refresh"
          onClick={load}
          disabled={loading}
          className="text-white/50 hover:text-white transition-colors"
          title="Refresh"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {entries.length === 0 && !loading && (
        <div className="text-white/40 text-sm py-4">No audit entries yet.</div>
      )}

      <ol className="relative border-l border-white/10 ml-2 space-y-4 pl-6">
        {entries.map((e) => {
          const meta = ACTION_LABEL[e.action] || { label: e.action, color: "text-white/70" };
          return (
            <li key={e.entry_id} className="relative">
              <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-white/70 ring-4 ring-white/10" />
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className={`text-sm ${meta.color}`}>{meta.label}</span>
                <span className="text-[11px] font-mono text-white/40 ml-auto whitespace-nowrap">
                  {fmtWhen(e.created_at)}
                </span>
              </div>
              <div className="text-[11px] font-mono text-white/50 mt-0.5 flex items-center gap-1.5">
                <User className="w-3 h-3" />
                {e.actor_name || e.actor_email}
                {summarizeMeta(e.action, e.meta) && (
                  <>
                    <span className="text-white/25">·</span>
                    <span className="text-white/60">{summarizeMeta(e.action, e.meta)}</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
