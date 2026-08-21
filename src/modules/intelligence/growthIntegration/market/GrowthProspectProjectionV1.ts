import type {
  CompanyStatus,
  InegiCompany,
} from '../../../market-intelligence/types/inegi';

export type GrowthProspectSignalKindV1 =
  | 'industry'
  | 'company_size'
  | 'operational_need'
  | 'business_problem'
  | 'required_capability'
  | 'declared_interest'
  | 'commercial_intent'
  | 'other';

export interface GrowthProspectContextRefV1 {
  readonly prospectId: string;
  readonly sourceAuthority: 'control_center';
  readonly sourceRef: string;
}

export interface GrowthProspectSignalV1 {
  readonly id: string;
  readonly kind: GrowthProspectSignalKindV1;
  readonly value: string;
  readonly status: 'confirmed' | 'inferred';
  readonly confidence: number;
  readonly sourceAuthority: 'control_center';
  readonly sourceRef: string;
}

export interface GrowthProspectContactV1 {
  readonly companyName: string;
  readonly legalName: string;
  readonly email: string;
  readonly phone: string;
  readonly website: string;
  readonly municipality: string;
  readonly state: string;
}

export interface GrowthProspectMarketMetadataV1 {
  readonly opportunityScore: number;
  readonly sourceScore: number;
  readonly priorityLevel:
    | 'CRITICAL'
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW'
    | null;
  readonly status: CompanyStatus;
}

export interface GrowthProspectProjectionV1 {
  readonly prospect: GrowthProspectContextRefV1;
  readonly contact: GrowthProspectContactV1;
  readonly signals: readonly GrowthProspectSignalV1[];
  readonly marketMetadata: GrowthProspectMarketMetadataV1;
}

function normalizedValue(
  value: string | null | undefined,
): string {
  return String(value ?? '').trim();
}

function createConfirmedSignal(
  prospectId: string,
  kind: GrowthProspectSignalKindV1,
  value: string,
): GrowthProspectSignalV1 {
  return {
    id: `${prospectId}:${kind}`,
    kind,
    value,
    status: 'confirmed',
    confidence: 1,
    sourceAuthority: 'control_center',
    sourceRef: prospectId,
  };
}

/**
 * Projects authoritative Control Center market facts into a
 * source-neutral Growth prospect representation.
 *
 * Important authority rules:
 *
 * - DENUE/INEGI remains owned by Control Center.
 * - Growth never becomes the source authority.
 * - Missing source facts remain missing.
 * - No RFC, revenue, payroll, technology stack, intent,
 *   commercial need, or other unsupported fact is fabricated.
 * - Market scores remain metadata and are not semantic evidence.
 */
export function projectInegiCompanyToGrowthProspectV1(
  company: InegiCompany,
): GrowthProspectProjectionV1 {
  const prospectId =
    normalizedValue(company.id);

  if (!prospectId) {
    throw new Error(
      'GROWTH_PROSPECT_SOURCE_ID_REQUIRED',
    );
  }

  const signals: GrowthProspectSignalV1[] = [];

  const industry =
    normalizedValue(company.sector);

  if (industry) {
    signals.push(
      createConfirmedSignal(
        prospectId,
        'industry',
        industry,
      ),
    );
  }

  const companySize =
    normalizedValue(company.rangoPersonal);

  if (companySize) {
    signals.push(
      createConfirmedSignal(
        prospectId,
        'company_size',
        companySize,
      ),
    );
  }

  /*
   * actividad is intentionally not converted into
   * business_problem, operational_need or commercial_intent.
   *
   * It describes the establishment's economic activity and is
   * not evidence that the prospect has a commercial need.
   *
   * motives, nextAction and scoring fields are also deliberately
   * excluded from semantic matching evidence because they are
   * Control Center commercial metadata rather than source facts
   * proving product fit.
   */

  return {
    prospect: {
      prospectId,
      sourceAuthority: 'control_center',
      sourceRef: prospectId,
    },

    contact: {
      companyName:
        normalizedValue(company.nombreComercial),
      legalName:
        normalizedValue(company.razonSocial),
      email:
        normalizedValue(company.email),
      phone:
        normalizedValue(company.telefono),
      website:
        normalizedValue(company.sitioWeb),
      municipality:
        normalizedValue(company.municipio),
      state:
        normalizedValue(company.estado),
    },

    signals,

    marketMetadata: {
      opportunityScore:
        Number.isFinite(company.opportunityScore)
          ? company.opportunityScore
          : 0,

      sourceScore:
        Number.isFinite(company.sourceScore)
          ? company.sourceScore
          : 0,

      priorityLevel:
        company.priorityLevel ?? null,

      status:
        company.status,
    },
  };
}

export default projectInegiCompanyToGrowthProspectV1;