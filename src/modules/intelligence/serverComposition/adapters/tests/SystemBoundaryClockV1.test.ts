import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SystemBoundaryClockV1 } from '../SystemBoundaryClockV1';
import type { BoundaryClockPort } from '../../../os/boundary/ports';

describe('AEA-05-R1B.1 SystemBoundaryClockV1', () => {
  let clock: BoundaryClockPort;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = new SystemBoundaryClockV1();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. implements BoundaryClockPort and returns string', () => {
    const timeString = clock.now();
    expect(typeof timeString).toBe('string');
  });

  it('2. returns valid ISO string representing current time', () => {
    const mockDate = new Date('2026-08-01T12:00:00.000Z');
    vi.setSystemTime(mockDate);
    expect(clock.now()).toBe('2026-08-01T12:00:00.000Z');
  });

  it('3. successive calls return updated time', () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    const time1 = clock.now();
    expect(time1).toBe('2026-08-01T12:00:00.000Z');

    vi.setSystemTime(new Date('2026-08-01T12:00:05.000Z'));
    const time2 = clock.now();
    expect(time2).toBe('2026-08-01T12:00:05.000Z');
  });

  it('4. stateless and deterministic when environment is mocked', () => {
    const clock2 = new SystemBoundaryClockV1();
    vi.setSystemTime(new Date('2026-08-01T12:00:10.000Z'));
    expect(clock.now()).toBe(clock2.now());
  });
});
