import * as fs from "fs";
import * as path from "path";

const PROJECT_ID = "aura-control-center-debb3";

function getAccessToken(): string | null {
  const p = path.join("C:", "Users", "javie", ".config", "configstore", "firebase-tools.json");
  if (fs.existsSync(p)) {
    try {
      const content = JSON.parse(fs.readFileSync(p, "utf8"));
      return content.tokens?.access_token || null;
    } catch (err) {
      console.error("Error reading firebase-tools.json:", err);
    }
  }
  return null;
}

const CANONICAL_EMAIL = "jcuellar@aurahcm.com";
const CANONICAL_UID = "dtlZU17EdObkRyLwLwL7dXfWaDo2"; // Confirmed Auth UID for jcuellar@aurahcm.com

const LEGACY_EMAILS = ["jcuellar@aura-hcm.com", "javier.cl111@gmail.com"];
const LEGACY_DOC_IDS = ["jcuellar@aura-hcm.com", "jcuellar@aurahcm.com", "dnD83EuDH5LGQeSRw8Ro"];

const LEGACY_AUTH_EMAIL = "jcuellar@aura-hcm.com";
const LEGACY_AUTH_UID = "pLtKOSklmlZaJIvXlqxSCNknArG3";

const RODOLFO_EMAIL = "rcuellar@aurahcm.com";
const RODOLFO_ADVISOR_ID = "0aiLjUZf1YPq9UuNxFPy";

// Firestore REST parser/formatter helpers
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "number") return { integerValue: val.toString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields: any = {};
    for (const k in val) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const k in obj) {
    fields[k] = toFirestoreValue(obj[k]);
  }
  return { fields };
}

function fromFirestoreValue(f: any): any {
  if (!f) return null;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.integerValue !== undefined) return parseInt(f.integerValue, 10);
  if (f.doubleValue !== undefined) return parseFloat(f.doubleValue);
  if (f.timestampValue !== undefined) return f.timestampValue;
  if (f.nullValue !== undefined) return null;
  if (f.arrayValue !== undefined) return (f.arrayValue.values || []).map(fromFirestoreValue);
  if (f.mapValue !== undefined) {
    const res: any = {};
    for (const k in f.mapValue.fields) {
      res[k] = fromFirestoreValue(f.mapValue.fields[k]);
    }
    return res;
  }
  return null;
}

function fromFirestoreDoc(doc: any): any {
  const name = doc.name.split("/").pop();
  const res: any = { id: name };
  for (const k in doc.fields) {
    res[k] = fromFirestoreValue(doc.fields[k]);
  }
  return res;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");

  console.log("======================================================================");
  console.log(" AURA PLATFORM IDENTITY REMEDIATION ENGINE (REST)");
  console.log(` MODE: ${isApply ? "=== APPLY (WRITING TO PRODUCTION) ===" : "=== DRY-RUN (READ-ONLY) ==="}`);
  console.log("======================================================================\n");

  const accessToken = getAccessToken();
  if (!accessToken) {
    console.error("[ERROR] No se pudo recuperar el token de acceso de firebase-tools. Inicia sesión con: firebase login");
    process.exit(1);
  }

  const authHeader = `Bearer ${accessToken}`;

  async function fetchREST(url: string, method = "GET", body: any = null) {
    const options: any = {
      method,
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} al llamar ${url}: ${errText}`);
    }
    return res.json();
  }

  try {
    // ----------------------------------------------------------------
    // 1. AUDIT & VALIDATION PHASE
    // ----------------------------------------------------------------
    console.log("[FASE 1] Cargando datos y realizando validaciones de seguridad...");

    // Validate Javier's Canonical Auth User
    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`;
    let canonicalAuthUser: any = null;
    try {
      const result = await fetchREST(lookupUrl, "POST", { localId: [CANONICAL_UID] });
      canonicalAuthUser = result.users?.[0];
      if (!canonicalAuthUser) {
        throw new Error(`No se encontró el usuario en Auth con el UID canónico: ${CANONICAL_UID}`);
      }
      if (canonicalAuthUser.email !== CANONICAL_EMAIL) {
        throw new Error(`Mala asociación: El UID ${CANONICAL_UID} corresponde a ${canonicalAuthUser.email}, no a ${CANONICAL_EMAIL}`);
      }
      console.log(`[OK] Cuenta Auth Canónica de Javier encontrada: ${CANONICAL_EMAIL} (UID: ${CANONICAL_UID})`);
    } catch (err: any) {
      console.error(`[ERROR] No se pudo verificar la cuenta Auth Canónica de Javier:`, err.message);
      process.exit(1);
    }

    // Validate Javier's Legacy Auth User
    let legacyAuthUser: any = null;
    try {
      const result = await fetchREST(lookupUrl, "POST", { localId: [LEGACY_AUTH_UID] });
      legacyAuthUser = result.users?.[0];
      if (legacyAuthUser) {
        console.log(`[OK] Cuenta Auth heredada de Javier encontrada: ${legacyAuthUser.email} (UID: ${LEGACY_AUTH_UID})`);
      } else {
        console.warn(`[WARN] Cuenta Auth heredada de Javier no existe o no fue devuelta: UID ${LEGACY_AUTH_UID}`);
      }
    } catch (err: any) {
      console.error("[ERROR] Fallo al buscar cuenta Auth heredada de Javier:", err.message);
      process.exit(1);
    }

    // Validate Legacy documents in platform_global_admins
    const legacyDocsInfo: Array<{ id: string; exists: boolean; data?: any; createTime?: string }> = [];
    let earliestCreatedAt: string | null = null;

    for (const docId of LEGACY_DOC_IDS) {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_global_admins/${docId}`;
      try {
        const rawDoc = await fetchREST(docUrl);
        const data = fromFirestoreDoc(rawDoc);
        legacyDocsInfo.push({ id: docId, exists: true, data, createTime: rawDoc.createTime });
        console.log(`[OK] Documento administrativo heredado encontrado: platform_global_admins/${docId} (Role actual: ${data.role || data.platformRole}, isActive original: ${data.isActive})`);

        if (rawDoc.createTime) {
          if (!earliestCreatedAt || new Date(rawDoc.createTime) < new Date(earliestCreatedAt)) {
            earliestCreatedAt = rawDoc.createTime;
          }
        }
      } catch (err: any) {
        if (err.message.includes("HTTP 404")) {
          legacyDocsInfo.push({ id: docId, exists: false });
          console.log(`[INFO] Documento administrativo heredado no existe: platform_global_admins/${docId}`);
        } else {
          console.error(`[ERROR] Error al consultar platform_global_admins/${docId}:`, err.message);
          process.exit(1);
        }
      }
    }

    if (legacyDocsInfo.filter(d => d.exists).length === 0) {
      console.error("[ERROR] No se encontró ningún documento administrativo heredado para Javier.");
      process.exit(1);
    }

    // Check Rodolfo's current status
    let rodolfoAuthUser: any = null;
    try {
      const result = await fetchREST(lookupUrl, "POST", { email: [RODOLFO_EMAIL] });
      rodolfoAuthUser = result.users?.[0];
      if (rodolfoAuthUser) {
        console.log(`[INFO] Cuenta Auth de Rodolfo ya existe: ${RODOLFO_EMAIL} (UID: ${rodolfoAuthUser.localId})`);
      } else {
        console.log(`[OK] Confirmado: La cuenta Auth de Rodolfo (${RODOLFO_EMAIL}) no existe en Firebase Auth.`);
      }
    } catch (err: any) {
      console.error("[ERROR] Error al buscar cuenta Auth de Rodolfo:", err.message);
      process.exit(1);
    }

    // Validate Rodolfo's Advisor Profile
    const advisorUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_sales_advisors/${RODOLFO_ADVISOR_ID}`;
    let rodolfoAdvisorData: any = null;
    try {
      const rawDoc = await fetchREST(advisorUrl);
      rodolfoAdvisorData = fromFirestoreDoc(rawDoc);
      console.log(`[OK] Perfil comercial existente de Rodolfo encontrado: platform_sales_advisors/${RODOLFO_ADVISOR_ID} (Nombre: ${rodolfoAdvisorData.name})`);
    } catch (err: any) {
      console.error(`[ERROR] Perfil comercial de Rodolfo no encontrado en platform_sales_advisors/${RODOLFO_ADVISOR_ID}:`, err.message);
      process.exit(1);
    }

    // ----------------------------------------------------------------
    // 2. OPERATIONS SUMMARY
    // ----------------------------------------------------------------
    console.log("\n======================================================================");
    console.log(" RESUMEN DE OPERACIONES PROPUESTAS");
    console.log("======================================================================");
    console.log("1. JAVIER — CONSOLIDACIÓN DE IDENTIDAD CANÓNICA:");
    console.log(`   - Crear/Actualizar: platform_global_admins/${CANONICAL_UID}`);
    console.log("     Campos a escribir:");
    console.log("       * email:", CANONICAL_EMAIL);
    console.log("       * role: \"PLATFORM_OWNER\"");
    console.log("       * platformRole: \"PLATFORM_OWNER\"");
    console.log("       * isActive: true (boolean)");
    console.log("       * identityStatus: \"CANONICAL\"");
    console.log("       * uid:", CANONICAL_UID);
    console.log("       * authUid:", CANONICAL_UID);
    console.log("       * identityAliases:", LEGACY_EMAILS);
    console.log(`       * createdAt: ${earliestCreatedAt}`);
    console.log("   - Actualizar documentos heredados (Normalizar a boolean y desactivar):");
    legacyDocsInfo.filter(d => d.exists).forEach(d => {
      console.log(`       * platform_global_admins/${d.id} -> identityStatus: "INACTIVE_ALIAS", isActive: false (boolean), role: "INACTIVE_ALIAS", migratedToUid: "${CANONICAL_UID}"`);
    });
    console.log(`   - Actualizar Custom Claims en Auth de Javier (UID: ${CANONICAL_UID}) -> roleCode: "PLATFORM_OWNER"`);
    if (legacyAuthUser) {
      console.log(`   - Desactivar cuenta Auth heredada de Javier (UID: ${LEGACY_AUTH_UID}):`);
      console.log("       * disabled: true");
      console.log("       * customAttributes (Claims): roleCode: null, status: \"DEACTIVATED_MIGRATED\", migratedToUid: \"" + CANONICAL_UID + "\"");
    }

    console.log("\n2. RODOLFO — SOCIO DE NEGOCIO (PLATFORM_PARTNER):");
    if (!rodolfoAuthUser) {
      console.log(`   - Crear cuenta en Firebase Auth para: ${RODOLFO_EMAIL}`);
      console.log("       * emailVerified: false");
      console.log("       * disabled: false");
    } else {
      console.log(`   - Reutilizar cuenta en Firebase Auth: ${RODOLFO_EMAIL} (UID: ${rodolfoAuthUser.localId})`);
    }
    console.log(`   - Crear documento administrativo: platform_global_admins/{rodolfoUid}`);
    console.log("     Campos a escribir:");
    console.log("       * email:", RODOLFO_EMAIL);
    console.log("       * role: \"PLATFORM_PARTNER\"");
    console.log("       * platformRole: \"PLATFORM_PARTNER\"");
    console.log(`       * advisorId:`, RODOLFO_ADVISOR_ID);
    console.log("       * isActive: true");
    console.log(`   - Actualizar perfil comercial existente platform_sales_advisors/${RODOLFO_ADVISOR_ID}:`);
    console.log("       * uid: {rodolfoUid}");
    console.log("       * authUid: {rodolfoUid}");
    console.log("       * platformRole: \"PLATFORM_PARTNER\"");
    console.log("       * invitationStatus: \"PENDING\" (No se genera ni expone link de invitación)");
    console.log("   - Configurar Custom Claims en Auth para Rodolfo -> roleCode: \"PLATFORM_PARTNER\", advisorId: \"" + RODOLFO_ADVISOR_ID + "\"");
    
    console.log("\n3. AUDITORÍA:");
    console.log("   - Registrar eventos correspondientes en platform_audit_logs.");
    console.log("======================================================================\n");

    if (!isApply) {
      console.log("[INFO] Ejecución finalizada en modo DRY-RUN. Ningún cambio ha sido guardado.");
      console.log("Para aplicar los cambios en producción, ejecute el script con la bandera: --apply");
      return;
    }

    // ----------------------------------------------------------------
    // 3. EXECUTION PHASE (APPLY MODE)
    // ----------------------------------------------------------------
    console.log("[FASE 3] Aplicando cambios en producción...");

    // A. Remediación Javier
    console.log("   - Escribiendo documento canónico en platform_global_admins...");
    const canonicalDocData = {
      email: CANONICAL_EMAIL,
      role: "PLATFORM_OWNER",
      platformRole: "PLATFORM_OWNER",
      isActive: true,
      identityStatus: "CANONICAL",
      uid: CANONICAL_UID,
      authUid: CANONICAL_UID,
      displayName: "Javier Cuéllar Lazarini",
      identityAliases: LEGACY_EMAILS,
      createdAt: earliestCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedBy: "remediatePlatformIdentities.ts"
    };

    const canonicalDocUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_global_admins/${CANONICAL_UID}`;
    await fetchREST(canonicalDocUrl, "PATCH", toFirestoreFields(canonicalDocData));

    // Update legacy documents to INACTIVE_ALIAS (and normalize isActive to boolean false)
    for (const d of legacyDocsInfo) {
      if (d.exists && d.id !== CANONICAL_UID) {
        console.log(`   - Desactivando documento heredado platform_global_admins/${d.id}...`);
        const legacyDocUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_global_admins/${d.id}?updateMask.fieldPaths=identityStatus&updateMask.fieldPaths=isActive&updateMask.fieldPaths=role&updateMask.fieldPaths=platformRole&updateMask.fieldPaths=migratedToUid&updateMask.fieldPaths=updatedAt`;
        await fetchREST(legacyDocUrl, "PATCH", toFirestoreFields({
          identityStatus: "INACTIVE_ALIAS",
          isActive: false,
          role: "INACTIVE_ALIAS",
          platformRole: "INACTIVE_ALIAS",
          migratedToUid: CANONICAL_UID,
          updatedAt: new Date().toISOString()
        }));
      }
    }

    // Write audit log for Javier
    console.log("   - Escribiendo auditoría de Javier...");
    const auditLogUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_audit_logs`;
    await fetchREST(auditLogUrl, "POST", toFirestoreFields({
      auditId: Math.random().toString(36).substring(2, 15),
      action: "IDENTITY_CONSOLIDATION",
      email: CANONICAL_EMAIL,
      uid: CANONICAL_UID,
      previousDocumentIds: LEGACY_DOC_IDS,
      canonicalDocumentId: CANONICAL_UID,
      previousRoles: ["SUPER_ADMIN"],
      newRole: "PLATFORM_OWNER",
      migratedAt: new Date().toISOString(),
      migratedBy: "remediatePlatformIdentities.ts"
    }));

    // B. Set Custom Claims for Javier
    console.log("   - Actualizando Custom Claims de Javier...");
    const updateClaimsUrl = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`;
    await fetchREST(updateClaimsUrl, "POST", {
      localId: CANONICAL_UID,
      customAttributes: JSON.stringify({ roleCode: "PLATFORM_OWNER" })
    });

    // C. Desactivar y remover claims de la cuenta Auth heredada de Javier
    if (legacyAuthUser) {
      console.log(`   - Desactivando cuenta Auth heredada ${LEGACY_AUTH_EMAIL}...`);
      await fetchREST(updateClaimsUrl, "POST", {
        localId: LEGACY_AUTH_UID,
        disabled: true,
        customAttributes: JSON.stringify({
          roleCode: null,
          status: "DEACTIVATED_MIGRATED",
          migratedToUid: CANONICAL_UID
        })
      });
    }

    // D. Remediación Rodolfo
    let rodolfoUid = "";
    if (!rodolfoAuthUser) {
      console.log(`   - Creando cuenta de Auth para Rodolfo: ${RODOLFO_EMAIL}...`);
      const createAuthUrl = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`;
      const result = await fetchREST(createAuthUrl, "POST", {
        email: RODOLFO_EMAIL,
        displayName: "Rodolfo Cuéllar Lazarini",
        emailVerified: false,
        disabled: false
      });
      rodolfoUid = result.localId;
      console.log(`   - [OK] Cuenta de Auth creada con UID: ${rodolfoUid}`);
    } else {
      rodolfoUid = rodolfoAuthUser.localId;
    }

    // Create Rodolfo Admin document
    console.log(`   - Escribiendo documento administrativo de Rodolfo: platform_global_admins/${rodolfoUid}...`);
    const rodolfoAdminUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_global_admins/${rodolfoUid}`;
    await fetchREST(rodolfoAdminUrl, "PATCH", toFirestoreFields({
      email: RODOLFO_EMAIL,
      role: "PLATFORM_PARTNER",
      platformRole: "PLATFORM_PARTNER",
      advisorId: RODOLFO_ADVISOR_ID,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Update Rodolfo's Advisor Profile in platform_sales_advisors
    console.log(`   - Actualizando perfil comercial platform_sales_advisors/${RODOLFO_ADVISOR_ID}...`);
    const rodolfoAdvisorUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_sales_advisors/${RODOLFO_ADVISOR_ID}?updateMask.fieldPaths=uid&updateMask.fieldPaths=authUid&updateMask.fieldPaths=platformRole&updateMask.fieldPaths=invitationStatus&updateMask.fieldPaths=updatedAt`;
    await fetchREST(rodolfoAdvisorUrl, "PATCH", toFirestoreFields({
      uid: rodolfoUid,
      authUid: rodolfoUid,
      platformRole: "PLATFORM_PARTNER",
      invitationStatus: "PENDING",
      updatedAt: new Date().toISOString()
    }));

    // Write audit log for Rodolfo
    console.log("   - Escribiendo auditoría de Rodolfo...");
    await fetchREST(auditLogUrl, "POST", toFirestoreFields({
      auditId: Math.random().toString(36).substring(2, 15),
      action: "PARTNER_PROVISIONING",
      email: RODOLFO_EMAIL,
      uid: rodolfoUid,
      advisorId: RODOLFO_ADVISOR_ID,
      role: "PLATFORM_PARTNER",
      timestamp: new Date().toISOString(),
      migratedBy: "remediatePlatformIdentities.ts"
    }));

    // Set Custom Claims for Rodolfo
    console.log("   - Actualizando Custom Claims de Rodolfo...");
    await fetchREST(updateClaimsUrl, "POST", {
      localId: rodolfoUid,
      customAttributes: JSON.stringify({
        roleCode: "PLATFORM_PARTNER",
        advisorId: RODOLFO_ADVISOR_ID
      })
    });

    console.log("\n======================================================================");
    console.log(" REMEDIACIÓN COMPLETADA CON ÉXITO EN PRODUCCIÓN");
    console.log("======================================================================\n");

  } catch (err: any) {
    console.error("\n[CRITICAL ERROR] Ocurrió un fallo durante la remediación:", err.message);
    process.exit(1);
  }
}

main();
