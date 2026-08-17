import { describe, expect, it, vi } from 'vitest';

import {
  createGovernedGrowthCoreCompositionV1,
} from '../createGovernedGrowthCoreCompositionV1';

import {
  GrowthCoreRemoteAdapterV1,
} from '../GrowthCoreRemoteAdapterV1';

import type {
  BoundaryInvocationContextProviderV1,
  GovernedBoundaryExecutorV1,
} from '../GrowthBoundaryExecutionAdapterV1';

describe(
  'INTEL-GROWTH-01 — createGovernedGrowthCoreCompositionV1',
  () => {
    it('creates a Growth remote adapter over the injected governed Boundary', () => {
      const boundary: GovernedBoundaryExecutorV1 = {
        execute: vi.fn(),
      };

      const invocationContext:
        BoundaryInvocationContextProviderV1 = {
          create: vi.fn(),
        };

      const composition =
        createGovernedGrowthCoreCompositionV1({
          boundary,
          invocationContext,
        });

      expect(composition).toBeInstanceOf(
        GrowthCoreRemoteAdapterV1,
      );
    });

    it('does not execute the Boundary during composition', () => {
      const execute = vi.fn();

      createGovernedGrowthCoreCompositionV1({
        boundary: {
          execute,
        },
        invocationContext: {
          create: vi.fn(),
        },
      });

      expect(execute).not.toHaveBeenCalled();
    });

    it('does not create invocation authority during composition', () => {
      const create = vi.fn();

      createGovernedGrowthCoreCompositionV1({
        boundary: {
          execute: vi.fn(),
        },
        invocationContext: {
          create,
        },
      });

      expect(create).not.toHaveBeenCalled();
    });

    it('creates isolated adapter instances', () => {
      const dependencies = {
        boundary: {
          execute: vi.fn(),
        } as GovernedBoundaryExecutorV1,
        invocationContext: {
          create: vi.fn(),
        } as BoundaryInvocationContextProviderV1,
      };

      const first =
        createGovernedGrowthCoreCompositionV1(
          dependencies,
        );

      const second =
        createGovernedGrowthCoreCompositionV1(
          dependencies,
        );

      expect(first).not.toBe(second);
      expect(first).toBeInstanceOf(
        GrowthCoreRemoteAdapterV1,
      );
      expect(second).toBeInstanceOf(
        GrowthCoreRemoteAdapterV1,
      );
    });
  },
);
