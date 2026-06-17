import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SeasonProvider } from "./context/SeasonContext";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { NicknameSetup } from "./pages/NicknameSetup";
import { MatchCenter } from "./pages/MatchCenter";
import { Stats } from "./pages/Stats";
import { Plantilla } from "./pages/Plantilla";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";
import { Landing } from "./pages/Landing";
import { Crest } from "./components/Crest";

const MainAppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  
  // Custom hash router state
  const [currentPage, setCurrentPage] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    const validPages = ["matches", "stats", "plantilla", "profile", "admin"];
    return validPages.includes(hash) ? hash : "matches";
  });

  const [showLogin, setShowLogin] = useState(false);

  // Keep hash and current page in sync
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const validPages = ["matches", "stats", "plantilla", "profile", "admin"];
      if (validPages.includes(hash)) {
        setCurrentPage(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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

  // Double check security for admin routes
  const activePage = (currentPage === "admin" && profile?.role !== "admin" && profile?.role !== "superadmin") 
    ? "profile" 
    : currentPage;

  // 4. Main Application Frame
  return (
    <div className="app-container">
      <Navbar currentPage={activePage} setCurrentPage={setCurrentPage} />
      
      <main className="main-content">
        {activePage === "matches" && <MatchCenter />}
        {activePage === "stats" && <Stats />}
        {activePage === "plantilla" && <Plantilla />}
        {activePage === "profile" && <Profile />}
        {activePage === "admin" && <Admin />}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SeasonProvider>
        <MainAppContent />
      </SeasonProvider>
    </AuthProvider>
  );
}

export default App;
