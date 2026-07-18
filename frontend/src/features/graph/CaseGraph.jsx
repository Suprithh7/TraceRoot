// Cytoscape graph view for a case. Nodes colored by risk, edges show flow.
import { useMemo } from "react";
import CytoscapeComponent from "react-cytoscapejs";

const RISK_COLORS = {
  freeze: "#f87171",
  monitor: "#fbbf24",
  safe: "#34d399",
};
const ROLE_SHAPES = {
  victim: "round-rectangle",
  mule: "round-diamond",
  cashout: "round-hexagon",
  merchant: "round-rectangle",
  unknown: "round-rectangle",
};

export const CaseGraph = ({ graph, onSelectNode }) => {
  const elements = useMemo(() => {
    const nodes = graph.nodes.map((n) => ({
      data: {
        id: n.id, label: `${n.label}\n${n.role.toUpperCase()}`,
        color: RISK_COLORS[n.risk] || "#94a3b8",
        shape: ROLE_SHAPES[n.role] || "round-rectangle",
      },
    }));
    const edges = graph.edges.map((e, i) => ({
      data: {
        id: `e${i}-${e.source}-${e.target}`,
        source: e.source, target: e.target,
        label: `$${Math.round(e.amount).toLocaleString()} · ${e.tx_count} tx`,
      },
    }));
    return [...nodes, ...edges];
  }, [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="h-[440px] flex items-center justify-center text-white/40 text-sm">
        No transactions yet — upload a CSV to build the graph.
      </div>
    );
  }

  return (
    <div className="h-[440px] w-full rounded-xl overflow-hidden bg-black/40 border border-white/5" data-testid="cytoscape-graph">
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "100%" }}
        layout={{ name: "breadthfirst", directed: true, spacingFactor: 1.35, padding: 30 }}
        stylesheet={[
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              "shape": "data(shape)",
              "label": "data(label)",
              "color": "#e5e7eb",
              "text-outline-width": 2,
              "text-outline-color": "#0a0a0a",
              "text-valign": "center",
              "text-halign": "center",
              "text-wrap": "wrap",
              "font-size": 10,
              "font-family": "ui-monospace, Menlo, monospace",
              "width": 90,
              "height": 55,
              "border-width": 1.5,
              "border-color": "rgba(255,255,255,0.15)",
            },
          },
          {
            selector: "edge",
            style: {
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
              "line-color": "rgba(255,255,255,0.25)",
              "target-arrow-color": "rgba(255,255,255,0.4)",
              "width": 1.5,
              "label": "data(label)",
              "font-size": 9,
              "color": "rgba(255,255,255,0.55)",
              "font-family": "ui-monospace, Menlo, monospace",
              "text-background-color": "#0a0a0a",
              "text-background-opacity": 0.85,
              "text-background-padding": 2,
              "text-rotation": "autorotate",
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-width": 3,
              "border-color": "#fff",
            },
          },
        ]}
        cy={(cy) => {
          cy.on("tap", "node", (evt) => onSelectNode?.(evt.target.id()));
        }}
      />
    </div>
  );
};
