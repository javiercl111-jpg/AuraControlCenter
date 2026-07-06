export type CompanyStatus = "NEW" | "QUALIFIED" | "CONTACTED" | "CONVERTED" | "DISCARDED";

export type RecommendedSuite =
  | "People Suite"
  | "Sales Suite"
  | "Compensation Suite"
  | "Operations Suite"
  | "Intelligence Suite"
  | "Digital Trust Suite";

export interface OpportunityScoreBreakdown {
  total: number;
  sourceScore: number;       // Max 25
  companySizeScore: number;  // Max 20
  sectorScore: number;       // Max 20
  reachabilityScore: number; // Max 35
}

export interface InegiCompany {
  id: string; // Deterministic ID: inegi_{cleanName}_{cleanMunicipio}_{cleanScian}
  razonSocial: string;
  nombreComercial: string;
  sector: string;
  tamano: string;
  rangoPersonal: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  direccion: string;
  municipio: string;
  estado: string;
  cp: string;
  scian: string;
  actividad: string;
  latitud: number;
  longitud: number;
  altaDenue: string;
  sourceScore: number;
  opportunityScore: number;
  scoreBreakdown: OpportunityScoreBreakdown;
  recommendedSuites: RecommendedSuite[];
  status: CompanyStatus;
  convertedOrganizationId?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface MarketSegment {
  id: string;
  name: string;
  description: string;
  iconName: string;
  filterChange: Partial<{
    tamano: string;
    sector: string;
    minScore: number;
    hasEmail: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
    status: CompanyStatus;
  }>;
}

const DEFAULT_COMPANY_STATUSES: CompanyStatus[] = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "CONVERTED",
  "DISCARDED",
];

export default DEFAULT_COMPANY_STATUSES;
