import { describe, expect, it } from 'vitest';

import {
  PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
  PIPELINE_BOOTSTRAP_SCENARIO_IDS,
  PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS,
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
} from '../types';

const GROWTH_DOMAINS = [
  'growth_strategy',
  'commercial_performance',
  'campaigns',
  'opportunities',
] as const;

const LEGACY_DOMAINS = [
  'organization',
  'payroll',
  'compensation',
  'benefits',
  'compliance',
  'talent_performance',
  'time_attendance',
  'workforce_analytics',
] as const;

describe('INTEL-GROWTH-01 — Growth Intelligence Scenario V1', () => {
  it('registers GROWTH_INTELLIGENCE as a canonical scenario', () => {
    expect(PIPELINE_BOOTSTRAP_SCENARIO_IDS).toContain(
      'GROWTH_INTELLIGENCE',
    );
  });

  it('registers the canonical Growth objective key', () => {
    expect(
      (PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS as Record<string, string>)
        .GROWTH_INTELLIGENCE,
    ).toBe('ASSESS_GROWTH_INTELLIGENCE');
  });

  it('registers the canonical Growth scenario descriptor', () => {
    const descriptor = (
      PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY as Record<
        string,
        {
          scenarioId: string;
          version: string;
          description: string;
          objectiveKey: string;
          allowedStages: readonly string[];
          requiredStages: readonly string[];
          includedDomains: readonly string[];
          excludedDomains: readonly string[];
        }
      >
    ).GROWTH_INTELLIGENCE;

    expect(descriptor).toBeDefined();
    expect(descriptor.scenarioId).toBe('GROWTH_INTELLIGENCE');
    expect(descriptor.version).toBe('1');
    expect(descriptor.objectiveKey).toBe(
      'ASSESS_GROWTH_INTELLIGENCE',
    );
  });

  it('owns exactly the four Growth coverage domains', () => {
    const descriptor = (
      PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY as Record<
        string,
        {
          includedDomains: readonly string[];
          excludedDomains: readonly string[];
        }
      >
    ).GROWTH_INTELLIGENCE;

    expect(descriptor.includedDomains).toEqual(GROWTH_DOMAINS);
    expect(descriptor.excludedDomains).toEqual(LEGACY_DOMAINS);
  });

  it('uses the canonical requestable stage vocabulary', () => {
    const descriptor = (
      PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY as Record<
        string,
        {
          allowedStages: readonly string[];
        }
      >
    ).GROWTH_INTELLIGENCE;

    expect(descriptor.allowedStages).toEqual(
      PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
    );
  });

  it('keeps Growth and legacy coverage domains disjoint', () => {
    const overlap = GROWTH_DOMAINS.filter((domain) =>
      (LEGACY_DOMAINS as readonly string[]).includes(domain),
    );

    expect(overlap).toEqual([]);
  });
});
