import { describe, it, expect } from 'vitest';
import {
  sanitizeMetadata,
  sanitizePublicError,
  sanitizeResultSummary,
  sanitizeComparisonSummary,
} from '../sanitizers';
import { GovernedBoundaryError } from '../errors';

describe('Boundary Sanitizers', () => {
  it('removes sensitive keys from metadata', () => {
    const rawMetadata = {
      authorization: 'Bearer secret-token',
      password: 'mypassword',
      token: '12345',
      apiKey: 'xyz',
      env: 'production',
      tenantCode: 'ORG_1',
    };

    const sanitized = sanitizeMetadata(rawMetadata);
    expect(sanitized).toBeDefined();
    expect(sanitized?.authorization).toBeUndefined();
    expect(sanitized?.password).toBeUndefined();
    expect(sanitized?.token).toBeUndefined();
    expect(sanitized?.apiKey).toBeUndefined();
    expect(sanitized?.env).toBe('production');
    expect(sanitized?.tenantCode).toBe('ORG_1');
  });

  it('does not mutate original metadata object', () => {
    const rawMetadata = { authorization: 'secret', safeKey: 'value' };
    const sanitized = sanitizeMetadata(rawMetadata);

    expect(rawMetadata.authorization).toBe('secret');
    expect(sanitized?.authorization).toBeUndefined();
  });

  it('sanitizes public errors without leaking stacks or internal details', () => {
    const boundaryErr = new GovernedBoundaryError(
      'MODE_NOT_ALLOWED',
      'Mode is forbidden',
      false,
      { sensitiveField: 'secret', allowedMode: 'SHADOW_ONLY' }
    );

    const publicErr = sanitizePublicError(boundaryErr);
    expect(publicErr.code).toBe('MODE_NOT_ALLOWED');
    expect(publicErr.message).toBe('Mode is forbidden');
    expect(publicErr.retryable).toBe(false);
    expect(publicErr.details?.allowedMode).toBe('SHADOW_ONLY');
    expect(publicErr.details?.sensitiveField).toBe('secret'); // Only sensitive keys filtered, safe strings kept
    expect((publicErr as unknown as Record<string, unknown>).stack).toBeUndefined();
  });

  it('converts unknown thrown errors into generic EXECUTION_FAILED errors', () => {
    const rawError = new Error('Database connection failed at /var/secret/db.config');
    const publicErr = sanitizePublicError(rawError);

    expect(publicErr.code).toBe('EXECUTION_FAILED');
    expect(publicErr.message).toBe('An internal execution error occurred');
    expect((publicErr as unknown as Record<string, unknown>).stack).toBeUndefined();
  });

  it('creates result summary using explicit allowlist without reference sharing', () => {
    const internalResult = {
      executionId: 'exec-123',
      sessionId: 'sess-456',
      status: 'SUCCEEDED',
      durationMs: 120,
      privateState: { secret: 'data' },
    };

    const summary = sanitizeResultSummary(internalResult);
    expect(summary).toEqual({
      executionId: 'exec-123',
      sessionId: 'sess-456',
      status: 'SUCCEEDED',
      durationMs: 120,
    });
    expect(summary?.privateState).toBeUndefined();
  });

  it('creates comparison summary using allowlist', () => {
    const compResult = {
      match: false,
      divergenceCount: 2,
      divergences: ['field_mismatch'],
      privateInternalLog: 'log',
    };

    const summary = sanitizeComparisonSummary(compResult);
    expect(summary).toEqual({
      match: false,
      divergenceCount: 2,
      divergences: ['field_mismatch'],
    });
    expect(summary?.privateInternalLog).toBeUndefined();
  });
});

export default describe;
