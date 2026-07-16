import { useEffect, useState } from "react";

import {
  getPlatformSettings,
  savePlatformSettings,
} from "../services/platformSettingsService";

import type { PlatformSettings } from "../types/platformSettings";

const emptySettings: Omit<PlatformSettings, "id"> = {
  billing: {
    defaultGraceDays: 15,
    maxGraceDays: 30,
    invoiceDueDays: 30,
    autoSuspendEnabled: true,
    autoReactivateOnPayment: true,
  },
  commissions: {
    year1Commission: 10,
    renewalCommission: 5,
    advisorBonusThreshold: 10,
    advisorBonusPercentage: 15,
  },
};

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<Omit<PlatformSettings, "id">>(emptySettings);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadSettings() {
    try {
      setError("");
      const data = await getPlatformSettings();

      setSettings({
        billing: data.billing,
        commissions: data.commissions,
      });
    } catch (err: any) {
      console.error("loadSettings error:", err);
      const code = err?.code || "";
      const msg = err?.message || "";
      if (code === "permission-denied") {
        setError("Acceso Denegado: Tu rol actual no tiene privilegios para ver la configuración global (permission-denied).");
      } else if (code === "not-found" || msg.includes("not-found")) {
        setError("No Encontrado: El documento de configuración global no existe en la base de datos (not-found).");
      } else {
        setError("Error de Carga: Fallo del sistema o SDK al intentar leer la configuración (load-error).");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function updateBillingSetting(
    field: keyof PlatformSettings["billing"],
    value: number | boolean
  ) {
    setSettings((current) => ({
      ...current,
      billing: {
        ...current.billing,
        [field]: value,
      },
    }));
  }

  function updateCommissionSetting(
    field: keyof PlatformSettings["commissions"],
    value: number
  ) {
    setSettings((current) => ({
      ...current,
      commissions: {
        ...current.commissions,
        [field]: value,
      },
    }));
  }

  async function handleSaveSettings() {
    if (settings.billing.defaultGraceDays < 0) {
      setError("Los días de gracia no pueden ser negativos.");
      return;
    }

    if (settings.billing.maxGraceDays < settings.billing.defaultGraceDays) {
      setError(
        "El máximo de días de gracia no puede ser menor al periodo default."
      );
      return;
    }

    if (settings.billing.invoiceDueDays < 0) {
      setError("Los días de vencimiento de factura no pueden ser negativos.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await savePlatformSettings(settings);
      setSuccessMessage("Configuración guardada correctamente.");
    } catch (err: any) {
      console.error("savePlatformSettings error:", err);
      const code = err?.code || "";
      if (code === "permission-denied") {
        setError("Acceso Denegado: Tu rol actual no permite guardar la configuración global (permission-denied).");
      } else {
        setError("Error de Guardado: Fallo del sistema o SDK al guardar la configuración.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando configuración...
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Configuration Center
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Configuración global
        </h1>

        <p className="mt-3 text-slate-400">
          Administra reglas globales de facturación, licencias, periodos de
          gracia y comisiones del ecosistema Aura.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
          {successMessage}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Facturación y licencias
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Días de gracia default
            </span>
            <input
              type="number"
              min={0}
              value={settings.billing.defaultGraceDays}
              onChange={(event) =>
                updateBillingSetting(
                  "defaultGraceDays",
                  Number(event.target.value)
                )
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Máximo días de gracia
            </span>
            <input
              type="number"
              min={0}
              value={settings.billing.maxGraceDays}
              onChange={(event) =>
                updateBillingSetting("maxGraceDays", Number(event.target.value))
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Vencimiento factura en días
            </span>
            <input
              type="number"
              min={0}
              value={settings.billing.invoiceDueDays}
              onChange={(event) =>
                updateBillingSetting(
                  "invoiceDueDays",
                  Number(event.target.value)
                )
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <input
              type="checkbox"
              checked={settings.billing.autoSuspendEnabled}
              onChange={(event) =>
                updateBillingSetting(
                  "autoSuspendEnabled",
                  event.target.checked
                )
              }
            />
            <span className="text-sm font-semibold text-slate-300">
              Suspensión automática habilitada
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <input
              type="checkbox"
              checked={settings.billing.autoReactivateOnPayment}
              onChange={(event) =>
                updateBillingSetting(
                  "autoReactivateOnPayment",
                  event.target.checked
                )
              }
            />
            <span className="text-sm font-semibold text-slate-300">
              Reactivar automáticamente al registrar pago
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Comisiones comerciales
        </h2>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Comisión año 1 %
            </span>
            <input
              type="number"
              min={0}
              value={settings.commissions.year1Commission}
              onChange={(event) =>
                updateCommissionSetting(
                  "year1Commission",
                  Number(event.target.value)
                )
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Comisión renovación %
            </span>
            <input
              type="number"
              min={0}
              value={settings.commissions.renewalCommission}
              onChange={(event) =>
                updateCommissionSetting(
                  "renewalCommission",
                  Number(event.target.value)
                )
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Umbral bono asesores
            </span>
            <input
              type="number"
              min={0}
              value={settings.commissions.advisorBonusThreshold}
              onChange={(event) =>
                updateCommissionSetting(
                  "advisorBonusThreshold",
                  Number(event.target.value)
                )
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Bono asesores %
            </span>
            <input
              type="number"
              min={0}
              value={settings.commissions.advisorBonusPercentage}
              onChange={(event) =>
                updateCommissionSetting(
                  "advisorBonusPercentage",
                  Number(event.target.value)
                )
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSaveSettings}
        disabled={isSaving}
        className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Guardando..." : "Guardar Configuración"}
      </button>
    </div>
  );
}