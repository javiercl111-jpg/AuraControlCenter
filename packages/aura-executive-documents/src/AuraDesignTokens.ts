export interface TypographyToken {
  fontFamily: string;
  fontStyle: "normal" | "bold" | "italic";
  fontSize: number;
  lineHeight: number; // multiplier
  tracking?: number; // extra letter spacing simulation
  color: readonly [number, number, number];
}

export const AURA_NAVY = [7, 20, 38] as const;
export const AURA_CYAN = [28, 210, 230] as const;
export const AURA_MAGENTA = [236, 72, 153] as const;
export const TEXT_DARK = [20, 30, 45] as const;
export const TEXT_MUTED = [95, 105, 120] as const;
export const BORDER = [220, 225, 235] as const;

export const AuraDesignTokens = {
  pageWidth: 210,
  pageHeight: 297,
  margin: {
    top: 25,
    right: 20,
    bottom: 25,
    left: 20
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 40
  },
  colors: {
    primary: AURA_NAVY,
    secondary: AURA_CYAN,
    accent: AURA_MAGENTA,
    textDark: TEXT_DARK,
    textMuted: TEXT_MUTED,
    border: BORDER,
    background: [255, 255, 255] as const,
    surface: [248, 250, 252] as const,
    success: [16, 185, 129] as const,
    warning: [245, 158, 11] as const,
    danger: [225, 29, 72] as const
  },
  typography: {
    displayTitle: {
      fontFamily: "helvetica",
      fontStyle: "bold",
      fontSize: 28,
      lineHeight: 1.2,
      color: [255, 255, 255]
    } as TypographyToken,
    sectionTitle: {
      fontFamily: "helvetica",
      fontStyle: "bold",
      fontSize: 16,
      lineHeight: 1.4,
      color: AURA_NAVY
    } as TypographyToken,
    subsectionTitle: {
      fontFamily: "helvetica",
      fontStyle: "bold",
      fontSize: 12,
      lineHeight: 1.4,
      color: TEXT_DARK
    } as TypographyToken,
    body: {
      fontFamily: "helvetica",
      fontStyle: "normal",
      fontSize: 10,
      lineHeight: 1.6,
      color: TEXT_DARK
    } as TypographyToken,
    bodyEmphasis: {
      fontFamily: "helvetica",
      fontStyle: "bold",
      fontSize: 10,
      lineHeight: 1.5,
      color: TEXT_DARK
    } as TypographyToken,
    metricLabel: {
      fontFamily: "helvetica",
      fontStyle: "bold",
      fontSize: 8,
      lineHeight: 1.4,
      color: TEXT_MUTED
    } as TypographyToken,
    footer: {
      fontFamily: "helvetica",
      fontStyle: "normal",
      fontSize: 8,
      lineHeight: 1.2,
      color: TEXT_MUTED
    } as TypographyToken
  }
};
