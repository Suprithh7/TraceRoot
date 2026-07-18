// Hardcoded mock fraud cases for TraceRoot demo

// Deterministic pseudo-random so charts are stable across renders.
const seeded = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

// Build a 24-hour velocity series ending at reportedAt.
// Freeze cases get a sharp spike near the end; monitor gets a bump; safe stays flat.
const buildVelocity = (risk, seedNum) => {
  const rand = seeded(seedNum);
  const base = risk === "safe" ? 4 : risk === "monitor" ? 6 : 5;
  const points = [];
  for (let i = 0; i < 24; i++) {
    let v = base + rand() * 3;
    if (risk === "freeze") {
      // Sharp spike in last 4 hours
      if (i >= 20) v = 18 + (i - 19) * 12 + rand() * 6;
      else if (i >= 18) v = 8 + rand() * 4;
    } else if (risk === "monitor") {
      if (i >= 21) v = 12 + rand() * 6;
    }
    points.push({ hour: i - 23, tx: Math.round(v * 10) / 10 });
  }
  return points;
};

const rawCases = [
  {
    id: "TR-2410-8891",
    subject: "Anonymous complainant #4471",
    amount: 47320,
    currency: "USD",
    reportedAt: "2026-02-11T09:14:00Z",
    channel: "Wire + P2P",
    country: "US → PH",
    risk: "freeze",
    riskScore: 92,
    breakdown: [
      { label: "Flash Drain (<4m)", points: 25, meta: "97% of balance moved in 3m 42s" },
      { label: "Structuring", points: 22, meta: "6 tx just under $10k CTR threshold" },
      { label: "Known Mule Endpoint", points: 20, meta: "Wallet flagged in 3 prior SARs" },
      { label: "Velocity Spike", points: 15, meta: "40x baseline in 24h" },
      { label: "Device Reuse", points: 10, meta: "Same fingerprint across 4 accounts" },
    ],
    aiSummary:
      "Account TR-2410-8891 exhibits a high-confidence layering pattern consistent with a coordinated mule network. Funds drained to sub-$10k tranches within a 4-minute window, then aggregated to a wallet previously named in FinCEN advisory 2025-A011. Device fingerprint overlap with three dormant accounts activated 48h prior. Recommend immediate 314(b) freeze and SAR filing within 30 days.",
    chain: [
      { label: "Victim", id: "acct •• 4471", amount: "$48,900", tag: "origin" },
      { label: "Mule 1", id: "acct •• 9033", amount: "$9,850 x3", tag: "layer" },
      { label: "Mule 2", id: "acct •• 2210", amount: "$9,600 x3", tag: "layer" },
      { label: "Cash Out", id: "wallet 0x7a…f2", amount: "$47,320", tag: "exit" },
    ],
  },
  {
    id: "TR-2410-8890",
    subject: "SMB — Northgate Logistics",
    amount: 18400,
    currency: "USD",
    reportedAt: "2026-02-10T22:02:00Z",
    channel: "ACH",
    country: "US → US",
    risk: "monitor",
    riskScore: 58,
    breakdown: [
      { label: "Off-hours Transfer", points: 15, meta: "3 tx between 02:00–04:00 local" },
      { label: "New Beneficiary", points: 15, meta: "Payee added <24h before wire" },
      { label: "Round-Dollar Pattern", points: 12, meta: "All amounts end in .00" },
      { label: "IP Geolocation Shift", points: 16, meta: "US → VPN exit in RO" },
    ],
    aiSummary:
      "Account shows moderate anomaly cluster: newly added beneficiary receiving round-dollar ACH transfers during off-hours, combined with a VPN-masked login from an unusual region. No known mule linkage. Behavior is consistent with either legitimate B2B onboarding or early-stage BEC compromise. Recommend enhanced monitoring for 14 days and step-up authentication on next transaction.",
    chain: [
      { label: "Victim", id: "acct •• 1102", amount: "$18,400", tag: "origin" },
      { label: "Mule 1", id: "acct •• 5578", amount: "$18,400", tag: "layer" },
      { label: "Cash Out", id: "acct •• 8801", amount: "$18,400", tag: "exit" },
    ],
  },
  {
    id: "TR-2410-8889",
    subject: "Retail — Card-not-present",
    amount: 2140,
    currency: "USD",
    reportedAt: "2026-02-10T14:47:00Z",
    channel: "Card",
    country: "US → US",
    risk: "safe",
    riskScore: 12,
    breakdown: [
      { label: "First-time Merchant", points: 6, meta: "New MCC for this cardholder" },
      { label: "Slightly Above Average Ticket", points: 6, meta: "2.1x rolling avg" },
    ],
    aiSummary:
      "Transaction pattern falls within normal deviation for this cardholder's segment. Merchant is verified, IP and device match historical profile, and no chain-of-funds risk was detected. No action required.",
    chain: [
      { label: "Cardholder", id: "card •• 0912", amount: "$2,140", tag: "origin" },
      { label: "Merchant", id: "MID 44201", amount: "$2,140", tag: "exit" },
    ],
  },
  {
    id: "TR-2410-8888",
    subject: "Elderly complainant #2033",
    amount: 112500,
    currency: "USD",
    reportedAt: "2026-02-09T18:20:00Z",
    channel: "Wire",
    country: "US → HK",
    risk: "freeze",
    riskScore: 88,
    breakdown: [
      { label: "Cross-border Escalation", points: 20, meta: "First int'l wire in 11yr history" },
      { label: "Elder Fraud Indicators", points: 22, meta: "Victim age 78, sudden liquidation" },
      { label: "Beneficiary Reuse", points: 18, meta: "Recipient tied to 2 confirmed scams" },
      { label: "Coached Behavior", points: 15, meta: "Call center notes: scripted answers" },
      { label: "Urgency Language", points: 13, meta: '"Must send today" flagged 4x' },
    ],
    aiSummary:
      "Strong indicators of pig-butchering / romance-investment fraud targeting elderly account holder. Victim liquidated retirement funds and initiated first-ever international wire to a Hong Kong beneficiary previously named in two closed cases. Branch call notes show coached, scripted responses. Recommend immediate freeze under Reg E elder-fraud provisions and coordinate with FBI IC3.",
    chain: [
      { label: "Victim", id: "acct •• 2033", amount: "$112,500", tag: "origin" },
      { label: "Mule 1", id: "acct •• 7761 (HK)", amount: "$112,500", tag: "layer" },
      { label: "Mule 2", id: "acct •• 3390 (SG)", amount: "$110,200", tag: "layer" },
      { label: "Cash Out", id: "OTC desk 0x1b…9c", amount: "USDT 108,900", tag: "exit" },
    ],
  },
  {
    id: "TR-2410-8887",
    subject: "Payroll — GreenLeaf Co.",
    amount: 6800,
    currency: "USD",
    reportedAt: "2026-02-09T11:05:00Z",
    channel: "ACH batch",
    country: "US → US",
    risk: "monitor",
    riskScore: 44,
    breakdown: [
      { label: "Payroll Anomaly", points: 14, meta: "One employee amount 3x normal" },
      { label: "Recent Direct-Deposit Change", points: 16, meta: "Bank changed 48h ago" },
      { label: "Duplicate SSN Match", points: 14, meta: "Weak match on secondary record" },
    ],
    aiSummary:
      "Payroll batch contains a single line item consistent with a direct-deposit hijack pattern. Employee record shows a recent bank change and a weak duplicate-SSN signal against a known synthetic identity list. Recommend holding this single line for HR verification while releasing the rest of the batch.",
    chain: [
      { label: "Employer", id: "GreenLeaf Payroll", amount: "$6,800", tag: "origin" },
      { label: "Mule 1", id: "acct •• 4408 (new)", amount: "$6,800", tag: "exit" },
    ],
  },
];

export const CASES = rawCases.map((c, i) => ({
  ...c,
  velocity: buildVelocity(c.risk, 1000 + i * 137),
}));

export const RISK_META = {
  freeze: {
    label: "Freeze Immediately",
    dot: "bg-red-400",
    ring: "ring-red-400/30",
    text: "text-red-300",
    chip: "bg-red-500/10 border-red-500/30 text-red-300",
  },
  monitor: {
    label: "Monitor",
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    text: "text-amber-300",
    chip: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  },
  safe: {
    label: "Safe",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    text: "text-emerald-300",
    chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  },
};
