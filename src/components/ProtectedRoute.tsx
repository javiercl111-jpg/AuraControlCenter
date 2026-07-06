import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { isGlobalAdmin } from "../services/platformAdminService";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setStatus("denied");
        return;
      }

      const allowed = await isGlobalAdmin(user.email, user.uid);
      setStatus(allowed ? "allowed" : "denied");
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