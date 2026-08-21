import { describe, expect, it } from 'vitest';

import type { InegiCompany } from '../../../../market-intelligence/types/inegi';

import {
  projectInegiCompanyToGrowthProspectV1,
} from '../GrowthProspectProjectionV1';

function createCompany(
  overrides: Partial<InegiCompany> = {},
): InegiCompany {
  return {
    id: 'inegi_empresa_demo_monterrey_541110',
    razonSocial: 'EMPRESA DEMO SA DE CV',
    nombreComercial: 'Empresa Demo',
    sector: 'Servicios profesionales',
    tamano: 'Mediana',
    rangoPersonal: '31 a 50 personas',
    telefono: '8112345678',
    email: 'contacto@empresa-demo.mx',
    sitioWeb: 'https://empresa-demo.mx',
    direccion: 'Av. Demo 100',
    municipio: 'Monterrey',
    estado: 'Nuevo LeÃ³n',
    cp: '64000',
    scian: '541110',
    actividad: 'Servicios profesionales',
    latitud: 25.6866,
    longitud: -100.3161,
    altaDenue: '2024-01',
    sourceScore: 20,
    opportunityScore: 82,
    scoreBreakdown: {
      total: 82,
      sourceScore: 20,
      companySizeScore: 17,
      sectorScore: 18,
      reachabilityScore: 27,
    },
    recommendedSuites: ['People Suite'],
    status: 'QUALIFIED',
    priorityLevel: 'HIGH',
    motives: ['Alta afinidad comercial'],
    nextAction: 'Contactar al prospecto',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe(
  'GROWTH-PRODUCT-01 | GrowthProspectProjectionV1',
  () => {
    it(
      'projects DENUE authority without transferring source ownership to Growth',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany(),
          );

        expect(result.prospect.prospectId).toBe(
          'inegi_empresa_demo_monterrey_541110',
        );

        expect(result.prospect.sourceAuthority).toBe(
          'control_center',
        );

        expect(result.prospect.sourceRef).toBe(
          'inegi_empresa_demo_monterrey_541110',
        );
      },
    );

    it(
      'uses only supplied DENUE facts and never fabricates missing commercial facts',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany({
              telefono: '',
              email: '',
              sitioWeb: '',
            }),
          );

        expect(
          result.signals.some(
            (signal) =>
              signal.kind === 'declared_interest',
          ),
        ).toBe(false);

        expect(
          JSON.stringify(result),
        ).not.toMatch(
          /RFC-|annualRevenue|estimatedRevenue|payrollSystem|MOCK\/DEMO/i,
        );
      },
    );

    it(
      'projects industry as confirmed evidence',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany(),
          );

        const industry =
          result.signals.find(
            (signal) =>
              signal.kind === 'industry',
          );

        expect(industry).toEqual({
          id:
            'inegi_empresa_demo_monterrey_541110:industry',
          kind: 'industry',
          value: 'Servicios profesionales',
          status: 'confirmed',
          confidence: 1,
          sourceAuthority: 'control_center',
          sourceRef:
            'inegi_empresa_demo_monterrey_541110',
        });
      },
    );

    it(
      'projects company size only from the supplied DENUE personnel range',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany(),
          );

        const size =
          result.signals.find(
            (signal) =>
              signal.kind === 'company_size',
          );

        expect(size?.value).toBe(
          '31 a 50 personas',
        );

        expect(size?.status).toBe(
          'confirmed',
        );
      },
    );

    it(
      'does not invent signals when DENUE fields are empty',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany({
              sector: '',
              rangoPersonal: '',
              actividad: '',
              motives: [],
              nextAction: '',
            }),
          );

        expect(result.signals).toEqual([]);
      },
    );

    it(
      'preserves prospect identity and contact facts without converting them into matching evidence',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany(),
          );

        expect(result.contact).toEqual({
          companyName: 'Empresa Demo',
          legalName: 'EMPRESA DEMO SA DE CV',
          email: 'contacto@empresa-demo.mx',
          phone: '8112345678',
          website: 'https://empresa-demo.mx',
          municipality: 'Monterrey',
          state: 'Nuevo LeÃ³n',
        });

        expect(
          result.signals.some(
            (signal) =>
              signal.value ===
              'contacto@empresa-demo.mx',
          ),
        ).toBe(false);
      },
    );

    it(
      'keeps score metadata informational and out of semantic matching evidence',
      () => {
        const result =
          projectInegiCompanyToGrowthProspectV1(
            createCompany(),
          );

        expect(result.marketMetadata).toEqual({
          opportunityScore: 82,
          sourceScore: 20,
          priorityLevel: 'HIGH',
          status: 'QUALIFIED',
        });

        expect(
          result.signals.some(
            (signal) =>
              signal.value === '82' ||
              signal.value === '20',
          ),
        ).toBe(false);
      },
    );
  },
);
