import { useEffect, useState } from "react";
import { Brain, BriefcaseBusiness, Rocket, ShieldAlert } from "lucide-react";

import type { ExecutiveDashboardData } from "../../pages/DashboardPage";

import BusinessTab from "./tabs/BusinessTab";
import ConsultingTab from "./tabs/ConsultingTab";
import IntelligenceTab from "./tabs/IntelligenceTab";
import OperationsTab from "./tabs/OperationsTab";

interface ExecutiveTabsProps {
  data: ExecutiveDashboardData;
}

type ExecutiveTabId = "business" | "consulting" | "operations" | "intelligence";

const STORAGE_KEY = "aura.executiveCenter.activeTab";

function isExecutiveTabId(value: string | null): value is ExecutiveTabId {
  return (
    value === "business" ||
    value === "consulting" ||
    value === "operations" ||
    value === "intelligence"
  );
}

export default function ExecutiveTabs({ data }: ExecutiveTabsProps) {
  const [activeTab, setActiveTab] = useState<ExecutiveTabId>(() => {
    const savedTab = window.localStorage.getItem(STORAGE_KEY);
    return isExecutiveTabId(savedTab) ? savedTab : "business";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs = [
    { id: "business", label: "Negocio", icon: BriefcaseBusiness },
    { id: "consulting", label: "Consulting", icon: Rocket },
    { id: "operations", label: "Operación", icon: ShieldAlert },
    { id: "intelligence", label: "Intelligence", icon: Brain },
  ] as const;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-slate-950 text-slate-400 hover:bg-cyan-400/10 hover:text-cyan-200",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "business" && <BusinessTab data={data} />}
      {activeTab === "consulting" && <ConsultingTab data={data} />}
      {activeTab === "operations" && <OperationsTab data={data} />}
      {activeTab === "intelligence" && <IntelligenceTab />}
    </section>
  );
}