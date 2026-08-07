import { describe, expect, it } from 'vitest';

import {
  createIntelligenceExecutionCompositionV1,
} from '../createIntelligenceExecutionCompositionV1';

describe('createIntelligenceExecutionCompositionV1', () => {
  it('creates a frozen execution composition', () => {
    const composition =
      createIntelligenceExecutionCompositionV1();

    expect(Object.isFrozen(composition)).toBe(true);
  });

  it('provides a production execution adapter', () => {
    const composition =
      createIntelligenceExecutionCompositionV1();

    expect(composition.executionAdapter).toBeDefined();

    expect(
      typeof composition.executionAdapter.execute,
    ).toBe('function');
  });

  it('creates isolated composition instances', () => {
    const first =
      createIntelligenceExecutionCompositionV1();

    const second =
      createIntelligenceExecutionCompositionV1();

    expect(first).not.toBe(second);

    expect(first.executionAdapter).not.toBe(
      second.executionAdapter,
    );
  });
});
