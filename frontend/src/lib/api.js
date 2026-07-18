// Central API client. All endpoints are prefixed with /api and use
// REACT_APP_BACKEND_URL from the environment.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText}: ${text}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

export const api = {
  // Auth
  me: () => req("/auth/me"),
  exchangeSession: (session_id) =>
    req("/auth/session", { method: "POST", body: JSON.stringify({ session_id }) }),
  logout: () => req("/auth/logout", { method: "POST" }),

  // Cases
  listCases: () => req("/cases"),
  getCase: (id) => req(`/cases/${id}`),
  createCase: (payload) =>
    req("/cases", { method: "POST", body: JSON.stringify(payload) }),
  deleteCase: (id) => req(`/cases/${id}`, { method: "DELETE" }),
  uploadCsv: (id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${API}/cases/${id}/upload`, {
      method: "POST", body: fd, credentials: "include",
    }).then((r) => {
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      return r.json();
    });
  },
  seed: () => req("/seed", { method: "POST" }),

  // Case detail
  getRisk: (id) => req(`/cases/${id}/risk-scores`),
  getGraph: (id) => req(`/cases/${id}/graph`),
  getTransactions: (id) => req(`/cases/${id}/transactions`),
  getRecommendations: (id) => req(`/cases/${id}/recommendations`),
  copilot: (id, kind, language = "en") =>
    req(`/cases/${id}/copilot`, {
      method: "POST", body: JSON.stringify({ kind, language }),
    }),
  copilotStream: (id, kind, language, onDelta, onDone, onError) => {
    const ctrl = new AbortController();
    fetch(`${API}/cases/${id}/copilot/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, language }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // Parse SSE frames separated by blank lines
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let event = "message";
            let data = "";
            frame.split("\n").forEach((line) => {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data += line.slice(5).trim();
            });
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (event === "done") { onDone?.(parsed.text || ""); }
              else if (event === "error") { onError?.(parsed.error || "stream error"); }
              else if (parsed.delta) { onDelta?.(parsed.delta); }
            } catch { /* ignore malformed */ }
          }
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") onError?.(e.message);
      });
    return () => ctrl.abort();
  },
  reportUrl: (id) => `${API}/cases/${id}/report`,
  auditExportUrl: (id, format) => `${API}/cases/${id}/audit/export?format=${format}`,

  // Sharing + audit
  listShares: (id) => req(`/cases/${id}/shares`),
  addShare: (id, email, role) =>
    req(`/cases/${id}/shares`, { method: "POST", body: JSON.stringify({ email, role }) }),
  removeShare: (id, shareId) =>
    req(`/cases/${id}/shares/${shareId}`, { method: "DELETE" }),
  changeStatus: (id, status) =>
    req(`/cases/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAudit: (id) => req(`/cases/${id}/audit`),
};

export { API, BACKEND_URL };
