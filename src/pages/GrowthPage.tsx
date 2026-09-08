import { useState } from "react";
import { httpsCallable } from "firebase/functions";

import { auth, clientRuntimeEnvironment, functions } from "../config/firebase";
import {
  getGrowthSocialProfileById,
  listGrowthSocialProfiles,
  upsertGrowthSocialProfile,
  type GrowthSocialAccountType,
  type GrowthSocialConnectionState,
  type GrowthSocialProfileBinding,
  type GrowthSocialProvider,
} from "../services/growthSocialProfileService";

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

type SocialProfileFormState = {
  bindingId: string;
  provider: GrowthSocialProvider;
  accountType: GrowthSocialAccountType;
  externalAccountId: string;
  displayName: string;
  handle: string;
  profileUrl: string;
  connectionState: GrowthSocialConnectionState;
  isActive: boolean;
};

const initialSocialProfileForm: SocialProfileFormState = {
  bindingId: "",
  provider: "LINKEDIN",
  accountType: "PROFILE",
  externalAccountId: "",
  displayName: "",
  handle: "",
  profileUrl: "",
  connectionState: "PENDING",
  isActive: true,
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

  const [socialLoading, setSocialLoading] = useState(false);
  const [socialProfiles, setSocialProfiles] =
    useState<GrowthSocialProfileBinding[]>([]);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);
  const [lookupBindingId, setLookupBindingId] = useState("");
  const [lookupResult, setLookupResult] =
    useState<GrowthSocialProfileBinding | null>(null);
  const [socialForm, setSocialForm] =
    useState<SocialProfileFormState>(initialSocialProfileForm);

  const loadSocialProfiles = async () => {
    if (socialLoading) return;

    if (!auth.currentUser) {
      setSocialError("AUTHENTICATED_USER_REQUIRED");
      return;
    }

    setSocialLoading(true);
    setSocialError(null);
    setSocialMessage(null);

    try {
      const bindings = await listGrowthSocialProfiles({
        activeOnly: false,
      });

      setSocialProfiles([...bindings]);
      setSocialMessage(
        `Loaded ${bindings.length} managed profile binding(s).`
      );
    } catch (candidateError) {
      setSocialError(normalizeError(candidateError));
    } finally {
      setSocialLoading(false);
    }
  };

  const lookupSocialProfile = async () => {
    if (socialLoading) return;

    if (!auth.currentUser) {
      setSocialError("AUTHENTICATED_USER_REQUIRED");
      return;
    }

    const bindingId = lookupBindingId.trim();

    if (!bindingId) {
      setSocialError("BINDING_ID_REQUIRED");
      return;
    }

    setSocialLoading(true);
    setSocialError(null);
    setSocialMessage(null);
    setLookupResult(null);

    try {
      const binding = await getGrowthSocialProfileById(bindingId);

      setLookupResult(binding);
      setSocialMessage(
        binding
          ? `Binding ${binding.bindingId} loaded.`
          : `Binding ${bindingId} was not found.`
      );
    } catch (candidateError) {
      setSocialError(normalizeError(candidateError));
    } finally {
      setSocialLoading(false);
    }
  };

  const editSocialProfile = (
    binding: GrowthSocialProfileBinding
  ) => {
    setSocialForm({
      bindingId: binding.bindingId,
      provider: binding.provider,
      accountType: binding.accountType,
      externalAccountId: binding.externalAccountId,
      displayName: binding.displayName,
      handle: binding.handle ?? "",
      profileUrl: binding.profileUrl ?? "",
      connectionState: binding.connectionState,
      isActive: binding.isActive,
    });

    setLookupBindingId(binding.bindingId);
    setLookupResult(binding);
    setSocialError(null);
    setSocialMessage(`Editing ${binding.bindingId}.`);
  };

  const saveSocialProfile = async () => {
    if (socialLoading) return;

    if (!auth.currentUser) {
      setSocialError("AUTHENTICATED_USER_REQUIRED");
      return;
    }

    const bindingId = socialForm.bindingId.trim();
    const externalAccountId = socialForm.externalAccountId.trim();
    const displayName = socialForm.displayName.trim();

    if (!bindingId || !externalAccountId || !displayName) {
      setSocialError(
        "BINDING_ID_EXTERNAL_ACCOUNT_ID_AND_DISPLAY_NAME_REQUIRED"
      );
      return;
    }

    const existing =
      socialProfiles.find(
        (binding) => binding.bindingId === bindingId
      ) ??
      (lookupResult?.bindingId === bindingId
        ? lookupResult
        : null);

    const now = new Date().toISOString();

    setSocialLoading(true);
    setSocialError(null);
    setSocialMessage(null);

    try {
      const saved = await upsertGrowthSocialProfile({
        bindingId,
        provider: socialForm.provider,
        accountType: socialForm.accountType,
        externalAccountId,
        displayName,
        ...(socialForm.handle.trim()
          ? { handle: socialForm.handle.trim() }
          : {}),
        ...(socialForm.profileUrl.trim()
          ? { profileUrl: socialForm.profileUrl.trim() }
          : {}),
        connectionState: socialForm.connectionState,
        isActive: socialForm.isActive,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(socialForm.connectionState === "CONNECTED"
          ? { connectedAt: existing?.connectedAt ?? now }
          : {}),
        ...(existing?.lastVerifiedAt
          ? { lastVerifiedAt: existing.lastVerifiedAt }
          : {}),
      });

      setSocialProfiles((current) => {
        const remaining = current.filter(
          (binding) => binding.bindingId !== saved.bindingId
        );

        return [...remaining, saved].sort((left, right) =>
          left.displayName.localeCompare(right.displayName)
        );
      });

      setLookupResult(saved);
      setLookupBindingId(saved.bindingId);
      setSocialMessage(`Binding ${saved.bindingId} saved.`);
    } catch (candidateError) {
      setSocialError(normalizeError(candidateError));
    } finally {
      setSocialLoading(false);
    }
  };

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
            <p className="mt-2 font-semibold text-white">{clientRuntimeEnvironment}</p>
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Managed Social Profiles
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Perfiles sociales gobernados
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Metadatos administrados con growth.social.manage.
              El tenant se resuelve en servidor. No conecta proveedores,
              no lee secretos y no publica contenido.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSocialProfiles}
            disabled={socialLoading}
            className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-200 disabled:opacity-60"
          >
            {socialLoading ? "Procesando..." : "Recargar perfiles"}
          </button>
        </div>

        {socialError ? (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {socialError.includes("permission-denied")
              ? "Acceso denegado por el servidor: se requiere growth.social.manage."
              : socialError}
          </div>
        ) : null}

        {socialMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm text-emerald-200">
            {socialMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <input
                value={lookupBindingId}
                onChange={(event) =>
                  setLookupBindingId(event.target.value)
                }
                placeholder="Binding ID"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />
              <button
                type="button"
                onClick={lookupSocialProfile}
                disabled={socialLoading}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Buscar
              </button>
            </div>

            {lookupResult ? (
              <button
                type="button"
                onClick={() => editSocialProfile(lookupResult)}
                className="text-left text-sm font-semibold text-cyan-300"
              >
                {lookupResult.displayName} ·{" "}
                {lookupResult.connectionState} · Editar
              </button>
            ) : null}

            {socialProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                No hay perfiles cargados en esta sesión.
              </div>
            ) : (
              socialProfiles.map((binding) => (
                <article
                  key={binding.bindingId}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
                >
                  <p className="text-xs text-slate-500">
                    {binding.provider} · {binding.accountType}
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {binding.displayName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {binding.bindingId} · {binding.connectionState}
                  </p>
                  <button
                    type="button"
                    onClick={() => editSocialProfile(binding)}
                    className="mt-4 text-xs font-semibold text-cyan-300"
                  >
                    Editar binding
                  </button>
                </article>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="font-semibold text-white">
              Crear o actualizar binding
            </p>

            <div className="mt-5 grid gap-4">
              <input
                value={socialForm.bindingId}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    bindingId: event.target.value,
                  }))
                }
                placeholder="Binding ID"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />

              <select
                value={socialForm.provider}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    provider:
                      event.target.value as GrowthSocialProvider,
                  }))
                }
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              >
                <option value="LINKEDIN">LinkedIn</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="YOUTUBE">YouTube</option>
              </select>

              <select
                value={socialForm.accountType}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    accountType:
                      event.target.value as GrowthSocialAccountType,
                  }))
                }
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              >
                <option value="PROFILE">Profile</option>
                <option value="ORGANIZATION">Organization</option>
                <option value="PAGE">Page</option>
                <option value="CHANNEL">Channel</option>
              </select>

              <input
                value={socialForm.externalAccountId}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    externalAccountId: event.target.value,
                  }))
                }
                placeholder="External account ID"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />

              <input
                value={socialForm.displayName}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Display name"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />

              <input
                value={socialForm.handle}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    handle: event.target.value,
                  }))
                }
                placeholder="Handle (optional)"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />

              <input
                value={socialForm.profileUrl}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    profileUrl: event.target.value,
                  }))
                }
                placeholder="Profile URL (optional)"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />

              <select
                value={socialForm.connectionState}
                onChange={(event) =>
                  setSocialForm((current) => ({
                    ...current,
                    connectionState:
                      event.target.value as GrowthSocialConnectionState,
                  }))
                }
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              >
                <option value="PENDING">Pending</option>
                <option value="CONNECTED">Connected metadata state</option>
                <option value="DISCONNECTED">Disconnected</option>
                <option value="REVOKED">Revoked</option>
                <option value="ERROR">Error</option>
              </select>

              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={socialForm.isActive}
                  onChange={(event) =>
                    setSocialForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Binding activo
              </label>

              <button
                type="button"
                onClick={saveSocialProfile}
                disabled={socialLoading}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
              >
                {socialLoading ? "Guardando..." : "Guardar binding"}
              </button>

              <p className="text-xs leading-5 text-slate-500">
                No inicia OAuth, no conecta cuentas y no publica.
              </p>
            </div>
          </div>
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