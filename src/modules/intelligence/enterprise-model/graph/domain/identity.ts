import type { RelationshipType } from './types';
import * as crypto from 'crypto';

export function generateDeterministicNodeId(type: string, label: string): string {
  const normalizedType = type.trim().toUpperCase();
  const normalizedLabel = label.trim().toLowerCase().replace(/\s+/g, '-');
  const payload = `${normalizedType}:${normalizedLabel}`;

  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

export function generateDeterministicRelationshipId(
  sourceId: string,
  targetId: string,
  type: RelationshipType
): string {
  const payload = `${sourceId}:${type}:${targetId}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

export default {
  generateDeterministicNodeId,
  generateDeterministicRelationshipId
};
