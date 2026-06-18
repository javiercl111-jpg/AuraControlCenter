import {
    BadgeDollarSign,
    Building2,
    CreditCard,
    Gauge,
    Layers3,
    PackageCheck,
    ReceiptText,
    ShieldCheck,
    UsersRound,
  } from "lucide-react";
  import { NavLink, Outlet } from "react-router-dom";
  
  const navItems = [
    { label: "Dashboard", path: "/", icon: Gauge },
    { label: "Clientes", path: "/clients", icon: Building2 },
    { label: "Ecosistemas", path: "/modules", icon: PackageCheck },
    { label: "Planes", path: "/plans", icon: Layers3 },
    { label: "Facturación", path: "/billing", icon: CreditCard },
    { label: "Pagos", path: "/payments", icon: ReceiptText },
    { label: "Licencias", path: "/licenses", icon: ShieldCheck },
    { label: "Comisiones", path: "/commissions", icon: BadgeDollarSign },
    { label: "Asesores", path: "/sales-advisors", icon: UsersRound },
  ];
  
  export default function AppLayout() {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-cyan-400/10 bg-slate-950/80 p-6 backdrop-blur xl:block">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Aura Platform
            </p>
  
            <h1 className="mt-3 text-2xl font-bold text-white">
              Control Center
            </h1>
  
            <p className="mt-2 text-sm text-slate-400">
              Consola global para clientes, planes, licencias y facturación.
            </p>
          </div>
  
          <nav className="space-y-2">
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
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>
  
        <main className="min-h-screen xl:pl-72">
          <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }