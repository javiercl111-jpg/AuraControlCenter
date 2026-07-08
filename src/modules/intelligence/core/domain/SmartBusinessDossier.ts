import type { BusinessMemoryEvent } from "../types/memory";

export interface DossierProps {
  id: string;
  businessName: string;
  taxId?: string;
  industry: string;
  employeeCount: number;
  annualRevenues?: number;
  locationsCount?: number;
  criticalAssetsCount?: number;
  payrollSystem?: string;
  hasElectronicSignature?: boolean;
  hasTimeAndAttendance?: boolean;
  estimatedMrr?: number;
  estimatedArr?: number;
  healthScoreCS?: number;
  complianceRisks?: string[];
  interactions?: Array<{ date: string; type: string; summary: string }>;
  uploadedDocuments?: Array<{ name: string; type: string; uploadedAt: string }>;
  memories?: BusinessMemoryEvent[];
}

export class SmartBusinessDossier {
  public readonly id: string;
  public readonly businessName: string;
  public readonly taxId?: string;
  public readonly industry: string;
  public employeeCount: number;
  public annualRevenues?: number;
  public locationsCount: number;
  public criticalAssetsCount: number;
  public payrollSystem?: string;
  public hasElectronicSignature: boolean;
  public hasTimeAndAttendance: boolean;
  public estimatedMrr: number;
  public estimatedArr: number;
  public healthScoreCS: number;
  public complianceRisks: string[];
  public interactions: Array<{ date: string; type: string; summary: string }>;
  public uploadedDocuments: Array<{ name: string; type: string; uploadedAt: string }>;
  public memories: BusinessMemoryEvent[];

  constructor(props: DossierProps) {
    this.id = props.id;
    this.businessName = props.businessName;
    this.taxId = props.taxId;
    this.industry = props.industry;
    this.employeeCount = props.employeeCount;
    this.annualRevenues = props.annualRevenues;
    this.locationsCount = props.locationsCount ?? 1;
    this.criticalAssetsCount = props.criticalAssetsCount ?? 0;
    this.payrollSystem = props.payrollSystem;
    this.hasElectronicSignature = props.hasElectronicSignature ?? false;
    this.hasTimeAndAttendance = props.hasTimeAndAttendance ?? false;
    this.estimatedMrr = props.estimatedMrr ?? 0;
    this.estimatedArr = props.estimatedArr ?? (props.estimatedMrr ? props.estimatedMrr * 12 : 0);
    this.healthScoreCS = props.healthScoreCS ?? 100;
    this.complianceRisks = props.complianceRisks ?? [];
    this.interactions = props.interactions ?? [];
    this.uploadedDocuments = props.uploadedDocuments ?? [];
    this.memories = props.memories ?? [];
  }

  /**
   * Evaluates the size group bucket based on personnel count.
   */
  public get sizeGroup(): "0-5" | "6-30" | "31-100" | "101-250" | "250+" {
    const size = this.employeeCount;
    if (size <= 5) return "0-5";
    if (size <= 30) return "6-30";
    if (size <= 100) return "31-100";
    if (size <= 250) return "101-250";
    return "250+";
  }

  /**
   * Calculates completeness percentage of dossier data to determine context quality.
   */
  public getCompletenessScore(): number {
    const fields = [
      this.taxId,
      this.annualRevenues,
      this.payrollSystem,
      this.hasElectronicSignature,
      this.hasTimeAndAttendance,
      this.interactions.length > 0 ? true : null,
      this.uploadedDocuments.length > 0 ? true : null,
    ];
    const filledCount = fields.filter((f) => f !== null && f !== undefined && f !== false).length;
    // Base fields: id, businessName, industry, employeeCount, locationsCount are guaranteed
    const baseFieldsCount = 5;
    const totalFields = fields.length + baseFieldsCount;
    return Math.round(((filledCount + baseFieldsCount) / totalFields) * 100);
  }

  /**
   * Analyzes dossier state to identify immediate compliance gaps.
   */
  public getHRComplianceGaps(): string[] {
    const gaps: string[] = [];

    if (this.employeeCount > 10 && !this.hasTimeAndAttendance) {
      gaps.push("Lack of automated time-and-attendance tracking for >10 employees.");
    }
    if (this.employeeCount > 50 && !this.hasElectronicSignature) {
      gaps.push("Manual contract signatures in enterprise scale (>50 employees) poses legal overhead.");
    }
    if (!this.payrollSystem || this.payrollSystem.toLowerCase().trim() === "excel") {
      gaps.push("Payroll managed in spreadsheets or unsupported platform.");
    }
    if (this.employeeCount > 35 && (!this.payrollSystem || this.payrollSystem.toLowerCase() === "excel")) {
      gaps.push("Critical compliance risk: Large employee headcount without a professional payroll system.");
    }

    return [...gaps, ...this.complianceRisks];
  }

  /**
   * Evaluates operations and billing telemetry to identify potential churn or operational risk flags.
   */
  public getFinancialRiskIndicators(): string[] {
    const warnings: string[] = [];

    if (this.annualRevenues && this.annualRevenues < this.estimatedArr) {
      warnings.push("High Arr commitment relative to total declared revenues.");
    }
    if (this.healthScoreCS < 70) {
      warnings.push("CS Health Score is critical, potential churn risk.");
    }
    if (this.locationsCount > 3 && this.criticalAssetsCount === 0) {
      warnings.push("Multiple business locations operated without explicit critical assets recorded.");
    }

    return warnings;
  }

  /**
   * Classifies the overall digital processes maturity of the business.
   */
  public getDigitalMaturityLevel(): "Low" | "Medium" | "High" {
    let score = 0;
    if (this.hasElectronicSignature) score += 30;
    if (this.hasTimeAndAttendance) score += 30;
    if (this.payrollSystem && this.payrollSystem.toLowerCase() !== "excel") score += 40;

    if (score >= 90) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  }

  /**
   * Summarizes the dossier state for contextual injection into LLMs.
   */
  public summarizeState(): string {
    return `Smart Business Dossier for: ${this.businessName}
Industry: ${this.industry}
Size: ${this.employeeCount} employees (Segment ${this.sizeGroup})
Maturity: ${this.getDigitalMaturityLevel()} Digital Maturity (Completeness: ${this.getCompletenessScore()}%)
Payroll Status: ${this.payrollSystem || "Not specified"}
Locations: ${this.locationsCount} location(s), ${this.criticalAssetsCount} asset(s)
Status: CS Health: ${this.healthScoreCS}/100, Est. MRR: $${this.estimatedMrr}
Documents uploaded: ${this.uploadedDocuments.map((d) => d.name).join(", ") || "None"}
Compliance Gaps Count: ${this.getHRComplianceGaps().length}`;
  }

  /**
   * Adds an interaction log.
   */
  public addInteraction(type: string, summary: string): void {
    this.interactions.push({
      date: new Date().toISOString().split("T")[0],
      type,
      summary,
    });
  }

  /**
   * Record uploaded document.
   */
  public addDocument(name: string, type: string): void {
    this.uploadedDocuments.push({
      name,
      type,
      uploadedAt: new Date().toISOString(),
    });
  }

  /**
   * Exports the entire snapshot payload.
   */
  public exportState(): DossierProps {
    return {
      id: this.id,
      businessName: this.businessName,
      taxId: this.taxId,
      industry: this.industry,
      employeeCount: this.employeeCount,
      annualRevenues: this.annualRevenues,
      locationsCount: this.locationsCount,
      criticalAssetsCount: this.criticalAssetsCount,
      payrollSystem: this.payrollSystem,
      hasElectronicSignature: this.hasElectronicSignature,
      hasTimeAndAttendance: this.hasTimeAndAttendance,
      estimatedMrr: this.estimatedMrr,
      estimatedArr: this.estimatedArr,
      healthScoreCS: this.healthScoreCS,
      complianceRisks: [...this.complianceRisks],
      interactions: [...this.interactions],
      uploadedDocuments: [...this.uploadedDocuments],
      memories: [...this.memories],
    };
  }

  /**
   * Adds a new event record directly into the dossier's historical timeline.
   */
  public addMemory(event: BusinessMemoryEvent): void {
    this.memories.push(event);
  }

  /**
   * Returns the sorted chronology of memory events for this specific business.
   */
  public getTimeline(): BusinessMemoryEvent[] {
    return [...this.memories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Returns the most recent commercial action event (proposal, sales pitch, objection, followup).
   */
  public getLastCommercialInteraction(): BusinessMemoryEvent | null {
    const commTypes: string[] = [
      "PROSPECT_CREATED",
      "PROPOSAL_GENERATED",
      "PROPOSAL_SENT",
      "OBJECTION_RECORDED",
      "FOLLOW_UP_SCHEDULED",
    ];
    const sorted = this.getTimeline();
    return sorted.find((e) => commTypes.includes(e.type)) || null;
  }

  /**
   * Evaluates active, unaddressed risks from memory (e.g. objections, renewal risk).
   */
  public getOpenRisks(): BusinessMemoryEvent[] {
    return this.memories.filter(
      (e) => (e.type === "OBJECTION_RECORDED" || e.type === "RENEWAL_RISK") && e.importance === "CRITICAL" || e.importance === "HIGH"
    );
  }

  /**
   * Recommends a strategic Next Best Action derived dynamically from historical memory context.
   */
  public getNextBestActionFromMemory(): string {
    const lastComm = this.getLastCommercialInteraction();
    if (!lastComm) {
      return "Establecer contacto inicial para levantar diagnóstico de procesos.";
    }

    if (lastComm.type === "OBJECTION_RECORDED") {
      const target = lastComm.metadata?.targetProduct || "Aura HCM";
      return `Presentar propuesta formal adaptada para: ${target}. Abordar objeción: "${lastComm.description}".`;
    }

    if (lastComm.type === "FOLLOW_UP_SCHEDULED") {
      return `Realizar llamada de seguimiento agendada: "${lastComm.title}".`;
    }

    if (lastComm.type === "PROPOSAL_SENT") {
      return "Confirmar recepción de propuesta comercial y agendar sesión de negociación.";
    }

    return "Realizar sesión periódica de revisión ejecutiva.";
  }
}

export default SmartBusinessDossier;
