import {
  getDoc,
  setDoc,
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../../config/firebase";
import type { CompanyStatus, InegiCompany } from "../types/inegi";
import type { PlatformOrganization } from "../../../types/platformOrganization";

const MARKET_COMPANIES_COLLECTION = "market_companies";

/**
 * Ejecuta una función asíncrona con reintentos y retroceso exponencial (Exponential Backoff).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  exponential = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Firestore operation failed. Retrying in ${delay}ms... Remaining retries: ${retries}. Error:`, error);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * exponential, exponential);
  }
}
const ORGANIZATIONS_COLLECTION = "platform_organizations";

// Parámetros configurables del UPSERT Enterprise
const UPSERT_READ_CHUNK_SIZE = 30;   // Límite de elementos para la cláusula "in" en Firestore
const UPSERT_WRITE_CHUNK_SIZE = 100; // Tamaño del lote para writeBatch de Firestore

export interface ImportHistoryEntry {
  id: string;
  timestamp: any;
  filename: string;
  totalProcessed: number;
  newAdded: number;
  updated: number;
  omitted: number;
  failed: number;
  timeMs: number;
  source: string;
  sourceVersion: string;
}

const DEFAULT_CONSULTANT = {
  id: "jcuellar",
  name: "Javier Cuéllar Lazarini",
  email: "jcuellar@aura-hcm.com",
};

/**
 * Importa prospectos de INEGI en lotes utilizando writeBatch (máximo 500 registros por lote).
 * Utiliza IDs determinísticos de forma que no genere costos de lectura y evite duplicados.
 */
/**
 * Importa prospectos de INEGI aplicando la política UPSERT Enterprise.
 * Divide los registros en lotes y comprueba su existencia y cambios para minimizar costos de escritura.
 */
export async function importMarketCompaniesBatch(
  companies: InegiCompany[],
  onProgress?: (progress: { processed: number; total: number }) => void,
  options?: { skipHistory?: boolean }
): Promise<{ 
  added: number; 
  overwritten: number; 
  omitted: number; 
  failed: number;
  historyId: string;
  timeMs: number;
  failedCompanies?: InegiCompany[];
  
  // Telemetría de diagnóstico de batch
  duplicateReadStart: string;
  duplicateReadEnd: string;
  duplicateReadMs: number;
  batchCommitStart: string;
  batchCommitEnd: string;
  batchCommitMs: number;
}> {
  const startTime = Date.now();
  let added = 0;
  let overwritten = 0;
  let omitted = 0;
  let failed = 0;
  const failedCompaniesList: InegiCompany[] = [];

  const nowStr = new Date().toISOString();

  // Variables para telemetría del batch
  let duplicateReadStartStr = "";
  let duplicateReadEndStr = "";
  let duplicateReadMs = 0;
  let batchCommitStartStr = "";
  let batchCommitEndStr = "";
  let batchCommitMs = 0;

  // Procesar escrituras en sub-lotes configurables (en executeImportJob companies tiene un tamaño máximo de 100)
  for (let i = 0; i < companies.length; i += UPSERT_WRITE_CHUNK_SIZE) {
    const chunk = companies.slice(i, i + UPSERT_WRITE_CHUNK_SIZE);
    const ids = chunk.map(c => c.id);

    // 1. Consultar existencia y estado actual en base mediante chunks de lectura de 30
    const existingDocsMap = new Map<string, any>();
    
    const readStart = Date.now();
    duplicateReadStartStr = new Date().toLocaleTimeString() + "." + String(Date.now() % 1000).padStart(3, "0");

    for (let j = 0; j < ids.length; j += UPSERT_READ_CHUNK_SIZE) {
      const idGroup = ids.slice(j, j + UPSERT_READ_CHUNK_SIZE);
      try {
        const q = query(
          collection(db, MARKET_COMPANIES_COLLECTION),
          where("__name__", "in", idGroup)
        );
        const snap = await retryWithBackoff(() => getDocs(q), 3, 1000);
        snap.forEach(doc => {
          existingDocsMap.set(doc.id, doc.data());
        });
      } catch (err) {
        console.error("Error al consultar existencia de IDs en importación:", err);
      }
    }

    const readEnd = Date.now();
    duplicateReadEndStr = new Date().toLocaleTimeString() + "." + String(Date.now() % 1000).padStart(3, "0");
    duplicateReadMs = readEnd - readStart;

    // 2. Preparar el lote de escritura (Upsert)
    const batch = writeBatch(db);
    let batchHasWrites = false;
    let chunkAdded = 0;
    let chunkOverwritten = 0;
    let chunkOmitted = 0;

    for (const company of chunk) {
      const existing = existingDocsMap.get(company.id);

      if (!existing) {
        // Nuevo registro: Crear con auditoría
        const docRef = doc(db, MARKET_COMPANIES_COLLECTION, company.id);
        batch.set(docRef, {
          ...company,
          firstImportedAt: nowStr,
          lastImportAt: nowStr,
          lastUpdatedAt: nowStr,
          importCount: 1,
          source: "INEGI",
          sourceVersion: "DENUE-2026",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        chunkAdded++;
        batchHasWrites = true;
      } else {
        // Comprobar si cambió algún campo crítico
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
          existing.cp !== company.cp ||
          existing.scian !== company.scian ||
          existing.actividad !== company.actividad;

        if (!hasChanged) {
          // Idéntico: Omitir escritura
          chunkOmitted++;
        } else {
          // Cambió: Actualizar campos modificados
          const docRef = doc(db, MARKET_COMPANIES_COLLECTION, company.id);
          const updates: Record<string, any> = {
            razonSocial: company.razonSocial,
            nombreComercial: company.nombreComercial,
            sector: company.sector,
            tamano: company.tamano,
            rangoPersonal: company.rangoPersonal,
            telefono: company.telefono,
            email: company.email,
            sitioWeb: company.sitioWeb,
            direccion: company.direccion,
            municipio: company.municipio,
            estado: company.estado,
            cp: company.cp,
            scian: company.scian,
            actividad: company.actividad,
            latitud: company.latitud,
            longitud: company.longitud,
            altaDenue: company.altaDenue,
            sourceScore: company.sourceScore,
            opportunityScore: company.opportunityScore,
            scoreBreakdown: company.scoreBreakdown,
            recommendedSuites: company.recommendedSuites,
            priorityLevel: company.priorityLevel || "LOW",
            motives: company.motives || [],
            nextAction: company.nextAction || "",
            lastImportAt: nowStr,
            lastUpdatedAt: nowStr,
            importCount: (existing.importCount || 1) + 1,
            updatedAt: serverTimestamp(),
          };

          batch.update(docRef, updates);
          chunkOverwritten++;
          batchHasWrites = true;
        }
      }
    }

    const commitStart = Date.now();
    batchCommitStartStr = new Date().toLocaleTimeString() + "." + String(Date.now() % 1000).padStart(3, "0");

    // 3. Ejecutar lote de escrituras
    if (batchHasWrites) {
      try {
        await retryWithBackoff(() => batch.commit(), 3, 1000);
        added += chunkAdded;
        overwritten += chunkOverwritten;
        omitted += chunkOmitted;
      } catch (err) {
        console.error("Error al escribir lote de importación después de reintentos:", err);
        failed += chunk.length;
        failedCompaniesList.push(...chunk);
      }
    } else {
      omitted += chunkOmitted;
    }

    const commitEnd = Date.now();
    batchCommitEndStr = new Date().toLocaleTimeString() + "." + String(Date.now() % 1000).padStart(3, "0");
    batchCommitMs = batchHasWrites ? (commitEnd - commitStart) : 0;

    if (onProgress) {
      onProgress({
        processed: Math.min(i + UPSERT_WRITE_CHUNK_SIZE, companies.length),
        total: companies.length,
      });
    }
  }

  // 4. Actualizar metadatos de estados acumulados
  const statesInBatch = Array.from(
    new Set(companies.map((c) => c.estado).filter((s) => s && s.trim().length > 0))
  );
  if (statesInBatch.length > 0) {
    try {
      await updateUniqueStates(statesInBatch);
    } catch (err) {
      console.warn("No se pudieron actualizar los estados únicos en metadatos:", err);
    }
  }

  const timeMs = Date.now() - startTime;

  // 5. Registrar Historial de Importaciones en base (Prioridad 4)
  const historyRef = doc(collection(db, "market_imports_history"));
  const historyId = historyRef.id;
  if (!options?.skipHistory) {
    try {
      await setDoc(historyRef, {
        id: historyId,
        timestamp: serverTimestamp(),
        filename: "Importación Masiva Excel",
        totalProcessed: companies.length,
        newAdded: added,
        updated: overwritten,
        omitted,
        failed,
        timeMs,
        source: "INEGI",
        sourceVersion: "DENUE-2026",
      });
    } catch (err) {
      console.error("Error al registrar historial de importación:", err);
    }
  }

  return { 
    added, 
    overwritten, 
    omitted, 
    failed, 
    historyId, 
    timeMs, 
    failedCompanies: failedCompaniesList,
    duplicateReadStart: duplicateReadStartStr,
    duplicateReadEnd: duplicateReadEndStr,
    duplicateReadMs,
    batchCommitStart: batchCommitStartStr,
    batchCommitEnd: batchCommitEndStr,
    batchCommitMs
  };
}

/**
 * Recupera el historial de las últimas 20 importaciones registradas.
 */
export async function getImportHistory(): Promise<ImportHistoryEntry[]> {
  try {
    const q = query(
      collection(db, "market_imports_history"),
      limit(20)
    );
    const snap = await getDocs(q);
    const list: ImportHistoryEntry[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: doc.id,
        timestamp: data.timestamp,
        filename: data.filename || "Archivo de Importación",
        totalProcessed: data.totalProcessed || 0,
        newAdded: data.newAdded || 0,
        updated: data.updated || 0,
        omitted: data.omitted || 0,
        failed: data.failed || 0,
        timeMs: data.timeMs || 0,
        source: data.source || "INEGI",
        sourceVersion: data.sourceVersion || "DENUE-2026",
      });
    });
    // Ordenar descendente (más recientes primero)
    return list.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.warn("No se pudo obtener el historial de importaciones:", err);
    return [];
  }
}

/**
 * Obtiene la lista de estados únicos cargados en el sistema desde el documento de metadatos.
 * Si el documento no existe o está vacío, devuelve la muestra piloto por defecto.
 */
export async function getUniqueStates(): Promise<string[]> {
  try {
    const docRef = doc(db, "market_companies_metadata", "states");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.states) && data.states.length > 0) {
        return data.states;
      }
    }
  } catch (err) {
    console.warn("No se pudieron cargar los estados únicos desde Firestore:", err);
  }
  // Fallback piloto por defecto
  return ["Querétaro", "Nuevo León"];
}

/**
 * Agrega nuevos estados únicos a la lista acumulada de metadatos utilizando una transacción.
 */
export async function updateUniqueStates(newStates: string[]): Promise<void> {
  if (newStates.length === 0) return;
  const docRef = doc(db, "market_companies_metadata", "states");
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      let currentStates: string[] = ["Querétaro", "Nuevo León"];
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.states)) {
          currentStates = data.states;
        }
      }

      // Combinar, eliminar duplicados y ordenar alfabéticamente
      const merged = Array.from(
        new Set([
          ...currentStates,
          ...newStates.map((s) => s.trim()).filter((s) => s.length > 0)
        ])
      ).sort();

      transaction.set(docRef, { states: merged });
    });
  } catch (err) {
    console.error("Error al actualizar estados únicos en transacción:", err);
    throw err;
  }
}

/**
 * Obtiene prospectos filtrados por Estado en Firestore con un límite de costo opcional.
 * Todo el refinamiento secundario ocurre en memoria mediante el Market Query Engine.
 */
export async function getMarketCompanies(
  filters: {
    estado?: string;
  },
  limitCount?: number
): Promise<InegiCompany[]> {
  const collRef = collection(db, MARKET_COMPANIES_COLLECTION);
  const queryConstraints: any[] = [];

  if (filters.estado && filters.estado !== "No Especificado") {
    queryConstraints.push(where("estado", "==", filters.estado));
  }

  if (limitCount !== undefined) {
    queryConstraints.push(limit(limitCount));
  }

  const q = query(collRef, ...queryConstraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<InegiCompany, "id">),
  }));
}

/**
 * Actualiza el estatus de un prospecto de mercado.
 */
export async function updateMarketCompanyStatus(
  companyId: string,
  status: CompanyStatus
): Promise<void> {
  const docRef = doc(db, MARKET_COMPANIES_COLLECTION, companyId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Convierte una empresa INEGI/DENUE en una Organización Consultiva en Aura Control Center.
 * Crea el expediente en platform_organizations, inicializa su timeline y cambia el estado a CONVERTED.
 */
export async function convertMarketCompanyToOrganization(
  company: InegiCompany
): Promise<string> {
  // Generar ID del timeline de forma similar al servicio principal
  const createTimelineEvent = (type: string, title: string, description: string) => ({
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    description,
    createdAt: Timestamp.now(),
  });

  const timeline = [
    createTimelineEvent(
      "ORGANIZATION_CREATED",
      "Expediente Prospectado de DENUE 2026",
      `La organización fue identificada y convertida desde Aura Market Intelligence con un Score de Oportunidad Aura de ${company.opportunityScore}%.`
    ),
    createTimelineEvent(
      "STAGE_UPDATED",
      "Fase de Diagnóstico Iniciada",
      "Se asignó la etapa inicial DISCOVERY para proceder con el descubrimiento de necesidades."
    ),
    createTimelineEvent(
      "CONSULTANT_ASSIGNED",
      "Consultor Asignado",
      `${DEFAULT_CONSULTANT.name} fue asignado automáticamente como consultor principal.`
    ),
  ];

  // Estructura de PlatformOrganization basada en el tipo del proyecto
  const organizationInput: Omit<PlatformOrganization, "id" | "createdAt" | "updatedAt"> = {
    companyName: company.nombreComercial || company.razonSocial || "Empresa Sin Nombre",
    contactName: "Contacto General",
    email: company.email || "contacto@empresa.com",
    phone: company.telefono || "",
    industry: company.sector || "Servicios",
    companySize: company.tamano || "Micro",
    mainChallenge: `Foco comercial originado en Aura Prospect Intelligence. Razón Social: ${company.razonSocial || "N/A"}. Actividad: ${company.actividad || "N/A"}.`,
    interestAreas: company.recommendedSuites,
    stage: "DISCOVERY",
    priority: company.opportunityScore >= 75 ? "HIGH" : company.opportunityScore >= 45 ? "MEDIUM" : "LOW",
    recommendedNextStep: "Programar llamada de presentación y validar el scoring de suites recomendadas.",
    notes: `Ubicación: ${company.direccion}, ${company.municipio}, C.P. ${company.cp}. Coordenadas: Lat ${company.latitud}, Lng ${company.longitud}. Código SCIAN: ${company.scian}. Alta DENUE: ${company.altaDenue}.`,
    source: "DENUE 2026",
    assignedConsultantId: DEFAULT_CONSULTANT.id,
    assignedConsultantName: DEFAULT_CONSULTANT.name,
    assignedConsultantEmail: DEFAULT_CONSULTANT.email,
    assignedAt: Timestamp.now(),
    timeline: timeline as any,
  };

  let newOrgId = "";

  // Usar una transacción para garantizar consistencia:
  // 1. Crear el expediente en platform_organizations.
  // 2. Actualizar el estatus de la empresa en market_companies a CONVERTED.
  await runTransaction(db, async (transaction) => {
    const orgsCollectionRef = collection(db, ORGANIZATIONS_COLLECTION);
    const companyDocRef = doc(db, MARKET_COMPANIES_COLLECTION, company.id);

    // Añadir documento de organización consultiva
    const newOrgRef = doc(orgsCollectionRef);
    transaction.set(newOrgRef, {
      ...organizationInput,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    newOrgId = newOrgRef.id;

    // Actualizar estado del prospecto inegi
    transaction.update(companyDocRef, {
      status: "CONVERTED",
      convertedOrganizationId: newOrgId,
      updatedAt: serverTimestamp(),
    });
  });

  return newOrgId;
}

/**
 * Utilidad de reparación para reconstruir el estado geográfico de registros históricos
 * que se hayan importado con el campo "estado" vacío o incorrecto, utilizando el ID del documento
 * o el municipio.
 */
export async function repairImportedStates(): Promise<{ totalChecked: number; repaired: number }> {
  const collRef = collection(db, MARKET_COMPANIES_COLLECTION);
  const snap = await getDocs(collRef);
  
  let totalChecked = 0;
  let repaired = 0;
  
  const batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    totalChecked++;
    const data = docSnap.data();
    const currentId = docSnap.id.toLowerCase();
    const currentMunicipio = (data.municipio || "").toLowerCase();
    const currentEstado = (data.estado || "").trim();

    // Si el estado está vacío, intentar repararlo
    if (!currentEstado || currentEstado === "No Especificado") {
      let resolvedState = "";

      // Coincidencias de ID o Municipio para Querétaro, Nuevo León o Jalisco
      if (currentId.includes("queretaro") || currentMunicipio.includes("querétaro") || currentMunicipio.includes("queretaro")) {
        resolvedState = "Querétaro";
      } else if (currentId.includes("nuevoleon") || currentId.includes("nuevo_leon") || currentMunicipio.includes("monterrey") || currentMunicipio.includes("san nicolas") || currentMunicipio.includes("san pedro")) {
        resolvedState = "Nuevo León";
      } else if (currentId.includes("jalisco") || currentMunicipio.includes("guadalajara") || currentMunicipio.includes("zapopan") || currentMunicipio.includes("tlaquepaque") || currentMunicipio.includes("el salto")) {
        resolvedState = "Jalisco";
      }

      if (resolvedState) {
        batch.update(docSnap.ref, {
          estado: resolvedState,
          updatedAt: serverTimestamp()
        });
        repaired++;
        batchCount++;

        // Firestore batch limit is 500
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`[MarketFirestoreService] Reparación de estados finalizada. Revisados: ${totalChecked}, Reparados: ${repaired}`);
  return { totalChecked, repaired };
}

/**
 * Guarda un registro de auditoría de importación en el historial.
 */
export async function writeImportAudit(audit: {
  filename: string;
  totalProcessed: number;
  newAdded: number;
  updated: number;
  omitted: number;
  failed: number;
  timeMs: number;
  source: string;
  sourceVersion: string;
  user: string;
  states?: string[];
}): Promise<string> {
  const historyRef = doc(collection(db, "market_imports_history"));
  const historyId = historyRef.id;
  await setDoc(historyRef, {
    id: historyId,
    timestamp: serverTimestamp(),
    filename: audit.filename,
    totalProcessed: audit.totalProcessed,
    newAdded: audit.newAdded,
    updated: audit.updated,
    omitted: audit.omitted,
    failed: audit.failed,
    timeMs: audit.timeMs,
    source: audit.source,
    sourceVersion: audit.sourceVersion,
    user: audit.user,
    states: audit.states || [],
  });
  return historyId;
}

const MarketFirestoreService = {
  importMarketCompaniesBatch,
  getMarketCompanies,
  updateMarketCompanyStatus,
  convertMarketCompanyToOrganization,
  getUniqueStates,
  updateUniqueStates,
  getImportHistory,
  repairImportedStates,
  writeImportAudit,
};

export default MarketFirestoreService;
