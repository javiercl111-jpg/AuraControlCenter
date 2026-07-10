import { jsPDF } from "jspdf";
import { ReportDesignSystem, TypographyToken } from "./ReportDesignSystem";

export class PdfLayoutEngine {
  private doc: jsPDF;
  private ds: ReportDesignSystem;
  public yPos: number;

  constructor(doc: jsPDF, ds: ReportDesignSystem) {
    this.doc = doc;
    this.ds = ds;
    this.yPos = ds.margin.top;
  }

  public ensureSpace(requiredSpace: number, headerCallback?: () => void) {
    if (this.yPos + requiredSpace > this.ds.pageHeight - this.ds.margin.bottom) {
      this.doc.addPage();
      this.yPos = this.ds.margin.top;
      if (headerCallback) headerCallback();
    }
  }

  public applyTypography(token: TypographyToken) {
    this.doc.setFont(token.fontFamily, token.fontStyle);
    this.doc.setFontSize(token.fontSize);
    
    // Fallback for color since it can be string or rgb
    let color: [number, number, number];
    if (token.color.startsWith("#")) {
      const h = token.color.replace("#", "");
      const r = parseInt(h.substring(0, 2), 16) || 0;
      const g = parseInt(h.substring(2, 4), 16) || 0;
      const b = parseInt(h.substring(4, 6), 16) || 0;
      color = [r, g, b];
    } else {
      // Assuming it's already converted in token if we passed rgb, 
      // but in ReportDesignSystem it's a string. We handle it here.
      color = [51, 65, 85]; // default textDark
    }
    
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  public applyColor(color: [number, number, number], type: "fill" | "draw" | "text" = "fill") {
    if (type === "fill") this.doc.setFillColor(color[0], color[1], color[2]);
    if (type === "draw") this.doc.setDrawColor(color[0], color[1], color[2]);
    if (type === "text") this.doc.setTextColor(color[0], color[1], color[2]);
  }

  public measureTextHeight(text: string | string[], token: TypographyToken, maxWidth: number): number {
    this.applyTypography(token);
    const lines = this.doc.splitTextToSize(text as any, maxWidth);
    // Rough estimation: fontSize in pt to mm is approx fontSize * 0.352778
    // Then multiply by lineHeight
    const singleLineHeight = token.fontSize * 0.352778 * token.lineHeight;
    return lines.length * singleLineHeight;
  }

  public drawText(text: string | string[], x: number, token: TypographyToken, options?: { maxWidth?: number, align?: "left" | "center" | "right" }): number {
    this.applyTypography(token);
    let lines = Array.isArray(text) ? text : [text];
    
    if (options?.maxWidth) {
      lines = this.doc.splitTextToSize(text as any, options.maxWidth);
    }

    const singleLineHeight = token.fontSize * 0.352778 * token.lineHeight;
    const tracking = token.tracking || 0;
    
    // Draw lines manually to support tracking if needed, though jsPDF charSpace is standard.
    if (tracking > 0) {
      // @ts-ignore
      this.doc.setCharSpace(tracking);
    } else {
      // @ts-ignore
      this.doc.setCharSpace(0);
    }

    // Adjust jsPDF standard baseline offset
    this.doc.text(lines, x, this.yPos + (token.fontSize * 0.352778), { align: options?.align || "left" });
    
    // @ts-ignore
    this.doc.setCharSpace(0); // reset

    const height = lines.length * singleLineHeight;
    this.yPos += height;
    return height;
  }

  public resetY() {
    this.yPos = this.ds.margin.top;
  }
}
