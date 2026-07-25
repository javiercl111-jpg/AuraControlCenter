import type { DossierExecutionContext } from '../domain/types';

export class DefaultDossierExecutionContext implements DossierExecutionContext {
  public executionId: string;
  public timestamp: string;

  constructor(executionId: string, timestamp: string) {
    this.executionId = executionId;
    this.timestamp = timestamp;
  }

  generateId(namespace: string, data: string): string {
    let hash = 5381;
    const str = `${this.executionId}:${namespace}:${data}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return `${namespace}_${(hash >>> 0).toString(16)}`;
  }
}

export default DefaultDossierExecutionContext;
