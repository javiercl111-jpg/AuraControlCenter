import { useState } from "react";
import { httpsCallable } from "firebase/functions";

import { auth, functions } from "../config/firebase";

type LinkedInReadinessResponse = {
  status?: string;
  tenantId?: string;
  principalId?: string;
  role?: string;
  secretBinding?: string;
  linkedInConnection?: string;
};

type ReadinessResult = {
  certified: boolean;
  status: string;
  role: string;
  principalMatch: boolean;
  secretBinding: string;
  linkedInConnection: string;
  checkedAt: string;
};

const providers = [
  {
    name: "LinkedIn",
    position: "Provider 001",
    state: "ACTIVE_PROVIDER_001",
    description:
      "Primer proveedor social gobernado de Aura Growth. Readiness operativo disponible sin publicar contenido.",
  },
  {
    name: "Facebook",
    position: "Provider",
    state: "PLANNED",
    description: "Preparado para incorporación futura al proveedor social multicanal.",
  },
  {
    name: "Instagram",
    position: "Provider",
    state: "PLANNED",
    description: "Preparado para incorporación futura al proveedor social multicanal.",
  },
  {
    name: "X",
    position: "Provider",
    state: "PLANNED",
    description: "Preparado para incorporación futura al proveedor social multicanal.",
  },
  {
    name: "TikTok",
    position: "Provider",
    state: "PLANNED",
    description: "Preparado para incorporación futura al proveedor social multicanal.",
  },
  {
    name: "YouTube",
    position: "Provider",
    state: "PLANNED",
    description: "Preparado para incorporación futura al proveedor social multicanal.",
  },
] as const;

function normalizeError(error: unknown): string {
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
}

export default function GrowthPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyReadiness = async () => {
    if (loading) {
      return;
    }

    const user = auth.currentUser;

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
          : "MISSING";

      const principalMatch =
        data.principalId === user.uid;

      const certified =
        data.status === "AUTHORIZED" &&
        data.tenantId === "aura_root" &&
        principalMatch &&
        data.secretBinding === "DECLARED_NOT_READ" &&
        data.linkedInConnection === "NOT_EXECUTED";

      setResult({
        certified,
        status: data.status ?? "MISSING",
        role,
        principalMatch,
        secretBinding: data.secretBinding ?? "MISSING",
        linkedInConnection: data.linkedInConnection ?? "MISSING",
        checkedAt: new Date().toISOString(),
      });
    } catch (candidateError) {
      setError(normalizeError(candidateError));
    } finally {
      setLoading(false);
    }
  };

  const readinessState =
    result?.certified
      ? "AUTHORIZED"
      : result
        ? "REVIEW_REQUIRED"
        : "NOT_CHECKED";

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-cyan-400/15 bg-slate-900/80 shadow-2xl shadow-cyan-950/20">
        <div className="border-b border-slate-800 px-6 py-7 md:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
                Aura Intelligence · Growth
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Aura Growth
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                Consola administrativa y operativa para crecimiento,
                redes sociales y gobierno de publicación del ecosistema Aura.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Domain owner
              </p>
              <p className="mt-1 font-semibold text-white">
                Aura Intelligence
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Control Center opera y gobierna; no duplica la lógica Growth.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-slate-800 md:grid-cols-4">
          <div className="bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Runtime
            </p>
            <p className="mt-2 font-semibold text-white">Preview</p>
          </div>

          <div className="bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Manage authority
            </p>
            <p className="mt-2 font-semibold text-cyan-200">
              growth.social.manage
            </p>
          </div>

          <div className="bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Publish authority
            </p>
            <p className="mt-2 font-semibold text-amber-200">
              Not granted
            </p>
          </div>

          <div className="bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              LinkedIn
            </p>
            <p className="mt-2 font-semibold text-emerald-200">
              Provider 001
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Overview
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Operational readiness
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              La autoridad operativa proviene del servidor. El rol mostrado es
              informativo y no sustituye el capability grant.
            </p>
          </div>

          <button
            type="button"
            onClick={verifyReadiness}
            disabled={loading}
            className="inline-flex min-w-48 items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verificando..." : "Verificar readiness"}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Authorization
            </p>
            <p className="mt-2 font-semibold text-white">{readinessState}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Role
            </p>
            <p className="mt-2 font-semibold text-white">
              {result?.role ?? "Not checked"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Informational only
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Principal match
            </p>
            <p className="mt-2 font-semibold text-white">
              {result ? (result.principalMatch ? "YES" : "NO") : "Not checked"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Connection
            </p>
            <p className="mt-2 font-semibold text-white">
              {result?.linkedInConnection ?? "NOT_CHECKED"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Social Networks
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
            const linkedIn =
              provider.name === "LinkedIn";

            const providerState =
              linkedIn && result?.certified
                ? "AUTHORIZED"
                : provider.state;

            return (
              <article
                key={provider.name}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {provider.position}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-white">
                      {provider.name}
                    </h3>
                  </div>

                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                    {providerState}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  {provider.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Publishing Governance
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">
              Manage capability
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              growth.social.manage habilita readiness y administración
              operativa gobernada.
            </p>
          </article>

          <article className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-5">
            <p className="text-sm font-semibold text-amber-200">
              Publish capability
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              growth.social.publish no se presume ni se deriva de manage.
              Requiere concesión explícita antes de cualquier publicación real.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <p className="text-sm font-semibold text-white">
              Secret custody
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              El valor del secreto de LinkedIn nunca se presenta en esta
              consola. Readiness únicamente confirma su binding seguro.
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Activity
        </p>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Last readiness
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {result?.checkedAt ?? "No check in this session"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Status
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {result?.status ?? "NOT_CHECKED"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Secret binding
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {result?.secretBinding ?? "NOT_CHECKED"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Publication
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-200">
                NOT_EXECUTED
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}