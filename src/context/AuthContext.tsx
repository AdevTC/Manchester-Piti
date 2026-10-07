import React, { createContext, useContext, useEffect, useState } from "react";
import { type User, browserPopupRedirectResolver, getRedirectResult, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../firebase";
import { userProfileSchema } from "../lib/schemas";
import { reportDroppedDoc } from "../lib/docTelemetry";

export interface UserProfile {
  email: string;
  nickname: string;
  role: "superadmin" | "admin" | "user";
  createdAt: Date | import("firebase/firestore").Timestamp;
  /** Linked player file (set by an admin approving the claim). */
  playerId?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserRole: (targetUid: string, targetEmail: string, newRole: "admin" | "user") => Promise<boolean>;
  setLocalAdminRole: (isAdmin: boolean) => void; // Developer helper
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Dev-only no-auth preview: `?preview` renders the app shell with a mock
  // session so inner pages can be designed/inspected without logging in.
  // Gated by import.meta.env.DEV, so it is stripped from production builds.
  const PREVIEW =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("preview");

  const [user, setUser] = useState<User | null>(
    PREVIEW ? ({ uid: "preview", email: "preview@local" } as unknown as User) : null,
  );
  const [profile, setProfile] = useState<UserProfile | null>(
    PREVIEW
      ? { email: "preview@local", nickname: "preview", role: "admin", createdAt: new Date() }
      : null,
  );
  const [loading, setLoading] = useState(!PREVIEW);

  // Helper to toggle admin role in local storage for development/testing
  const [localAdminOverride, setLocalAdminOverride] = useState<boolean>(() => {
    return import.meta.env.DEV && localStorage.getItem("dev_admin_override") === "true";
  });

  const setLocalAdminRole = (isAdmin: boolean) => {
    setLocalAdminOverride(isAdmin);
    localStorage.setItem("dev_admin_override", isAdmin ? "true" : "false");
    if (profile && profile.role !== "superadmin") {
      setProfile({
        ...profile,
        role: isAdmin ? "admin" : "user"
      });
    }
  };

  useEffect(() => {
    if (PREVIEW) return;
    // The profile is live: an approved player claim or a role change shows up without reloading.
    let stopProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      stopProfile?.();
      stopProfile = null;
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const userDocRef = doc(db, "users", currentUser.uid);
      const isSuperAdminEmail = currentUser.emailVerified && currentUser.email === "adriantomascv@gmail.com";
      stopProfile = onSnapshot(
        userDocRef,
        (userDoc) => {
          if (!userDoc.exists()) {
            setProfile(null);
            setLoading(false);
            return;
          }
          const parsed = userProfileSchema.safeParse(userDoc.data());
          if (!parsed.success) {
            // Descarte de lectura MÁS consecuente (bloquea la sesión): que sea
            // detectable en prod vía la telemetría central, no solo console.
            reportDroppedDoc("users", currentUser.uid, parsed.error.issues);
            setProfile(null);
            setLoading(false);
            return;
          }
          const data = { ...parsed.data } as UserProfile;
          // Force superadmin role in DB if logged in with superadmin email
          if (isSuperAdminEmail && data.role !== "superadmin") {
            data.role = "superadmin";
            void setDoc(userDocRef, { role: "superadmin" }, { merge: true }).catch((error) =>
              console.error("Error promoting superadmin:", error),
            );
          }
          // Apply developer override if active and not the real superadmin
          if (import.meta.env.DEV && localAdminOverride && data.role !== "superadmin") {
            data.role = "admin";
          }
          setProfile(data);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching user profile:", error);
          setProfile(null);
          setLoading(false);
        },
      );
    });

    return () => {
      stopProfile?.();
      unsubscribe();
    };
  }, [localAdminOverride, PREVIEW]);

  // A web app added to an iPhone/iPad home screen can't open Google's popup: go there and back.
  const standalone = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  useEffect(() => {
    if (!standalone()) return;
    getRedirectResult(auth, browserPopupRedirectResolver).catch((error: unknown) => console.error("Google redirect failed:", error));
  }, []);
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      if (standalone()) await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
      else await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (error) {
      console.error("Google login failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (targetUid: string, targetEmail: string, newRole: "admin" | "user"): Promise<boolean> => {
    if (!profile || (profile.role !== "superadmin" && profile.role !== "admin")) {
      throw new Error("No tienes permisos para realizar esta acción.");
    }
    if (targetEmail === "adriantomascv@gmail.com") {
      throw new Error("No se pueden alterar los permisos del Administrador Supremo.");
    }
    
    try {
      const targetDocRef = doc(db, "users", targetUid);
      await setDoc(targetDocRef, { role: newRole }, { merge: true });
      return true;
    } catch (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      loginWithGoogle, 
      logout, 
      updateUserRole,
      setLocalAdminRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
