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

    // Track bounds
    const doc = this.doc;
    const align = options?.align || "left";
    const fontSize = typography.fontSize;
    const lineHeight = typography.lineHeight || 1.2;
    const lines = Array.isArray(text) ? text : [text];
    
    const lineH = fontSize * 0.352778 * lineHeight;
    const totalHeight = lines.length * lineH;
    
    let maxW = 0;
    lines.forEach(l => {
      const w = doc.getTextWidth(l);
      if (w > maxW) maxW = w;
    });
    
    let x1 = x;
    let x2 = x + maxW;
    if (align === "center") {
      x1 = x - (maxW / 2);
      x2 = x + (maxW / 2);
    } else if (align === "right") {
      x1 = x - maxW;
      x2 = x;
    }
    
    const y1 = this.yPos - (fontSize * 0.352778);
    const y2 = this.yPos + totalHeight;
    
    if (!(doc as any).drawnBounds) {
      (doc as any).drawnBounds = [];
    }
    (doc as any).drawnBounds.push({
      text: lines.join(" | "),
      x1,
      y1,
      x2,
      y2,
      page: (doc.internal as any).getCurrentPageInfo().pageNumber,
      fontSize
    });
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

export function validatePdfBounds(doc: jsPDF) {
  const boundsList = (doc as any).drawnBounds || [];
  
  for (const bounds of boundsList) {
    const { text, x1, y1, x2, y2, page } = bounds;
    
    let safeLeft = 20;
    let safeRight = 190;
    let safeTop = 16;
    let safeBottom = 276;
    
    if (page === 1) {
      safeLeft = 12; // must clear the Cyan/Magenta lines at 0-11
      safeRight = 198;
      safeTop = 12;
      safeBottom = 285;
    }
    
    const marginOfError = 0.1;
    
    if (x1 < safeLeft - marginOfError) {
      throw new Error(`[BOUNDS VIOLATION] Page ${page}: Left bound exceeded for text "${text.substring(0, 30)}...". x1=${x1.toFixed(2)}, safeLeft=${safeLeft}`);
    }
    if (x2 > safeRight + marginOfError) {
      throw new Error(`[BOUNDS VIOLATION] Page ${page}: Right bound exceeded for text "${text.substring(0, 30)}...". x2=${x2.toFixed(2)}, safeRight=${safeRight}`);
    }
    if (y1 < safeTop - marginOfError) {
      throw new Error(`[BOUNDS VIOLATION] Page ${page}: Top bound exceeded for text "${text.substring(0, 30)}...". y1=${y1.toFixed(2)}, safeTop=${safeTop}`);
    }
    if (y2 > safeBottom + marginOfError) {
      throw new Error(`[BOUNDS VIOLATION] Page ${page}: Bottom bound exceeded for text "${text.substring(0, 30)}...". y2=${y2.toFixed(2)}, safeBottom=${safeBottom}`);
    }
  }
}
