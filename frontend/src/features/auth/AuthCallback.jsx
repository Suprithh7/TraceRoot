// Handles the return from Emergent OAuth. Reads session_id from the URL
// fragment, exchanges it via the backend, then redirects to /dashboard.
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        const u = await api.exchangeSession(m[1]);
        setUser(u);
        // Clean URL and go to dashboard
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: u } });
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-sm text-white/50 font-mono">
          {err ? `Sign-in failed: ${err}` : "Signing you in..."}
        </p>
      </div>
    </div>
  );
};
