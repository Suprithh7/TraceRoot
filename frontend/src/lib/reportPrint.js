// Build a self-contained, print-ready HTML document for a case report.
// Opened in a new window and triggered via window.print() → user gets
// browser's native "Save as PDF" dialog.

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtMoney = (n, cur = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(n);

export const buildReportHtml = (c, meta) => {
  const totalPoints = c.breakdown.reduce((s, b) => s + b.points, 0);
  const now = new Date().toLocaleString();

  const chainHtml = c.chain
    .map(
      (n, i) => `
      <div class="chain-node ${n.tag}">
        <div class="chain-tag">${
          n.tag === "origin" ? "Source" : n.tag === "exit" ? "Cash Out" : `Layer ${i}`
        }</div>
        <div class="chain-label">${escapeHtml(n.label)}</div>
        <div class="chain-id">${escapeHtml(n.id)}</div>
        <div class="chain-amt">${escapeHtml(n.amount)}</div>
      </div>
      ${i < c.chain.length - 1 ? '<div class="chain-arrow">&#8594;</div>' : ""}`
    )
    .join("");

  const breakdownRows = c.breakdown
    .map(
      (b) => `
      <tr>
        <td>${escapeHtml(b.label)}<div class="meta">${escapeHtml(b.meta)}</div></td>
        <td class="pts">+${b.points}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>TraceRoot Report ${escapeHtml(c.id)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #111; margin: 0; padding: 24px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .brand { display:flex; align-items:center; gap:10px; font-family: ui-monospace, Menlo, monospace;
           letter-spacing: 0.28em; font-size: 11px; text-transform: uppercase; color:#555; }
  .brand .dot { width:8px; height:8px; background:#111; border-radius:50%; }
  h1 { font-size: 26px; margin: 18px 0 6px; letter-spacing: -0.01em; }
  .sub { color:#666; font-size: 13px; margin-bottom: 22px; }
  .risk-pill { display:inline-block; padding:4px 10px; border-radius:999px; font-size:10px;
               font-family: ui-monospace, monospace; text-transform: uppercase; letter-spacing: 0.14em;
               border:1px solid; }
  .risk-freeze  { background:#fee2e2; border-color:#fca5a5; color:#991b1b; }
  .risk-monitor { background:#fef3c7; border-color:#fcd34d; color:#92400e; }
  .risk-safe    { background:#d1fae5; border-color:#6ee7b7; color:#065f46; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px 24px; margin: 18px 0 22px; }
  .field { border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .field .k { font-size:10px; text-transform:uppercase; letter-spacing:0.18em; color:#888; font-family: ui-monospace, monospace; }
  .field .v { font-size:14px; margin-top:2px; }
  section { margin-top: 24px; page-break-inside: avoid; }
  section h2 { font-size:12px; text-transform:uppercase; letter-spacing:0.24em; color:#555;
               font-family: ui-monospace, monospace; margin: 0 0 10px; }
  .summary { line-height: 1.65; font-size: 13.5px; color:#222; }
  table { width:100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; }
  th { background:#fafafa; font-size:10px; text-transform:uppercase; letter-spacing:0.14em; color:#666; font-family: ui-monospace, monospace; }
  td.pts { text-align:right; font-family: ui-monospace, monospace; width: 80px; }
  td .meta { font-size: 11px; color:#888; margin-top:2px; font-family: ui-monospace, monospace; }
  .total-row td { border-top: 2px solid #111; font-weight:600; }
  .chain { display:flex; align-items:stretch; gap:8px; flex-wrap: wrap; }
  .chain-node { flex:1; min-width: 140px; border:1px solid #ddd; border-radius: 10px; padding: 10px 12px; background:#fafafa; }
  .chain-node.origin { border-color:#111; background:#fff; }
  .chain-node.exit { border-color:#fca5a5; background:#fef2f2; }
  .chain-node.layer { border-color:#fcd34d; background:#fffbeb; }
  .chain-tag { font-size:10px; text-transform:uppercase; letter-spacing:0.16em; color:#888; font-family: ui-monospace, monospace; }
  .chain-label { font-weight: 600; margin-top:4px; }
  .chain-id { font-size: 11px; color:#666; font-family: ui-monospace, monospace; margin-top:2px; }
  .chain-amt { font-family: ui-monospace, monospace; margin-top:6px; font-size: 13px; }
  .chain-arrow { align-self:center; font-size: 18px; color:#999; padding: 0 2px; }
  .score { display:inline-flex; align-items:baseline; gap:6px; }
  .score .n { font-size: 40px; font-weight: 700; letter-spacing:-0.02em; }
  .score .d { color:#999; font-size:16px; }
  footer { margin-top: 30px; font-size: 10px; color:#999; text-align:center;
           font-family: ui-monospace, monospace; text-transform: uppercase; letter-spacing: 0.16em; }
  .print-hint { position:fixed; top:8px; right:12px; background:#111; color:#fff;
                padding: 8px 14px; border-radius: 999px; font-family: ui-monospace, monospace;
                font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
  @media print { .print-hint { display:none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="print-hint">Use “Save as PDF” in the print dialog</div>

  <div class="brand"><span class="dot"></span> TraceRoot · Investigation Report</div>
  <h1>${escapeHtml(c.subject)}</h1>
  <div class="sub">
    Case <b>${escapeHtml(c.id)}</b> ·
    <span class="risk-pill risk-${c.risk}">${escapeHtml(meta.label)}</span> ·
    <span class="score"><span class="n">${c.riskScore}</span><span class="d">/100</span></span>
  </div>

  <div class="grid">
    <div class="field"><div class="k">Reported</div><div class="v">${escapeHtml(new Date(c.reportedAt).toLocaleString())}</div></div>
    <div class="field"><div class="k">Channel</div><div class="v">${escapeHtml(c.channel)}</div></div>
    <div class="field"><div class="k">Route</div><div class="v">${escapeHtml(c.country)}</div></div>
    <div class="field"><div class="k">Exposure</div><div class="v">${escapeHtml(fmtMoney(c.amount, c.currency))}</div></div>
    <div class="field"><div class="k">Recommendation</div><div class="v">${escapeHtml(meta.label)}</div></div>
    <div class="field"><div class="k">Generated</div><div class="v">${escapeHtml(now)}</div></div>
  </div>

  <section>
    <h2>Executive Summary</h2>
    <div class="summary">${escapeHtml(c.aiSummary)}</div>
  </section>

  <section>
    <h2>Fund flow chain</h2>
    <div class="chain">${chainHtml}</div>
  </section>

  <section>
    <h2>Risk breakdown (${totalPoints}/100)</h2>
    <table>
      <thead><tr><th>Signal</th><th style="text-align:right">Points</th></tr></thead>
      <tbody>
        ${breakdownRows}
        <tr class="total-row"><td>Total</td><td class="pts">${totalPoints}/100</td></tr>
      </tbody>
    </table>
  </section>

  <footer>TraceRoot v0.4.1 · Demo · All data simulated · Confidential — Investigator use only</footer>
</body>
</html>`;
};
