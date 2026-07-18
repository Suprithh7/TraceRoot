// Money-flow graph — deliberately designed, not a default lib demo:
//  • Dagre LR hierarchical layout (Victim → Mule → Cash-out)
//  • Distinct node shapes + SVG icon badges per role
//  • Directional edges with arrowheads, width mapped to $ amount
//  • Marching-ants dash animation showing flow direction
//  • Hover highlight (dim non-connected nodes/edges)
//  • Click a node → side panel with that account's transaction history
//  • Dark investigation-tool canvas with subtle grid
import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import CytoscapeComponent from "react-cytoscapejs";
import { X, ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";

cytoscape.use(dagre);

const RISK_COLORS = {
  freeze:  { fill: "#7f1d1d", ring: "#f87171", text: "#fecaca" },
  monitor: { fill: "#78350f", ring: "#fbbf24", text: "#fde68a" },
  safe:    { fill: "#064e3b", ring: "#34d399", text: "#a7f3d0" },
};
const ROLE = {
  victim:   { shape: "round-rectangle", label: "VICTIM" },
  mule:     { shape: "round-diamond",   label: "MULE" },
  cashout:  { shape: "round-hexagon",   label: "CASH-OUT" },
  merchant: { shape: "round-tag",       label: "MERCHANT" },
  unknown:  { shape: "ellipse",         label: "ACCOUNT" },
};

// SVG icons as data URIs — coloured white so risk fill shows behind.
const ICON = {
  victim: encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='7' r='4'/><path d='M5.5 21a6.5 6.5 0 0 1 13 0'/></svg>`
  ),
  mule: encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 12h18M6 9v6M18 9v6M9 5v14M15 5v14'/></svg>`
  ),
  cashout: encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='6' width='18' height='12' rx='2'/><circle cx='12' cy='12' r='3'/><path d='M7 12h.01M17 12h.01'/></svg>`
  ),
  merchant: encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6'/></svg>`
  ),
  unknown: encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M9 10a3 3 0 1 1 4.5 2.6c-.9.4-1.5 1-1.5 2M12 17h.01'/></svg>`
  ),
};

const iconUri = (role) => `data:image/svg+xml;utf8,${ICON[role] || ICON.unknown}`;

const fmt$ = (n) => `$${Math.round(n).toLocaleString()}`;

export const CaseGraph = ({ graph, transactions = [] }) => {
  const cyRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tick, setTick] = useState(0);

  // Marching-ants animation: bump line-dash-offset on interval.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => (v + 1) % 100000), 45);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.edges().style("line-dash-offset", -tick * 2);
  }, [tick]);

  const elements = useMemo(() => {
    if (!graph?.nodes?.length) return [];
    const maxAmount = Math.max(1, ...graph.edges.map((e) => e.amount));
    const nodes = graph.nodes.map((n) => {
      const rc = RISK_COLORS[n.risk] || RISK_COLORS.safe;
      const role = ROLE[n.role] || ROLE.unknown;
      return {
        data: {
          id: n.id,
          label: n.label,
          roleLabel: role.label,
          shape: role.shape,
          fill: rc.fill,
          ring: rc.ring,
          text: rc.text,
          icon: iconUri(n.role),
          totalIn: n.total_in,
          totalOut: n.total_out,
          risk: n.risk,
          role: n.role,
        },
        classes: `risk-${n.risk} role-${n.role}`,
      };
    });
    const edges = graph.edges.map((e, i) => {
      const width = 2 + (e.amount / maxAmount) * 8; // 2px – 10px
      return {
        data: {
          id: `e${i}-${e.source}-${e.target}`,
          source: e.source, target: e.target,
          amount: e.amount, tx_count: e.tx_count,
          width,
          label: `${fmt$(e.amount)} · ${e.tx_count} tx`,
        },
      };
    });
    return [...nodes, ...edges];
  }, [graph]);

  const highlightNeighborhood = (nodeId) => {
    const cy = cyRef.current;
    if (!cy) return;
    if (!nodeId) {
      cy.elements().removeClass("faded highlighted");
      return;
    }
    const node = cy.getElementById(nodeId);
    const neighborhood = node.closedNeighborhood();
    cy.elements().addClass("faded");
    neighborhood.removeClass("faded").addClass("highlighted");
  };

  const selectedNode = graph?.nodes?.find((n) => n.id === selectedId) || null;

  const accountTxs = useMemo(() => {
    if (!selectedId) return [];
    return transactions.filter((t) => t.sender === selectedId || t.receiver === selectedId);
  }, [selectedId, transactions]);

  if (!graph?.nodes?.length) {
    return (
      <div className="h-[480px] flex items-center justify-center text-white/40 text-sm">
        No transactions yet — upload a CSV to build the graph.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 items-stretch">
      <div
        className="relative h-[480px] rounded-xl overflow-hidden border border-white/10"
        data-testid="cytoscape-graph"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(59,130,246,0.06), transparent 60%), radial-gradient(circle at 80% 80%, rgba(239,68,68,0.05), transparent 60%), linear-gradient(180deg, #05070a 0%, #020304 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute top-3 left-3 flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-white/50 z-10">
          <LegendDot color="#34d399" label="Safe" />
          <LegendDot color="#fbbf24" label="Monitor" />
          <LegendDot color="#f87171" label="Freeze" />
          <span className="text-white/25">·</span>
          <span>hover to isolate · click to inspect</span>
        </div>

        <CytoscapeComponent
          cy={(cy) => {
            cyRef.current = cy;
            cy.on("tap", "node", (evt) => {
              setSelectedId(evt.target.id());
              highlightNeighborhood(evt.target.id());
            });
            cy.on("tap", (evt) => {
              if (evt.target === cy) {
                setSelectedId(null);
                highlightNeighborhood(null);
              }
            });
            cy.on("mouseover", "node", (evt) => highlightNeighborhood(evt.target.id()));
            cy.on("mouseout", "node", () => {
              if (!selectedId) highlightNeighborhood(null);
            });
          }}
          elements={elements}
          style={{ width: "100%", height: "100%" }}
          layout={{
            name: "dagre",
            rankDir: "LR",
            nodeSep: 55,
            rankSep: 110,
            padding: 30,
            animate: true,
            animationDuration: 500,
          }}
          stylesheet={[
            {
              selector: "node",
              style: {
                "shape": "data(shape)",
                "background-color": "data(fill)",
                "background-image": "data(icon)",
                "background-fit": "contain",
                "background-clip": "none",
                "background-image-opacity": 0.85,
                "background-width": "40%",
                "background-height": "40%",
                "background-position-y": "22%",
                "border-width": 2,
                "border-color": "data(ring)",
                "border-opacity": 0.85,
                "width": 110,
                "height": 78,
                "label": "data(label)",
                "text-valign": "bottom",
                "text-halign": "center",
                "text-margin-y": 6,
                "color": "#e5e7eb",
                "text-outline-width": 3,
                "text-outline-color": "#0a0a0a",
                "font-family": "ui-monospace, Menlo, monospace",
                "font-size": 11,
              },
            },
            {
              // Role sub-label rendered as a second line-ish via letter spacing
              selector: "node.risk-freeze",
              style: { "shadow-blur": 22, "shadow-color": "#f87171", "shadow-opacity": 0.35, "shadow-offset-x": 0, "shadow-offset-y": 0 },
            },
            {
              selector: "node.risk-monitor",
              style: { "shadow-blur": 14, "shadow-color": "#fbbf24", "shadow-opacity": 0.25 },
            },
            {
              selector: "edge",
              style: {
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "target-arrow-color": "rgba(255,255,255,0.6)",
                "line-color": "rgba(255,255,255,0.5)",
                "line-style": "dashed",
                "line-dash-pattern": [6, 4],
                "width": "data(width)",
                "arrow-scale": 1.2,
                "label": "data(label)",
                "font-size": 10,
                "font-family": "ui-monospace, Menlo, monospace",
                "color": "#d1d5db",
                "text-background-color": "#0a0a0a",
                "text-background-opacity": 0.9,
                "text-background-padding": 3,
                "text-background-shape": "roundrectangle",
                "text-rotation": "autorotate",
                "text-margin-y": -6,
              },
            },
            {
              selector: "edge.highlighted, node.highlighted",
              style: { "opacity": 1 },
            },
            {
              selector: ".faded",
              style: { "opacity": 0.15 },
            },
            {
              selector: "node:selected",
              style: {
                "border-width": 4,
                "border-color": "#ffffff",
                "border-opacity": 1,
              },
            },
          ]}
        />
      </div>

      {/* Side panel */}
      <aside
        className="border border-white/10 rounded-xl bg-white/[0.02] p-4 h-[480px] overflow-y-auto"
        data-testid="account-side-panel"
      >
        {!selectedNode && (
          <div className="text-white/40 text-sm text-center pt-16 px-4">
            <p className="mb-3">Click any account in the graph to inspect its transaction history.</p>
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
              nodes: {graph.nodes.length} · edges: {graph.edges.length}
            </p>
          </div>
        )}
        {selectedNode && (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                  {ROLE[selectedNode.role]?.label || "ACCOUNT"}
                </div>
                <div className="text-lg font-mono mt-0.5">{selectedNode.label}</div>
                <div className="text-[11px] font-mono text-white/40 mt-0.5 break-all">{selectedNode.id}</div>
              </div>
              <button
                data-testid="close-side-panel"
                onClick={() => { setSelectedId(null); highlightNeighborhood(null); }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <FlowStat label="In" value={fmt$(selectedNode.total_in)} icon={<ArrowDownRight className="w-3.5 h-3.5 text-emerald-300" />} />
              <FlowStat label="Out" value={fmt$(selectedNode.total_out)} icon={<ArrowUpRight className="w-3.5 h-3.5 text-red-300" />} />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
              Transactions · {accountTxs.length}
            </div>
            <ul className="space-y-2">
              {accountTxs.map((t) => {
                const isOut = t.sender === selectedId;
                return (
                  <li key={t.tx_id} className="border border-white/5 rounded-lg px-3 py-2 bg-black/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-white/50">
                        {new Date(t.date).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`font-mono ${isOut ? "text-red-300" : "text-emerald-300"}`}>
                        {isOut ? "−" : "+"}{fmt$(t.amount)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-white/50 mt-1 flex items-center gap-1">
                      {isOut ? "to" : "from"} <span className="text-white/70">{isOut ? t.receiver : t.sender}</span>
                    </div>
                    {t.description && (
                      <div className="text-[10px] text-white/40 mt-0.5">{t.description}</div>
                    )}
                  </li>
                );
              })}
              {!accountTxs.length && (
                <li className="text-white/40 text-xs">No transactions for this account.</li>
              )}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
};

const LegendDot = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="w-2 h-2 rounded-full" style={{ background: color }} /> {label}
  </span>
);

const FlowStat = ({ label, value, icon }) => (
  <div className="border border-white/10 rounded-lg px-3 py-2 bg-black/30">
    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-white/40">
      {icon}{label}
    </div>
    <div className="text-sm font-mono mt-1">{value}</div>
  </div>
);
