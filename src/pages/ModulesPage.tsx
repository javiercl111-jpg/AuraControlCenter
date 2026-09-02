import { Link } from "react-router-dom";

type ModuleDefinition = {
  code: string;
  name: string;
  description: string;
  status: string;
  path?: string;
};

const modules: ModuleDefinition[] = [
    {
      code: "AURA_HCM",
      name: "Aura HCM",
      description: "Gestión de capital humano, asistencia, documentos y RH.",
      status: "Activo",
    },
    {
      code: "AURA_MAINTENANCE",
      name: "Aura Maintenance OS",
      description: "Órdenes, activos, ubicaciones, QR, preventivos y operación.",
      status: "Piloto",
    },
    {
      code: "AURA_SIGNATURE",
      name: "Aura Signature",
      description: "Firma electrónica, documentos, custodia y evidencia.",
      status: "Activo",
    },
    {
      code: "AURA_INTELLIGENCE",
      name: "Aura Intelligence",
      description: "Asistente IA central para soporte y operación del ecosistema.",
      status: "MVP",
    },
    {
      code: "AURA_GROWTH",
      name: "Aura Growth",
      description: "Inteligencia y automatizaci�n para crecimiento, contenido y operaci�n comercial.",
      status: "Preview operativo",
      path: "/growth",
    },
  ];
  
  export default function ModulesPage() {
    return (
      <div>
        <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Catálogo Aura Platform
          </p>
  
          <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Ecosistemas Aura
          </h1>
  
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
            Registro base de los productos que Aura Control Center podrá activar,
            desactivar y licenciar por cliente.
          </p>
        </header>
  
        <section className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <article
              key={module.code}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                    {module.code}
                  </p>
  
                  <h2 className="mt-2 text-2xl font-bold text-white">
                    {module.name}
                  </h2>
                </div>
  
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {module.status}
                </span>
              </div>
  
              <p className="text-sm leading-6 text-slate-400">
                {module.description}
              </p>

              {module.path ? (
                <Link
                  to={module.path}
                  className="mt-5 inline-flex items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
                >
                  Abrir consola
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    );
  }