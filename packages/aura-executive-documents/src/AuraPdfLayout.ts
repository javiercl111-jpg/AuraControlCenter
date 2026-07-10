import { jsPDF } from "jspdf";
import { AuraDesignTokens, TypographyToken } from "./AuraDesignTokens";

export class AuraPdfLayout {
  public yPos: number;
  private doc: jsPDF;

  constructor(doc: jsPDF) {
    this.doc = doc;
    this.yPos = AuraDesignTokens.margin.top;
  }

  public resetY(y: number = AuraDesignTokens.margin.top) {
    this.yPos = y;
  }

  public applyTypography(typography: TypographyToken) {
    this.doc.setFont(typography.fontFamily, typography.fontStyle);
    this.doc.setFontSize(typography.fontSize);
    this.doc.setTextColor(typography.color[0], typography.color[1], typography.color[2]);
    if (typography.tracking) {
      // @ts-ignore
      this.doc.setCharSpace(typography.tracking);
    } else {
      // @ts-ignore
      this.doc.setCharSpace(0);
    }
  }

  public drawText(text: string | string[], x: number, typography: TypographyToken, options?: any) {
    this.applyTypography(typography);
    this.doc.text(text, x, this.yPos, options);
  }

  public ensureSpace(requiredSpace: number, headerCallback: () => void) {
    const spaceLeft = AuraDesignTokens.pageHeight - AuraDesignTokens.margin.bottom - this.yPos;
    if (spaceLeft < requiredSpace) {
      this.doc.addPage();
      this.resetY();
      headerCallback();
      this.yPos += AuraDesignTokens.spacing.xl;
    }
  }
}
