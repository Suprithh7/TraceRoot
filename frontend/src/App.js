import { useState } from "react";
import "@/App.css";
import { SignInPage } from "@/components/SignInPage";
import { Dashboard } from "@/components/Dashboard";
import { CaseDetail } from "@/components/CaseDetail";

function App() {
  const [view, setView] = useState("login"); // login | dashboard | case
  const [email, setEmail] = useState("");
  const [activeCase, setActiveCase] = useState(null);

  const handleSignIn = (em) => {
    setEmail(em);
    setView("dashboard");
  };

  const handleOpenCase = (id) => {
    setActiveCase(id);
    setView("case");
  };

  const handleBackToDashboard = () => {
    setActiveCase(null);
    setView("dashboard");
  };

  const handleSignOut = () => {
    setEmail("");
    setActiveCase(null);
    setView("login");
  };

  return (
    <div className="App min-h-screen bg-black">
      {view === "login" && <SignInPage onSignIn={handleSignIn} />}
      {view === "dashboard" && (
        <Dashboard email={email} onOpenCase={handleOpenCase} onSignOut={handleSignOut} />
      )}
      {view === "case" && (
        <CaseDetail caseId={activeCase} onBack={handleBackToDashboard} />
      )}
    </div>
  );
}

export default App;
