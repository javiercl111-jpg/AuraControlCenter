import type { EnterpriseTransformationAssessment } from '../domain/types';

export class AssessmentSerializer {
  public serialize(assessment: EnterpriseTransformationAssessment): string {
    return this.deterministicStringify(assessment);
  }

  private deterministicStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      const arrData = obj.map(item => JSON.parse(this.deterministicStringify(item)));
      return JSON.stringify(arrData);
    }

    const recordObj = obj as Record<string, unknown>;
    const keys = Object.keys(recordObj).sort();
    const sortedObj: Record<string, unknown> = {};

    for (const key of keys) {
      if (recordObj[key] !== undefined) {
        sortedObj[key] = JSON.parse(this.deterministicStringify(recordObj[key]));
      }
    }

    return JSON.stringify(sortedObj);
  }
}
