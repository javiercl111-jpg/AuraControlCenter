import type { InegiCompany } from "../types/inegi";

export const TARGET_PIPELINE_SIZE = 10;

/**
 * Determina si un prospecto del mercado es elegible para ingresar al Pipeline Comercial (Reservoir).
 */
export function isEligiblePipelineProspect(company: InegiCompany): boolean {
  if (!company) return false;

  // 1. Estatus compatible (NEW o REACTIVATED)
  const isCompatibleStatus = company.status === "NEW" || (company.status as string) === "REACTIVATED";
  if (!isCompatibleStatus) return false;

  // 2. No convertido (sin organización asociada)
  if (company.convertedOrganizationId) return false;

  // 3. No asignado activamente a ningún asesor
  if (company.assignedAdvisorId) return false;

  // 4. Datos de contacto completos (debe tener email y teléfono válidos)
  const hasCompleteContact = 
    company.email && 
    company.email.trim() !== "" && 
    company.telefono && 
    company.telefono.trim() !== "";
  
  if (!hasCompleteContact) return false;

  // 5. Prioridad comercial: Debe ser CRITICAL o HIGH (Opportunity Score >= 70)
  const score = company.opportunityScore || 0;
  if (score < 70) return false;

  return true;
}

/**
 * Compara dos prospectos para determinar el orden de prioridad determinista:
 * 1. Nivel de prioridad CRITICAL primero, luego HIGH.
 * 2. Opportunity Score descendente.
 * 3. Fecha de actualización/creación más reciente como desempate estable.
 */
export function comparePipelinePriority(a: InegiCompany, b: InegiCompany): number {
  const getPriorityWeight = (c: InegiCompany): number => {
    const p = c.priorityLevel || "LOW";
    if (p === "CRITICAL") return 3;
    if (p === "HIGH") return 2;
    if (p === "MEDIUM") return 1;
    return 0;
  };

  const weightA = getPriorityWeight(a);
  const weightB = getPriorityWeight(b);

  if (weightA !== weightB) {
    return weightB - weightA; // Mayor peso primero (descendente)
  }

  // Desempate 2: Opportunity Score descendente
  const scoreA = a.opportunityScore || 0;
  const scoreB = b.opportunityScore || 0;
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  // Desempate 3: Fecha de actualización o creación (más reciente primero)
  const getTimestamp = (c: InegiCompany): number => {
    if (c.updatedAt) {
      if (typeof c.updatedAt === "number") return c.updatedAt;
      if (typeof c.updatedAt === "string") return new Date(c.updatedAt).getTime();
      if (c.updatedAt && (c.updatedAt as any).seconds) return (c.updatedAt as any).seconds * 1000;
    }
    if (c.createdAt) {
      if (typeof c.createdAt === "number") return c.createdAt;
      if (typeof c.createdAt === "string") return new Date(c.createdAt).getTime();
      if (c.createdAt && (c.createdAt as any).seconds) return (c.createdAt as any).seconds * 1000;
    }
    return 0;
  };

  return getTimestamp(b) - getTimestamp(a);
}
