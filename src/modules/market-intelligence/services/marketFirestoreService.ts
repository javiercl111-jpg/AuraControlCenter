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
  orderBy,
  startAfter,
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
  fingerprint?: string;
  user?: string;
  states?: string[];
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

    const readPromises: Promise<any>[] = [];
    for (let j = 0; j < ids.length; j += UPSERT_READ_CHUNK_SIZE) {
      const idGroup = ids.slice(j, j + UPSERT_READ_CHUNK_SIZE);
      const q = query(
        collection(db, MARKET_COMPANIES_COLLECTION),
        where("__name__", "in", idGroup)
      );
      readPromises.push(
        retryWithBackoff(() => getDocs(q), 3, 1000).then(snap => {
          snap.forEach(doc => {
            existingDocsMap.set(doc.id, doc.data());
          });
        }).catch(err => {
          console.error("Error al consultar existencia de IDs en importación paralela:", err);
        })
      );
    }
    await Promise.all(readPromises);

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
          existing.estadoNormalized !== (company as any).estadoNormalized ||
          existing.sourceState !== (company as any).sourceState ||
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
            estadoNormalized: (company as any).estadoNormalized || "",
            sourceState: (company as any).sourceState || "No Especificado",
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
        fingerprint: data.fingerprint || "",
        user: data.user || "",
        states: data.states || [],
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
  const statesSet = new Set<string>(["Querétaro", "Nuevo León"]);
  
  try {
    const docRef = doc(db, "market_companies_metadata", "states");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.states)) {
        data.states.forEach((s: any) => {
          if (s && String(s).trim()) statesSet.add(String(s).trim());
        });
      }
    }
  } catch (err) {
    console.warn("No se pudieron cargar los estados únicos desde market_companies_metadata/states:", err);
  }

  try {
    const q = query(collection(db, "market_dataset_metadata"));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.state && String(data.state).trim()) {
        statesSet.add(String(data.state).trim());
      }
    });
  } catch (err) {
    console.warn("No se pudieron cargar los estados únicos desde market_dataset_metadata:", err);
  }

  try {
    const q = query(collection(db, "market_companies_metadata"));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      if (docSnap.id !== "states") {
        const data = docSnap.data();
        if (data && data.state && String(data.state).trim()) {
          statesSet.add(String(data.state).trim());
        }
      }
    });
  } catch (err) {
    console.warn("No se pudieron cargar los estados únicos desde market_companies_metadata:", err);
  }

  return Array.from(statesSet).sort();
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
  let queryConstraints: any[] = [];

  if (filters.estado && filters.estado !== "No Especificado") {
    queryConstraints.push(where("estado", "==", filters.estado));
  }

  if (limitCount !== undefined) {
    queryConstraints.push(limit(limitCount));
  }

  const q = query(collRef, ...queryConstraints);
  const snapshot = await getDocs(q);

  let results = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<InegiCompany, "id">),
  }));

  // Fallback si retorna vacío y se busca un estado (para soportar registros viejos con estadoNormalized o sourceState)
  if (results.length === 0 && filters.estado && filters.estado !== "No Especificado") {
    console.log(`[Aura query fallback] Intentando búsqueda fallback por estadoNormalized para: ${filters.estado}`);
    
    // Probar por estadoNormalized
    const qNorm = query(
      collRef, 
      where("estadoNormalized", "==", filters.estado.toLowerCase()),
      ...(limitCount !== undefined ? [limit(limitCount)] : [])
    );
    const snapNorm = await getDocs(qNorm);
    results = snapNorm.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<InegiCompany, "id">),
    }));

    if (results.length === 0) {
      console.log(`[Aura query fallback] Intentando búsqueda fallback por sourceState para: ${filters.estado}`);
      // Probar por sourceState
      const qSource = query(
        collRef, 
        where("sourceState", "==", filters.estado),
        ...(limitCount !== undefined ? [limit(limitCount)] : [])
      );
      const snapSource = await getDocs(qSource);
      results = snapSource.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<InegiCompany, "id">),
      }));
    }
  }

  return results;
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
export async function repairImportedStates(): Promise<{ totalChecked: number; repaired: number; omitted: number; errors: number }> {
  let totalChecked = 0;
  let repaired = 0;
  let omitted = 0;
  let errors = 0;
  let hasMore = true;
  let lastVisible: any = null;
  const batchLimit = 400;

  const tabascoMunNormalized = [
    "centro", "villahermosa", "cardenas", "comalcalco", "paraiso",
    "macuspana", "huimanguillo", "nacajuca", "cunduacan", "tenosique",
    "balancan", "jalpa de mendez", "teapa", "tacotalpa", "emiliano zapata",
    "jalapa", "jonuta"
  ];

  let totalTabascoCount = 0;

  while (hasMore) {
    try {
      const collRef = collection(db, MARKET_COMPANIES_COLLECTION);
      const queryConstraints: any[] = [orderBy("__name__"), limit(500)];
      if (lastVisible) {
        queryConstraints.push(startAfter(lastVisible));
      }

      const q = query(collRef, ...queryConstraints);
      const snap = await getDocs(q);

      if (snap.empty) {
        hasMore = false;
        break;
      }

      lastVisible = snap.docs[snap.docs.length - 1];
      
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of snap.docs) {
        totalChecked++;
        const data = docSnap.data();
        
        const currentEstado = (data.estado || "").trim();
        const currentNormalized = (data.estadoNormalized || "").trim().toLowerCase();
        const currentSourceState = (data.sourceState || "").trim();
        const currentMunicipio = (data.municipio || "").trim();
        const munNorm = currentMunicipio.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9 ]/g, "")
          .trim();

        const filename = (data.filename || data.sourceFile || "").toLowerCase();
        const razonSocial = (data.razonSocial || "").toLowerCase();
        const nombreComercial = (data.nombreComercial || "").toLowerCase();

        let shouldBeTabasco = false;

        // Criterios para Tabasco
        if (
          filename.includes("27_tabasco") ||
          filename.includes("27-tabasco") ||
          currentSourceState.toLowerCase() === "tabasco" ||
          currentEstado === "27" ||
          currentNormalized === "27" ||
          tabascoMunNormalized.some(m => munNorm === m || munNorm.includes(m)) ||
          (munNorm === "centro" && (razonSocial.includes("villahermosa") || nombreComercial.includes("villahermosa")))
        ) {
          shouldBeTabasco = true;
        }

        if (shouldBeTabasco) {
          totalTabascoCount++;
          // Si no está configurado como Tabasco, actualizarlo
          if (currentEstado !== "Tabasco" || currentNormalized !== "tabasco" || currentSourceState !== "Tabasco") {
            try {
              batch.update(docSnap.ref, {
                estado: "Tabasco",
                estadoNormalized: "tabasco",
                sourceState: "Tabasco",
                updatedAt: serverTimestamp()
              });
              repaired++;
              batchCount++;

              if (batchCount >= batchLimit) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
              }
            } catch (err) {
              console.error("Error al añadir actualización al batch:", err);
              errors++;
            }
          } else {
            omitted++;
          }
        } else {
          omitted++;
        }
      }

      if (batchCount > 0) {
        try {
          await batch.commit();
        } catch (commitErr) {
          console.error("Error al hacer commit del batch restante:", commitErr);
          errors += batchCount;
        }
      }

      // Si trajimos menos de 500 registros, es la última página
      if (snap.docs.length < 500) {
        hasMore = false;
      }
    } catch (pageErr) {
      console.error("Error al procesar lote de reparación:", pageErr);
      errors += 500;
      hasMore = false;
    }
  }

  // Actualizar metadatos
  if (totalTabascoCount > 0) {
    try {
      const tabascoDatasetMetadataRef = doc(db, "market_dataset_metadata", "Tabasco");
      await setDoc(tabascoDatasetMetadataRef, {
        state: "Tabasco",
        totalRecords: totalTabascoCount,
        lastImportJobId: "manual_repair",
        completedAt: serverTimestamp(),
        fingerprint: "manual_repair_tabasco",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const tabascoCompaniesMetadataRef = doc(db, "market_companies_metadata", "Tabasco");
      await setDoc(tabascoCompaniesMetadataRef, {
        state: "Tabasco",
        totalRecords: totalTabascoCount,
        lastImportJobId: "manual_repair",
        completedAt: serverTimestamp(),
        fingerprint: "manual_repair_tabasco",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const statesRef = doc(db, "market_companies_metadata", "states");
      await runTransaction(db, async (transaction) => {
        const statesSnap = await transaction.get(statesRef);
        let statesList: string[] = ["Querétaro", "Nuevo León", "Tabasco"];
        if (statesSnap.exists()) {
          const currentList = statesSnap.data()?.states || [];
          const combined = new Set([...currentList, ...statesList]);
          statesList = Array.from(combined).sort();
        }
        transaction.set(statesRef, { states: statesList }, { merge: true });
      });
    } catch (metaErr) {
      console.error("Error al actualizar metadatos durante reparación de estados:", metaErr);
    }
  }

  console.log(`[MarketFirestoreService] Reparación de estados finalizada. Revisados: ${totalChecked}, Reparados: ${repaired}, Omitidos: ${omitted}, Errores: ${errors}`);
  return { totalChecked, repaired, omitted, errors };
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
  fingerprint?: string;
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
    fingerprint: audit.fingerprint || "",
  });
  return historyId;
}

/**
 * Realiza una auditoría completa del estado de Tabasco en la colección de market_companies,
 * contando registros que tengan indicadores de Tabasco y aplicando un backfill masivo
 * si se detectan discrepancias.
 */
export async function auditAndRepairTabasco(
  onProgress?: (progress: { processed: number; total: number }) => void
): Promise<{
  totalScanned: number;
  countEstadoTabasco: number;
  countEstadoNormalizedTabasco: number;
  countEstadoNormalizedTabascoLower: number;
  countSourceStateTabasco: number;
  countSourceStateTabascoLower: number;
  countFilenameTabasco: number;
  countMunicipiosTabasco: number;
  totalUniqueTabascoSignals: number;
  repaired: number;
}> {
  const collRef = collection(db, MARKET_COMPANIES_COLLECTION);
  let lastDoc: any = null;
  let hasMore = true;
  let totalScanned = 0;

  let countEstadoTabasco = 0;
  let countEstadoNormalizedTabasco = 0;
  let countEstadoNormalizedTabascoLower = 0;
  let countSourceStateTabasco = 0;
  let countSourceStateTabascoLower = 0;
  let countFilenameTabasco = 0;
  let countMunicipiosTabasco = 0;
  let totalUniqueTabascoSignals = 0;

  const batchSize = 1000;
  const docsToUpdate: { id: string; ref: any }[] = [];

  while (hasMore) {
    let q = query(collRef, orderBy("__name__"), limit(batchSize));
    if (lastDoc) {
      q = query(collRef, orderBy("__name__"), startAfter(lastDoc), limit(batchSize));
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    totalScanned += snap.docs.length;

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const filename = (data.filename || data.sourceFile || data.sourceFileUrl || "").toLowerCase();
      const sourceState = data.sourceState || "";
      const estadoNormalized = data.estadoNormalized || "";
      const estado = data.estado || "";
      const municipio = (data.municipio || "").toLowerCase().trim();

      const matchEstado = estado === "Tabasco";
      const matchEstNorm = estadoNormalized === "Tabasco";
      const matchEstNormLower = estadoNormalized === "tabasco";
      const matchSrcState = sourceState === "Tabasco";
      const matchSrcStateLower = sourceState === "tabasco";
      const matchFilename = filename.includes("27_tabasco") || filename.includes("27-tabasco") || filename.includes("tabasco");
      const matchMunicipios = ["centro", "villahermosa", "comalcalco", "cardenas", "paraiso"].some(m => municipio.includes(m));

      if (matchEstado) countEstadoTabasco++;
      if (matchEstNorm) countEstadoNormalizedTabasco++;
      if (matchEstNormLower) countEstadoNormalizedTabascoLower++;
      if (matchSrcState) countSourceStateTabasco++;
      if (matchSrcStateLower) countSourceStateTabascoLower++;
      if (matchFilename) countFilenameTabasco++;
      if (matchMunicipios) countMunicipiosTabasco++;

      const hasTabascoSignal =
        matchEstado ||
        matchEstNorm ||
        matchEstNormLower ||
        matchSrcState ||
        matchSrcStateLower ||
        matchFilename ||
        matchMunicipios;

      if (hasTabascoSignal) {
        totalUniqueTabascoSignals++;
        if (estado !== "Tabasco" || estadoNormalized !== "Tabasco" || sourceState !== "Tabasco") {
          docsToUpdate.push({ id: docSnap.id, ref: docSnap.ref });
        }
      }
    });

    if (onProgress) {
      onProgress({ processed: totalScanned, total: 57000 });
    }

    if (snap.docs.length < batchSize) {
      hasMore = false;
    }
  }

  // Realizar el backfill masivo por lotes de 100 en 100
  let repaired = 0;
  const writeBatchSize = 100;
  for (let i = 0; i < docsToUpdate.length; i += writeBatchSize) {
    const chunk = docsToUpdate.slice(i, i + writeBatchSize);
    const batchInstance = writeBatch(db);
    chunk.forEach((item) => {
      batchInstance.update(item.ref, {
        estado: "Tabasco",
        estadoNormalized: "Tabasco",
        sourceState: "Tabasco"
      });
    });
    await batchInstance.commit();
    repaired += chunk.length;
  }

  // Si reparamos algo, forzar la creación de metadatos para Tabasco
  if (totalUniqueTabascoSignals > 0) {
    try {
      const tabascoDatasetMetadataRef = doc(db, "market_dataset_metadata", "Tabasco");
      await setDoc(tabascoDatasetMetadataRef, {
        state: "Tabasco",
        totalRecords: totalUniqueTabascoSignals,
        lastImportJobId: "manual_audit_repair",
        completedAt: serverTimestamp(),
        fingerprint: "audit_repair_tabasco",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const tabascoCompaniesMetadataRef = doc(db, "market_companies_metadata", "Tabasco");
      await setDoc(tabascoCompaniesMetadataRef, {
        state: "Tabasco",
        totalRecords: totalUniqueTabascoSignals,
        lastImportJobId: "manual_audit_repair",
        completedAt: serverTimestamp(),
        fingerprint: "audit_repair_tabasco",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const statesRef = doc(db, "market_companies_metadata", "states");
      await runTransaction(db, async (transaction) => {
        const statesSnap = await transaction.get(statesRef);
        let statesList: string[] = ["Querétaro", "Nuevo León", "Tabasco"];
        if (statesSnap.exists()) {
          const currentList = statesSnap.data()?.states || [];
          const combined = new Set([...currentList, ...statesList]);
          statesList = Array.from(combined).sort();
        }
        transaction.set(statesRef, { states: statesList }, { merge: true });
      });
    } catch (metaErr) {
      console.warn("Fallo al escribir metadatos tras auditoría:", metaErr);
    }
  }

  return {
    totalScanned,
    countEstadoTabasco,
    countEstadoNormalizedTabasco,
    countEstadoNormalizedTabascoLower,
    countSourceStateTabasco,
    countSourceStateTabascoLower,
    countFilenameTabasco,
    countMunicipiosTabasco,
    totalUniqueTabascoSignals,
    repaired,
  };
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
  auditAndRepairTabasco,
};

export default MarketFirestoreService;
