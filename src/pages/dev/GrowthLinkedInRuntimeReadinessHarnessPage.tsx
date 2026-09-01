import { useState } from "react";
import { httpsCallable } from "firebase/functions";

import { auth, functions } from "../../config/firebase";

type LinkedInReadinessResponse = {
  status?: string;
  tenantId?: string;
  principalId?: string;
  role?: string;
  secretBinding?: string;
  linkedInConnection?: string;
};

type InvocationResult = {
  certified: boolean;
  status: string;
  tenantId: string;
  principalId: string;
  role: string;
  secretBinding: string;
  linkedInConnection: string;
};

const AUTHORIZED_ROLES = new Set([
  "SUPER_ADMIN",
  "FOUNDER",
  "SALES_DIRECTOR",
  "PLATFORM_OWNER",
  "PLATFORM_PARTNER",
  "PARTNER",
]);

const normalizeError = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    return "UNKNOWN_ERROR";
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };

  const code =
    typeof candidate.code === "string"
      ? candidate.code
      : "UNKNOWN_CODE";

  const message =
    typeof candidate.message === "string"
      ? candidate.message
      : "Unknown callable error";

  return `${code}: ${message}`;
};

export default function GrowthLinkedInRuntimeReadinessHarnessPage() {
  const [armed, setArmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentUser = auth.currentUser;

  const invokeReadiness = async () => {
    if (!armed || attempted || loading) {
      return;
    }

    const user = auth.currentUser;

    setAttempted(true);
    setError(null);
    setResult(null);

    if (!user) {
      setError("AUTHENTICATED_USER_REQUIRED");
      return;
    }

    setLoading(true);

    try {
      const callable = httpsCallable<
        Record<string, never>,
        LinkedInReadinessResponse
      >(
        functions,
        "growthLinkedInRuntimeReadinessV1"
      );

      const response = await callable({});
      const data = response.data;

      const role =
        typeof data.role === "string"
          ? data.role
          : "";

      const normalized: InvocationResult = {
        certified:
          data.status === "AUTHORIZED" &&
          data.tenantId === "aura_root" &&
          data.principalId === user.uid &&
          AUTHORIZED_ROLES.has(role) &&
          data.secretBinding === "DECLARED_NOT_READ" &&
          data.linkedInConnection === "NOT_EXECUTED",

        status:
          data.status ?? "MISSING",

        tenantId:
          data.tenantId ?? "MISSING",

        principalId:
          data.principalId ?? "MISSING",

        role:
          role || "MISSING",

        secretBinding:
          data.secretBinding ?? "MISSING",

        linkedInConnection:
          data.linkedInConnection ?? "MISSING",
      };

      setResult(normalized);
    } catch (invocationError: unknown) {
      setError(
        normalizeError(invocationError)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="rounded-xl border border-cyan-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="text-2xl font-semibold text-cyan-300">
          LinkedIn Runtime Readiness
        </h1>

        <p className="mt-3 text-sm text-slate-300">
          Harness temporal de Preview para una sola invocacion
          controlada del callable de readiness.
        </p>

        <p className="mt-2 text-sm text-amber-300">
          Este harness no solicita tokens manualmente, no habilita
          App Check debug, no lee el secreto de LinkedIn y no llama
          directamente a la API de LinkedIn.
        </p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100">
        <h2 className="text-lg font-semibold">
          Autoridad de sesion
        </h2>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-400">Authenticated</dt>
            <dd>{currentUser ? "YES" : "NO"}</dd>
          </div>

          <div>
            <dt className="text-slate-400">Principal UID present</dt>
            <dd>{currentUser?.uid ? "YES" : "NO"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-6 text-slate-100">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={armed}
            disabled={attempted}
            onChange={(event) => setArmed(event.target.checked)}
            className="mt-1"
          />

          <span className="text-sm">
            Confirmo una unica invocacion controlada de
            growthLinkedInRuntimeReadinessV1.
          </span>
        </label>

        <button
          type="button"
          onClick={invokeReadiness}
          disabled={
            !armed ||
            !currentUser ||
            attempted ||
            loading
          }
          className="mt-5 rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading
            ? "Invocando..."
            : attempted
              ? "Invocacion ya intentada"
              : "Ejecutar invocacion controlada"}
        </button>

        <p className="mt-3 text-xs text-slate-400">
          Maximo un intento por carga de pagina. No existe invocacion
          automatica al abrir esta ruta.
        </p>
      </div>

      {result && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100">
          <h2 className="text-lg font-semibold">
            Resultado seguro
          </h2>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-400">Certified</dt>
              <dd>{result.certified ? "PASS" : "FAIL"}</dd>
            </div>

            <div>
              <dt className="text-slate-400">Status</dt>
              <dd>{result.status}</dd>
            </div>

            <div>
              <dt className="text-slate-400">Tenant</dt>
              <dd>{result.tenantId}</dd>
            </div>

            <div>
              <dt className="text-slate-400">Role</dt>
              <dd>{result.role}</dd>
            </div>

            <div>
              <dt className="text-slate-400">Principal match</dt>
              <dd>
                {result.principalId === currentUser?.uid
                  ? "YES"
                  : "NO"}
              </dd>
            </div>

            <div>
              <dt className="text-slate-400">Secret binding</dt>
              <dd>{result.secretBinding}</dd>
            </div>

            <div>
              <dt className="text-slate-400">LinkedIn connection</dt>
              <dd>{result.linkedInConnection}</dd>
            </div>
          </dl>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-700 bg-red-950/30 p-6 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}