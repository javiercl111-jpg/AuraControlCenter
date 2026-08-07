import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import type {
  AuthoritativeFeaturePolicyPort,
} from '../../os/boundary/ports';
import {
  InMemoryAuthoritativeFeaturePolicyProducer,
} from '../InMemoryAuthoritativeFeaturePolicyProducer';
import {
  AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1,
} from '../table';
import {
  TRUSTED_CONSUMER_REGISTRY_V1,
  TRUSTED_SOURCE_REGISTRY_V1,
} from '../../serverComposition/registry';

const producerPath = resolve(
  __dirname,
  '..',
  'InMemoryAuthoritativeFeaturePolicyProducer.ts'
);
const producerSource = readFileSync(producerPath, 'utf8');

describe('AI-02H1D.3 producer architecture', () => {
  it('34. implements the authoritative feature policy port', () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );
    const port: AuthoritativeFeaturePolicyPort = producer;

    expect(port.evaluateAuthoritativePolicy).toBe(
      producer.evaluateAuthoritativePolicy
    );
    expect(port.getEffectivePolicy).toBe(producer.getEffectivePolicy);
  });

  it('35. imports only local serverPolicy and Boundary contracts', () => {
    const imports = [
      ...producerSource.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ].map((match) => match[1]);

    expect(imports.length).toBeGreaterThan(0);
    expect(
      imports.every(
        (specifier) =>
          specifier?.startsWith('./') ||
          specifier?.startsWith('../os/boundary/')
      )
    ).toBe(true);
  });

  it('36. imports no Functions, Firebase, Discovery, React, or UI code', () => {
    expect(producerSource).not.toMatch(
      /functions|firebase|discovery|react|\/ui\//i
    );
  });

  it('37. uses no environment authority or nondeterministic generation', () => {
    expect(producerSource).not.toMatch(
      /process\.env|import\.meta\.env|Date\.now\s*\(|new\s+Date\s*\(\s*\)|Math\.random\s*\(|randomUUID\s*\(/
    );
  });

  it('38. performs no audit, logging, I/O, network, or timers', () => {
    expect(producerSource).not.toMatch(
      /Audit|console\.|from\s+['"](?:node:)?(?:fs|http|https|net|tls)|fetch\s*\(|setTimeout\s*\(|setInterval\s*\(/
    );
  });

  it('39. keeps its immutable index private and exports no mutable state', () => {
    expect(producerSource).toContain('readonly #snapshot');
    expect(producerSource).not.toMatch(
      /export\s+(?:const|let|var)\s+.*(?:Index|Map)/
    );
    expect(Object.keys(serverExports)).not.toContain(
      'AUTHORITATIVE_POLICY_ENTRY_INDEX'
    );
  });

  it('40. never invokes the legacy policy method internally', () => {
    expect(
      producerSource.match(/getEffectivePolicy/g)
    ).toHaveLength(1);
    expect(producerSource).not.toContain('this.getEffectivePolicy');
  });

  it('41. exports the producer and no internal index', () => {
    expect(
      serverExports.InMemoryAuthoritativeFeaturePolicyProducer
    ).toBe(InMemoryAuthoritativeFeaturePolicyProducer);
    expect(Object.keys(serverExports)).not.toContain(
      'AuthoritativePolicyEntryIndex'
    );
  });

  it('42. does not expand trusted registries', () => {
    expect(
      Object.keys(TRUSTED_CONSUMER_REGISTRY_V1.entries)
    ).toEqual(['INTELLIGENCE_OS_CONTRACT_TEST']);
    expect(
      Object.keys(TRUSTED_SOURCE_REGISTRY_V1.entries)
    ).toEqual(['TRUSTED_COMPOSITION_CONTRACT_TEST']);
  });

  it('43. retains one SHADOW_ONLY test policy and no productive consumer', () => {
    expect(AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1.entries).toHaveLength(
      1
    );
    expect(
      JSON.stringify(AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1)
    ).not.toMatch(/PRODUCTIVE|EVALUATION|DISCOVERY/);
  });
});
