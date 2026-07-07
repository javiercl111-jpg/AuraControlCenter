import type { ComponentType } from "react";
import {
  Compass,
  MailWarning,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";

interface Segment {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<any>;
  filters: Partial<{
    status: string;
    tamano: string;
    sector: string;
    hasEmail: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
    minScore: number;
  }>;
}

interface MarketSegmentsPanelProps {
  onSelectSegment: (segmentId: string, filters: any) => void;
  activeSegmentId: string | null;
}

const PREDEFINED_SEGMENTS: Segment[] = [
  {
    id: "high_priority",
    name: "Alta Prioridad Corporativa",
    description: "Prospectos con Opportunity Score superior a 75 pts.",
    icon: Sparkles,
    filters: {
      minScore: 75,
      status: "NEW",
    },
  },
  {
    id: "medium_growth",
    name: "Medianas en Crecimiento",
    description: "Empresas de tamaño Mediana listas para automatizar nómina.",
    icon: TrendingUp,
    filters: {
      tamano: "Mediana",
      status: "NEW",
    },
  },
  {
    id: "tech_services",
    name: "Tecnología y Servicios",
    description: "Sectores de Información y Servicios Profesionales.",
    icon: Compass,
    filters: {
      sector: "Servicios Profesionales",
      status: "NEW",
    },
  },
  {
    id: "missing_contact",
    name: "Cuentas por Enriquecer",
    description: "Registros importados sin email para contactar activamente.",
    icon: MailWarning,
    filters: {
      hasEmail: false,
      status: "NEW",
    },
  },
  {
    id: "pre_qualified",
    name: "Pre-Calificados",
    description: "Prospectos en estatus calificados esperando contacto comercial.",
    icon: UserCheck,
    filters: {
      status: "QUALIFIED",
    },
  },
];

export default function MarketSegmentsPanel({
  onSelectSegment,
  activeSegmentId,
}: MarketSegmentsPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
      <h3 className="text-sm font-semibold tracking-wide text-cyan-200 mb-4">
        Segmentos Estratégicos
      </h3>
      <p className="text-xs text-slate-500 mb-6">
        Filtros preconfigurados para acelerar el embudo de ventas del Directorio INEGI.
      </p>

      <div className="space-y-3">
        {PREDEFINED_SEGMENTS.map((segment) => {
          const Icon = segment.icon;
          const isActive = activeSegmentId === segment.id;

          return (
            <button
              key={segment.id}
              type="button"
              onClick={() => onSelectSegment(segment.id, segment.filters)}
              className={`flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all duration-200 ${
                isActive
                  ? "border-cyan-400/35 bg-cyan-400/[0.05] text-white shadow-md shadow-cyan-950/10"
                  : "border-slate-800/80 bg-slate-900/10 text-slate-400 hover:border-slate-700 hover:bg-slate-900/30 hover:text-slate-200"
              }`}
            >
              <div
                className={`mt-0.5 rounded-lg p-2 ${
                  isActive
                    ? "bg-cyan-400/10 text-cyan-300"
                    : "bg-slate-800/50 text-slate-500"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-xs">{segment.name}</h4>
                <p className="mt-1 text-[10px] text-slate-500 leading-normal">
                  {segment.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
