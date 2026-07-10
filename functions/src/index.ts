import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as XLSX from "xlsx";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

admin.initializeApp();

const db = admin.firestore();

// ----------------- Interfaces -----------------
interface OpportunityScoreBreakdown {
  total: number;
  sourceScore: number;
  companySizeScore: number;
  sectorScore: number;
  reachabilityScore: number;
}

interface HeaderMap {
  razonSocialIdx: number;
  nombreComercialIdx: number;
  sectorIdx: number;
  tamanoIdx: number;
  rangoPersonalIdx: number;
  telefonoIdx: number;
  emailIdx: number;
  sitioWebIdx: number;
  direccionIdx: number;
  municipioIdx: number;
  estadoIdx: number;
  cpIdx: number;
  scianIdx: number;
  actividadIdx: number;
  latitudIdx: number;
  longitudIdx: number;
  altaDenueIdx: number;
  scoreIdx: number;
}

// ----------------- Normalization Helpers -----------------
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  const cleaned = email.trim().toLowerCase();

  const placeholders = [
    "no disponible",
    "n/a",
    "no aplica",
    "sin correo",
    "no_disponible",
    "noreply",
    "sin_correo",
    "none",
    "null",
  ];

  if (placeholders.some(p => cleaned.includes(p))) {
    return "";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");

  const placeholders = [
    "0000000000",
    "1234567890",
    "1111111111",
  ];

  if (placeholders.includes(cleaned) || cleaned.length < 8 || cleaned.length > 15) {
    return "";
  }

  if (cleaned.length === 12 && cleaned.startsWith("52")) {
    return cleaned.slice(2);
  }

  return cleaned;
}

function normalizeState(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getNormalizedStateName(stateVal: string, filename?: string): string {
  const cleanVal = (stateVal || "").trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (cleanVal.includes("queretaro") || cleanVal.includes("22")) return "Querétaro";
  if (cleanVal.includes("tabasco") || cleanVal.includes("27")) return "Tabasco";
  if (cleanVal.includes("jalisco") || cleanVal.includes("14")) return "Jalisco";
  if (cleanVal.includes("nuevo leon") || cleanVal.includes("19")) return "Nuevo León";
  if (cleanVal.includes("cdmx") || cleanVal.includes("ciudad de mexico") || cleanVal.includes("distrito federal") || cleanVal.includes("09")) return "Ciudad de México";

  if (filename) {
    const cleanFile = filename.toLowerCase();
    if (cleanFile.includes("queretaro") || cleanFile.includes("22_")) return "Querétaro";
    if (cleanFile.includes("tabasco") || cleanFile.includes("27_")) return "Tabasco";
    if (cleanFile.includes("jalisco") || cleanFile.includes("14_")) return "Jalisco";
    if (cleanFile.includes("nuevo") || cleanFile.includes("19_")) return "Nuevo León";
    if (cleanFile.includes("cdmx") || cleanFile.includes("09_") || cleanFile.includes("ciudad de mexico") || cleanFile.includes("ciudad de me")) return "Ciudad de México";
  }

  if (cleanVal === "tab") return "Tabasco";
  if (cleanVal === "qro") return "Querétaro";
  if (cleanVal === "jal") return "Jalisco";
  if (cleanVal === "nl") return "Nuevo León";
  if (cleanVal === "df" || cleanVal === "distrito federal") return "Ciudad de México";

  return stateVal && cleanVal !== "no especificado" && cleanVal !== "null" ? stateVal : "No Especificado";
}

function generateDeterministicId(
  razonSocial: string | null | undefined,
  nombreComercial: string | null | undefined,
  municipio: string | null | undefined,
  scian: string | null | undefined
): string {
  const cleanStr = (str: string | null | undefined) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const partName = cleanStr(razonSocial) || cleanStr(nombreComercial) || "empresa";
  const partMun = cleanStr(municipio) || "sinmunicipio";
  const partScian = cleanStr(scian) || "sinscian";

  return `inegi_${partName}_${partMun}_${partScian}`.slice(0, 100);
}

function calculateOpportunityScore(
  rawSourceScore: number | null | undefined,
  tamano: string | null | undefined,
  sector: string | null | undefined,
  emailValido: string,
  telefonoValido: string,
  sitioWeb: string | null | undefined
): OpportunityScoreBreakdown {
  let rawScore = Number(rawSourceScore) || 0;
  if (rawScore > 0 && rawScore <= 10) {
    rawScore = rawScore * 10;
  }
  const sourceScore = Math.min(25, Math.round(rawScore * 0.25));

  let companySizeScore = 5;
  const cleanTamano = (tamano || "").toLowerCase();
  if (cleanTamano.includes("grande") || cleanTamano.includes("251") || cleanTamano.includes("101")) {
    companySizeScore = 20;
  } else if (cleanTamano.includes("mediana") || cleanTamano.includes("51") || cleanTamano.includes("31")) {
    companySizeScore = 15;
  } else if (cleanTamano.includes("pequeña") || cleanTamano.includes("11") || cleanTamano.includes("pequena")) {
    companySizeScore = 10;
  }

  let sectorScore = 5;
  const cleanSector = (sector || "").toLowerCase();

  if (
    cleanSector.includes("financier") ||
    cleanSector.includes("seguro") ||
    cleanSector.includes("tecnolog") ||
    cleanSector.includes("informacion") ||
    cleanSector.includes("profesional") ||
    cleanSector.includes("cientific") ||
    cleanSector.includes("corporativo")
  ) {
    sectorScore = 20;
  } else if (cleanSector.includes("manufactur") || cleanSector.includes("industria")) {
    sectorScore = 15;
  } else if (cleanSector.includes("comercio") || cleanSector.includes("servicios")) {
    sectorScore = 10;
  }

  let reachabilityScore = 0;
  if (emailValido) reachabilityScore += 15;
  if (telefonoValido) reachabilityScore += 10;

  const cleanWeb = (sitioWeb || "").toLowerCase().trim();
  const hasWeb = cleanWeb && cleanWeb !== "no disponible" && cleanWeb !== "n/a" && cleanWeb !== "no aplica";
  if (hasWeb) reachabilityScore += 10;

  const total = sourceScore + companySizeScore + sectorScore + reachabilityScore;

  return {
    total,
    sourceScore,
    companySizeScore,
    sectorScore,
    reachabilityScore,
  };
}

function determineRecommendedSuites(
  sector: string | null | undefined,
  tamano: string | null | undefined,
  rangoPersonal: string | null | undefined,
  scoreTotal: number
): string[] {
  const suites: string[] = [];
  const cleanSector = (sector || "").toLowerCase();
  const cleanTamano = (tamano || "").toLowerCase();
  const cleanRango = (rangoPersonal || "").toLowerCase();

  const esGrandeOMediana =
    cleanTamano.includes("grande") ||
    cleanTamano.includes("mediana") ||
    cleanRango.includes("50") ||
    cleanRango.includes("100") ||
    cleanRango.includes("250");

  if (esGrandeOMediana || cleanSector.includes("manufactur") || cleanSector.includes("comercio")) {
    suites.push("People Suite");
  }

  if (
    cleanSector.includes("comercio") ||
    cleanSector.includes("financier") ||
    cleanSector.includes("servicios") ||
    cleanSector.includes("seguro") ||
    cleanSector.includes("alojamiento") ||
    cleanSector.includes("alimentos")
  ) {
    suites.push("Sales Suite");
  }

  if (esGrandeOMediana) {
    suites.push("Compensation Suite");
  }

  if (
    cleanSector.includes("manufactur") ||
    cleanSector.includes("construc") ||
    cleanSector.includes("transport") ||
    cleanSector.includes("logistica")
  ) {
    suites.push("Operations Suite");
  }

  if (scoreTotal >= 60 || esGrandeOMediana) {
    suites.push("Intelligence Suite");
  }

  if (
    cleanSector.includes("financier") ||
    cleanSector.includes("seguro") ||
    cleanSector.includes("profesional") ||
    cleanSector.includes("juridic") ||
    cleanSector.includes("consultor")
  ) {
    suites.push("Digital Trust Suite");
  }

  if (suites.length === 0) {
    suites.push("Sales Suite");
  }

  return suites;
}

function generateCommercialAdvisorInfo(
  opportunityScore: number,
  tamano: string,
  sector: string,
  email: string,
  telefono: string,
  sitioWeb: string,
  actividad: string
): {
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  motives: string[];
  nextAction: string;
} {
  const motives: string[] = [];
  let priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (opportunityScore >= 85) priorityLevel = "CRITICAL";
  else if (opportunityScore >= 70) priorityLevel = "HIGH";
  else if (opportunityScore >= 45) priorityLevel = "MEDIUM";

  const cleanSector = (sector || "").toLowerCase();
  const cleanTamano = (tamano || "").toLowerCase();
  const cleanActividad = (actividad || "").toLowerCase();

  if (cleanSector.includes("alojamiento") || cleanActividad.includes("hotel")) {
    motives.push("Giro de Alojamiento/Hotelería: Alta rotación operativa. Crítico digitalizar control de turnos.");
  } else if (cleanSector.includes("alimentos") || cleanActividad.includes("restaurante")) {
    motives.push("Giro de Restaurante/Alimentos: Foco en contratación rápida y expedientes digitales.");
  } else if (cleanSector.includes("manufactur") || cleanSector.includes("industria")) {
    motives.push("Sector Industrial: Complejidad operativa. Oportunidad en Operations & People Suite.");
  } else if (cleanSector.includes("financier") || cleanSector.includes("seguro")) {
    motives.push("Servicios Financieros: Alto potencial presupuestario para la línea Intelligence Suite.");
  } else {
    motives.push("Giro comercial idóneo para el ecosistema de automatización Aura.");
  }

  if (cleanTamano.includes("grande") || cleanTamano.includes("mediana")) {
    motives.push(`Estructura corporativa clasificada como ${tamano} (Requiere tabuladores complejos).`);
  } else {
    motives.push("Pyme ágil ideal para adopción rápida en la nube.");
  }

  if (email && email !== "no disponible" && email !== "no aplica") {
    motives.push("Canal de email verificado: Permite enviar presentación comercial digital.");
  }
  if (telefono && telefono !== "no disponible" && telefono !== "no aplica") {
    motives.push("Contacto telefónico disponible: Apto para prospección telefónica directa.");
  }

  const cleanWeb = (sitioWeb || "").toLowerCase().trim();
  const hasWeb = cleanWeb && cleanWeb !== "no disponible" && cleanWeb !== "n/a" && cleanWeb !== "no aplica";
  if (hasWeb) {
    motives.push("Sitio web activo: Refleja infraestructura y madurez tecnológica compatible.");
  }

  let nextAction = "Registrar prospecto y validar datos generales en base local.";
  if (priorityLevel === "CRITICAL") {
    nextAction = "Llamada comercial prioritaria: Agendar demo de 15 min enfocada en Operations & People Suite.";
  } else if (priorityLevel === "HIGH") {
    nextAction = "Enviar correo de contacto personalizado con folleto de Sales & Compensation Suite.";
  } else if (priorityLevel === "MEDIUM") {
    nextAction = "Validar tomador de decisiones (RRHH/Operaciones) mediante llamada exploratoria.";
  }

  return {
    priorityLevel,
    motives,
    nextAction,
  };
}

function detectHeaderRowAndBuildMap(rows: any[][]): { headerRowIndex: number; headerMap: HeaderMap } {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(cell => typeof cell === "string" && /razon|denominacion|nombre/i.test(cell))) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (rows[headerRowIndex] || []).map(cell => (cell !== undefined && cell !== null ? String(cell).trim().toLowerCase() : ""));
  const findIndex = (possibleNames: string[]) => {
    return headers.findIndex(h => possibleNames.some(name => h === name || h.includes(name)));
  };

  const headerMap: HeaderMap = {
    razonSocialIdx: findIndex(["razon social", "razon_social", "denominacion", "nombre o razon social"]),
    nombreComercialIdx: findIndex(["nombre comercial", "nombre_comercial", "establecimiento", "negocio"]),
    sectorIdx: findIndex(["sector", "actividad sectorial", "nombre de la clase de actividad"]),
    tamanoIdx: findIndex(["tamano", "tamaño", "estrato"]),
    rangoPersonalIdx: findIndex(["personal", "rango de personal", "rango_personal"]),
    telefonoIdx: findIndex(["telefono", "teléfono", "tel"]),
    emailIdx: findIndex(["email", "correo", "e-mail", "correo electronico"]),
    sitioWebIdx: findIndex(["sitio web", "sitio_web", "web", "pagina"]),
    direccionIdx: findIndex(["direccion", "dirección", "calle"]),
    municipioIdx: findIndex(["municipio", "municipio_nom", "nom_mun"]),
    estadoIdx: findIndex(["estado", "entidad", "nom_ent", "provincia"]),
    cpIdx: findIndex(["c.p.", "cp", "código postal", "codigo postal"]),
    scianIdx: findIndex(["scian", "clase de actividad", "clase_actividad"]),
    actividadIdx: findIndex(["actividad", "nombre de la clase de actividad"]),
    latitudIdx: findIndex(["latitud", "lat"]),
    longitudIdx: findIndex(["longitud", "lon", "lng"]),
    altaDenueIdx: findIndex(["alta denue", "fecha_alta"]),
    scoreIdx: findIndex(["score", "calificación", "calificacion"]),
  };

  if (headerMap.razonSocialIdx === -1 && headerMap.nombreComercialIdx === -1) {
    throw new Error("No se pudo mapear las columnas requeridas del DENUE.");
  }

  return { headerRowIndex, headerMap };
}

function normalizeRowWithMap(rowArray: any[], map: HeaderMap): any {
  const getValue = (idx: number, fallback: string = ""): string => {
    if (idx === -1 || idx >= rowArray.length) return fallback;
    const val = rowArray[idx];
    return val !== undefined && val !== null ? String(val).trim() : fallback;
  };

  const getNumber = (idx: number, fallback: number = 0): number => {
    if (idx === -1 || idx >= rowArray.length) return fallback;
    const val = Number(rowArray[idx]);
    return isNaN(val) ? fallback : val;
  };

  const razonSocial = getValue(map.razonSocialIdx);
  const nombreComercial = getValue(map.nombreComercialIdx);
  const sector = getValue(map.sectorIdx);
  const tamano = getValue(map.tamanoIdx, "Micro");
  const rangoPersonal = getValue(map.rangoPersonalIdx, "0 a 5 personas");

  const rawTelefono = getValue(map.telefonoIdx);
  const rawEmail = getValue(map.emailIdx);
  const sitioWeb = getValue(map.sitioWebIdx);

  const direccion = getValue(map.direccionIdx);
  const municipio = getValue(map.municipioIdx);
  const rawEstado = getValue(map.estadoIdx);
  const estado = getNormalizedStateName(rawEstado);
  const sourceState = rawEstado || "No Especificado";
  const estadoNormalized = normalizeState(estado);
  const cp = getValue(map.cpIdx);
  const scian = getValue(map.scianIdx);
  const actividad = getValue(map.actividadIdx);

  const latitud = getNumber(map.latitudIdx);
  const longitud = getNumber(map.longitudIdx);
  const altaDenue = getValue(map.altaDenueIdx);

  const email = normalizeEmail(rawEmail);
  const telefono = normalizePhone(rawTelefono);
  const rawSourceScore = getNumber(map.scoreIdx, 0);

  const scoreBreakdown = calculateOpportunityScore(
    rawSourceScore,
    tamano,
    sector,
    email,
    telefono,
    sitioWeb
  );

  const opportunityScore = scoreBreakdown.total;
  const recommendedSuites = determineRecommendedSuites(sector, tamano, rangoPersonal, opportunityScore);
  const id = generateDeterministicId(razonSocial, nombreComercial, municipio, scian);

  const advisor = generateCommercialAdvisorInfo(
    opportunityScore,
    tamano,
    sector,
    email,
    telefono,
    sitioWeb,
    actividad
  );

  return {
    id,
    razonSocial,
    nombreComercial,
    sector,
    tamano,
    rangoPersonal,
    telefono,
    email,
    sitioWeb,
    direccion,
    municipio,
    estado,
    cp,
    scian,
    actividad,
    latitud,
    longitud,
    altaDenue,
    sourceScore: rawSourceScore,
    opportunityScore,
    scoreBreakdown,
    recommendedSuites,
    priorityLevel: advisor.priorityLevel,
    motives: advisor.motives,
    nextAction: advisor.nextAction,
    status: "NEW",
    sourceState,
    estadoNormalized,
  };
}

async function updateStateMetadataAndList(stateName: string, totalRecords: number, jobId: string, fingerprint: string) {
  if (!stateName || stateName === "No Especificado") return;

  const datasetMetaRef = db.collection("market_dataset_metadata").doc(stateName);
  await datasetMetaRef.set({
    state: stateName,
    totalRecords,
    lastImportJobId: jobId,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    fingerprint: fingerprint || "",
  }, { merge: true });

  const companiesMetaRef = db.collection("market_companies_metadata").doc(stateName);
  await companiesMetaRef.set({
    state: stateName,
    totalRecords,
    lastImportJobId: jobId,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    fingerprint: fingerprint || "",
  }, { merge: true });

  const statesRef = db.collection("market_companies_metadata").doc("states");
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(statesRef);
    let currentStates: string[] = ["Querétaro", "Nuevo León"];
    if (snap.exists) {
      const data = snap.data();
      if (data && Array.isArray(data.states)) {
        currentStates = data.states;
      }
    }
    if (!currentStates.includes(stateName)) {
      const merged = Array.from(new Set([...currentStates, stateName])).sort();
      transaction.set(statesRef, { states: merged });
    }
  });
}

// ----------------- Cloud Function Trigger -----------------
export const processMarketImportJob = onDocumentCreated(
  {
    document: "market_import_jobs/{jobId}",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (!data || data.status !== "queued") {
      return;
    }

    const jobId = event.params.jobId;
    console.log(`[processMarketImportJob] Iniciando procesamiento para el job: ${jobId}`);
    const startTime = Date.now();

    try {
      await snapshot.ref.update({
        status: "processing",
        currentStage: "Descargando archivo Excel desde Storage...",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const storagePath = data.storagePath;
      const bucket = admin.storage().bucket();
      const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${data.filename}`);

      await bucket.file(storagePath).download({ destination: tempFilePath });

      await snapshot.ref.update({
        currentStage: "Analizando y mapeando archivo Excel...",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const workbook = XLSX.readFile(tempFilePath);
      const sheetName =
        workbook.SheetNames.find(
          (name: string) => name.toLowerCase() === "datos"
        ) || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("El archivo Excel no contiene ninguna hoja.");
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`No se pudo leer la hoja '${sheetName}' en el Excel.`);
      }

      const rows2D = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      if (rows2D.length === 0) {
        throw new Error(`La hoja '${sheetName}' está vacía.`);
      }

      const { headerRowIndex, headerMap } = detectHeaderRowAndBuildMap(rows2D);
      const dataRows = rows2D.slice(headerRowIndex + 1);
      const totalRows = dataRows.length;

      await snapshot.ref.update({
        total: totalRows,
        currentStage: `Normalizando y cargando ${totalRows.toLocaleString()} prospectos...`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      let processed = 0;
      let added = 0;
      let overwritten = 0;
      let omitted = 0;
      let failed = 0;

      let unresolvedStateCount = 0;
      let resolvedStateCount = 0;
      const stateDistribution: Record<string, number> = {};
      const sectorDistribution: Record<string, number> = {};
      const validationErrors: string[] = [];

      const nowStr = new Date().toISOString();
      const customState = (data.states && data.states.length > 0) ? data.states[0] : null;

      for (let i = 0; i < totalRows; i += 100) {
        const chunkRows = dataRows.slice(i, i + 100);
        const companies: any[] = [];

        for (const row of chunkRows) {
          if (!row || row.length === 0) continue;
          try {
            const company = normalizeRowWithMap(row, headerMap);
            company.estado = getNormalizedStateName(customState || company.estado, data.filename || "");
            if (company.estado === "No Especificado") {
              const munNorm = normalizeState(company.municipio || "");
              if (munNorm) {
                if (munNorm.includes("queretaro")) {
                  company.estado = "Querétaro";
                } else if (munNorm.includes("villahermosa") || munNorm === "centro" || munNorm.includes("centrotabasco") || munNorm.includes("cardenas") || munNorm.includes("comalcalco") || munNorm.includes("paraiso")) {
                  company.estado = "Tabasco";
                } else {
                  const nlMunicipios = ["monterrey", "sannicolas", "apodaca", "guadalupe", "santacatarina", "sanpedrogarza", "sanpedrogarcia", "garcia", "escobedo"];
                  if (nlMunicipios.some(m => munNorm.includes(m))) {
                    company.estado = "Nuevo León";
                  }
                }
              }
            }
            company.estadoNormalized = normalizeState(company.estado);
            if (!company.sourceState) {
              const excelStateVal = headerMap.estadoIdx !== -1 && headerMap.estadoIdx < row.length ? String(row[headerMap.estadoIdx] || "").trim() : "";
              company.sourceState = excelStateVal || "No Especificado";
            }
            company.importJobId = jobId;
            company.fingerprint = data.fingerprint || "";
            company.sourceFile = data.filename || "";

            const isUnresolved = !company.estado || company.estado === "No Especificado" || !company.estadoNormalized;
            if (isUnresolved) {
              unresolvedStateCount++;
            } else {
              resolvedStateCount++;
            }

            stateDistribution[company.estado] = (stateDistribution[company.estado] || 0) + 1;
            const sectorNorm = company.sector || "Otros Sectores";
            sectorDistribution[sectorNorm] = (sectorDistribution[sectorNorm] || 0) + 1;

            const missingFields = [];
            if (!company.estado) missingFields.push("estado");
            if (!company.estadoNormalized) missingFields.push("estadoNormalized");
            if (!company.sourceState) missingFields.push("sourceState");
            if (!company.sourceFile) missingFields.push("sourceFile");
            if (!company.importJobId) missingFields.push("importJobId");
            if (!company.fingerprint) missingFields.push("fingerprint");

            if (missingFields.length > 0 && validationErrors.length < 50) {
              validationErrors.push(`Fila con Razón Social: "${company.razonSocial || company.nombreComercial}" le faltan campos: ${missingFields.join(", ")}`);
            }

            if (company.razonSocial || company.nombreComercial) {
              companies.push(company);
            }
          } catch (e) {
            failed++;
          }
        }

        if (companies.length > 0) {
          const docRefs = companies.map(c => db.collection("market_companies").doc(c.id));
          const snapshots = await db.getAll(...docRefs);
          const existingDocsMap = new Map<string, any>();

          snapshots.forEach(snap => {
            if (snap.exists) {
              existingDocsMap.set(snap.id, snap.data());
            }
          });

          const batch = db.batch();

          for (const company of companies) {
            const existing = existingDocsMap.get(company.id);
            const docRef = db.collection("market_companies").doc(company.id);

            if (!existing) {
              batch.set(docRef, {
                ...company,
                firstImportedAt: nowStr,
                lastImportAt: nowStr,
                lastUpdatedAt: nowStr,
                importCount: 1,
                source: "INEGI",
                sourceVersion: "DENUE-2026",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              added++;
            } else {
              const hasChanged =
                existing.razonSocial !== company.razonSocial ||
                existing.nombreComercial !== company.nombreComercial ||
                existing.sector !== company.sector ||
                existing.tamano !== company.tamano ||
                existing.rangoPersonal !== company.rangoPersonal ||
                existing.telefono !== company.telefono ||
                existing.email !== company.email ||
                existing.sitioWeb !== company.sitioWeb ||
                existing.direccion !== company.direccion ||
                existing.municipio !== company.municipio ||
                existing.estado !== company.estado ||
                existing.estadoNormalized !== company.estadoNormalized ||
                existing.sourceState !== company.sourceState ||
                existing.cp !== company.cp ||
                existing.scian !== company.scian ||
                existing.actividad !== company.actividad;

              if (!hasChanged) {
                omitted++;
              } else {
                batch.set(docRef, {
                  ...existing,
                  ...company,
                  lastImportAt: nowStr,
                  lastUpdatedAt: nowStr,
                  importCount: (existing.importCount || 1) + 1,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                overwritten++;
              }
            }
          }

          await batch.commit();
        }

        processed += chunkRows.length;

        await snapshot.ref.update({
          processed,
          added,
          overwritten,
          omitted,
          failed,
          progress: Math.round((processed / totalRows) * 100),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn("No se pudo eliminar el archivo temporal:", e);
      }

      await db.collection("market_imports_history").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        filename: data.filename,
        totalProcessed: totalRows,
        newAdded: added,
        updated: overwritten,
        omitted: omitted,
        failed: failed,
        timeMs: Date.now() - startTime,
        source: "INEGI",
        sourceVersion: "DENUE-2026",
        fingerprint: data.fingerprint || "",
        user: data.createdBy || "",
      });

      // 4. Metadata & Validation update
      const unresolvedPercentage = totalRows > 0 ? (unresolvedStateCount / totalRows) * 100 : 0;
      const validationStatus = unresolvedPercentage > 1.0 ? "needs_review" : "valid";

      if (validationStatus === "needs_review") {
        validationErrors.push(`Más del 1% del dataset (${unresolvedPercentage.toFixed(2)}%) tiene estado vacío o No Especificado.`);
      }

      if (validationStatus === "valid") {
        const targetState = (data.states && data.states.length > 0) ? data.states[0] : null;
        if (targetState && targetState !== "No Especificado") {
          await updateStateMetadataAndList(targetState, totalRows, jobId, data.fingerprint || "");
        }
      }

      await snapshot.ref.update({
        status: validationStatus === "valid" ? "completed" : "needs_review",
        currentStage: validationStatus === "valid" ? "completed" : "needs_review",
        validationStatus,
        validationErrors,
        unresolvedStateCount,
        resolvedStateCount,
        stateDistribution,
        sectorDistribution,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (err: any) {
      console.error("Error al procesar el job en el backend:", err);
      await snapshot.ref.update({
        status: "failed",
        currentStage: "failed",
        errorMessage: err.message || "Error desconocido en el servidor de importación masiva.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
export * from './intelligence/evaluateConversation';
export { createSalesAdvisorUser } from './advisors/createSalesAdvisorUser';
export { createDiscoveryLead } from './discovery/createDiscoveryLead';
export { exchangeDiscoveryToken } from './discovery/exchangeDiscoveryToken';
export { resolveDiscoverySession } from './discovery/resolveDiscoverySession';
export { completeDiscoverySession } from './discovery/completeDiscoverySession';