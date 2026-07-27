export class MetadataSanitizer {
  private static readonly MAX_KEY_LENGTH = 50;
  private static readonly MAX_VALUE_LENGTH = 200;
  private static readonly MAX_KEYS = 20;

  // Extremely strict allowlist of known safe keys (domain specific logic goes here or is injected)
  private static readonly SAFE_KEY_PATTERNS = [
    /^sourceId$/,
    /^scenario$/,
    /^device(Type|Id)$/,
    /^tenantId$/,
    /^appVersion$/,
    /^region$/
  ];

  public static sanitize(
    metadata: Record<string, unknown> | undefined,
    allowList?: string[]
  ): Record<string, string | number | boolean> | undefined {
    if (!metadata) return undefined;
    
    const result: Record<string, string | number | boolean> = {};
    let keyCount = 0;

    for (const [key, value] of Object.entries(metadata)) {
      if (keyCount >= this.MAX_KEYS) break;
      if (key.length > this.MAX_KEY_LENGTH) continue;

      const isSafeByKey = this.SAFE_KEY_PATTERNS.some(p => p.test(key)) || (allowList && allowList.includes(key));
      if (!isSafeByKey) continue;

      if (typeof value === 'string') {
        result[key] = value.substring(0, this.MAX_VALUE_LENGTH);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      }
      
      keyCount++;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }
}
