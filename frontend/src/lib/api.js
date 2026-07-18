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
  reportUrl: (id) => `${API}/cases/${id}/report`,
};

export { API, BACKEND_URL };
