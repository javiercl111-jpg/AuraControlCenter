import {
    BadgeDollarSign,
    Building2,
    CirclePause,
    Layers3,
    TrendingUp,
  } from "lucide-react";
  
  const stats = [
    {
      label: "Clientes activos",
      value: "0",
      icon: Building2,
      detail: "Pendiente de conectar Firestore",
    },
    {
      label: "Ecosistemas",
      value: "4",
      icon: Layers3,
      detail: "HCM, Maintenance, Signature, Intelligence",
    },
    {
      label: "Facturación mensual",
      value: "$0",
      icon: BadgeDollarSign,
      detail: "Facturación administrativa",
    },
    {
      label: "Licencias suspendidas",
      value: "0",
      icon: CirclePause,
      detail: "Bloqueos por falta de pago",
    },
  ];
  
  export default function DashboardPage() {
    return (
      <div>
        <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Aura Control Center
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Consola global del ecosistema Aura
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
            Desde aquí se administrarán clientes, planes, módulos contratados,
            licencias, facturación administrativa, asesores y comisiones.
          </p>
        </header>
  
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
  
            return (
              <article
                key={stat.label}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-slate-600" />
                </div>
  
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{stat.detail}</p>
              </article>
            );
          })}
        </section>
      </div>
    );
  }