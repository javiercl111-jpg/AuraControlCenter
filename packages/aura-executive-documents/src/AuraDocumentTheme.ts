import { AuraDocumentTheme } from "./AuraDocumentTypes";
import { AURA_NAVY, AURA_CYAN, AURA_MAGENTA, TEXT_DARK, TEXT_MUTED, BORDER } from "./AuraDesignTokens";

export const defaultAuraTheme: AuraDocumentTheme = {
  primaryColor: AURA_NAVY,
  secondaryColor: AURA_CYAN,
  accentColor: AURA_MAGENTA,
  textColor: TEXT_DARK,
  mutedTextColor: TEXT_MUTED,
  borderColor: BORDER,
  backgroundColor: [255, 255, 255]
};
