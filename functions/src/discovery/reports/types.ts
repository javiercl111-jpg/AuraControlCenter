export interface ExecutiveBrandingProfile {
  brandId: string;
  brandName: string;
  logoUrl: string;
  logoStoragePath?: string;
  localAssetKey?: string;
  
  primaryColor: string; // Hex e.g. #071426
  secondaryColor: string; // Hex e.g. #22d3ee
  accentColor: string; // Hex e.g. #6366f1
  surfaceColor: string;
  backgroundColor: string;
  
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  
  website: string;
  email: string;
  whatsapp: string;
  address?: string;
  
  footerText: string;
  confidentialityText: string;
  legalDisclaimer?: string;
  
  advisorPresentationEnabled: boolean;
  verificationEnabled: boolean;
  
  isActive: boolean;
  version: string;
  updatedAt: string | Date;
  updatedBy: string;
  effectiveFrom?: string | Date;
}

export type DeliveryLevel = "ALLOW_FULL" | "ALLOW_BASIC" | "BLOCK_ABUSE" | "REQUIRE_MANUAL_REVIEW" | "REQUIRE_EMAIL_VERIFICATION";
export type ReportStatus = "PENDING" | "GENERATING" | "READY" | "DELIVERED" | "DOWNLOAD_FAILED" | "EMAIL_SENT" | "EMAIL_FAILED" | "UNDER_REVIEW" | "REVOKED" | "ERROR";
export type ReportType = "EXTERNAL_RADIOGRAFIA" | "INTERNAL_BRIEFING";

export interface DiscoveryReportMetadata {
  reportId: string;
  prospectId: string;
  sessionId: string;
  advisorId?: string;
  ownerUid?: string;
  folio: string;
  reportType: ReportType;
  deliveryLevel: DeliveryLevel;
  status: ReportStatus;
  
  documentVersion: string;
  brandingVersion: string;
  
  storagePath: string;
  storageBucket?: string;
  
  generatedAt: string | Date;
  generatedBy: string; // usually "SYSTEM"
  
  readyAt?: string | Date;
  deliveredAt?: string | Date;
  sentAt?: string | Date;
  downloadedAt?: string | Date;
  emailDeliveryStatus?: string;
  checksum?: string;
  revokedAt?: string | Date;
  
  idempotencyKey: string; // sessionId + reportType + documentVersion
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ReportViewModel {
  reportId?: string;
  status: ReportStatus;
  deliveryLevel: DeliveryLevel;
  folio?: string;
  generatedAt?: string | Date;
  
  // Public facing payload
  companyName: string;
  contactName: string;
  advisor?: {
    displayName: string;
    title: string;
    email: string;
    phone: string;
    commercialCode?: string;
  };
  
  // Basic diagnostic summary
  maturityScore?: number;
  overallStatus?: string;
  keyFindings: string[];
  
  // Expanded diagnostic (only if ALLOW_FULL)
  operationalRisks?: string[];
  opportunities?: string[];
  roadmap?: string[];
  recommendedModules?: string[];
  
  downloadUrl?: string; // temporal signed URL
}
