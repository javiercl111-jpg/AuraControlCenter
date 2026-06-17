const plans = [
    {
      code: "HCM_BASIC",
      name: "Aura HCM Básico",
      price: "$2,990 + IVA",
      scope: "Hasta 50 empleados",
    },
    {
      code: "HCM_PROFESSIONAL",
      name: "Aura HCM Professional",
      price: "$7,990 + IVA",
      scope: "Hasta 250 empleados",
    },
    {
      code: "HCM_ENTERPRISE",
      name: "Aura HCM Enterprise",
      price: "Desde $14,990 + IVA",
      scope: "250+ empleados",
    },
    {
      code: "MAINTENANCE_PILOT_STARTER",
      name: "Maintenance Pilot Starter",
      price: "$2,500 + IVA",
      scope: "Hasta 100 activos / 10 técnicos",
    },
    {
      code: "MAINTENANCE_PILOT_PROFESSIONAL",
      name: "Maintenance Pilot Professional",
      price: "$5,500 + IVA",
      scope: "Hasta 500 activos",
    },
    {
      code: "MAINTENANCE_PILOT_ENTERPRISE",
      name: "Maintenance Pilot Enterprise",
      price: "$8,500 + IVA",
      scope: "Piloto avanzado / hotel grande",
    },
  ];
  
  export default function PlansPage() {
    return (
      <div>
        <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Licenciamiento Aura
          </p>
  
          <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Planes comerciales
          </h1>
  
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
            Base inicial de planes para Aura HCM y Aura Maintenance OS. Estos
            planes serán configurables desde Aura Control Center.
          </p>
        </header>
  
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.code}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                {plan.code}
              </p>
  
              <h2 className="mt-3 text-xl font-bold text-white">{plan.name}</h2>
  
              <p className="mt-5 text-3xl font-black text-white">{plan.price}</p>
  
              <p className="mt-3 text-sm text-slate-400">{plan.scope}</p>
            </article>
          ))}
        </section>
      </div>
    );
  }