// Horizontal timeline built from a case's transactions.
import { motion } from "framer-motion";

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const labelFor = (tx, i, total) => {
  if (i === 0) return "Fraud begins";
  if (i === total - 1) return "Cash out";
  const desc = (tx.description || "").toLowerCase();
  if (desc.includes("crypto") || desc.includes("otc")) return "Crypto off-ramp";
  if (desc.includes("swift") || desc.includes("int'l")) return "Cross-border wire";
  if (desc.includes("p2p")) return "Mule transfer";
  return "Layered transfer";
};

export const CaseTimeline = ({ transactions }) => {
  if (!transactions.length) {
    return (
      <div className="text-white/40 text-sm py-6">No transactions to plot.</div>
    );
  }
  return (
    <div className="relative pl-6" data-testid="case-timeline">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
      <ul className="space-y-4">
        {transactions.map((tx, i) => (
          <motion.li
            key={tx.tx_id || i}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative"
          >
            <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-white/80 ring-4 ring-white/10" />
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono text-white/40 whitespace-nowrap">{fmt(tx.date)}</span>
              <span className="text-sm text-white/90">{labelFor(tx, i, transactions.length)}</span>
              <span className="text-xs font-mono text-white/50 ml-auto">
                ${Number(tx.amount).toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] font-mono text-white/40 mt-0.5">
              {tx.sender} → {tx.receiver}
              {tx.description ? ` · ${tx.description}` : ""}
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};
