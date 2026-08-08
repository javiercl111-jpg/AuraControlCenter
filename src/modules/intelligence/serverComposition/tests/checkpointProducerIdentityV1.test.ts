import { describe, expect, it } from 'vitest';

import {
  AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_ID,
  AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1,
  AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_VERSION,
} from '../checkpointProducerIdentityV1';

describe('checkpointProducerIdentityV1', () => {
  it('uses the canonical Aura Intelligence checkpoint producer id', () => {
    expect(AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_ID).toBe(
      'aura-intelligence-bootstrap-checkpoint',
    );
  });

  it('keeps producer version 1 stable', () => {
    expect(AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_VERSION).toBe('1');
  });

  it('exposes the canonical producer identity', () => {
    expect(AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1).toEqual({
      producerId: 'aura-intelligence-bootstrap-checkpoint',
      producerVersion: '1',
    });
  });

  it('keeps the canonical producer identity frozen', () => {
    expect(Object.isFrozen(AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1)).toBe(true);
  });

  it('keeps constants and canonical identity aligned', () => {
    expect(AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1.producerId).toBe(
      AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_ID,
    );
    expect(AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1.producerVersion).toBe(
      AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_VERSION,
    );
  });
});
