import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function PermissionDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-red-500/10 bg-slate-900/20 p-8 text-center backdrop-blur">
      <div className="rounded-2xl bg-red-500/10 p-4 text-red-400">
        <ShieldAlert className="h-12 w-12" />
      </div>
      
      <h2 className="mt-6 text-2xl font-bold text-white">
        Acceso Restringido por Permisos
      </h2>
      
      <p className="mt-2 text-sm text-slate-400 max-w-md leading-relaxed">
        Tu rol de seguridad actual en Aura Control Center no cuenta con las capacidades 
        requeridas para consultar o interactuar con el motor de Market Intelligence.
      </p>
      
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/"
          className="rounded-2xl bg-cyan-400 px-6 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-95"
        >
          Volver al Dashboard
        </Link>
        
        <a
          href="mailto:soporte@aura-hcm.com?subject=Solicitud%20de%20Permisos%20-%20Aura%20Market%20Intelligence"
          className="rounded-2xl border border-slate-800 bg-slate-950 px-6 py-3 text-xs font-bold text-slate-400 transition hover:border-slate-700 hover:text-white"
        >
          Solicitar Permisos
        </a>
      </div>
    </div>
  );
}
