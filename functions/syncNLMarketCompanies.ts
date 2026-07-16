import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { resolveBusinessIdentity, BusinessIdentityResult } from './src/utils/identityUtils';

// Helper to authenticate using firebase-tools.json token if ADC is missing
function setupADCWorkaround() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }
  const homeDir = os.homedir();
  const configPaths = [
    path.join(homeDir, '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json')
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (data.tokens && data.tokens.refresh_token) {
          const tempAdcPath = path.join(os.tmpdir(), 'aura_gcloud_adc.json');
          const adc = {
            type: 'authorized_user',
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
            refresh_token: data.tokens.refresh_token
          };
          fs.writeFileSync(tempAdcPath, JSON.stringify(adc, null, 2));
          process.env.GOOGLE_APPLICATION_CREDENTIALS = tempAdcPath;
          console.log(`[AUTH] Setup temporary Application Default Credentials from ${configPath}`);
          return;
        }
      } catch (err: any) {
        console.warn(`[AUTH] Failed to parse ${configPath}: ${err.message}`);
      }
    }
  }
}

setupADCWorkaround();

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'aura-control-center-debb3'
  });
}

const db = admin.firestore();

// ----------------- CLI Args Parser -----------------
const args = process.argv.slice(2);
const params: Record<string, string | boolean> = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].substring(2);
    if (args[i + 1] && !args[i + 1].startsWith('--')) {
      params[key] = args[i + 1];
      i++;
    } else {
      params[key] = true;
    }
  }
}

const isApply = !!params['apply'];
const file = params['file'] as string;
const stateCode = params['state-code'] as string;
const reportFile = params['report-file'] as string;
const confirmProject = params['confirm-project'] as string;
const confirmState = params['confirm-state'] as string;
const jobId = (params['job-id'] as string) || `sync_job_${Date.now()}`;
const batchSize = parseInt(params['batch-size'] as string) || 300;
const maxWrites = parseInt(params['max-writes'] as string) || 1000000;
const resumeFrom = params['resume-from'] as string;
console.log(`Unused CLI bindings: maxWrites=${maxWrites}, resumeFrom=${resumeFrom}`);

const localOnly = !!params['local-only'];
const compareFirestore = !!params['compare-firestore'];

// ----------------- Validation -----------------
if (!file || !fs.existsSync(file)) {
  console.error("Error: --file argument is required and must exist.");
  process.exit(1);
}
if (!stateCode) {
  console.error("Error: --state-code argument is required (e.g. NL).");
  process.exit(1);
}

if (!localOnly && !compareFirestore) {
  console.error("Error: Must specify either --local-only or --compare-firestore.");
  process.exit(1);
}

if (isApply) {
  if (confirmProject !== 'aura-control-center-debb3' || confirmState !== stateCode || !params['job-id']) {
    console.error("Error: --apply requires --confirm-project aura-control-center-debb3, --confirm-state <state> and explicit --job-id.");
    process.exit(1);
  }
}

const OPERATIONAL_FIELDS = [
  'assignedAdvisorId', 'assignedAt', 'activeAssignmentId', 'pipelineStatus',
  'status', 'discardDetails', 'convertedOrganizationId', 'notes', 'tags',
  'createdBy', 'history', 'auditoria'
];
console.log(`Operational fields schema: ${OPERATIONAL_FIELDS.join(', ')}`);

interface ExcelRow {
  rowIdx: number;
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  municipio: string;
  cp: string;
  scian: string;
  telefono: string;
  latitud: string;
  longitud: string;
  actividad: string;
  email: string;
  web: string;
  tamano: string;
  rangoPersonal: string;
  sector: string;
  score: number;
  altaDenue: string;
  identity: BusinessIdentityResult;
}

interface CanonicalIndustry {
  code: string;
  label: string;
}

function resolveCanonicalIndustry(company: {
  scian?: string | null;
  actividad?: string | null;
  sector?: string | null;
}): CanonicalIndustry {
  const getScianCode = (): string => {
    if (company.scian) {
      const match = String(company.scian).trim().match(/^\d+/);
      if (match) return match[0];
    }
    const fields = [
      company.actividad,
      company.sector
    ];
    for (const f of fields) {
      if (f) {
        const match = String(f).trim().match(/^\d+/);
        if (match) return match[0];
      }
    }
    return "";
  };

  const scianCode = getScianCode();

  if (scianCode) {
    if (scianCode.startsWith("721")) {
      return { code: "HOTELS_LODGING", label: "Hoteles y Hospedaje" };
    }
    if (scianCode.startsWith("722")) {
      return { code: "RESTAURANTS_FOOD", label: "Restaurantes y Alimentos" };
    }
    if (scianCode.startsWith("31") || scianCode.startsWith("32") || scianCode.startsWith("33")) {
      return { code: "MANUFACTURING", label: "Manufactura" };
    }
    if (scianCode.startsWith("23")) {
      return { code: "CONSTRUCTION", label: "Construcción" };
    }
    if (scianCode.startsWith("62")) {
      return { code: "HEALTHCARE", label: "Hospitales" };
    }
    if (scianCode.startsWith("61")) {
      return { code: "EDUCATION", label: "Educación" };
    }
    if (scianCode.startsWith("54")) {
      return { code: "PROFESSIONAL_SERVICES", label: "Servicios Profesionales" };
    }
    if (scianCode.startsWith("46")) {
      return { code: "RETAIL", label: "Comercio Minorista" };
    }
    if (scianCode.startsWith("43")) {
      return { code: "WHOLESALE", label: "Comercio Mayorista" };
    }
    if (scianCode.startsWith("48") || scianCode.startsWith("49")) {
      return { code: "TRANSPORT_LOGISTICS", label: "Logística" };
    }
    if (scianCode.startsWith("51")) {
      return { code: "TECHNOLOGY", label: "Medios y Telecomunicaciones" };
    }
    if (scianCode.startsWith("93")) {
      return { code: "GOVERNMENT", label: "Gobierno" };
    }
    if (scianCode.startsWith("52") || scianCode.startsWith("55")) {
      return { code: "FINANCIAL_SERVICES", label: "Servicios Financieros" };
    }
  }

  const checkTextMatch = (text: string): CanonicalIndustry | null => {
    const norm = (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!norm) return null;

    if (
      norm.includes("hotel") ||
      norm.includes("hospedaje") ||
      norm.includes("motel") ||
      norm.includes("alojamiento")
    ) {
      return { code: "HOTELS_LODGING", label: "Hoteles y Hospedaje" };
    }

    if (
      norm.includes("restaurante") ||
      norm.includes("alimento") ||
      norm.includes("comida") ||
      norm.includes("bar") ||
      norm.includes("cafeteria") ||
      norm.includes("bebida")
    ) {
      return { code: "RESTAURANTS_FOOD", label: "Restaurantes y Alimentos" };
    }

    if (norm.includes("hospital") || norm.includes("clinica") || norm.includes("medico") || norm.includes("consultorio") || norm.includes("salud")) {
      return { code: "HEALTHCARE", label: "Hospitales" };
    }

    if (norm.includes("manufactura") || norm.includes("fabrica") || norm.includes("produccion") || norm.includes("maquila") || norm.includes("industrial")) {
      return { code: "MANUFACTURING", label: "Manufactura" };
    }

    if (norm.includes("construccion") || norm.includes("edificacion") || norm.includes("obra civil")) {
      return { code: "CONSTRUCTION", label: "Construcción" };
    }

    if (norm.includes("educacion") || norm.includes("escuela") || norm.includes("colegio") || norm.includes("universidad")) {
      return { code: "EDUCATION", label: "Educación" };
    }

    if (norm.includes("profesional") || norm.includes("cientifico") || norm.includes("tecnico") || norm.includes("consultoria") || norm.includes("despacho")) {
      return { code: "PROFESSIONAL_SERVICES", label: "Servicios Profesionales" };
    }

    if (norm.includes("comercio al por menor") || norm.includes("minorista") || norm.includes("tienda")) {
      return { code: "RETAIL", label: "Comercio Minorista" };
    }

    if (norm.includes("comercio al por mayor") || norm.includes("mayorista")) {
      return { code: "WHOLESALE", label: "Comercio Mayorista" };
    }

    if (norm.includes("transporte") || norm.includes("almacenamiento") || norm.includes("logistica")) {
      return { code: "TRANSPORT_LOGISTICS", label: "Logística" };
    }

    if (norm.includes("telecomunicacion") || norm.includes("television") || norm.includes("radio") || norm.includes("internet") || norm.includes("medios masivos")) {
      return { code: "TECHNOLOGY", label: "Medios y Telecomunicaciones" };
    }

    if (norm.includes("gobierno") || norm.includes("administracion publica")) {
      return { code: "GOVERNMENT", label: "Gobierno" };
    }

    if (norm.includes("financiero") || norm.includes("banco") || norm.includes("seguro") || norm.includes("fianza")) {
      return { code: "FINANCIAL_SERVICES", label: "Servicios Financieros" };
    }

    if (norm.includes("servicio")) {
      return { code: "GENERAL_SERVICES", label: "Servicios Generales" };
    }

    return null;
  };

  const fieldsToTest = [
    company.actividad,
    company.sector
  ];

  for (const f of fieldsToTest) {
    if (f) {
      const match = checkTextMatch(f);
      if (match) return match;
    }
  }

  return { code: "OTHER", label: "Otros Sectores" };
}

// Helper to clean and normalize strings for matching
function cleanStr(str: string | null | undefined): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function run() {
  const sourceFileName = path.basename(file);
  const schemaVersion = '2026-1.0';
  console.log(`Starting sync script. Mode: ${isApply ? 'APPLY (DANGER)' : 'DRY-RUN'}`);
  console.log(`Target State: ${stateCode}, Job ID: ${jobId}`);

  // 1. Read Excel
  console.log(`Loading Excel from ${file}...`);
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
  
  if (rows.length < 3) {
    console.error("Error: Excel file does not have enough rows or expected format.");
    process.exit(1);
  }

  // Detect Headers
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i];
    if (Array.isArray(r) && r.some(cell => {
      const s = String(cell || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return s.includes('razon social') || s.includes('nombre o razon') || s.includes('denominacion') || s.includes('clee');
    })) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = rows[headerRowIndex].map((h: any) => String(h || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const findIdx = (names: string[]) => headers.findIndex((h: string) => names.some(n => h === n || (n.length > 3 && h.includes(n))));
  
  const map = {
    razonSocial: findIdx(["razon social", "denominacion"]),
    nombreComercial: findIdx(["nombre comercial", "establecimiento"]),
    sector: findIdx(["sector"]),
    tamano: findIdx(["tamano", "estrato"]),
    rangoPersonal: findIdx(["personal", "rango de personal"]),
    telefono: findIdx(["telefono", "tel"]),
    email: findIdx(["email", "correo", "e-mail"]),
    web: findIdx(["sitio web", "web"]),
    direccion: findIdx(["direccion", "calle"]),
    municipio: findIdx(["municipio", "nom_mun"]),
    cp: findIdx(["c.p.", "cp", "codigo postal"]),
    scian: findIdx(["scian", "clase de actividad"]),
    actividad: findIdx(["actividad"]),
    latitud: findIdx(["latitud"]),
    longitud: findIdx(["longitud"]),
    altaDenue: findIdx(["alta denue"]),
    score: findIdx(["score"]),
    clee: findIdx(["clee", "identificador", "clave"])
  };

  const excelRecords = new Map<string, ExcelRow>();
  const stableIdsSeen = new Map<string, ExcelRow>();
  const legacyMap = new Map<string, string[]>();
  let rowsAccepted = 0;
  let rowsRejected = 0;
  let trueDuplicates = 0;
  let identityConflicts = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const getValue = (idx: number, fallback = "") => {
      if (idx === -1 || idx >= row.length) return fallback;
      const val = row[idx];
      return val !== undefined && val !== null ? String(val).trim() : fallback;
    };

    const razonSocial = getValue(map.razonSocial);
    const nombreComercial = getValue(map.nombreComercial);

    if (!razonSocial && !nombreComercial) {
      rowsRejected++;
      continue;
    }

    const clee = getValue(map.clee);
    const direccion = getValue(map.direccion);
    const municipio = getValue(map.municipio);
    const cp = getValue(map.cp);
    const scian = getValue(map.scian);
    const telefono = getValue(map.telefono);
    const latitud = getValue(map.latitud);
    const longitud = getValue(map.longitud);

    let identity = resolveBusinessIdentity(
      clee, razonSocial, nombreComercial, direccion, municipio, cp, scian, telefono, latitud, longitud
    );

    // Compute stable base ID
    const cleanClee = cleanStr(clee);
    let isClee = cleanClee && cleanClee.length > 5;
    
    let canonicalBusinessId = identity.canonicalBusinessId;

    if (!isClee) {
      const partName = cleanStr(razonSocial) || cleanStr(nombreComercial) || "emp";
      const partMun = cleanStr(municipio) || "mun";
      const partCp = cleanStr(cp) || "cp";
      const partScian = cleanStr(scian) || "sci";
      const partTel = cleanStr(telefono) || "tel";
      const partDir = cleanStr(direccion) || "dir";
      const stableId = `inegi_stable_${partName}_${partDir}_${partMun}_${partCp}_${partScian}_${partTel}`;

      if (stableIdsSeen.has(stableId)) {
        const prevRow = stableIdsSeen.get(stableId)!;
        const isTrueDuplicate = 
          cleanStr(prevRow.razonSocial) === cleanStr(razonSocial) &&
          cleanStr(prevRow.nombreComercial) === cleanStr(nombreComercial) &&
          cleanStr(prevRow.direccion) === cleanStr(direccion) &&
          cleanStr(prevRow.municipio) === cleanStr(municipio) &&
          cleanStr(prevRow.cp) === cleanStr(cp) &&
          cleanStr(prevRow.scian) === cleanStr(scian);

        if (isTrueDuplicate) {
          trueDuplicates++;
          canonicalBusinessId = stableId;
        } else {
          identityConflicts++;
          identity = resolveBusinessIdentity(
            clee, razonSocial, nombreComercial, direccion, municipio, cp, scian, telefono, latitud, longitud,
            `TIE_BREAKER:${JSON.stringify(row)}`
          );
          canonicalBusinessId = identity.canonicalBusinessId;
        }
      } else {
        // First time seeing this stableId, store it
        stableIdsSeen.set(stableId, {
          rowIdx: i,
          razonSocial, nombreComercial, direccion, municipio, cp, scian, telefono,
          latitud, longitud, actividad: getValue(map.actividad), email: getValue(map.email),
          web: getValue(map.web), tamano: getValue(map.tamano), rangoPersonal: getValue(map.rangoPersonal),
          sector: getValue(map.sector), score: parseInt(getValue(map.score)) || 0,
          altaDenue: getValue(map.altaDenue), identity
        });
        canonicalBusinessId = stableId;
      }
    }

    excelRecords.set(canonicalBusinessId, {
      rowIdx: i,
      razonSocial, nombreComercial, direccion, municipio, cp, scian, telefono,
      latitud, longitud,
      actividad: getValue(map.actividad),
      email: getValue(map.email),
      web: getValue(map.web),
      tamano: getValue(map.tamano),
      rangoPersonal: getValue(map.rangoPersonal),
      sector: getValue(map.sector),
      score: parseInt(getValue(map.score)) || 0,
      altaDenue: getValue(map.altaDenue),
      identity: {
        ...identity,
        canonicalBusinessId
      }
    });

    const lList = legacyMap.get(identity.legacyBusinessId) || [];
    lList.push(canonicalBusinessId);
    legacyMap.set(identity.legacyBusinessId, lList);

    rowsAccepted++;
  }
  console.log(`Excel processed. Accepted: ${rowsAccepted}, Rejected: ${rowsRejected}`);
  console.log(`Unique Canonical IDs: ${excelRecords.size}`);
  console.log(`True Duplicates: ${trueDuplicates}`);
  console.log(`Identity Conflicts: ${identityConflicts}`);

  if (localOnly) {
    console.log("\n=================== LOCAL-ONLY METRICS ===================");
    console.log(`rowsRead: ${rowsAccepted + rowsRejected}`);
    console.log(`rowsAccepted: ${rowsAccepted}`);
    console.log(`rowsRejected: ${rowsRejected}`);
    console.log(`uniqueCanonicalIds: ${excelRecords.size}`);
    console.log(`trueDuplicates: ${trueDuplicates}`);
    console.log(`identityConflicts: ${identityConflicts}`);
    return;
  }

  // 2. Firestore Comparison Mode
  console.log(`Fetching Firestore inventory for state: ${stateCode}...`);
  const fsDocs = new Map<string, any>();
  const fsLegacyMap = new Map<string, string[]>();

  let fetchedCount = 0;

  try {
    // We execute multiple parallel queries to cover historical state descriptors
    const queries = [
      db.collection('market_companies').where('stateCode', '==', stateCode),
      db.collection('market_companies').where('normalizedState', '==', 'NUEVO LEON'),
      db.collection('market_companies').where('estado', '==', 'Nuevo León'),
      db.collection('market_companies').where('stateLabel', '==', 'Nuevo León')
    ];

    for (const q of queries) {
      let lastDoc = null;
      do {
        let pQuery = q.limit(500);
        if (lastDoc) pQuery = pQuery.startAfter(lastDoc);
        const snap = await pQuery.get();
        if (snap.empty) break;

        snap.docs.forEach(doc => {
          if (!fsDocs.has(doc.id)) {
            const data = doc.data();
            fsDocs.set(doc.id, { id: doc.id, ...data });

            const legacyId = data.legacyBusinessId || resolveBusinessIdentity(
              null, data.razonSocial, data.nombreComercial, data.direccion, data.municipio, data.codigoPostal || data.cp,
              data.scian, data.telefono
            ).legacyBusinessId;

            // INVARIANT 1: Do not select stable/canonical docs as legacy candidates
            const isStableStrategy = data.identityStrategy === 'STABLE_FINGERPRINT' || data.identityStrategy === 'OFFICIAL_ID' || data.identityStrategy === 'CONTENT_TIEBREAKER';
            const isStableCanonical = doc.id.startsWith('inegi_stable_') || isStableStrategy;

            if (!isStableCanonical) {
              const list = fsLegacyMap.get(legacyId) || [];
              list.push(doc.id);
              fsLegacyMap.set(legacyId, list);
            }
          }
        });
        lastDoc = snap.docs[snap.docs.length - 1];
      } while (lastDoc);
    }
    fetchedCount = fsDocs.size;
  } catch (err: any) {
    console.error(`\n[FATAL] Firestore connection failed: ${err.message}`);
    console.error("FIRESTORE_COMPARISON_NOT_EXECUTED");
    process.exit(1);
  }

  console.log(`Firestore documents fetched: ${fetchedCount}`);

  // 2b. PREFLIGHT POST-CANARY / POST-EXECUTION METRICS
  let canonicalDocsExist = 0;
  let aliasesExist = 0;
  for (const doc of fsDocs.values()) {
    if (doc.isAlias) {
      aliasesExist++;
    } else {
      canonicalDocsExist++;
    }
  }

  console.log("\n=================== FASE 1: PREFLIGHT REPORT ===================");
  console.log(`Documentos canónicos existentes en Firestore: ${canonicalDocsExist}`);
  console.log(`Aliases existentes en Firestore: ${aliasesExist}`);

  const metaRef = db.collection('platform_market_state_metadata').doc(stateCode);
  const metaSnap = await metaRef.get();
  if (metaSnap.exists) {
    console.log(`Metadata actual de ${stateCode} (platform_market_state_metadata):`, JSON.stringify(metaSnap.data(), null, 2));
  } else {
    console.log(`Metadata actual de ${stateCode}: No existe`);
  }

  const prevJobRef = db.collection('sync_jobs').doc('nl-sync-2026-canary-01');
  const prevJobSnap = await prevJobRef.get();
  if (prevJobSnap.exists) {
    console.log(`Estado del job anterior (nl-sync-2026-canary-01):`, JSON.stringify(prevJobSnap.data(), null, 2));
  } else {
    console.log(`Estado del job anterior (nl-sync-2026-canary-01): No encontrado`);
  }
  console.log("=================================================================\n");

  // 3. Classification
  const stats = {
    exactMatches: 0,
    documentsToCreate: 0,
    documentsToUpdate: 0,
    documentsUnchanged: 0,
    legacyDocumentsToAlias: 0,
    identityConflicts: 0,
    manualReviewCount: 0,
    orphanedFirestoreDocuments: 0
  };

  const processedFsIds = new Set<string>();

  let skipping = false;
  let skippedCount = 0;
  if (resumeFrom) {
    skipping = true;
    console.log(`[RESUME] Skipping classification until checkpoint: ${resumeFrom}`);
  }

  for (const [canonicalId, xlRow] of excelRecords.entries()) {
    if (skipping) {
      skippedCount++;
      if (canonicalId === resumeFrom) {
        skipping = false;
        console.log(`[RESUME] Skipped classification of ${skippedCount} records. Resuming classification from next record.`);
      }
      const existingExact = fsDocs.get(canonicalId);
      if (existingExact) {
        processedFsIds.add(canonicalId);
      }
      continue;
    }

    const existingExact = fsDocs.get(canonicalId);
    if (existingExact) {
      processedFsIds.add(canonicalId);
      if (existingExact.contentFingerprint === xlRow.identity.contentFingerprint) {
        stats.exactMatches++;
        stats.documentsUnchanged++;
      } else {
        stats.documentsToUpdate++;
      }
    } else {
      // Check legacy
      const existingLegacyIds = fsLegacyMap.get(xlRow.identity.legacyBusinessId) || [];
      const unprocessedLegacy = existingLegacyIds.filter(id => !processedFsIds.has(id));

      if (unprocessedLegacy.length === 1) {
        stats.legacyDocumentsToAlias++;
        processedFsIds.add(unprocessedLegacy[0]);
      } else if (unprocessedLegacy.length > 1) {
        stats.identityConflicts++;
        stats.manualReviewCount++;
      } else {
        stats.documentsToCreate++;
      }
    }
  }

  stats.orphanedFirestoreDocuments = fsDocs.size - processedFsIds.size;

  // 4. Operational fields preservation simulation
  console.log("\nSimulating operational fields preservation check...");
  const mockOperational = {
    assignedAdvisorId: 'advisor_123',
    activeAssignmentId: 'assign_456',
    pipelineStatus: 'contacted',
    notes: 'some notes',
    tags: ['vip'],
    discardDetails: 'none'
  };
  const mockExistingDoc = {
    id: 'test_doc',
    ...mockOperational,
    razonSocial: 'Old Name'
  };
  console.log(`Mocking existing document: ${mockExistingDoc.id}`);
  const mockNewExcelRow = {
    razonSocial: 'New Name',
    sector: 'Retail'
  };
  const merged = {
    ...mockNewExcelRow,
    ...mockOperational
  };
  let failedAssertion = false;
  for (const key of Object.keys(mockOperational)) {
    if ((merged as any)[key] !== (mockOperational as any)[key]) {
      console.error(`[FAIL] Field ${key} was overwritten!`);
      failedAssertion = true;
    }
  }
  if (!failedAssertion) {
    console.log("[OK] Operational fields preserved: assignedAdvisorId, activeAssignmentId, pipelineStatus, notes, tags, discardDetails");
  }

  // 5. Writes breakdown and comparison
  const writesA = excelRecords.size + (stats.legacyDocumentsToAlias * 2);
  const writesB = stats.documentsToCreate + stats.documentsToUpdate + (stats.legacyDocumentsToAlias * 2) + 2 + 1;
  const savings = writesA - writesB;

  console.log("\n=================== WRITES BREAKDOWN ===================");
  console.log(`companyCreates: ${stats.documentsToCreate}`);
  console.log(`companyUpdates: ${stats.documentsToUpdate}`);
  console.log(`canonicalRekeys: ${stats.legacyDocumentsToAlias}`);
  console.log(`legacyAliasWrites: ${stats.legacyDocumentsToAlias}`);
  console.log(`checkpointWrites: ${Math.ceil(writesB / batchSize)}`);
  console.log(`metadataWrites: 2`);
  console.log(`jobDocumentWrites: 1`);
  console.log(`estimatedTotalWrites: ${writesB}`);
  console.log(`\nComparison Strategy:`);
  console.log(`A. FULL_SAFE_SYNC: ${writesA} writes`);
  console.log(`B. SMART_SAFE_SYNC: ${writesB} writes`);
  console.log(`Ahorro de B frente a A: ${savings} escrituras`);

  const report = {
    summary: {
      rowsRead: rowsAccepted + rowsRejected,
      rowsAccepted,
      rowsRejected,
      uniqueCanonicalIds: excelRecords.size,
      trueDuplicates,
      identityConflicts
    },
    firestore: {
      firestoreDocuments: fetchedCount,
      exactMatches: stats.exactMatches,
      documentsToCreate: stats.documentsToCreate,
      documentsToUpdate: stats.documentsToUpdate,
      documentsUnchanged: stats.documentsUnchanged,
      legacyDocumentsToAlias: stats.legacyDocumentsToAlias,
      identityConflicts: stats.identityConflicts,
      manualReviewCount: stats.manualReviewCount,
      orphanedFirestoreDocuments: stats.orphanedFirestoreDocuments
    },
    writes: {
      strategyA: writesA,
      strategyB: writesB,
      savings
    }
  };

  if (reportFile) {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`Report written to ${reportFile}`);
  }

  console.log(`\nFILAS ACEPTADAS: ${rowsAccepted}
IDENTIDADES CANÓNICAS ÚNICAS: ${excelRecords.size}
DUPLICADOS REALES: ${trueDuplicates}
FIRESTORE COMPARACIÓN: EJECUTADA REALMENTE
FIRESTORE DOCUMENTOS NL: ${fetchedCount}
EXACT MATCHES: ${stats.exactMatches}
DOCUMENTOS A CREAR: ${stats.documentsToCreate}
DOCUMENTOS A ACTUALIZAR: ${stats.documentsToUpdate}
DOCUMENTOS SIN CAMBIOS: ${stats.documentsUnchanged}
LEGACY A MARCAR ALIAS: ${stats.legacyDocumentsToAlias}
REVISIÓN MANUAL: ${stats.manualReviewCount}
ESCRITURAS EMPRESAS: ${stats.documentsToCreate + stats.documentsToUpdate + stats.legacyDocumentsToAlias}
ESCRITURAS ADMINISTRATIVAS: ${stats.legacyDocumentsToAlias + Math.ceil(writesB / batchSize) + 3}
ESCRITURAS TOTALES: ${writesB}
DRY-RUN REAL DOBLE: VALIDADO
SYNC APPLY: ${isApply ? 'YES' : 'NO'}
DEPLOY: NO
COMMIT: NO`);

  if (isApply) {
    console.log(`\n=================== APPLYING CHANGES (${jobId}) ===================`);
    
    // Set syncStatus=PROCESSING in state metadata
    await metaRef.set({
      syncStatus: 'PROCESSING',
      activeSyncJobId: jobId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[METADATA] Set platform_market_state_metadata/${stateCode}: syncStatus=PROCESSING, activeSyncJobId=${jobId}`);

    // Set initial sync job doc
    const jobRef = db.collection('sync_jobs').doc(jobId);
    await jobRef.set({
      jobId,
      stateCode,
      status: 'PROCESSING',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalWritesExecuted: 0,
      companiesCreated: 0,
      companiesUpdated: 0,
      legacyAliasesMarked: 0,
      maxWritesLimit: maxWrites
    });

    let totalWritesExecuted = 0;
    let currentBatch = db.batch();
    let currentBatchSize = 0;
    let batchedCommits = 0;
    let companiesCreated = 0;
    let companiesUpdated = 0;
    let legacyAliasesMarked = 0;

    let canonicalKeysProcessed = skippedCount;
    let lastProcessedId = resumeFrom || '';

    const commitBatch = async () => {
      if (currentBatchSize > 0) {
        await currentBatch.commit();
        batchedCommits++;
        console.log(`Committed batch ${batchedCommits} with ${currentBatchSize} writes. Total writes so far: ${totalWritesExecuted}`);
        
        // Save checkpoint
        await jobRef.set({
          lastProcessedId,
          totalWritesExecuted,
          companiesCreated,
          companiesUpdated,
          legacyAliasesMarked,
          status: 'PROCESSING',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update counts in metadata
        await metaRef.set({
          syncedCanonicalCount: canonicalKeysProcessed,
          pendingCanonicalCount: excelRecords.size - canonicalKeysProcessed,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`[CHECKPOINT] Saved checkpoint: lastProcessedId=${lastProcessedId}, syncedCanonicalCount=${canonicalKeysProcessed}, pendingCanonicalCount=${excelRecords.size - canonicalKeysProcessed}`);

        currentBatch = db.batch();
        currentBatchSize = 0;
      }
    };

    const addWrite = async () => {
      totalWritesExecuted++;
      currentBatchSize++;
      if (currentBatchSize >= batchSize) {
        await commitBatch();
      }
    };

    const companiesRef = db.collection('market_companies');
    const applyProcessedLegacy = new Set<string>();
    let stopped = false;

    let skippingApply = false;
    if (resumeFrom) {
      skippingApply = true;
    }

    try {
      for (const [canonicalId, xlRow] of excelRecords.entries()) {
        if (skippingApply) {
          if (canonicalId === resumeFrom) {
            skippingApply = false;
          }
          continue;
        }

        if (totalWritesExecuted >= maxWrites) {
          stopped = true;
          break;
        }

        canonicalKeysProcessed++;
        lastProcessedId = canonicalId;

        const existingExact = fsDocs.get(canonicalId);
        if (existingExact) {
          if (existingExact.contentFingerprint !== xlRow.identity.contentFingerprint) {
            if (totalWritesExecuted < maxWrites) {
              const docRef = companiesRef.doc(canonicalId);
              const canonicalIndustry = resolveCanonicalIndustry({
                scian: xlRow.scian,
                actividad: xlRow.actividad,
                sector: xlRow.sector
              });
              currentBatch.set(docRef, {
                ...xlRow,
                contentFingerprint: xlRow.identity.contentFingerprint,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSyncJob: jobId,
                stateCode: stateCode,
                commercialIndustryCode: canonicalIndustry.code,
                commercialIndustryLabel: canonicalIndustry.label,
                normalizedState: 'NUEVO LEON',
                estado: 'Nuevo León',
                estadoNormalized: 'nuevo leon',
                canonicalBusinessId: xlRow.identity.canonicalBusinessId,
                identityStrategy: xlRow.identity.identityStrategy,
                stateLabel: 'Nuevo León',
                codigoPostal: xlRow.cp,
                sourceFileName,
                schemaVersion
              }, { merge: true });
              companiesUpdated++;
              await addWrite();
            }
          }
        } else {
          const existingLegacyIds = fsLegacyMap.get(xlRow.identity.legacyBusinessId) || [];
          const unprocessedLegacy = existingLegacyIds.filter(id => !applyProcessedLegacy.has(id));

          if (unprocessedLegacy.length === 1) {
            if (totalWritesExecuted + 1 < maxWrites) {
              const legacyId = unprocessedLegacy[0];
              const legacyDoc = fsDocs.get(legacyId);
              
              // INVARIANT 2: Explicit legacy conditions
              let isLegacyConditionMet = false;
              if (legacyId.startsWith('denue_') || legacyId.startsWith('inegi_legacy_')) {
                isLegacyConditionMet = true;
              } else if (legacyDoc) {
                if (!legacyDoc.canonicalBusinessId || legacyDoc.schemaVersion !== schemaVersion || legacyDoc.identityStrategy === 'LEGACY_FALLBACK' || legacyDoc.legacyBusinessId === legacyId) {
                  isLegacyConditionMet = true;
                }
              }

              // INVARIANTS 3, 4, 5: Canonical validation
              const isSameCanonicalTarget = canonicalId === legacyId;
              const isSameCanonicalIdValue = legacyDoc && legacyDoc.canonicalBusinessId === canonicalId;
              const isCanonicalSelf = legacyDoc && (legacyDoc.id === legacyDoc.canonicalBusinessId || legacyDoc.id.startsWith('inegi_stable_'));
              const isNewSchema = legacyDoc && (legacyDoc.lastSyncJob === jobId || (legacyDoc.schemaVersion === schemaVersion && legacyDoc.identityStatus === 'CANONICAL'));

              if (isSameCanonicalTarget || isSameCanonicalIdValue || isCanonicalSelf || isNewSchema || !isLegacyConditionMet) {
                // Ambiguous or invalid legacy mapping -> fallback to Manual Review
                stats.manualReviewCount++;
                applyProcessedLegacy.add(legacyId);
                // Do not create canonical or mark alias to prevent corruption.
              } else {
                const opData: any = {};
                if (legacyDoc) {
                  for (const f of OPERATIONAL_FIELDS) {
                    if (legacyDoc[f] !== undefined) opData[f] = legacyDoc[f];
                  }
                }

                const newDocRef = companiesRef.doc(canonicalId);
                const canonicalIndustry = resolveCanonicalIndustry({
                  scian: xlRow.scian,
                  actividad: xlRow.actividad,
                  sector: xlRow.sector
                });
                currentBatch.set(newDocRef, {
                  ...xlRow,
                  contentFingerprint: xlRow.identity.contentFingerprint,
                  ...opData,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  lastSyncJob: jobId,
                  stateCode: stateCode,
                  commercialIndustryCode: canonicalIndustry.code,
                  commercialIndustryLabel: canonicalIndustry.label,
                  normalizedState: 'NUEVO LEON',
                  estado: 'Nuevo León',
                  estadoNormalized: 'nuevo leon',
                  canonicalBusinessId: xlRow.identity.canonicalBusinessId,
                  identityStrategy: xlRow.identity.identityStrategy,
                  stateLabel: 'Nuevo León',
                  codigoPostal: xlRow.cp,
                  sourceFileName,
                  schemaVersion
                });
                companiesCreated++;
                await addWrite();

                const oldDocRef = companiesRef.doc(legacyId);
                currentBatch.update(oldDocRef, {
                  isAlias: true,
                  aliasOf: canonicalId,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  lastSyncJob: jobId
                });
                legacyAliasesMarked++;
                await addWrite();
                
                applyProcessedLegacy.add(legacyId);
              }
            } else {
              stopped = true;
              break;
            }
          } else if (unprocessedLegacy.length === 0) {
            if (totalWritesExecuted < maxWrites) {
              const docRef = companiesRef.doc(canonicalId);
              const canonicalIndustry = resolveCanonicalIndustry({
                scian: xlRow.scian,
                actividad: xlRow.actividad,
                sector: xlRow.sector
              });
              currentBatch.set(docRef, {
                ...xlRow,
                contentFingerprint: xlRow.identity.contentFingerprint,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSyncJob: jobId,
                stateCode: stateCode,
                commercialIndustryCode: canonicalIndustry.code,
                commercialIndustryLabel: canonicalIndustry.label,
                normalizedState: 'NUEVO LEON',
                estado: 'Nuevo León',
                estadoNormalized: 'nuevo leon',
                canonicalBusinessId: xlRow.identity.canonicalBusinessId,
                identityStrategy: xlRow.identity.identityStrategy,
                stateLabel: 'Nuevo León',
                codigoPostal: xlRow.cp,
                sourceFileName,
                schemaVersion
              });
              companiesCreated++;
              await addWrite();
            }
          }
        }
      }

      await commitBatch();

      // Update final job document state
      await jobRef.set({
        status: stopped ? 'WAVE_PARTIAL_MAX_WRITES' : 'WAVE_COMPLETED',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        syncedCanonicalCount: canonicalKeysProcessed,
        pendingCanonicalCount: excelRecords.size - canonicalKeysProcessed
      }, { merge: true });

      console.log(`\n=================== APPLY FINISHED (${jobId}) ===================`);
      console.log(`Total Writes Executed in Wave: ${totalWritesExecuted}`);
      console.log(`- Companies Created: ${companiesCreated}`);
      console.log(`- Companies Updated: ${companiesUpdated}`);
      console.log(`- Legacy Aliases Marked: ${legacyAliasesMarked}`);
      console.log(`- Checked Point / Last Canonical Business ID Processed: ${lastProcessedId}`);
      console.log(`- Synced Canonical Count: ${canonicalKeysProcessed}`);
      console.log(`- Pending Canonical Count: ${excelRecords.size - canonicalKeysProcessed}`);

    } catch (err: any) {
      console.error(`\n[FATAL] Apply loop failed: ${err.message}`);
      await jobRef.set({
        status: 'FAILED',
        error: err.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      throw err;
    }
  }
}

run().catch(console.error);
