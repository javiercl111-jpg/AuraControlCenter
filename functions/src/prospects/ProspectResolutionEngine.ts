import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { 
  PROSPECT_RESOLUTION_VERSION, 
  MatchClassification, 
  ProspectOrigin, 
  AcquisitionSource, 
  PlatformEvent, 
  PlatformLeadV2, 
  MergePayload, 
  ProspectResolutionOutput,
  LifecycleEventType
} from "./types";

const PUBLIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", 
  "live.com", "msn.com", "aol.com", "protonmail.com"
]);

export class ProspectResolutionEngine {
  private db: admin.firestore.Firestore;

  constructor() {
    this.db = admin.firestore();
  }

  // --- Normalization Helpers ---

  public static normalizeCompanyName(name: string): string {
    if (!name) return "";
    return name.toUpperCase()
      .replace(/[.,]/g, "")
      .replace(/\b(SA DE CV|S A DE C V|SAPI DE CV|S DE RL DE CV|S DE RL|SAB DE CV|SC|AC|INC|LLC|LTD)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  public static normalizeEmail(email: string): string {
    return (email || "").toLowerCase().trim();
  }

  public static extractDomain(email: string): string {
    const normalized = this.normalizeEmail(email);
    if (!normalized.includes("@")) return "";
    const domain = normalized.split("@")[1];
    return PUBLIC_DOMAINS.has(domain) ? "" : domain;
  }

  public static normalizePhone(phone: string): string {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
  }

  public static normalizeRfc(rfc: string): string {
    if (!rfc) return "";
    return rfc.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  }

  public static hashIdentity(value: string): string {
    if (!value) return "";
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  // --- Core Resolution ---

  public async resolveProspect(payload: MergePayload, transaction?: admin.firestore.Transaction): Promise<ProspectResolutionOutput> {
    if (transaction) {
      return this._resolveInternal(payload, transaction);
    } else {
      return this.db.runTransaction(async (t) => {
        return this._resolveInternal(payload, t);
      });
    }
  }

  private async _resolveInternal(payload: MergePayload, t: admin.firestore.Transaction): Promise<ProspectResolutionOutput> {
    const normCompany = ProspectResolutionEngine.normalizeCompanyName(payload.companyName || "");
    const normEmail = ProspectResolutionEngine.normalizeEmail(payload.email || "");
    const normDomain = ProspectResolutionEngine.extractDomain(normEmail);
    const normPhone = ProspectResolutionEngine.normalizePhone(payload.phone || "");
    const normRfc = ProspectResolutionEngine.normalizeRfc(payload.rfc || "");

    const hashes = {
      rfc: normRfc ? ProspectResolutionEngine.hashIdentity(normRfc) : null,
      email: normEmail ? ProspectResolutionEngine.hashIdentity(normEmail) : null,
      phone: normPhone ? ProspectResolutionEngine.hashIdentity(normPhone) : null,
      domain: normDomain ? ProspectResolutionEngine.hashIdentity(`DOMAIN_${normDomain}`) : null,
      name: normCompany ? ProspectResolutionEngine.hashIdentity(`NAME_${normCompany}`) : null
    };

    let matchedProspectId: string | null = null;
    let matchClassification: MatchClassification = MatchClassification.NEW_COMPANY;
    let matchScore = 0;
    let matchStrategy = "NO_MATCH";
    let matchedFields: string[] = [];
    let possibleDuplicateIds: string[] = [];

    // 1. Source Lead ID exact match
    if (payload.sourceLeadId) {
      const existingSnap = await t.get(this.db.collection("platform_leads").doc(payload.sourceLeadId));
      if (existingSnap.exists) {
        matchedProspectId = payload.sourceLeadId;
        matchClassification = MatchClassification.EXACT_MATCH;
        matchScore = 100;
        matchStrategy = "SOURCE_LEAD_ID";
        matchedFields.push("sourceLeadId");
      }
    }

    // 2. RFC Exact Match
    if (!matchedProspectId && hashes.rfc) {
      const rfcDocs = await t.get(this.db.collection("prospect_identity_index").where("normalizedHash", "==", hashes.rfc).limit(1));
      if (!rfcDocs.empty) {
        matchedProspectId = rfcDocs.docs[0].data().prospectId;
        matchClassification = MatchClassification.EXACT_MATCH;
        matchScore = 100;
        matchStrategy = "RFC_EXACT";
        matchedFields.push("rfc");
      }
    }

    // 3. Email Exact Match
    if (!matchedProspectId && hashes.email) {
      const emailDocs = await t.get(this.db.collection("prospect_identity_index").where("normalizedHash", "==", hashes.email).limit(1));
      if (!emailDocs.empty) {
        matchedProspectId = emailDocs.docs[0].data().prospectId;
        matchClassification = MatchClassification.EXACT_MATCH;
        matchScore = 100;
        matchStrategy = "EMAIL_EXACT";
        matchedFields.push("email");
      }
    }

    // 4. Phone + Normalized Company Match (HIGH_CONFIDENCE)
    if (!matchedProspectId && hashes.phone && hashes.name) {
      // Find by phone first
      const phoneDocs = await t.get(this.db.collection("prospect_identity_index").where("normalizedHash", "==", hashes.phone).limit(10));
      for (const docSnap of phoneDocs.docs) {
        const pId = docSnap.data().prospectId;
        const pSnap = await t.get(this.db.collection("platform_leads").doc(pId));
        if (pSnap.exists && pSnap.data()?.normalizedCompanyName === normCompany) {
          matchedProspectId = pId;
          matchClassification = MatchClassification.HIGH_CONFIDENCE;
          matchScore = 90;
          matchStrategy = "PHONE_AND_NAME";
          matchedFields.push("phone", "companyName");
          break;
        }
      }
    }

    // 5. Domain + Normalized Company (HIGH_CONFIDENCE)
    if (!matchedProspectId && hashes.domain && hashes.name) {
      const domainDocs = await t.get(this.db.collection("prospect_identity_index").where("normalizedHash", "==", hashes.domain).limit(10));
      for (const docSnap of domainDocs.docs) {
        const pId = docSnap.data().prospectId;
        const pSnap = await t.get(this.db.collection("platform_leads").doc(pId));
        if (pSnap.exists && pSnap.data()?.normalizedCompanyName === normCompany) {
          matchedProspectId = pId;
          matchClassification = MatchClassification.HIGH_CONFIDENCE;
          matchScore = 85;
          matchStrategy = "DOMAIN_AND_NAME";
          matchedFields.push("domain", "companyName");
          break;
        }
      }
    }

    // 6. Name + City (Skipping for now due to location complexity, moving to generic Name partial)
    
    // 7. Same Domain ONLY or Same Name ONLY (POSSIBLE_DUPLICATE)
    if (!matchedProspectId) {
      if (hashes.domain) {
        const domainDocs = await t.get(this.db.collection("prospect_identity_index").where("normalizedHash", "==", hashes.domain).limit(5));
        domainDocs.forEach(d => possibleDuplicateIds.push(d.data().prospectId));
      }
      if (hashes.name) {
        const nameDocs = await t.get(this.db.collection("prospect_identity_index").where("normalizedHash", "==", hashes.name).limit(5));
        nameDocs.forEach(d => {
          if (!possibleDuplicateIds.includes(d.data().prospectId)) possibleDuplicateIds.push(d.data().prospectId);
        });
      }

      if (possibleDuplicateIds.length > 0) {
        matchClassification = MatchClassification.POSSIBLE_DUPLICATE;
        matchScore = 40;
        matchStrategy = "PARTIAL_OR_DOMAIN_ONLY";
        matchedFields.push(hashes.domain ? "domain" : "companyName");
      }
    }

    const autoMergeAllowed = matchClassification === MatchClassification.EXACT_MATCH || matchClassification === MatchClassification.HIGH_CONFIDENCE;
    const manualReviewRequired = matchClassification === MatchClassification.POSSIBLE_DUPLICATE;
    const duplicateRisk = matchClassification === MatchClassification.POSSIBLE_DUPLICATE;

    const output: ProspectResolutionOutput = {
      matchClassification,
      matchScore,
      matchedProspectId: matchedProspectId || undefined,
      matchedFields,
      conflictingFields: [], // Populate during merge logic
      resolutionReason: `Resolved via ${matchStrategy}`,
      matchStrategy,
      autoMergeAllowed,
      manualReviewRequired,
      duplicateRisk,
      possibleDuplicateIds: possibleDuplicateIds.length > 0 ? possibleDuplicateIds : undefined,
      version: PROSPECT_RESOLUTION_VERSION
    };

    // Final Read Phase before any Writes
    let finalExistingSnap: admin.firestore.DocumentSnapshot | null = null;
    if (autoMergeAllowed && matchedProspectId) {
      finalExistingSnap = await t.get(this.db.collection("platform_leads").doc(matchedProspectId));
    }

    // Execute Write Phase (Strict separation of reads and writes)
    const normsObj = { normCompany, normEmail, normDomain, normPhone, normRfc };
    
    if (autoMergeAllowed && matchedProspectId && finalExistingSnap) {
      if (!finalExistingSnap.exists) {
        console.warn(`staleIdentityIndexDetected: prospectId ${matchedProspectId} not found. Falling back to Create.`);
        await this.executeCreate(payload, output, t, normsObj);
      } else {
        await this.executeMerge(matchedProspectId, finalExistingSnap, payload, output, t, normsObj);
      }
    } else {
      await this.executeCreate(payload, output, t, normsObj);
    }

    return output;
  }

  // --- Write Operations ---

  private async executeCreate(
    payload: MergePayload, 
    output: ProspectResolutionOutput, 
    t: admin.firestore.Transaction,
    norms: any
  ) {
    const prospectRef = this.db.collection("platform_leads").doc();
    const prospectId = prospectRef.id;
    output.matchedProspectId = prospectId; // Even if new, we return the generated ID

    const ownerStatus = payload.advisorId ? "ASSIGNED" : "UNASSIGNED";
    
    const prospectData: PlatformLeadV2 = {
      schemaVersion: 2,
      companyName: payload.companyName || "",
      contactName: payload.contactName || "",
      email: payload.email || "",
      phone: payload.phone || "",
      rfc: payload.rfc || "",
      website: payload.website || "",
      location: payload.location || "",
      
      normalizedCompanyName: norms.normCompany,
      normalizedEmail: norms.normEmail,
      normalizedDomain: norms.normDomain,
      normalizedPhone: norms.normPhone,
      rfcNormalized: norms.normRfc,
      
      resolutionStatus: output.manualReviewRequired ? "REVIEW_REQUIRED" : "RESOLVED",
      resolutionVersion: PROSPECT_RESOLUTION_VERSION,
      lastResolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      duplicateRisk: output.duplicateRisk,
      possibleDuplicateIds: output.possibleDuplicateIds || [],
      
      lifecycleStatus: "NEW",
      lifecycleVersion: "1.0",
      statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
      statusChangedBy: "SYSTEM",
      statusChangeReason: "Initial Resolution",
      lastContactAt: null,
      nextContactAt: null,
      lastResponseAt: null,
      contactAttemptsCount: 0,
      noResponseSince: null,
      nurtureUntil: null,
      archivedAt: null,
      reactivatedAt: null,
      
      currentStage: "NEW",
      
      originalAdvisorId: payload.advisorId || "UNASSIGNED",
      originalAdvisorUid: payload.advisorUid || "UNASSIGNED",
      originalAttributionSource: payload.acquisitionSource || AcquisitionSource.DIRECT,
      originalAttributedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      currentAdvisorId: payload.advisorId || "UNASSIGNED",
      currentAdvisorUid: payload.advisorUid || "UNASSIGNED",
      ownerUid: payload.advisorUid || "UNASSIGNED",
      ownerStatus,
      
      origin: payload.origin || ProspectOrigin.UNKNOWN,
      acquisitionSource: payload.acquisitionSource || AcquisitionSource.UNKNOWN,
      
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    t.set(prospectRef, prospectData);

    // Save Identity Indexes
    this.saveIdentityIndexes(prospectId, norms, t);

    // Emit Event
    this.emitEvent(prospectId, "PROSPECT_CREATED", "SYSTEM", "ProspectResolutionEngine", { matchStrategy: output.matchStrategy }, t, payload.linkId);
    
    if (output.duplicateRisk) {
      this.emitEvent(prospectId, "POSSIBLE_DUPLICATE_DETECTED", "SYSTEM", "ProspectResolutionEngine", { possibleDuplicates: output.possibleDuplicateIds }, t, payload.linkId);
    }
    
    if (ownerStatus === "UNASSIGNED") {
      this.emitEvent(prospectId, "UNASSIGNED_CREATED", "SYSTEM", "ProspectResolutionEngine", {}, t, payload.linkId);
    }
  }

  private async executeMerge(
    prospectId: string, 
    existingSnap: admin.firestore.DocumentSnapshot,
    payload: MergePayload, 
    output: ProspectResolutionOutput, 
    t: admin.firestore.Transaction,
    norms: any
  ) {
    const prospectRef = existingSnap.ref;
    const existing = existingSnap.data() as PlatformLeadV2;

    const updates: any = {
      resolutionStatus: "RESOLVED",
      resolutionVersion: PROSPECT_RESOLUTION_VERSION,
      lastResolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Field-level merge (simplistic: overwrite if empty, keep existing if present)
    // A robust version would track source priorities.
    if (!existing.phone && payload.phone) updates.phone = payload.phone;
    if (!existing.rfc && payload.rfc) updates.rfc = payload.rfc;
    if (!existing.website && payload.website) updates.website = payload.website;

    // Attribution Logic
    // NEVER overwrite originalAdvisorId
    if (payload.advisorId && payload.advisorId !== existing.originalAdvisorId && existing.originalAdvisorId !== "UNASSIGNED") {
      updates.attributionConflict = true;
      updates.conflictingAdvisorId = payload.advisorId;
      output.conflictingFields.push("advisorId");
      
      this.emitEvent(prospectId, "ADVISOR_ATTRIBUTION_CONFLICT", "SYSTEM", "ProspectResolutionEngine", {
        original: existing.originalAdvisorId,
        incoming: payload.advisorId
      }, t, payload.linkId);
    }

    t.update(prospectRef, updates);

    // Save missing indexes
    this.saveIdentityIndexes(prospectId, norms, t);

    this.emitEvent(prospectId, "PROSPECT_MERGED", "SYSTEM", "ProspectResolutionEngine", {
      matchStrategy: output.matchStrategy,
      fieldsMerged: Object.keys(updates)
    }, t, payload.linkId);
  }

  private saveIdentityIndexes(prospectId: string, norms: any, t: admin.firestore.Transaction) {
    const idxCollection = this.db.collection("prospect_identity_index");
    
    if (norms.normRfc) {
      const h = ProspectResolutionEngine.hashIdentity(norms.normRfc);
      t.set(idxCollection.doc(`rfc_${h}`), { prospectId, identityType: "RFC", normalizedHash: h, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    if (norms.normEmail) {
      const h = ProspectResolutionEngine.hashIdentity(norms.normEmail);
      t.set(idxCollection.doc(`email_${h}`), { prospectId, identityType: "EMAIL", normalizedHash: h, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    if (norms.normPhone) {
      const h = ProspectResolutionEngine.hashIdentity(norms.normPhone);
      t.set(idxCollection.doc(`phone_${h}`), { prospectId, identityType: "PHONE", normalizedHash: h, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    if (norms.normDomain) {
      const h = ProspectResolutionEngine.hashIdentity(`DOMAIN_${norms.normDomain}`);
      t.set(idxCollection.doc(`domain_${h}`), { prospectId, identityType: "DOMAIN_NAME", normalizedHash: h, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    if (norms.normCompany) {
      const h = ProspectResolutionEngine.hashIdentity(`NAME_${norms.normCompany}`);
      t.set(idxCollection.doc(`name_${h}`), { prospectId, identityType: "COMPANY_NAME", normalizedHash: h, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }

  private emitEvent(
    prospectId: string, 
    type: LifecycleEventType, 
    actorType: "SYSTEM" | "ADVISOR" | "PROSPECT", 
    source: string, 
    metadata: any, 
    t: admin.firestore.Transaction,
    linkId?: string
  ) {
    const eventRef = this.db.collection("platform_events").doc();
    const event: PlatformEvent = {
      eventId: eventRef.id,
      type,
      prospectId,
      linkId,
      actorType,
      source,
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    t.set(eventRef, event);
  }
}
