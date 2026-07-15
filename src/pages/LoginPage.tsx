import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { isGlobalAdmin } from "../services/platformAdminService";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      const userEmail = credential.user.email;

      if (!userEmail) {
        setError("No se pudo identificar el correo del usuario.");
        return;
      }

      const allowed = await isGlobalAdmin(userEmail, credential.user.uid);

      if (!allowed) {
        await auth.signOut();
        setError(
          "Esta cuenta no tiene permisos para acceder a Aura Control Center."
        );
        return;
      }

      if (rememberMe) {
        localStorage.setItem("remembered_email", email.trim().toLowerCase());
      } else {
        localStorage.removeItem("remembered_email");
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login error:", err);

      if (err instanceof FirebaseError) {
        setError(`Firebase: ${err.code}`);
      } else {
        setError("No se pudo iniciar sesión.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="mb-8 flex items-center gap-4">
        <img
  src="/aura-control-center-logo.png"
  alt="Aura Control Center"
  className="h-16 w-16 rounded-2xl object-contain"
/>

          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
  Aura Platform
</p>

<h1 className="text-2xl font-bold text-white">
  Control Center
</h1>

<p className="text-xs text-slate-500">
  SaaS Administration Platform
</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white">
          Acceso Superadministrador
        </h2>

        <p className="mt-3 text-sm text-slate-400">
          Portal privado para administrar clientes, ecosistemas, planes,
          licencias y facturación administrativa de Aura.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Correo
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Contraseña
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            />
          </div>

          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400 focus:ring-offset-slate-950"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-300 cursor-pointer">
              Recordarme
            </label>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Validando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}