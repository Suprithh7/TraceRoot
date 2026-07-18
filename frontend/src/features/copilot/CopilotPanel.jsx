// AI Copilot panel — tabs for summary, report, freeze justification, next steps,
// with a language switcher (EN / HI / TA).
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const KINDS = [
  { k: "summary",              label: "Executive Summary" },
  { k: "report",               label: "Full Report" },
  { k: "freeze_justification", label: "Freeze Justification" },
  { k: "next_steps",           label: "Next Steps" },
];
const LANGS = [
  { k: "en", label: "English" },
  { k: "hi", label: "हिन्दी" },
  { k: "ta", label: "தமிழ்" },
];

export const CopilotPanel = ({ caseId }) => {
  const [kind, setKind] = useState("summary");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [texts, setTexts] = useState({}); // { "kind|lang": text }
  const [err, setErr] = useState(null);
  const abortRef = useRef(null);

  const cacheKey = `${kind}|${lang}`;
  const text = texts[cacheKey];

  useEffect(() => () => { abortRef.current?.(); }, []);

  const generate = () => {
    setLoading(true); setStreaming(true); setErr(null);
    setTexts((prev) => ({ ...prev, [cacheKey]: "" }));
    abortRef.current?.();
    abortRef.current = api.copilotStream(
      caseId, kind, lang,
      (delta) => setTexts((prev) => ({ ...prev, [cacheKey]: (prev[cacheKey] || "") + delta })),
      (fullText) => {
        setTexts((prev) => ({ ...prev, [cacheKey]: fullText || prev[cacheKey] || "" }));
        setLoading(false); setStreaming(false);
      },
      (msg) => { setErr(msg); setLoading(false); setStreaming(false); },
    );
  };

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.015] p-6" data-testid="copilot-panel">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-white/60" />
        <h2 className="text-lg font-semibold tracking-tight">AI Investigation Copilot</h2>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-white/40 border border-white/10 rounded-full px-2 py-0.5">
          gemini · gemma-orchestrator
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {KINDS.map((t) => (
          <button
            key={t.k}
            data-testid={`copilot-kind-${t.k}`}
            onClick={() => setKind(t.k)}
            className={`text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${
              kind === t.k
                ? "bg-white text-black border-white"
                : "border-white/15 text-white/60 hover:text-white hover:border-white/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Language</span>
        {LANGS.map((l) => (
          <button
            key={l.k}
            data-testid={`copilot-lang-${l.k}`}
            onClick={() => setLang(l.k)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              lang === l.k
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {l.label}
          </button>
        ))}
        <button
          data-testid="copilot-generate-button"
          onClick={generate}
          disabled={loading}
          className="ml-auto rounded-full bg-white text-black px-4 py-1.5 text-xs font-medium hover:bg-white/90 transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {text ? "Regenerate" : "Generate"}
        </button>
      </div>

      <motion.div
        key={cacheKey + (streaming ? "s" : "d")}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        className="min-h-[160px] rounded-xl bg-black/40 border border-white/5 p-5 text-[15px] leading-[1.75] text-white/85 whitespace-pre-wrap"
        data-testid="copilot-output"
      >
        {err && <span className="text-red-300 font-mono text-xs">Error: {err}</span>}
        {!err && !text && !loading && (
          <span className="text-white/40 text-sm">Click <b>Generate</b> to stream an AI response for this case.</span>
        )}
        {!err && !text && loading && (
          <span className="text-white/40 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Contacting the model…
          </span>
        )}
        {text}
        {streaming && text && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-white/70 align-middle animate-pulse" />
        )}
      </motion.div>

      {kind === "freeze_justification" && text && (
        <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-amber-300/80">
          Draft — for human investigator review, not a legal determination.
        </p>
      )}
    </div>
  );
};
