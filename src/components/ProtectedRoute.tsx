import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { isGlobalAdmin, getPlatformAdminByEmailOrUid } from "../services/platformAdminService";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );

  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      setStatus("allowed");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setStatus("denied");
        return;
      }

      try {
        const allowed = await isGlobalAdmin(user.email, user.uid);
        if (allowed) {
          // Token claims check and automatic refresh if out of sync
          const adminDoc = await getPlatformAdminByEmailOrUid(user.email, user.uid);
          if (adminDoc) {
            const tokenResult = await user.getIdTokenResult();
            const tokenRole = tokenResult.claims.roleCode;
            if (tokenRole !== adminDoc.role) {
              console.info("[Auth] Custom claims role out of sync with database. Forcing token refresh...");
              await user.getIdToken(true);
            }
          }
        }
        setStatus(allowed ? "allowed" : "denied");
      } catch (err) {
        console.error("[Auth] Error validating user platform claims:", err);
        setStatus("denied");
      }
    });

    return () => unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-cyan-300">
        Validando acceso a Aura Control Center...
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/login" replace />;
  }

  return children;
}