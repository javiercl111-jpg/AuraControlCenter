import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { isGlobalAdmin } from "../services/platformAdminService";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("jcuellar@aura-hcm.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      const allowed = await isGlobalAdmin(userEmail);

      if (!allowed) {
        await auth.signOut();
        setError("Acceso no autorizado para Aura Control Center.");
        return;
      }

      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError("Correo o contraseña incorrectos.");
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
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Aura
            </p>
            <h1 className="text-xl font-bold text-white">Control Center</h1>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white">
          Acceso Superadministrador
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Portal privado para administrar clientes, ecosistemas, planes,
          licencias y facturación administrativa de Aura.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
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
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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