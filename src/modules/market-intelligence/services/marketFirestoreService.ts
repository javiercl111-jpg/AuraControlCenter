import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  getCountFromServer,
} from "firebase/firestore";

import { db } from "../../../config/firebase";
import type { CompanyStatus, InegiCompany } from "../types/inegi";
import type { PlatformOrganization } from "../../../types/platformOrganization";

const MARKET_COMPANIES_COLLECTION = "market_companies";
const ORGANIZATIONS_COLLECTION = "platform_organizations";

const DEFAULT_CONSULTANT = {
  id: "jcuellar",
  name: "Javier Cuéllar Lazarini",
  email: "jcuellar@aura-hcm.com",
};

/**
 * Importa prospectos de INEGI en lotes utilizando writeBatch (máximo 500 registros por lote).
 * Utiliza IDs determinísticos de forma que no genere costos de lectura y evite duplicados.
 */
export async function importMarketCompaniesBatch(
  companies: InegiCompany[]
): Promise<{ added: number; overwritten: number }> {
  if (companies.length > 500) {
    throw new Error("Límite de lectura e importación excedido. Máximo 500 registros por lote.");
  }

  const batch = writeBatch(db);
  let count = 0;

  for (const company of companies) {
    const docRef = doc(db, MARKET_COMPANIES_COLLECTION, company.id);
    
    // Guardar o sobrescribir el registro de forma determinística
    batch.set(docRef, {
      ...company,
      updatedAt: serverTimestamp(),
    });
    count++;
  }

  await batch.commit();
  return { added: count, overwritten: 0 };
}

/**
 * Obtiene prospectos paginados y filtrados.
 * Combina filtros de base en Firestore con filtros de refinamiento en memoria
 * para evitar el requisito de índices compuestos complejos y proteger costos de lectura.
 */
export async function getMarketCompanies(
  filters: {
    status?: CompanyStatus;
    tamano?: string;
    sector?: string;
    municipio?: string;
    hasEmail?: boolean;
    hasPhone?: boolean;
    hasWebsite?: boolean;
    minScore?: number;
    search?: string;
  },
  pageSize: number = 25,
  lastVisibleSnapshot: any = null
): Promise<{
  companies: InegiCompany[];
  lastDoc: any;
  totalCount: number;
}> {
  const collRef = collection(db, MARKET_COMPANIES_COLLECTION);
  
  // Construir consulta base
  const queryConstraints: any[] = [];

  // Filtros estructurados que aprovechan índices nativos simples
  if (filters.status) {
    queryConstraints.push(where("status", "==", filters.status));
  }
  if (filters.tamano) {
    queryConstraints.push(where("tamano", "==", filters.tamano));
  }
  if (filters.sector) {
    queryConstraints.push(where("sector", "==", filters.sector));
  }
  if (filters.municipio) {
    queryConstraints.push(where("municipio", "==", filters.municipio));
  }

  // 1. Obtener conteo de forma barata (Firestore protegido)
  const countQuery = query(collRef, ...queryConstraints);
  const countSnapshot = await getCountFromServer(countQuery);
  const totalCount = countSnapshot.data().count;

  // 2. Traer registros aplicando paginación
  // Si hay filtros en memoria (búsqueda de texto, email, score mínimo, etc.),
  // traemos un número mayor de registros para filtrarlos en el cliente, protegiendo costo.
  const isComplexFilterActive = 
    filters.hasEmail !== undefined || 
    filters.hasPhone !== undefined || 
    filters.hasWebsite !== undefined || 
    (filters.minScore !== undefined && filters.minScore > 0) || 
    (filters.search !== undefined && filters.search.trim() !== "");

  const limitCount = isComplexFilterActive ? 250 : pageSize;
  const currentQueryConstraints = [...queryConstraints, limit(limitCount)];

  if (lastVisibleSnapshot && !isComplexFilterActive) {
    currentQueryConstraints.push(startAfter(lastVisibleSnapshot));
  }

  const q = query(collRef, ...currentQueryConstraints);
  const snapshot = await getDocs(q);
  
  let docs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<InegiCompany, "id">),
  }));

  // 3. Aplicar filtros en memoria
  if (isComplexFilterActive) {
    docs = docs.filter(company => {
      // Filtro de correo
      if (filters.hasEmail && !company.email) return false;
      if (filters.hasEmail === false && company.email) return false;

      // Filtro de teléfono
      if (filters.hasPhone && !company.telefono) return false;
      if (filters.hasPhone === false && company.telefono) return false;

      // Filtro de web
      if (filters.hasWebsite) {
        const cleanWeb = (company.sitioWeb || "").toLowerCase();
        const hasWeb = cleanWeb && cleanWeb !== "no disponible" && cleanWeb !== "n/a" && cleanWeb !== "no aplica";
        if (!hasWeb) return false;
      }

      // Filtro de Score Mínimo
      if (filters.minScore !== undefined && company.opportunityScore < filters.minScore) return false;

      // Filtro de búsqueda textual
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = (company.nombreComercial || "").toLowerCase().includes(searchLower);
        const razonMatch = (company.razonSocial || "").toLowerCase().includes(searchLower);
        const actividadMatch = (company.actividad || "").toLowerCase().includes(searchLower);
        if (!nameMatch && !razonMatch && !actividadMatch) return false;
      }

      return true;
    });
  }

  // Paginación en memoria en caso de filtros complejos
  let paginatedDocs = docs;
  let finalLastDoc = null;

  if (isComplexFilterActive) {
    paginatedDocs = docs.slice(0, pageSize);
    finalLastDoc = null; // En búsquedas complejas en memoria desactivamos el cursor incremental directo
  } else {
    finalLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  return {
    companies: paginatedDocs,
    lastDoc: finalLastDoc,
    totalCount: isComplexFilterActive ? paginatedDocs.length : totalCount,
  };
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

const MarketFirestoreService = {
  importMarketCompaniesBatch,
  getMarketCompanies,
  updateMarketCompanyStatus,
  convertMarketCompanyToOrganization,
};

export default MarketFirestoreService;
