import {
  BadgeDollarSign,
  Building2,
  Calculator,
  Compass,
  CreditCard,
  FileText,
  Gauge,
  Layers3,
  LogOut,
  Network,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { auth } from "../config/firebase";

const navItems = [
  { label: "Dashboard", path: "/", icon: Gauge },
  { label: "CRM", path: "/crm", icon: Workflow },
  { label: "Inteligencia Comercial", path: "/market-intelligence", icon: Compass },
  { label: "Cotizador", path: "/pricing", icon: Calculator },
  { label: "Clientes", path: "/clients", icon: Building2 },
  { label: "Tenants", path: "/tenants", icon: Network },
  { label: "Suscripciones", path: "/subscriptions", icon: RefreshCw },
  { label: "Comisiones", path: "/commissions", icon: BadgeDollarSign },
  { label: "Licencias", path: "/licenses", icon: ShieldCheck },
  { label: "Enforcement", path: "/tenant-enforcement", icon: ShieldAlert },
  { label: "Ecosistemas", path: "/modules", icon: PackageCheck },
  { label: "Planes", path: "/plans", icon: Layers3 },
  { label: "Facturación", path: "/billing", icon: CreditCard },
  { label: "Pagos", path: "/payments", icon: ReceiptText },
  { label: "Asesores", path: "/sales-advisors", icon: UsersRound },
  { label: "Reportes", path: "/reports", icon: FileText },
  { label: "Configuración", path: "/settings", icon: Settings },
];

export default function AppLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 overflow-y-auto border-r border-cyan-400/10 bg-slate-950/80 p-6 backdrop-blur xl:block">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <img
              src="/aura-control-center-logo.png"
              alt="Aura Control Center"
              className="h-20 w-auto object-contain"
            />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Aura Platform
          </p>

          <h1 className="mt-3 text-2xl font-bold text-white">
            Control Center
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Consola global para clientes, tenants, licencias, facturación y
            operación comercial.
          </p>
        </div>

        <nav className="space-y-2 pb-8">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-cyan-400/10 text-cyan-200"
                      : "text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-200",
                  ].join(" ")
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 pt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-h-screen xl:pl-72">
        <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}