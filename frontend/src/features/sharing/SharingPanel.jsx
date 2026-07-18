// Sharing + status panel for a case.
// Owner can invite analysts/viewers and change status.
import { useEffect, useState } from "react";
import { UserPlus, Trash2, Users, Shield, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const STATUS_META = {
  open:   { label: "Open",   chip: "bg-white/10 border-white/20 text-white/80" },
  frozen: { label: "Frozen", chip: "bg-red-500/10 border-red-500/30 text-red-300" },
  closed: { label: "Closed", chip: "bg-neutral-500/10 border-neutral-500/30 text-neutral-300" },
};

export const SharingPanel = ({ caseId, currentStatus, onStatusChange }) => {
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [status, setStatus] = useState(currentStatus || "open");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const load = async () => {
    try { setShares(await api.listShares(caseId)); }
    catch (e) { /* viewers may hit 200 with [] */ }
  };

  useEffect(() => { load(); }, [caseId]);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("invite"); setErr(null);
    try {
      await api.addShare(caseId, email.trim(), role);
      setEmail("");
      await load();
    } catch (e2) { setErr(e2.message.replace(/^\d+ [A-Za-z ]+: /, "")); }
    finally { setBusy(null); }
  };

  const remove = async (shareId) => {
    if (!window.confirm("Revoke access for this analyst?")) return;
    setBusy(shareId);
    try { await api.removeShare(caseId, shareId); await load(); }
    finally { setBusy(null); }
  };

  const setCaseStatus = async (next) => {
    setBusy("status");
    try {
      await api.changeStatus(caseId, next);
      setStatus(next);
      onStatusChange?.(next);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  return (
    <section className="space-y-6" data-testid="sharing-panel">
      {/* Status control */}
      <div className="border border-white/10 rounded-2xl bg-white/[0.015] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-white/60" />
          <h2 className="text-lg font-semibold tracking-tight">Case status</h2>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-white/40">
            Auditable action
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_META).map(([k, m]) => (
            <button
              key={k}
              data-testid={`status-${k}`}
              disabled={busy === "status" || status === k}
              onClick={() => setCaseStatus(k)}
              className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                status === k ? m.chip : "border-white/15 text-white/60 hover:text-white hover:border-white/30"
              } ${status === k ? "" : "hover:bg-white/5"} disabled:cursor-not-allowed`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-white/30">
          Owners can freeze / close a case. Every change is written to the audit log.
        </p>
      </div>

      {/* Sharing */}
      <div className="border border-white/10 rounded-2xl bg-white/[0.015] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-white/60" />
          <h2 className="text-lg font-semibold tracking-tight">Shared with</h2>
        </div>

        <form onSubmit={invite} className="flex flex-wrap gap-2 items-center mb-4">
          <input
            data-testid="share-email-input"
            type="email"
            placeholder="analyst@agency.gov"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[220px] bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-white/30"
          />
          <select
            data-testid="share-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-white/30 text-white"
          >
            <option value="analyst">Analyst · can edit</option>
            <option value="viewer">Viewer · read-only</option>
          </select>
          <button
            data-testid="share-invite-button"
            type="submit"
            disabled={busy === "invite"}
            className="rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {busy === "invite" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Invite
          </button>
        </form>
        {err && <p className="text-xs text-red-300 mb-3 font-mono">{err}</p>}

        <div className="border border-white/10 rounded-xl divide-y divide-white/5">
          {shares.length === 0 && (
            <div className="p-4 text-white/40 text-sm">
              Not shared with anyone yet. Owner-only access.
            </div>
          )}
          {shares.map((s) => (
            <div key={s.share_id} className="flex items-center gap-4 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-mono">
                {(s.name || s.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{s.name || s.email}</div>
                <div className="text-[11px] font-mono text-white/40 truncate">{s.email}</div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full border border-white/15 text-white/70">
                {s.role}
              </span>
              <button
                data-testid={`revoke-${s.share_id}`}
                onClick={() => remove(s.share_id)}
                disabled={busy === s.share_id}
                className="text-white/40 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Revoke"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-white/30">
          Invitees must have signed into TraceRoot at least once before you can share with them.
        </p>
      </div>
    </section>
  );
};
