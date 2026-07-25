import type {
  AssessmentExecutionContext,
  IDGenerationContext
} from '../domain/types';
import * as crypto from 'crypto';

export class AssessmentContextBuilder {
  private executionId: string;
  private policyVersion: string;
  private timestamp: string;

  constructor(executionId: string, policyVersion: string, timestamp: string) {
    this.executionId = executionId;
    this.policyVersion = policyVersion;
    this.timestamp = timestamp;
  }

  public build(): AssessmentExecutionContext {
    return {
      executionId: this.executionId,
      timestamp: this.timestamp,
      policyVersion: this.policyVersion,
      generateDeterministicId: this.generateDeterministicId.bind(this)
    };
  }

  private generateDeterministicId(context: IDGenerationContext): string {
    const sortedReferences = [...context.references].sort();
    
    const payload = JSON.stringify({
      executionId: context.executionId,
      policyVersion: context.policyVersion,
      references: sortedReferences,
      content: context.content
    });
    
    return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
  }
}
