import {
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    Lightbulb,
    Rocket,
    ShieldAlert,
  } from "lucide-react";
  
  import type { ExecutiveDashboardData } from "../../../pages/DashboardPage";
  
  interface IntelligenceTabProps {
    data: ExecutiveDashboardData;
  }
  
  interface ExecutiveRecommendation {
    title: string;
    description: string;
    severity: "success" | "info" | "warning" | "danger";
    icon: typeof Lightbulb;
  }
  
  function getRecommendationStyles(severity: ExecutiveRecommendation["severity"]) {
    if (severity === "danger") {
      return "border-red-500/20 bg-red-500/10 text-red-200";
    }
  
    if (severity === "warning") {
      return "border-yellow-400/20 bg-yellow-400/10 text-yellow-100";
    }
  
    if (severity === "success") {
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    }
  
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
  }
  
  function buildRecommendations(
    data: ExecutiveDashboardData
  ): ExecutiveRecommendation[] {
    const recommendations: ExecutiveRecommendation[] = [];
  
    if (data.metrics.suspendedClients.length > 0) {
      recommendations.push({
        title: "Revisar clientes suspendidos",
        description: `Hay ${data.metrics.suspendedClients.length} cliente(s) suspendido(s). Prioriza continuidad comercial y seguimiento de recuperación.`,
        severity: "danger",
        icon: ShieldAlert,
      });
    }
  
    if (data.metrics.pendingInvoices.length > 0) {
      recommendations.push({
        title: "Priorizar cobranza",
        description: `Hay ${data.metrics.pendingInvoices.length} factura(s) pendiente(s). Revisa pagos, próximas acciones y comunicación con clientes.`,
        severity: "warning",
        icon: CreditCard,
      });
    }
  
    if (data.metrics.tenantsNearLimit.length > 0) {
      recommendations.push({
        title: "Revisar límites contratados",
        description: `${data.metrics.tenantsNearLimit.length} tenant(s) están cerca o sobre su límite. Puede existir oportunidad de expansión o ajuste de plan.`,
        severity: "warning",
        icon: AlertTriangle,
      });
    }
  
    if (data.metrics.highPriorityOrganizations.length > 0) {
      recommendations.push({
        title: "Atender organizaciones prioritarias",
        description: `Hay ${data.metrics.highPriorityOrganizations.length} organización(es) de prioridad alta en Consulting Center. Conviene revisar sus expedientes hoy.`,
        severity: "info",
        icon: Rocket,
      });
    }
  
    if (data.metrics.consultingDiscovery.length > 0) {
      recommendations.push({
        title: "Agendar descubrimiento",
        description: `Hay ${data.metrics.consultingDiscovery.length} organización(es) en descubrimiento. Inicia diagnóstico antes de presentar módulos.`,
        severity: "info",
        icon: Rocket,
      });
    }
  
    if (recommendations.length === 0) {
      recommendations.push({
        title: "Operación estable",
        description:
          "No hay alertas críticas. Puedes enfocar el día en expansión, seguimiento consultivo y mejora del pipeline.",
        severity: "success",
        icon: CheckCircle2,
      });
    }
  
    return recommendations.slice(0, 3);
  }
  
  export default function IntelligenceTab({ data }: IntelligenceTabProps) {
    const recommendations = buildRecommendations(data);
  
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Aura Intelligence
          </p>
  
          <h3 className="mt-3 text-xl font-bold text-white">
            Recomendaciones ejecutivas
          </h3>
  
          <p className="mt-2 text-sm leading-6 text-cyan-100">
            Aura prioriza hasta tres señales importantes para ayudarte a decidir
            dónde enfocar tu atención hoy.
          </p>
        </div>
  
        <div className="grid gap-3">
          {recommendations.map((recommendation) => {
            const Icon = recommendation.icon;
  
            return (
              <article
                key={recommendation.title}
                className={[
                  "rounded-3xl border p-5",
                  getRecommendationStyles(recommendation.severity),
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
  
                  <div>
                    <h4 className="font-bold text-white">
                      {recommendation.title}
                    </h4>
  
                    <p className="mt-2 text-sm leading-6 opacity-90">
                      {recommendation.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }