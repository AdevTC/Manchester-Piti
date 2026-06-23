import React, { useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SeasonProvider } from "./context/SeasonContext";
import { Login } from "./pages/Login";
import { NicknameSetup } from "./pages/NicknameSetup";
import { Landing } from "./pages/Landing";
import { Crest } from "./components/Crest";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";

const MainAppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();

  const [showLogin, setShowLogin] = useState(false);

  // Dev-only: `?login` renders the auth gate regardless of session, so the
  // login screen can be designed/inspected while signed in. DEV-stripped.
  const PREVIEW_LOGIN =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("login");
  if (PREVIEW_LOGIN) return <Login />;

  // 1. Loading screen
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--mp-navy-deep, #0c1733)",
          gap: "1.5rem"
        }}
      >
        <Crest
          size={104}
          alt="Manchester Piti"
          className="mp-boot-crest"
          style={{ filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.45))" }}
        />
        <div style={{ textAlign: "center" }}>
          <div className="mp-boot-spinner" />
          <p style={{ color: "var(--mp-sky, #6CABDD)", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
            Iniciando Manchester Piti
          </p>
        </div>
      </div>
    );
  }

  // 2. Auth Gate (Not Logged In): public landing first, then login
  if (!user) {
    return showLogin ? <Login /> : <Landing onEnter={() => setShowLogin(true)} />;
  }

  // 3. Profile Gate (Logged In, but no Nickname set)
  if (user && !profile) {
    return <NicknameSetup />;
  }

  // 4. Main Application Frame — the authenticated routes live in the router.
  return <RouterProvider router={router} />;
};

function App() {
  return (
    <AuthProvider>
      <SeasonProvider>
        <TooltipProvider delayDuration={300}>
          <MainAppContent />
          <Toaster />
        </TooltipProvider>
      </SeasonProvider>
    </AuthProvider>
  );
}

export default App;
