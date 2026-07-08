import { useState } from "react";
import {
  BadgeDollarSign,
  Briefcase,
  Building2,
  Calculator,
  Compass,
  CreditCard,
  FileText,
  Gauge,
  Layers3,
  LogOut,
  Menu,
  Network,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { auth } from "../config/firebase";

const navItems = [
  { label: "Dashboard", path: "/", icon: Gauge },
  { label: "CRM", path: "/crm", icon: Workflow },
  { label: "Aura Prospect Intelligence", path: "/market-intelligence", icon: Compass },
  { label: "Aura Consulting Center", path: "/consulting", icon: Briefcase },
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

const bottomNavItems = [
  { label: "Dashboard", shortLabel: "Dashboard", path: "/", icon: Gauge },
  { label: "Aura Prospect Intelligence", shortLabel: "Prospectos", path: "/market-intelligence", icon: Compass },
  { label: "Aura Consulting Center", shortLabel: "Consultoría", path: "/consulting", icon: Briefcase },
  { label: "Clientes", shortLabel: "Clientes", path: "/clients", icon: Building2 },
  { label: "Tenants", shortLabel: "Tenants", path: "/tenants", icon: Network },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* HEADER MÓVIL (Pantallas < xl) */}
      <header className="fixed top-0 inset-x-0 z-45 flex h-16 items-center justify-between border-b border-cyan-400/10 bg-slate-950/80 px-5 backdrop-blur xl:hidden">
        <div className="flex items-center gap-2.5">
          <img
            src="/aura-control-center-logo.png"
            alt="Aura Logo"
            className="h-8 w-auto object-contain"
          />
          <span className="text-sm font-bold tracking-wide text-white">Control Center</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 transition active:scale-95"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* DRAWER SIDEBAR MÓVIL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
          />
          {/* Content */}
          <aside className="fixed bottom-0 top-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-cyan-400/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center gap-2">
                <img
                  src="/aura-control-center-logo.png"
                  alt="Aura Logo"
                  className="h-8 w-auto object-contain"
                />
                <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">Aura Platform</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1.5 flex-1 pb-8">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => setIsMobileMenuOpen(false)}
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

            <div className="border-t border-slate-800 pt-5 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* SIDEBAR DESKTOP (Pantallas >= xl) */}
      <aside className="fixed inset-y-0 left-0 hidden w-72 overflow-y-auto border-r border-cyan-400/10 bg-slate-950/80 p-6 backdrop-blur xl:block">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <img
              src="/aura-control-center-logo.png"
              alt="Aura Control Center"
              className="h-20 w-auto object-contain"
            />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300 font-sans">
            Aura Platform
          </p>

          <h1 className="mt-3 text-2xl font-bold text-white tracking-tight">
            Control Center
          </h1>

          <p className="mt-2 text-sm text-slate-400 leading-relaxed font-sans">
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

      {/* BOTTOM NAV MÓVIL (Pantallas < xl) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-cyan-400/10 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur px-2 py-2 xl:hidden">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center justify-center text-center transition flex-1 py-1 gap-0.5",
                  isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200",
                ].join(" ")
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-bold tracking-tight uppercase truncate max-w-[64px]">
                {item.shortLabel}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* MAIN CONTAINER */}
      <main className="min-h-screen xl:pl-72 pt-16 pb-16 xl:pt-0 xl:pb-0">
        <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}