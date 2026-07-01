import { ArrowLeft, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

import { db } from "../config/firebase";
import { getClientById } from "../services/platformClientDetailService";
import type { PlatformClient } from "../types/platformClient";

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "text-emerald-400";
    case "GRACE_PERIOD":
      return "text-yellow-400";
    case "SUSPENDED":
      return "text-red-400";
    case "CANCELLED":
      return "text-slate-400";
    case "PENDING_ACTIVATION":
    case "READY":
      return "text-blue-400";
    default:
      return "text-white";
  }
}

function getLicenseStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "text-emerald-400";
    case "SUSPENDED":
      return "text-red-400";
    case "EXPIRED":
      return "text-yellow-500";
    case "CANCELLED":
      return "text-slate-400";
    case "PENDING_ACTIVATION":
    default:
      return "text-blue-400";
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function formatDate(timestamp: any): string {
  if (!timestamp) return "Sin fecha";
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  try {
    return new Date(timestamp).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return String(timestamp);
  }
}

export default function ClientDetailPage() {
  const { clientId } = useParams();

  const [client, setClient] = useState<PlatformClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("Cargando...");
  const [tenantStatus, setTenantStatus] = useState<string>("Cargando...");
  const [licenseStatuses, setLicenseStatuses] = useState<{ code: string; status: string }[]>([]);
  const [associatedCommissions, setAssociatedCommissions] = useState<any[]>([]);
  const [isDirectSale, setIsDirectSale] = useState(false);

  useEffect(() => {
    async function loadClient() {
      if (!clientId) {
        setError("Cliente no válido.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getClientById(clientId);

        if (!data) {
          setError("No se encontró el cliente.");
          setIsLoading(false);
          return;
        }

        setClient(data);

        // Fetch Subscription Status
        const subSnap = await getDocs(
          query(collection(db, "platform_subscriptions"), where("clientId", "==", clientId), limit(1))
        );
        if (!subSnap.empty) {
          setSubscriptionStatus(subSnap.docs[0].data().status || "PENDING_ACTIVATION");
        } else {
          setSubscriptionStatus("Sin suscripción");
        }

        // Fetch Tenant Status
        const tenantSnap = await getDocs(
          query(collection(db, "platform_tenants"), where("clientId", "==", clientId), limit(1))
        );
        if (!tenantSnap.empty) {
          setTenantStatus(tenantSnap.docs[0].data().status || "READY");
        } else {
          setTenantStatus("Sin tenant");
        }

        // Fetch Licenses Status
        const licensesSnap = await getDocs(
          query(collection(db, "platform_licenses"), where("clientId", "==", clientId))
        );
        const lics = licensesSnap.docs.map((d) => ({
          code: d.data().productCode as string,
          status: d.data().status as string,
        }));
        setLicenseStatuses(lics);

        // Fetch Associated Commissions
        const commsSnap = await getDocs(
          query(collection(db, "platform_commissions"), where("clientId", "==", clientId))
        );
        const comms = commsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAssociatedCommissions(comms);

        // Fetch Quote to check if it's a direct sale
        const quoteId = (data as any).quoteId;
        if (quoteId) {
          try {
            const quoteSnap = await getDoc(doc(db, "platform_quotes", quoteId));
            if (quoteSnap.exists()) {
              const quoteData = quoteSnap.data();
              if (
                quoteData.salesChannel === "DIRECT" ||
                quoteData.commissionSkipped === true ||
                !quoteData.advisorId ||
                quoteData.advisorId === "UNASSIGNED"
              ) {
                setIsDirectSale(true);
              }
            }
          } catch (qErr) {
            console.error("Error fetching quote for client detail:", qErr);
          }
        }
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la información completa del cliente.");
      } finally {
        setIsLoading(false);
      }
    }

    loadClient();
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando cliente...
      </div>
    );
  }

  if (error || !client) {
    return (
      <div>
        <Link
          to="/clients"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          {error || "Cliente no disponible."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        <Link
          to={`/clients/${client.id}/edit`}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
        >
          <Pencil className="h-4 w-4" />
          Editar Cliente
        </Link>
      </div>

      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Detalle de Cliente
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          {client.companyName}
        </h1>

        <p className="mt-2 text-slate-400">{client.tradeName}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">
            Información General
          </h2>

          <div className="space-y-3 text-sm text-slate-400">
            <p>
              Razón social:{" "}
              <span className="font-semibold text-white">
                {client.companyName}
              </span>
            </p>

            <p>
              Nombre comercial:{" "}
              <span className="font-semibold text-white">
                {client.tradeName}
              </span>
            </p>

            <p>
              Estado:{" "}
              <span className="font-semibold text-cyan-300">
                {client.status}
              </span>
            </p>

            {client.salesChannel === "ADVISOR" ? (
              <>
                <p>
                  Asesor comercial:{" "}
                  <span className="font-semibold text-white">
                    {client.advisorName || "No asignado"}
                  </span>
                </p>
                {client.advisorEmail && (
                  <p>
                    Correo del asesor:{" "}
                    <span className="font-semibold text-white text-xs">
                      {client.advisorEmail}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p>
                Canal comercial:{" "}
                <span className="font-semibold text-white">Venta directa</span>
              </p>
            )}

            {client.ownerAdvisorId && (
              <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-1">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Propietario Comercial (Owner)
                </p>
                <p>
                  Nombre:{" "}
                  <span className="font-semibold text-white">
                    {client.ownerAdvisorName || "No asignado"}
                  </span>
                </p>
                {client.ownerAdvisorEmail && (
                  <p>
                    Correo:{" "}
                    <span className="font-semibold text-white text-xs">
                      {client.ownerAdvisorEmail}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">Licencia</h2>

          <div className="space-y-3 text-sm text-slate-400">
            <p>
              Plan:{" "}
              <span className="font-semibold text-white">
                {client.planCode}
              </span>
            </p>

            <p>
              Ciclo:{" "}
              <span className="font-semibold text-white">
                {client.billingCycle}
              </span>
            </p>

            <p>
              Inicio:{" "}
              <span className="font-semibold text-white">
                {client.startDate || "Sin fecha"}
              </span>
            </p>

            <p>
              Renovación:{" "}
              <span className="font-semibold text-white">
                {client.renewalDate || "Sin fecha"}
              </span>
            </p>

            <p>
              Gracia hasta:{" "}
              <span className="font-semibold text-white">
                {client.graceUntil || "Sin fecha"}
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-white">Datos fiscales</h2>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="text-slate-400">
              Razón social fiscal:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.legalName || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              RFC:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.rfc || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Régimen fiscal:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.taxRegime || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Uso CFDI:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.cfdiUse || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Método pago:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.paymentMethod || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Forma pago:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.paymentForm || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              CP fiscal:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.fiscalZipCode || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Correo facturación:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.billingEmail || "Sin dato"}
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-white">
            Ecosistemas contratados
          </h2>

          <div className="flex flex-wrap gap-2">
            {client.enabledModules?.map((moduleCode) => (
              <span
                key={moduleCode}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-cyan-300"
              >
                {moduleCode}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-white">
            Estados Comerciales (Ciclo de Vida)
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800/60">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Estado Suscripción</p>
              <p className={["mt-2 text-lg font-bold uppercase tracking-wide", getStatusColor(subscriptionStatus)].join(" ")}>
                {subscriptionStatus === "ACTIVE" ? "Activa" :
                 subscriptionStatus === "GRACE_PERIOD" ? "En Gracia" :
                 subscriptionStatus === "SUSPENDED" ? "Suspendida" :
                 subscriptionStatus === "CANCELLED" ? "Cancelada" :
                 subscriptionStatus === "PENDING_ACTIVATION" ? "Pendiente" : subscriptionStatus}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800/60">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Estado Tenant</p>
              <p className={["mt-2 text-lg font-bold uppercase tracking-wide", getStatusColor(tenantStatus)].join(" ")}>
                {tenantStatus === "ACTIVE" ? "Activa" :
                 tenantStatus === "GRACE_PERIOD" ? "En Gracia" :
                 tenantStatus === "SUSPENDED" ? "Suspendida" :
                 tenantStatus === "CANCELLED" ? "Cancelada" :
                 tenantStatus === "READY" ? "Listo" : tenantStatus}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800/60">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Estado Licencias</p>
              <div className="mt-2 space-y-1.5">
                {licenseStatuses.length === 0 ? (
                  <p className="text-slate-500 text-xs italic">Sin licencias registradas</p>
                ) : (
                  licenseStatuses.map((lic) => (
                    <div key={lic.code} className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">{lic.code.replace("AURA_", "")}</span>
                      <span className={["font-bold uppercase", getLicenseStatusColor(lic.status)].join(" ")}>{lic.status === "ACTIVE" ? "Activa" : lic.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-white">
            Comisiones Asociadas
          </h2>

          {associatedCommissions.length === 0 ? (
            <p className="text-slate-500 text-sm italic">
              {isDirectSale ? "Venta directa / Sin comisión asociada." : "No hay comisiones asociadas a este cliente."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Porcentaje (%)</th>
                    <th className="px-4 py-3">Monto Comisión</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {associatedCommissions.map((comm) => (
                    <tr key={comm.id} className="hover:bg-slate-900/10">
                      <td className="px-4 py-3">{formatDate(comm.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold text-white">{comm.commissionPercent}%</td>
                      <td className="px-4 py-3 font-bold text-cyan-300">{formatCurrency(comm.commissionAmount)}</td>
                      <td className="px-4 py-3 uppercase font-semibold text-[10px]">
                        <span className={comm.status === "PAID" ? "text-emerald-400" :
                                         comm.status === "APPROVED" ? "text-blue-400" :
                                         comm.status === "VOID" ? "text-red-400" : "text-yellow-400"}>
                          {comm.status === "PAID" ? "Pagada" :
                           comm.status === "APPROVED" ? "Aprobada" :
                           comm.status === "VOID" ? "Anulada" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}