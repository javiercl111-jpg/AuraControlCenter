export interface AuraDocumentAssets {
  logoDataUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  fallbackBrandText: string;
}

export interface AuraDocumentTheme {
  primaryColor: readonly [number, number, number];
  secondaryColor: readonly [number, number, number];
  accentColor: readonly [number, number, number];
  textColor: readonly [number, number, number];
  mutedTextColor: readonly [number, number, number];
  borderColor: readonly [number, number, number];
  backgroundColor: readonly [number, number, number];
}
