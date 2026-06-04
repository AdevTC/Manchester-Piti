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

const MainAppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  
  // Custom hash router state
  const [currentPage, setCurrentPage] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    const validPages = ["matches", "stats", "plantilla", "profile", "admin"];
    return validPages.includes(hash) ? hash : "matches";
  });

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
          background: "#070b13",
          gap: "1.5rem"
        }}
      >
        <div
          style={{
            width: "4.5rem",
            height: "4.5rem",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent-cyan), #ffffff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-glow)",
            fontSize: "2rem",
            fontWeight: 900,
            color: "#0f172a"
          }}
        >
          M
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "1.5rem",
            height: "1.5rem",
            border: "3px solid rgba(6, 182, 212, 0.1)",
            borderTopColor: "var(--accent-cyan)",
            borderRadius: "50%",
            animation: "pulseGlow 1.2s infinite linear",
            margin: "0 auto 0.75rem"
          }}></div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", letterSpacing: "0.05em" }}>
            Iniciando Manchester Piti...
          </p>
        </div>
      </div>
    );
  }

  // 2. Auth Gate (Not Logged In)
  if (!user) {
    return <Login />;
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
