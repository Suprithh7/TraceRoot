import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { SignInPage } from "@/components/SignInPage";
import { Dashboard } from "@/components/Dashboard";
import { CaseWorkspace } from "@/features/dashboard/CaseWorkspace";
import { AuthCallback } from "@/features/auth/AuthCallback";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { DemoDashboard } from "@/features/dashboard/DemoDashboard";

function AppRouter() {
  const location = useLocation();
  // Handle Emergent OAuth return: URL fragment carries session_id.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/cases/:caseId" element={<ProtectedRoute><CaseWorkspace /></ProtectedRoute>} />
      <Route path="/demo-dashboard" element={<DemoDashboard />} />
      <Route path="*" element={<SignInPage />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-black">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
