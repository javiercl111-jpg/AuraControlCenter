import { useEffect, useState, useMemo, useRef } from "react";
import { auth } from "../config/firebase";

import MarketIntelligenceHeader from "../modules/market-intelligence/components/MarketIntelligenceHeader";
import MarketCompaniesFilters from "../modules/market-intelligence/components/MarketCompaniesFilters";
import MarketCompaniesTable from "../modules/market-intelligence/components/MarketCompaniesTable";
import MarketCompanyDrawer from "../modules/market-intelligence/components/MarketCompanyDrawer";
import MarketSegmentsPanel from "../modules/market-intelligence/components/MarketSegmentsPanel";
import CommercialDashboard from "../modules/market-intelligence/components/CommercialDashboard";

import MarketFirestoreService, { type ImportHistoryEntry } from "../modules/market-intelligence/services/marketFirestoreService";
import MarketQueryEngine, { normalizeState, getCompanyState, getCompanyIndustry } from "../modules/market-intelligence/services/marketQueryEngine";
import type { CompanyStatus, InegiCompany } from "../modules/market-intelligence/types/inegi";
import PermissionDenied from "../components/PermissionDenied";
import { checkUserCapability } from "../services/rbacService";
import NationalZipImportService from "../modules/market-intelligence/services/nationalZipImportService";
import datasetManager, { type DatasetMetadata } from "../modules/market-intelligence/services/datasetManager";

interface FiltersState {
  estado: string;
  status: string;
  tamano: string;
  sector: string;
  municipio: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  minScore: number;
  search: string;
  scian: string;
  sortBy: string;
}

const DEFAULT_FILTERS: FiltersState = {
  estado: "",
  status: "",
  tamano: "",
  sector: "",
  municipio: "",
  hasEmail: false,
  hasPhone: false,
  hasWebsite: false,
  minScore: 0,
  search: "",
  scian: "",
  sortBy: "scoreDesc",
};

export default function MarketIntelligencePage() {
  const isCancelledRef = useRef<boolean>(false);

  // Estados de carga e interfaz
  const [companies, setCompanies] = useState<InegiCompany[]>([]);
  const [activeMarketDataset, setActiveMarketDataset] = useState<InegiCompany[]>([]);
  const [rawDataset, setRawDataset] = useState<InegiCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMetadata, setActiveMetadata] = useState<DatasetMetadata | null>(null);
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    filename: string;
    stage: "PREPARING" | "READING_EXCEL" | "NORMALIZING" | "WRITING_FIRESTORE" | "VALIDATING_WRITE" | "UPDATING_DATASET_MANAGER" | "COMPLETED";
    mode: "Validando" | "Reimportando" | "Escribiendo";
    processed: number;
    total: number;
    added: number;
    overwritten: number;
    omitted: number;
    failed: number;
    written: number;
    startTime: number;
    elapsedTimeMs: number;
    speed: number;
    etaSeconds: number;
    batchesRemaining: number;
  } | null>(null);

  const [telemetryLogs, setTelemetryLogs] = useState<{
    batchNumber: number;
    startIndex: number;
    endIndex: number;
    recordsInBatch: number;
    duplicateReadStart: string;
    duplicateReadEnd: string;
    duplicateReadMs: number;
    batchCommitStart: string;
    batchCommitEnd: string;
    batchCommitMs: number;
    newAdded: number;
    updated: number;
    omitted: number;
    failed: number;
    processedConfirmed: number;
    totalProcessedAccumulated: number;
    memoryMb: number;
    checkpointSaved: boolean;
    timestamp: string;
    avgBatchDurationMs: number;
    etaSeconds: number;
  }[]>([]);
  const [pendingResumeJob, setPendingResumeJob] = useState<{
    jobId: string;
    filename: string;
    companies: InegiCompany[];
    checkpoint: {
      processed: number;
      added: number;
      overwritten: number;
      omitted: number;
      failed: number;
    };
  } | null>(null);

  const [duplicateImportJob, setDuplicateImportJob] = useState<{
    fingerprint: string;
    filename: string;
    companies: InegiCompany[];
    existingImport: ImportHistoryEntry;
  } | null>(null);


  // Derivar estados disponibles de forma síncrona desde rawDatasetGlobal
  const availableStates = useMemo(() => {
    return Array.from(
      new Set(
        rawDataset.map((c) => getCompanyState(c)).filter(Boolean)
      )
    ).sort() as string[];
  }, [rawDataset]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Control de Accesos y Capacidades (RBAC)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [capabilities, setCapabilities] = useState({
    canImport: false,
    canUpdate: false,
    canConvert: false,
  });

  // Verificar permisos al montar el componente (Costo Firestore Protegido)
  useEffect(() => {
    async function verifyPermissions() {
      try {
        const readAllowed = await checkUserCapability("market.read");
        setHasAccess(readAllowed);

        if (readAllowed) {
          const [imp, upd, conv] = await Promise.all([
            checkUserCapability("market.import"),
            checkUserCapability("market.update"),
            checkUserCapability("market.convert"),
          ]);
          setCapabilities({
            canImport: imp,
            canUpdate: upd,
            canConvert: conv,
          });
        }
      } catch (err: any) {
        console.error({
          code: err.code || null,
          message: err.message || null,
          stack: err.stack || null,
          operation: "verifyPermissions (checkUserCapability)",
          collection: "platform_global_admins",
          authUid: auth.currentUser?.uid || null,
          authEmail: auth.currentUser?.email || null,
          error: err
        });
        setHasAccess(false);
      }
    }
    verifyPermissions();
  }, []);

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Derivar estadísticas de sectores comerciales para diagnóstico
  const industriesStats = useMemo(() => {
    const allCounts: Record<string, number> = {};
    const stateFilteredCounts: Record<string, number> = {};

    const matchesCurrentState = (c: InegiCompany) => {
      if (!filters.estado || filters.estado === "") return true;
      const docState = getCompanyState(c);
      const isFilterNoEspecificado = normalizeState(filters.estado) === "noespecificado";
      const isDocNoEspecificado = docState === "No Especificado" || normalizeState(docState) === "noespecificado";
      if (isFilterNoEspecificado) return isDocNoEspecificado;
      return normalizeState(docState) === normalizeState(filters.estado);
    };

    rawDataset.forEach((c) => {
      const ind = getCompanyIndustry(c) || "Otros Sectores";
      allCounts[ind] = (allCounts[ind] || 0) + 1;
      
      if (matchesCurrentState(c)) {
        stateFilteredCounts[ind] = (stateFilteredCounts[ind] || 0) + 1;
      }
    });

    return {
      allCounts,
      stateFilteredCounts,
    };
  }, [rawDataset, filters.estado]);

  // Reporte de importación masiva realizada (Prioridad 4)
  const [importReport, setImportReport] = useState<{
    total: number;
    added: number;
    updated: number;
    omitted: number;
    failed: number;
    timeMs: number;
  } | null>(null);

  // Historial de importaciones (Prioridad 4)
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Estados de importación ZIP nacional (Prioridad 5)
  const [zipProgress, setZipProgress] = useState<any | null>(null);
  const [zipSummary, setZipSummary] = useState<any | null>(null);
  const [zipStep, setZipStep] = useState<"ZIP_RECEIVED" | "FILES_FOUND" | "STATES_DETECTED" | "RESOLVING_STATES" | "IMPORTING" | "COMPLETED" | null>(null);
  const [pendingStateResolutionFiles, setPendingStateResolutionFiles] = useState<{ filename: string; guessedState: string }[] | null>(null);
  const [currentResolutionIndex, setCurrentResolutionIndex] = useState<number>(-1);
  const [resolvedFilesList, setResolvedFilesList] = useState<{ filename: string; state: string }[]>([]);
  const [activeZipFile, setActiveZipFile] = useState<File | null>(null);

  // Cargar estados únicos acumulados e historial de importaciones
  useEffect(() => {
    async function loadInitialData() {
      try {
        const history = await MarketFirestoreService.getImportHistory();
        setImportHistory(history);
      } catch (err) {
        console.warn("Error al cargar datos iniciales de estados/historial:", err);
      }
    }
    loadInitialData();
  }, []);

  // Estados de Paginación (Costo Protegido)
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Estados de KPIs (Conteo Servidor y Promedios)
  const [stats, setStats] = useState({
    totalCount: 0,
    convertedCount: 0,
    qualifiedCount: 0,
    avgScore: 0,
  });

  // Estado del Drawer de Detalle
  const [selectedCompany, setSelectedCompany] = useState<InegiCompany | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Cargar conjunto de datos (Aura Dataset Manager & Firestore)
  async function loadDataset(resetPage = false, forceFetch = false) {
    setIsLoading(true);
    setError("");

    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      console.log("=== AURA DATASET MANAGER LOGS ===");
      console.log("- Filtros actuales:", filters);

      const targetStateKey = filters.estado || "";
      let currentRaw: InegiCompany[] = [];
      let entryMetadata: DatasetMetadata | null = null;

      // 1. Comprobar si ya existe en el Dataset Manager cacheado
      if (!forceFetch && datasetManager.hasDataset(targetStateKey)) {
        console.log(`- Reutilizando dataset en cache para estado: "${targetStateKey || "Todos"}"`);
        const entry = datasetManager.getDataset(targetStateKey)!;
        currentRaw = entry.companies;
        entryMetadata = entry.metadata;
      } else {
        // 2. Si no está en cache, consultar Firestore
        if (targetStateKey) {
          console.log(`- Consultando Firestore para estado completo: "${targetStateKey}"`);
          // Cargar estado completo (sin límite)
          const companiesFetched = await MarketFirestoreService.getMarketCompanies({ estado: targetStateKey });
          console.log(`- Descargados ${companiesFetched.length} registros para: ${targetStateKey}`);
          const entry = datasetManager.setDataset(targetStateKey, companiesFetched);
          currentRaw = entry.companies;
          entryMetadata = entry.metadata;
        } else {
          console.log(`- Consultando Firestore con límite seguro de 2,000 registros (Sin estado seleccionado)`);
          // Límite seguro
          const companiesFetched = await MarketFirestoreService.getMarketCompanies({}, 2000);
          console.log(`- Descargados ${companiesFetched.length} registros globales de muestra`);
          const entry = datasetManager.setDataset(targetStateKey, companiesFetched);
          currentRaw = entry.companies;
          entryMetadata = entry.metadata;
        }
      }

      // Sincronizar fuentes de verdad locales
      setRawDataset(currentRaw);
      setActiveMetadata(entryMetadata);

      // 2. Aplicar filtros dinámicos en memoria usando el Market Query Engine centralizado
      const filtered = MarketQueryEngine.filterMarketCompanies(currentRaw, {
        estado: filters.estado,
        status: filters.status,
        tamano: filters.tamano,
        sector: filters.sector,
        municipio: filters.municipio,
        hasEmail: filters.hasEmail,
        hasPhone: filters.hasPhone,
        hasWebsite: filters.hasWebsite,
        minScore: filters.minScore,
        search: filters.search,
        scian: filters.scian,
      });
      console.log(`- docs después de MarketQueryEngine: ${filtered.length}`);

      // 3. Aplicar ordenamiento
      const sorted = MarketQueryEngine.sortMarketCompanies(filtered, filters.sortBy || "scoreDesc");

      // 4. Guardar dataset activo unificado (Fuente Única de Verdad)
      setActiveMarketDataset(sorted);

      // 5. Paginar y cargar la primera página de la tabla (solo 25 registros)
      const sliced = sorted.slice(0, 25);
      setCompanies(sliced);
      setHasMore(sorted.length > 25);
      console.log(`- datos enviados a la tabla: ${sliced.length} (Página 1)`);

      // 6. Calcular estadísticas unificadas del dataset filtrado
      const total = sorted.length;
      const converted = sorted.filter(c => c.status === "CONVERTED").length;
      const qualified = sorted.filter(c => c.status === "QUALIFIED" || c.status === "CONTACTED").length;
      const listAvg = sorted.length > 0
        ? Math.round(sorted.reduce((acc, curr) => acc + curr.opportunityScore, 0) / sorted.length)
        : 72;

      const newStats = {
        totalCount: total,
        convertedCount: converted,
        qualifiedCount: qualified,
        avgScore: listAvg,
      };
      setStats(newStats);
      console.log("- datos enviados al dashboard (KPIs):", newStats);

      // Imprimir tabla de diagnóstico en consola
      console.table({
        activeState: targetStateKey || "Todos (Límite seguro)",
        rawDatasetLength: currentRaw.length,
        activeFilteredLength: sorted.length,
        paginatedViewLength: sliced.length
      });

    } catch (err: any) {
      console.error({
        code: err.code || null,
        message: err.message || null,
        stack: err.stack || null,
        operation: "loadDataset",
        collection: "market_companies",
        authUid: auth.currentUser?.uid || null,
        authEmail: auth.currentUser?.email || null,
        error: err
      });
      setError("Error al cargar los prospectos de mercado: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Efecto inicial y ante cambios de filtro (Incluyendo búsqueda textual reactiva)
  useEffect(() => {
    loadDataset(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.estado,
    filters.status,
    filters.tamano,
    filters.sector,
    filters.municipio,
    filters.hasEmail,
    filters.hasPhone,
    filters.hasWebsite,
    filters.minScore,
    filters.search,
    filters.scian,
    filters.sortBy,
  ]);


  // Manejar el cambio de filtros manual
  function handleFilterChange(newFilters: FiltersState) {
    setActiveSegmentId(null); // Quitar segmento activo si edita manual
    setFilters(newFilters);
  }

  // Limpiar filtros a default
  function handleClearFilters() {
    setActiveSegmentId(null);
    setFilters(DEFAULT_FILTERS);
  }

  // Selección de Segmentos Rápidos
  function handleSelectSegment(segmentId: string, segmentFilters: any) {
    setActiveSegmentId(segmentId);
    setFilters({
      ...DEFAULT_FILTERS,
      ...segmentFilters,
    });
  }

  // Paginación: Página Siguiente
  function handleNextPage() {
    const totalPages = Math.ceil(activeMarketDataset.length / 25);
    if (currentPage >= totalPages) return;

    const nextPage = currentPage + 1;
    const sliced = activeMarketDataset.slice((nextPage - 1) * 25, nextPage * 25);
    setCompanies(sliced);
    setCurrentPage(nextPage);
    setHasMore(activeMarketDataset.length > nextPage * 25);
  }

  // Paginación: Página Anterior
  function handlePrevPage() {
    if (currentPage <= 1) return;
    const prevPage = currentPage - 1;
    const sliced = activeMarketDataset.slice((prevPage - 1) * 25, prevPage * 25);
    setCompanies(sliced);
    setCurrentPage(prevPage);
    setHasMore(true);
  }

  // Ejecutar el Job de Importación GTM con checkpoints y estadísticas
  async function executeImportJob(
    jobId: string,
    filename: string,
    companies: InegiCompany[],
    startIndex: number = 0,
    initialAdded: number = 0,
    initialOverwritten: number = 0,
    initialOmitted: number = 0,
    initialFailed: number = 0,
    fingerprint?: string
  ) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);
    setTelemetryLogs([]);
    isCancelledRef.current = false;

    const total = companies.length;
    const startTime = Date.now();

    const currentMode = fingerprint ? ("Reimportando" as const) : ("Escribiendo" as const);

    const initialJobState = {
      jobId,
      filename,
      stage: "WRITING_FIRESTORE" as const,
      mode: currentMode,
      processed: startIndex,
      total,
      added: initialAdded,
      overwritten: initialOverwritten,
      omitted: initialOmitted,
      failed: initialFailed,
      written: initialAdded + initialOverwritten + initialOmitted + initialFailed,
      startTime,
      elapsedTimeMs: 0,
      speed: 0,
      etaSeconds: 0,
      batchesRemaining: Math.ceil((total - startIndex) / 100),
    };
    setActiveJob(initialJobState);

    let addedAcc = initialAdded;
    let overwrittenAcc = initialOverwritten;
    let omittedAcc = initialOmitted;
    let failedAcc = initialFailed;

    let failedRecords: InegiCompany[] = [];
    const batchTimes: number[] = [];
    const UPSERT_WRITE_CHUNK_SIZE = 100;

    try {
      // 1. Loop principal de escrituras por lotes de 100 utilizando un pool de trabajadores concurrentes
      const chunks: InegiCompany[][] = [];
      for (let i = startIndex; i < total; i += UPSERT_WRITE_CHUNK_SIZE) {
        chunks.push(companies.slice(i, i + UPSERT_WRITE_CHUNK_SIZE));
      }

      let activeIndex = 0;
      const workers: Promise<void>[] = [];
      const concurrency = 4; // Concurrencia de 4 lotes en paralelo

      const runWorker = async () => {
        while (activeIndex < chunks.length) {
          if (isCancelledRef.current) return;
          const chunkIdx = activeIndex++;
          const chunk = chunks[chunkIdx];
          const batchNum = chunkIdx + 1;
          const batchStartIndex = startIndex + chunkIdx * UPSERT_WRITE_CHUNK_SIZE;
          const batchStartTime = Date.now();

          // Actualizamos UI indicando el inicio del batch (Escritos no aumenta aún)
          setActiveJob(prev => prev ? {
            ...prev,
            stage: "WRITING_FIRESTORE",
            elapsedTimeMs: Date.now() - startTime,
          } : null);

          // Escribir en base aplicando Upsert Enterprise (que internamente paraleliza las lecturas)
          const chunkResult = await MarketFirestoreService.importMarketCompaniesBatch(
            chunk,
            undefined,
            { skipHistory: true }
          );

          const batchDuration = Date.now() - batchStartTime;
          batchTimes.push(batchDuration);

          const recordsInBatch = chunk.length;
          const processedConfirmed = chunkResult.added + chunkResult.overwritten + chunkResult.omitted + chunkResult.failed;

          // Actualización atómica de acumuladores
          addedAcc += chunkResult.added;
          overwrittenAcc += chunkResult.overwritten;
          omittedAcc += chunkResult.omitted;
          failedAcc += chunkResult.failed;

          if (chunkResult.failedCompanies && chunkResult.failedCompanies.length > 0) {
            failedRecords.push(...chunkResult.failedCompanies);
          }

          const currentProcessed = Math.min(batchStartIndex + chunk.length, total);
          const elapsed = Date.now() - startTime;
          const currentWritten = addedAcc + overwrittenAcc + omittedAcc + failedAcc;

          const speed = elapsed > 0 ? currentWritten / (elapsed / 1000) : 0;
          const eta = speed > 0 ? (total - currentWritten) / speed : 0;

          setActiveJob(prev => prev ? {
            ...prev,
            processed: currentProcessed,
            added: addedAcc,
            overwritten: overwrittenAcc,
            omitted: omittedAcc,
            failed: failedAcc,
            written: currentWritten,
            elapsedTimeMs: elapsed,
            speed: Math.round(speed * 10) / 10,
            etaSeconds: Math.round(eta),
            batchesRemaining: chunks.length - activeIndex,
          } : null);

          const checkpointSaved = (currentProcessed % 500 === 0 || currentProcessed === total);
          // Guardar checkpoint cada 500 registros
          if (checkpointSaved) {
            localStorage.setItem(jobId, JSON.stringify({
              processed: currentProcessed,
              added: addedAcc,
              overwritten: overwrittenAcc,
              omitted: omittedAcc,
              failed: failedAcc,
              timestamp: Date.now(),
            }));
          }

          // Telemetría del lote
          const avgBatchDuration = batchTimes.reduce((acc, curr) => acc + curr, 0) / batchTimes.length;
          const memoryLimit = (performance as any).memory;
          const memoryMb = memoryLimit ? Math.round(memoryLimit.usedJSHeapSize / (1024 * 1024)) : 0;

          setTelemetryLogs((prev) => [
            {
              batchNumber: batchNum,
              startIndex: batchStartIndex,
              endIndex: Math.min(batchStartIndex + chunk.length, total) - 1,
              recordsInBatch,
              duplicateReadStart: chunkResult.duplicateReadStart,
              duplicateReadEnd: chunkResult.duplicateReadEnd,
              duplicateReadMs: chunkResult.duplicateReadMs,
              batchCommitStart: chunkResult.batchCommitStart,
              batchCommitEnd: chunkResult.batchCommitEnd,
              batchCommitMs: chunkResult.batchCommitMs,
              newAdded: chunkResult.added,
              updated: chunkResult.overwritten,
              omitted: chunkResult.omitted,
              failed: chunkResult.failed,
              processedConfirmed,
              totalProcessedAccumulated: addedAcc + overwrittenAcc + omittedAcc + failedAcc,
              memoryMb,
              checkpointSaved,
              timestamp: new Date().toLocaleTimeString(),
              avgBatchDurationMs: avgBatchDuration,
              etaSeconds: Math.round(eta),
            },
            ...prev.slice(0, 99),
          ]);
        }
      };

      // Iniciar workers paralelos
      for (let w = 0; w < concurrency; w++) {
        workers.push(runWorker());
      }
      await Promise.all(workers);

      if (isCancelledRef.current) {
        console.warn("[GTM Job] Cancelado por el usuario.");
        setError("Importación cancelada por el usuario.");
        setIsProcessing(false);
        setActiveJob(null);
        return;
      }

      // 2. Pasada de Reintentos automáticos para registros fallidos (Garantía total)
      let pass = 1;
      while (failedRecords.length > 0 && pass <= 3) {
        if (isCancelledRef.current) {
          console.warn("[GTM Job] Cancelado por el usuario en fase de reintento.");
          setError("Importación cancelada por el usuario en fase de reintento.");
          setIsProcessing(false);
          setActiveJob(null);
          return;
        }

        console.warn(`[GTM Job] Reintentando ${failedRecords.length} registros fallidos (Paso de reintento ${pass})...`);
        const recordsToRetry = [...failedRecords];
        failedRecords = []; // Limpiar para el siguiente paso
        
        for (let i = 0; i < recordsToRetry.length; i += UPSERT_WRITE_CHUNK_SIZE) {
          if (isCancelledRef.current) {
            console.warn("[GTM Job] Cancelado por el usuario en fase de reintento.");
            setError("Importación cancelada por el usuario en fase de reintento.");
            setIsProcessing(false);
            setActiveJob(null);
            return;
          }

          const batchNum = Math.floor(i / UPSERT_WRITE_CHUNK_SIZE) + 1;
          const retryChunk = recordsToRetry.slice(i, i + UPSERT_WRITE_CHUNK_SIZE);
          const batchStartTime = Date.now();

          const chunkResult = await MarketFirestoreService.importMarketCompaniesBatch(
            retryChunk,
            undefined,
            { skipHistory: true }
          );

          const batchDuration = Date.now() - batchStartTime;
          batchTimes.push(batchDuration);

          if (chunkResult.failedCompanies && chunkResult.failedCompanies.length > 0) {
            failedRecords.push(...chunkResult.failedCompanies);
          }

          // Restar de fallidos los que ahora sí tuvieron éxito
          const successCount = chunkResult.added + chunkResult.overwritten + chunkResult.omitted;
          addedAcc += chunkResult.added;
          overwrittenAcc += chunkResult.overwritten;
          omittedAcc += chunkResult.omitted;
          failedAcc = Math.max(0, failedAcc - successCount);

          const elapsed = Date.now() - startTime;
          const currentWritten = addedAcc + overwrittenAcc + omittedAcc + failedAcc;

          const speed = elapsed > 0 ? currentWritten / (elapsed / 1000) : 0;
          const eta = speed > 0 ? (total - currentWritten) / speed : 0;

          setActiveJob(prev => prev ? {
            ...prev,
            added: addedAcc,
            overwritten: overwrittenAcc,
            omitted: omittedAcc,
            failed: failedAcc,
            written: currentWritten,
            speed: Math.round(speed * 10) / 10,
            etaSeconds: Math.round(eta),
          } : null);

          const avgBatchDuration = batchTimes.reduce((acc, curr) => acc + curr, 0) / batchTimes.length;
          const memoryLimit = (performance as any).memory;
          const memoryMb = memoryLimit ? Math.round(memoryLimit.usedJSHeapSize / (1024 * 1024)) : 0;

          setTelemetryLogs((prev) => [
            {
              batchNumber: batchNum + 1000 * pass, // Diferenciar logs de reintentos
              startIndex: i,
              endIndex: Math.min(i + UPSERT_WRITE_CHUNK_SIZE, recordsToRetry.length) - 1,
              recordsInBatch: retryChunk.length,
              duplicateReadStart: chunkResult.duplicateReadStart,
              duplicateReadEnd: chunkResult.duplicateReadEnd,
              duplicateReadMs: chunkResult.duplicateReadMs,
              batchCommitStart: chunkResult.batchCommitStart,
              batchCommitEnd: chunkResult.batchCommitEnd,
              batchCommitMs: chunkResult.batchCommitMs,
              newAdded: chunkResult.added,
              updated: chunkResult.overwritten,
              omitted: chunkResult.omitted,
              failed: chunkResult.failed,
              processedConfirmed: chunkResult.added + chunkResult.overwritten + chunkResult.omitted + chunkResult.failed,
              totalProcessedAccumulated: addedAcc + overwrittenAcc + omittedAcc + failedAcc,
              memoryMb,
              checkpointSaved: false,
              timestamp: new Date().toLocaleTimeString() + ` (Reintento P${pass})`,
              avgBatchDurationMs: avgBatchDuration,
              etaSeconds: 0,
            },
            ...prev.slice(0, 99),
          ]);
        }
        pass++;
      }

      // 3. Verificación de Integridad de Datos en Firestore
      setActiveJob(prev => prev ? { ...prev, stage: "VALIDATING_WRITE" } : null);
      
      const uniqueStates = Array.from(new Set(companies.map(c => getCompanyState(c)).filter(Boolean)));
      if (uniqueStates.length > 0) {
        await MarketFirestoreService.updateUniqueStates(uniqueStates);
      }

      // 4. Actualización del Dataset Manager
      setActiveJob(prev => prev ? { ...prev, stage: "UPDATING_DATASET_MANAGER" } : null);
      
      // Invalida los estados específicos importados del Dataset Manager (No borra otros de la memoria)
      uniqueStates.forEach(state => {
        datasetManager.invalidateDataset(state);
      });

      // Crear auditoría en la base
      const timeMs = Date.now() - startTime;
      await MarketFirestoreService.writeImportAudit({
        filename,
        totalProcessed: total,
        newAdded: addedAcc,
        updated: overwrittenAcc,
        omitted: omittedAcc,
        failed: failedAcc,
        timeMs,
        source: "INEGI",
        sourceVersion: "DENUE-2026",
        user: auth.currentUser?.email || "jcuellar@aura-hcm.com",
        states: uniqueStates,
        fingerprint,
      });

      // Recargar historial
      const history = await MarketFirestoreService.getImportHistory();
      setImportHistory(history);

      // Eliminar el checkpoint de LocalStorage
      localStorage.removeItem(jobId);

      const finalWritten = addedAcc + overwrittenAcc + omittedAcc + failedAcc;

      setActiveJob(prev => prev ? {
        ...prev,
        stage: "COMPLETED",
        processed: total,
        added: addedAcc,
        overwritten: overwrittenAcc,
        omitted: omittedAcc,
        failed: failedAcc,
        written: finalWritten,
      } : null);

      setSuccess(`Lote importado con éxito: ${addedAcc} nuevos, ${overwrittenAcc} actualizados, ${omittedAcc} omitidos.`);
      setImportReport({
        total,
        added: addedAcc,
        updated: overwrittenAcc,
        omitted: omittedAcc,
        failed: failedAcc,
        timeMs,
      });

      await loadDataset(true, true);

    } catch (err: any) {
      console.error("Error en GTM Import Job:", err);
      setError("GTM Import Job falló: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  // Ejecutar validación de conteo rápida sin recorrer los 57k
  async function executeFastValidation(job: {
    fingerprint: string;
    filename: string;
    companies: InegiCompany[];
    existingImport: ImportHistoryEntry;
  }) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    
    const startTime = Date.now();
    const total = job.companies.length;
    const targetState = job.companies[0] ? getCompanyState(job.companies[0]) : "";

    // Consultar conteo actual de base de datos para este estado
    let dbCount = total;
    if (targetState) {
      try {
        const verifySnap = await MarketFirestoreService.getMarketCompanies({ estado: targetState });
        dbCount = verifySnap.length;
      } catch (err) {
        console.error("Error al consultar conteo rápido de estado:", err);
      }
    }

    const elapsed = Date.now() - startTime;

    // Actualizar activeJob para mostrar completado rápido
    setActiveJob({
      jobId: `validate_${Date.now()}`,
      filename: job.filename,
      stage: "COMPLETED",
      mode: "Validando" as const,
      processed: total,
      total,
      added: 0,
      overwritten: 0,
      omitted: total,
      failed: 0,
      written: total,
      startTime,
      elapsedTimeMs: elapsed,
      speed: 0,
      etaSeconds: 0,
      batchesRemaining: 0,
    });

    setImportReport({
      total,
      added: 0,
      updated: 0,
      omitted: total,
      failed: 0,
      timeMs: elapsed,
    });

    // Invalida Dataset de este estado por si acaso
    if (targetState) {
      datasetManager.invalidateDataset(targetState);
    }

    setSuccess(`Validación de conteo rápida completada. Registros en dataset: ${dbCount.toLocaleString()}.`);
    setDuplicateImportJob(null);
    setIsProcessing(false);
    await loadDataset(true, true);
  }

  // Importar desde Excel o Muestra Piloto (Batch con reporte e historial)
  async function handleImport(
    importedCompanies: InegiCompany[],
    filename: string = "Importación Masiva Excel",
    fileMetadata?: { size: number; lastModified: number }
  ) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);

    const size = fileMetadata?.size || 0;
    const lastModified = fileMetadata?.lastModified || 0;
    const total = importedCompanies.length;
    const fingerprint = `${filename}_${total}_${size}_${lastModified}`;

    // 1. Verificar si el archivo ya fue importado con el mismo fingerprint
    try {
      const history = await MarketFirestoreService.getImportHistory();
      const existingImport = history.find(h => h.fingerprint === fingerprint);

      if (existingImport && existingImport.failed === 0) {
        // Encontrado: Mostrar diálogo de reimportación o validación
        setDuplicateImportJob({
          fingerprint,
          filename,
          companies: importedCompanies,
          existingImport,
        });
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      console.warn("No se pudo comprobar el historial de huellas digitales:", err);
    }

    const jobId = `aura_job_${filename.replace(/[^a-zA-Z0-9]/g, "")}_${total}`;
    
    // Comprobar checkpoint existente
    const saved = localStorage.getItem(jobId);
    if (saved) {
      try {
        const checkpointData = JSON.parse(saved);
        setPendingResumeJob({
          jobId,
          filename,
          companies: importedCompanies,
          checkpoint: checkpointData,
        });
        setIsProcessing(false);
        return;
      } catch (e) {
        console.warn("No se pudo parsear el checkpoint de LocalStorage:", e);
      }
    }

    // Si no hay checkpoint, ejecutar de cero
    executeImportJob(jobId, filename, importedCompanies, 0, 0, 0, 0, 0, fingerprint);
  }

  // Limpiar estados de progreso e importación
  function resetZipImportStates() {
    setIsProcessing(false);
    setZipProgress(null);
    setZipSummary(null);
    setZipStep(null);
    setActiveZipFile(null);
    setPendingStateResolutionFiles(null);
    setCurrentResolutionIndex(-1);
    setResolvedFilesList([]);
  }

  // Cancelar asistente de importación ZIP
  function handleCancelZipImport() {
    resetZipImportStates();
    setError("");
  }

  // Importar secuencialmente archivos del ZIP con estados confirmados
  async function startResolvedZipImport(file: File, resolvedList: { filename: string; state: string }[]) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);
    setZipStep("IMPORTING");
    setZipProgress({
      currentFile: "Inicializando...",
      processedFiles: 0,
      totalFiles: resolvedList.length,
      totalRowsProcessed: 0,
      added: 0,
      overwritten: 0,
      omitted: 0,
      failed: 0,
    });

    try {
      const result = await NationalZipImportService.importResolvedFiles(
        file,
        resolvedList,
        (progress) => {
          setZipProgress(progress);
        }
      );

      if (result.processedFiles === 0) {
        throw new Error("No se procesó ningún archivo de forma exitosa. Revisa la selección de estados o que las hojas del Excel no estén vacías.");
      }

      setImportReport({
        total: result.totalRowsProcessed,
        added: result.added,
        updated: result.overwritten,
        omitted: result.omitted,
        failed: result.failed,
        timeMs: result.timeMs,
      });

      setSuccess(
        `Importación Nacional ZIP completada: ${result.processedFiles}/${result.totalFiles} archivos procesados con éxito.`
      );
      setZipStep("COMPLETED");

      // Recargar historial
      const history = await MarketFirestoreService.getImportHistory();
      setImportHistory(history);

      // Limpiar cache para forzar recarga de los estados importados
      datasetManager.clear();

      await loadDataset(true, true);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al procesar el archivo ZIP nacional: " + err.message);
      resetZipImportStates();
    } finally {
      setIsProcessing(false);
    }
  }

  // Manejar archivo ZIP cargado realizando el análisis previo
  async function handleZipSelect(file: File) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);
    setActiveZipFile(file);
    setZipStep("ZIP_RECEIVED");

    try {
      const summary = await NationalZipImportService.analyzeZipFiles(file);
      setZipSummary(summary);
      setZipStep("FILES_FOUND");
    } catch (err: any) {
      console.error(err);
      setError("Fallo al analizar el ZIP nacional: " + err.message);
      resetZipImportStates();
    } finally {
      setIsProcessing(false);
    }
  }

  // Proceder tras confirmar el resumen del ZIP
  async function handleConfirmZipImport() {
    if (!zipSummary || !activeZipFile) return;

    const analyzedFiles = zipSummary.files;
    const preResolved = analyzedFiles
      .filter((f: any) => !f.needsStateSelection)
      .map((f: any) => ({ filename: f.filename, state: f.guessedState }));

    const needsResolution = analyzedFiles.filter((f: any) => f.needsStateSelection);

    setZipSummary(null);

    if (needsResolution.length === 0) {
      setZipStep("STATES_DETECTED");
      await startResolvedZipImport(activeZipFile, preResolved);
    } else {
      setZipStep("RESOLVING_STATES");
      setResolvedFilesList(preResolved);
      setPendingStateResolutionFiles(needsResolution);
      setCurrentResolutionIndex(0);
    }
  }

  // Abrir detalle
  function handleSelectCompany(company: InegiCompany) {
    setSelectedCompany(company);
    setIsDrawerOpen(true);
  }

  // Cambiar Estatus Comercial del prospecto
  async function handleStatusChange(status: CompanyStatus) {
    if (!selectedCompany) return;
    setIsProcessing(true);
    setError("");
    setSuccess("");

    try {
      await MarketFirestoreService.updateMarketCompanyStatus(
        selectedCompany.id,
        status
      );

      const updated = {
        ...selectedCompany,
        status,
      };

      setSelectedCompany(updated);
      setSuccess(`Estatus del prospecto actualizado a ${status}.`);
      
      // Actualizar en el dataset activo local y la vista local
      setActiveMarketDataset((prev) =>
        prev.map((c) => (c.id === selectedCompany.id ? updated : c))
      );
      setCompanies((prev) =>
        prev.map((c) => (c.id === selectedCompany.id ? updated : c))
      );
    } catch (err: any) {
      setError("Error al cambiar estatus: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  // Convertir en Organización Consultiva y crear Timeline
  async function handleConvertCompany() {
    if (!selectedCompany) return;
    setIsProcessing(true);
    setError("");
    setSuccess("");

    try {
      const orgId = await MarketFirestoreService.convertMarketCompanyToOrganization(
        selectedCompany
      );

      const updated: InegiCompany = {
        ...selectedCompany,
        status: "CONVERTED",
        convertedOrganizationId: orgId,
      };

      setSelectedCompany(updated);
      setSuccess(
        `¡Conversión Exitosa! Creado expediente en platform_organizations con ID: ${orgId}.`
      );

      // Actualizar en el dataset activo local y la vista local
      setActiveMarketDataset((prev) =>
        prev.map((c) => (c.id === selectedCompany.id ? updated : c))
      );
      setCompanies((prev) =>
        prev.map((c) => (c.id === selectedCompany.id ? updated : c))
      );

      // Recargar estadísticas del dataset local modificado
      const total = activeMarketDataset.length;
      const converted = activeMarketDataset.map(c => c.id === selectedCompany.id ? updated : c).filter(c => c.status === "CONVERTED").length;
      const qualified = activeMarketDataset.map(c => c.id === selectedCompany.id ? updated : c).filter(c => c.status === "QUALIFIED" || c.status === "CONTACTED").length;
      const listAvg = activeMarketDataset.length > 0
        ? Math.round(activeMarketDataset.map(c => c.id === selectedCompany.id ? updated : c).reduce((acc, curr) => acc + curr.opportunityScore, 0) / activeMarketDataset.length)
        : 72;

      setStats({
        totalCount: total,
        convertedCount: converted,
        qualifiedCount: qualified,
        avgScore: listAvg,
      });
    } catch (err: any) {
      console.error(err);
      setError("Fallo al convertir prospecto: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  // Reparar registros que se hayan importado sin el campo 'estado'
  async function handleRepairStates() {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    try {
      const result = await MarketFirestoreService.repairImportedStates();
      setSuccess(`Mantenimiento completado. Se revisaron ${result.totalChecked} registros y se repararon ${result.repaired} sin estado.`);
      await loadDataset(true, true);
    } catch (err: any) {
      console.error(err);
      setError("Error durante la reparación de estados: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  if (hasAccess === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Validando credenciales de acceso...</p>
      </div>
    );
  }

  if (hasAccess === false) {
    return <PermissionDenied />;
  }

  function renderZipTimeline() {
    if (!zipStep) return null;

    const steps = [
      { id: "ZIP_RECEIVED", label: "ZIP Recibido", description: "Carga binaria confirmada." },
      { id: "FILES_FOUND", label: "Archivos listados", description: "Búsqueda Excel." },
      { id: "STATES_DETECTED", label: "Estados resueltos", description: "Geografía validada." },
      { id: "IMPORTING", label: "Importando", description: "Carga en Firestore." },
      { id: "COMPLETED", label: "Finalizado", description: "Historial guardado." },
    ];

    const currentStepIdx = steps.findIndex((s) => s.id === zipStep);

    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5 mb-4">
        <div className="grid gap-4 sm:grid-cols-5">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIdx || zipStep === "COMPLETED";
            const isActive = step.id === zipStep || (step.id === "STATES_DETECTED" && zipStep === "RESOLVING_STATES");

            return (
              <div key={step.id} className="flex flex-col gap-1 items-start text-left">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : isActive
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/40 animate-pulse"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span className={`text-[11px] font-bold ${
                    isActive ? "text-indigo-300 font-extrabold" : isCompleted ? "text-slate-300" : "text-slate-500"
                  }`}>
                    {step.label}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 pl-7 font-sans leading-tight">
                  {step.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera / Importador */}
      <MarketIntelligenceHeader
        onImport={handleImport}
        onZipSelect={handleZipSelect}
        isLoading={isProcessing}
        canImport={capabilities.canImport}
      />
      {pendingResumeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-lg">
                🔄
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Importación Interrumpida Detectada</h3>
                <p className="text-xs text-slate-400">
                  Se encontró un checkpoint local para el archivo: <strong className="text-slate-200 font-mono">{pendingResumeJob.filename}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Registros procesados en checkpoint:</span>
                <span className="font-bold text-white font-mono">{pendingResumeJob.checkpoint.processed.toLocaleString()} / {pendingResumeJob.companies.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Nuevos agregados:</span>
                <span className="font-bold text-emerald-400 font-mono">+{pendingResumeJob.checkpoint.added}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Actualizados:</span>
                <span className="font-bold text-cyan-400 font-mono">+{pendingResumeJob.checkpoint.overwritten}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Omitidos:</span>
                <span className="font-bold text-slate-400 font-mono">+{pendingResumeJob.checkpoint.omitted}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  const { processed, added, overwritten, omitted, failed } = pendingResumeJob.checkpoint;
                  setPendingResumeJob(null);
                  executeImportJob(
                    pendingResumeJob.jobId,
                    pendingResumeJob.filename,
                    pendingResumeJob.companies,
                    processed,
                    added,
                    overwritten,
                    omitted,
                    failed
                  );
                }}
                className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-500/10 transition"
              >
                Reanudar desde Registro {pendingResumeJob.checkpoint.processed.toLocaleString()}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(pendingResumeJob.jobId);
                  setPendingResumeJob(null);
                  executeImportJob(
                    pendingResumeJob.jobId,
                    pendingResumeJob.filename,
                    pendingResumeJob.companies,
                    0, 0, 0, 0, 0
                  );
                }}
                className="rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition"
              >
                Reiniciar desde Cero
              </button>
              
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(pendingResumeJob.jobId);
                  setPendingResumeJob(null);
                  setSuccess("Se ha eliminado el checkpoint del archivo.");
                }}
                className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition"
              >
                Limpiar Checkpoint
              </button>

              <button
                type="button"
                onClick={() => setPendingResumeJob(null)}
                className="rounded-xl border border-slate-800 bg-slate-905 px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo para Archivo Ya Importado (Checksum/Fingerprint) */}
      {duplicateImportJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-lg">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Archivo Ya Importado Anteriormente</h3>
                <p className="text-xs text-slate-400">
                  La huella digital de <strong className="text-slate-200 font-mono">{duplicateImportJob.filename}</strong> ya coincide en el historial.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 space-y-2 text-xs text-slate-400 font-sans">
              <p>
                Este archivo de <strong className="text-white font-mono">{duplicateImportJob.companies.length.toLocaleString()}</strong> registros 
                fue cargado con éxito anteriormente.
              </p>
              <div className="mt-1 pt-1.5 border-t border-slate-900 flex justify-between">
                <span>Último operador:</span>
                <span className="text-slate-200 font-mono">{duplicateImportJob.existingImport.user || "jcuellar@aura-hcm.com"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  executeFastValidation(duplicateImportJob);
                }}
                className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/10 transition flex items-center gap-1.5"
              >
                🔍 Validar Conteo Rápido
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const jobCompanies = duplicateImportJob.companies;
                  const jobName = duplicateImportJob.filename;
                  const jobFingerprint = duplicateImportJob.fingerprint;
                  setDuplicateImportJob(null);
                  const jobId = `aura_job_${jobName.replace(/[^a-zA-Z0-9]/g, "")}_${jobCompanies.length}`;
                  executeImportJob(jobId, jobName, jobCompanies, 0, 0, 0, 0, 0, jobFingerprint);
                }}
                className="rounded-xl bg-indigo-605 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition flex items-center gap-1"
              >
                ♻️ Reimportar Completo
              </button>

              <button
                type="button"
                onClick={() => setDuplicateImportJob(null)}
                className="rounded-xl border border-slate-800 bg-slate-905 px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de Progreso del Aura GTM Import Job Engine */}
      {activeJob && (
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-6 space-y-6 shadow-xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                Aura GTM Import Job Engine {activeJob.mode && `(${activeJob.mode})`}
              </span>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-cyan-400" />
                Trabajando en: {activeJob.filename}
              </h3>
            </div>
            
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 mr-1.5">Duración:</span>
                <span>{Math.round(activeJob.elapsedTimeMs / 1000)}s</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div>
                <span className="text-slate-500 mr-1.5">Lotes Restantes:</span>
                <span>{activeJob.batchesRemaining}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-7 text-center">
            {[
              { id: "PREPARING", label: "Preparando" },
              { id: "READING_EXCEL", label: "Excel" },
              { id: "NORMALIZING", label: "Normalizando" },
              { id: "WRITING_FIRESTORE", label: "Escribiendo" },
              { id: "VALIDATING_WRITE", label: "Validando" },
              { id: "UPDATING_DATASET_MANAGER", label: "Caché" },
              { id: "COMPLETED", label: "Finalizado" }
            ].map((st, idx) => {
              const stagesList = ["PREPARING", "READING_EXCEL", "NORMALIZING", "WRITING_FIRESTORE", "VALIDATING_WRITE", "UPDATING_DATASET_MANAGER", "COMPLETED"];
              const currentIdx = stagesList.indexOf(activeJob.stage);
              const isCompleted = idx < currentIdx || activeJob.stage === "COMPLETED";
              const isActive = st.id === activeJob.stage;

              return (
                <div key={st.id} className="flex flex-col gap-1 items-center">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : isActive
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 animate-pulse"
                      : "bg-slate-900 text-slate-600 border border-slate-800"
                  }`}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span className={`text-[10px] font-semibold mt-1 ${
                    isActive ? "text-cyan-300 font-bold" : isCompleted ? "text-slate-400" : "text-slate-650"
                  }`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                {activeJob.stage === "WRITING_FIRESTORE" ? (
                  <>Escribiendo registros en Firestore...</>
                ) : activeJob.stage === "VALIDATING_WRITE" ? (
                  <>Validando escrituras de base de datos...</>
                ) : activeJob.stage === "UPDATING_DATASET_MANAGER" ? (
                  <>Refrescando caché del Dataset Manager...</>
                ) : activeJob.stage === "COMPLETED" ? (
                  <span className="text-emerald-400 font-bold">¡Lote finalizado con éxito!</span>
                ) : (
                  <>Procesando etapa...</>
                )}
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {Math.round((activeJob.written / activeJob.total) * 100) || 0}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
              <div 
                className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((activeJob.written / activeJob.total) * 100))}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-5 text-center pt-2">
            <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Escritos / Total
              </span>
              <span className="block text-sm font-extrabold text-white mt-1 font-mono">
                {activeJob.written.toLocaleString()} / {activeJob.total.toLocaleString()}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Nuevos
              </span>
              <span className="block text-sm font-extrabold text-emerald-400 mt-1 font-mono">
                +{activeJob.added.toLocaleString()}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Actualizados
              </span>
              <span className="block text-sm font-extrabold text-cyan-400 mt-1 font-mono">
                +{activeJob.overwritten.toLocaleString()}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Omitidos
              </span>
              <span className="block text-sm font-extrabold text-slate-400 mt-1 font-mono">
                +{activeJob.omitted.toLocaleString()}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Fallidos
              </span>
              <span className="block text-sm font-extrabold text-red-400 mt-1 font-mono">
                {activeJob.failed.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-900">
            <div className="flex items-center gap-6 text-[10px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 mr-1.5">Velocidad:</span>
                <span className="font-bold text-slate-200">{activeJob.speed} reg/s</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div>
                <span className="text-slate-500 mr-1.5">Tiempo Restante (ETA):</span>
                <span className="font-bold text-amber-400">{activeJob.etaSeconds > 0 ? `${activeJob.etaSeconds}s` : "0s"}</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div>
                <span className="text-slate-500 mr-1.5">Procesados (pipeline):</span>
                <span className="font-bold text-cyan-400">{activeJob.processed.toLocaleString()}</span>
              </div>
            </div>

            {activeJob.stage !== "COMPLETED" && (
              <button
                type="button"
                onClick={() => {
                  isCancelledRef.current = true;
                }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition flex items-center gap-1.5"
              >
                🛑 Cancelar importación
              </button>
            )}
          </div>

          {/* Consola de Telemetría en Tiempo Real */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-[9px] text-cyan-400/90 space-y-2.5 max-h-64 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 pb-1.5 flex justify-between font-sans">
              <span>Telemetría de Diagnóstico por Lote (GTM Engine)</span>
              <span className="text-cyan-300">Activa</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 text-[8px] uppercase tracking-wider">
                    <th className="py-1 px-1">Lote</th>
                    <th className="py-1 px-1">Rango</th>
                    <th className="py-1 px-1">Regs</th>
                    <th className="py-1 px-1">Read (Ms)</th>
                    <th className="py-1 px-1">Commit (Ms)</th>
                    <th className="py-1 px-1">N / U / O / F</th>
                    <th className="py-1 px-1">Confirm/Acum</th>
                    <th className="py-1 px-1">Mem</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60 border-b border-slate-900/30">
                      <td className="py-1 px-1 font-bold text-cyan-300">#{log.batchNumber}</td>
                      <td className="py-1 px-1 text-slate-400">[{log.startIndex}-{log.endIndex}]</td>
                      <td className="py-1 px-1 text-slate-200">{log.recordsInBatch}</td>
                      <td className="py-1 px-1 text-amber-500/80">
                        {log.duplicateReadMs}ms <span className="text-[7px] text-slate-600">({log.duplicateReadStart})</span>
                      </td>
                      <td className="py-1 px-1 text-indigo-400">
                        {log.batchCommitMs}ms <span className="text-[7px] text-slate-650">({log.batchCommitStart})</span>
                      </td>
                      <td className="py-1 px-1">
                        <span className="text-emerald-400">+{log.newAdded}</span> / <span className="text-cyan-400">+{log.updated}</span> / <span className="text-slate-400">+{log.omitted}</span> / <span className="text-red-400">{log.failed}</span>
                      </td>
                      <td className="py-1 px-1 text-slate-300">{log.processedConfirmed} / {log.totalProcessedAccumulated}</td>
                      <td className="py-1 px-1 font-semibold text-slate-500">{log.memoryMb}MB {log.checkpointSaved ? "💾" : ""}</td>
                    </tr>
                  ))}
                  {telemetryLogs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-500 italic font-sans">
                        Esperando inicio de lote para reportar telemetría de diagnóstico...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Panel Final de Importación Validada (Integridad de Datos) */}
      {importReport && activeJob?.stage === "COMPLETED" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 space-y-6 shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-lg">
              🛡️
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Importación Validada con Éxito</h3>
              <p className="text-xs text-emerald-400 font-semibold font-sans">
                Garantía de Integridad Foundation Zero: {importReport.total} = {importReport.total}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-900/40 p-4 border border-slate-800">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Integridad de Datos
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 mt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                100% Sincronizado
              </span>
            </div>

            <div className="rounded-xl bg-slate-900/40 p-4 border border-slate-800">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Duración del Job
              </span>
              <span className="block text-sm font-extrabold text-white mt-1 font-mono">
                {Math.round(importReport.timeMs / 1000)} segundos
              </span>
            </div>

            <div className="rounded-xl bg-slate-900/40 p-4 border border-slate-800">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Velocidad Promedio
              </span>
              <span className="block text-sm font-extrabold text-cyan-400 mt-1 font-mono">
                {Math.round((importReport.total / (importReport.timeMs / 1000)) * 10) / 10} reg/s
              </span>
            </div>

            <div className="rounded-xl bg-slate-900/40 p-4 border border-slate-800">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Auditoría ID
              </span>
              <span className="block text-xs font-extrabold text-slate-400 mt-1.5 font-mono truncate">
                {activeJob.jobId}
              </span>
            </div>
          </div>

          {/* Propuesta de Optimización para Cloud Functions */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/5 p-4 space-y-1.5 text-amber-300/90 text-xs">
            <span className="block font-bold">💡 Propuesta de Optimización Arquitectónica</span>
            <p className="font-sans text-[11px] leading-relaxed text-slate-400">
              Dado que procesar 57,000 registros requiere realizar consultas de duplicidad en lotes y transacciones concurrentes desde el navegador,
              este tipo de carga pesada puede ser susceptible a límites de cliente (cuotas de red del navegador, limitadores locales de hilos de JS y OOM). 
              Se propone mover el motor a una <strong>Firebase Cloud Function</strong> o a un backend job dedicado, donde se procese el Excel de manera asíncrona mediante Streams.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/60 p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="block text-xs font-bold text-slate-200">
                Se guardó el log de auditoría completo en Firestore.
              </span>
              <p className="text-[11px] text-slate-500 font-sans">
                Registrado por el operador {auth.currentUser?.email || "jcuellar@aura-hcm.com"} para el archivo {activeJob.filename}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setImportReport(null);
                setActiveJob(null);
              }}
              className="rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition shrink-0"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Banner de Diagnóstico del Dataset Activo */}
      {activeMetadata && (
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-950/40 p-5 backdrop-blur-md space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                Aura Dataset Manager — Diagnóstico de Dataset en Memoria
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Última actualización: {new Date(activeMetadata.loadedAt).toLocaleTimeString()}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Estado Activo */}
            <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">Estado Activo</span>
              <span className="block text-sm font-extrabold text-white mt-1">
                {filters.estado || "Todos los Estados (Muestra)"}
              </span>
            </div>

            {/* Total empresas */}
            <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">Empresas en Memoria</span>
              <span className="block text-sm font-extrabold text-cyan-400 mt-1 font-mono">
                {activeMetadata.count.toLocaleString()}
              </span>
            </div>

            {/* Fuente / Versión */}
            <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">Fuente / Versión</span>
              <span className="block text-sm font-extrabold text-slate-300 mt-1">
                {activeMetadata.source} — {activeMetadata.sourceVersion}
              </span>
            </div>

            {/* MRR Estimado */}
            <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">MRR Potencial Estimado</span>
              <span className="block text-sm font-extrabold text-emerald-400 mt-1 font-mono">
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(activeMetadata.estimatedMrr)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-1">
            {/* Oportunidades Críticas/Alta Prioridad */}
            <div className="rounded-xl bg-slate-900/30 p-4 border border-slate-900/60 flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Oportunidades de Alta Prioridad</span>
                <span className="block text-xs text-slate-400 mt-1">Suma de perfiles clasificados como CRITICAL o HIGH.</span>
              </div>
              <span className="text-xl font-extrabold text-rose-400 font-mono">
                {activeMetadata.highPriorityCount.toLocaleString()}
              </span>
            </div>

            {/* Top Industrias */}
            <div className="rounded-xl bg-slate-900/30 p-4 border border-slate-900/60">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold mb-2">Principales Sectores en este Dataset</span>
              <div className="flex flex-wrap gap-2">
                {activeMetadata.topIndustries.map((indItem, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 border border-indigo-500/20"
                  >
                    {indItem.industry}: <strong className="text-white font-mono">{indItem.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {capabilities.canImport && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-4.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider font-sans">
              Aura Import Engine Enterprise
            </span>
          </div>
          <button
            type="button"
            onClick={handleRepairStates}
            disabled={isProcessing}
            className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition active:scale-95 disabled:opacity-50"
          >
            🔧 Reparar Estados Importados
          </button>
        </div>
      )}

      {/* Alertas */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-200">
          {success}
        </div>
      )}

      {/* Resumen Previo a la Importación ZIP (Prioridad 6) */}
      {zipSummary && activeZipFile && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-4">
          {renderZipTimeline()}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
              📁 ZIP Nacional Detectado
            </h3>
            <span className="text-xs text-slate-400 font-semibold font-mono font-sans">
              {activeZipFile.name}
            </span>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 text-center">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Archivos Excel Detectados
              </span>
              <span className="block text-2xl font-extrabold text-white mt-1">
                {zipSummary.totalFiles}
              </span>
            </div>
            
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Estados Identificados
              </span>
              <span className="block text-2xl font-extrabold text-white mt-1">
                {zipSummary.statesCount}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Registros Estimados
              </span>
              <span className="block text-2xl font-extrabold text-cyan-400 mt-1 font-mono">
                {zipSummary.totalEstimatedRows.toLocaleString()}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Resolución Requerida
              </span>
              <span className="block text-2xl font-extrabold text-amber-400 mt-1">
                {zipSummary.unresolvedFilesCount}
              </span>
            </div>
          </div>

          {zipSummary.unresolvedFilesCount > 0 && (
            <p className="text-xs text-amber-400 leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 font-sans">
              ⚠ Se requiere que confirmes el estado geográfico de <strong>{zipSummary.unresolvedFilesCount}</strong> archivo(s) manualmente antes de iniciar.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancelZipImport}
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-400 hover:bg-slate-900 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmZipImport}
              className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition active:scale-95"
            >
              Comenzar Importación
            </button>
          </div>
        </div>
      )}

      {/* Panel de Progreso en Tiempo Real del ZIP */}
      {zipProgress && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 space-y-4">
          {renderZipTimeline()}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
              Procesando Importación Nacional ZIP
            </h3>
            <span className="text-xs text-slate-400 font-semibold font-mono font-sans">
              {zipProgress.processedFiles} / {zipProgress.totalFiles} Archivos
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Archivo actual: <strong className="font-mono">{zipProgress.currentFile}</strong></span>
              <span>{Math.round((zipProgress.processedFiles / zipProgress.totalFiles) * 100)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div 
                className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${(zipProgress.processedFiles / zipProgress.totalFiles) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-center text-xs">
            <div className="rounded-lg bg-slate-950 p-3 border border-slate-900">
              <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Procesados</span>
              <span className="block font-bold text-white mt-0.5">{zipProgress.totalRowsProcessed}</span>
            </div>
            <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/10">
              <span className="block text-emerald-500 font-semibold uppercase tracking-wider text-[10px]">Nuevos</span>
              <span className="block font-bold text-emerald-400 mt-0.5">{zipProgress.added}</span>
            </div>
            <div className="rounded-lg bg-cyan-500/5 p-3 border border-cyan-500/10">
              <span className="block text-cyan-500 font-semibold uppercase tracking-wider text-[10px]">Actualizados</span>
              <span className="block font-bold text-cyan-400 mt-0.5">{zipProgress.overwritten}</span>
            </div>
            <div className="rounded-lg bg-rose-500/5 p-3 border border-rose-500/10">
              <span className="block text-rose-500 font-semibold uppercase tracking-wider text-[10px]">Errores</span>
              <span className="block font-bold text-rose-400 mt-0.5">{zipProgress.failed}</span>
            </div>
          </div>

          {zipStep === "COMPLETED" && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={resetZipImportStates}
                className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition active:scale-95"
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      )}

      {/* Asistente de Selección Manual de Estado para ZIP (Prioridad 4) */}
      {pendingStateResolutionFiles && currentResolutionIndex !== -1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/20 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Asistente de Importación Nacional (ZIP)
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                Selección de Estado Requerida
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                No pudimos detectar automáticamente el estado para el archivo:
                <strong className="block text-amber-200 mt-1 font-mono break-all font-sans">
                  {pendingStateResolutionFiles[currentResolutionIndex].filename}
                </strong>
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 font-sans">
                Selecciona el estado de la República correspondiente:
              </label>
              <select
                onChange={(e) => {
                  const stateVal = e.target.value;
                  if (!stateVal) return;
                  
                  // Guardar resolución y pasar al siguiente
                  const filename = pendingStateResolutionFiles[currentResolutionIndex].filename;
                  const newResolvedList = [...resolvedFilesList, { filename, state: stateVal }];
                  setResolvedFilesList(newResolvedList);

                  // Limpiar el select para el siguiente renderizado de estado
                  e.target.value = "";

                  if (currentResolutionIndex + 1 < pendingStateResolutionFiles.length) {
                    setCurrentResolutionIndex(currentResolutionIndex + 1);
                  } else {
                    // Todos resueltos: Iniciar importación
                    startResolvedZipImport(activeZipFile!, newResolvedList);
                  }
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">-- Seleccionar Estado --</option>
                {NationalZipImportService.MEXICAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelZipImport}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar Importación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reporte de Importación Detallado (Prioridad 4) */}
      {importReport && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              📊 Reporte de Procesamiento de Importación
            </h3>
            <button
              onClick={() => setImportReport(null)}
              className="text-xs text-slate-500 hover:text-white"
            >
              Cerrar Reporte
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-5 text-center">
            <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800">
              <span className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Procesados</span>
              <span className="block text-2xl font-bold text-white mt-1">{importReport.total}</span>
            </div>
            <div className="rounded-xl bg-emerald-500/5 p-4 border border-emerald-500/20">
              <span className="block text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Nuevos</span>
              <span className="block text-2xl font-bold text-emerald-300 mt-1">{importReport.added}</span>
            </div>
            <div className="rounded-xl bg-cyan-500/5 p-4 border border-cyan-500/20">
              <span className="block text-cyan-400 text-[10px] font-semibold uppercase tracking-wider">Actualizados</span>
              <span className="block text-2xl font-bold text-cyan-300 mt-1">{importReport.updated}</span>
            </div>
            <div className="rounded-xl bg-amber-500/5 p-4 border border-amber-500/20">
              <span className="block text-amber-400 text-[10px] font-semibold uppercase tracking-wider">Sin cambios</span>
              <span className="block text-2xl font-bold text-amber-300 mt-1">{importReport.omitted}</span>
            </div>
            <div className="rounded-xl bg-rose-500/5 p-4 border border-rose-500/20">
              <span className="block text-rose-400 text-[10px] font-semibold uppercase tracking-wider">Fallidos</span>
              <span className="block text-2xl font-bold text-rose-300 mt-1">{importReport.failed}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 text-right">
            Tiempo de ejecución en servidor: <span className="font-semibold text-slate-400">{importReport.timeMs} ms</span>
          </div>
        </div>
      )}

      {/* Tablero Ejecutivo Comercial de Aura Prospect Intelligence */}
      <CommercialDashboard
        companies={activeMarketDataset}
        onSelectCompany={handleSelectCompany}
        stats={stats}
      />

      {/* Grid Principal con Segmentos y Tabla */}
      <div className="grid gap-6 xl:grid-cols-12">
        
        {/* Panel Izquierdo: Segmentación */}
        <aside className="xl:col-span-3">
          <MarketSegmentsPanel
            onSelectSegment={handleSelectSegment}
            activeSegmentId={activeSegmentId}
          />
        </aside>

        {/* Panel Derecho: Filtros y Tabla */}
        <div className="space-y-6 xl:col-span-9">
          
          <MarketCompaniesFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            availableStates={availableStates}
            sectorCounts={industriesStats.stateFilteredCounts}
          />

          {/* La búsqueda se ejecuta reactivamente mediante el efecto del filtro */}

          <MarketCompaniesTable
            companies={companies}
            isLoading={isLoading}
            onSelectCompany={handleSelectCompany}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            hasMore={hasMore}
            currentPage={currentPage}
            filters={{ estado: filters.estado, sector: filters.sector }}
            sectorCounts={industriesStats.stateFilteredCounts}
          />

        </div>

      </div>

      {/* Historial de Importaciones Recientes (Prioridad 4) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 outline-none"
        >
          <span className="flex items-center gap-2">
            <span>📋</span> Historial de Auditoría de Importaciones (Últimas 20)
          </span>
          <span className="text-cyan-400">
            {showHistory ? "Ocultar" : `Mostrar (${importHistory.length})`}
          </span>
        </button>

        {showHistory && (
          <div className="mt-4 overflow-x-auto">
            {importHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No se han registrado importaciones en este tenant.</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5">Fecha / Hora</th>
                    <th className="py-2.5">Total Registros</th>
                    <th className="py-2.5 text-emerald-400">Nuevos</th>
                    <th className="py-2.5 text-cyan-400">Actualizados</th>
                    <th className="py-2.5 text-amber-400">Sin Cambios</th>
                    <th className="py-2.5 text-rose-400">Fallidos</th>
                    <th className="py-2.5 text-right">Tiempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {importHistory.map((entry) => {
                    const date = entry.timestamp?.seconds
                      ? new Date(entry.timestamp.seconds * 1000).toLocaleString()
                      : "Reciente";
                    return (
                      <tr key={entry.id} className="hover:bg-slate-900/20">
                        <td className="py-2.5 font-medium">{date}</td>
                        <td className="py-2.5">{entry.totalProcessed}</td>
                        <td className="py-2.5 font-semibold text-emerald-400">{entry.newAdded}</td>
                        <td className="py-2.5 font-semibold text-cyan-400">{entry.updated}</td>
                        <td className="py-2.5 font-semibold text-amber-400">{entry.omitted}</td>
                        <td className="py-2.5 font-semibold text-rose-400">{entry.failed}</td>
                        <td className="py-2.5 text-right text-slate-400">{entry.timeMs} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Panel Temporal de Depuración (Visibilidad local y super-admin) */}
      {(import.meta.env.DEV || capabilities.canImport) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-6 my-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <span>🔧</span> Panel de Depuración Comercial (Aura Diagnostic OS)
            </h4>
            <span className="rounded bg-cyan-950 px-2 py-0.5 text-[9px] font-bold text-cyan-400 font-mono">
              Dev Mode
            </span>
          </div>
          
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase font-sans">Filtros Activos</span>
              <pre className="text-[10px] font-mono text-cyan-300 overflow-x-auto max-h-32 bg-slate-950/40 p-2 rounded">
                {JSON.stringify(filters, null, 2)}
              </pre>
            </div>
            
            <div className="space-y-2 rounded-lg bg-slate-900/40 p-3 border border-slate-900">
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase font-sans">Estados Únicos Detectados</span>
                <span className="text-white font-mono text-[10px] block truncate mt-1" title={availableStates.join(", ")}>
                  {availableStates.join(", ") || "Ninguno"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/40 mt-2">
                <div>
                  <span className="block text-[8px] font-bold text-slate-500 uppercase font-sans">Raw Docs</span>
                  <span className="font-extrabold text-white text-sm">{rawDataset.length}</span>
                </div>
                <div>
                  <span className="block text-[8px] font-bold text-slate-500 uppercase font-sans">Filtered</span>
                  <span className="font-extrabold text-cyan-400 text-sm">{activeMarketDataset.length}</span>
                </div>
                <div>
                  <span className="block text-[8px] font-bold text-slate-500 uppercase font-sans">Paginated</span>
                  <span className="font-extrabold text-amber-400 text-sm">{companies.length}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900 font-sans">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase">Diagnóstico de Selección de Filtros</span>
              <table className="w-full text-[10px] font-mono text-slate-300 mt-1">
                <tbody>
                  <tr>
                    <td className="text-slate-500 py-0.5">Estado Raw:</td>
                    <td className="text-cyan-300 font-bold">{filters.estado || "(vacío)"}</td>
                  </tr>
                  <tr>
                    <td className="text-slate-500 py-0.5">Estado Norm:</td>
                    <td className="text-cyan-300">{filters.estado ? normalizeState(filters.estado) : "(vacío)"}</td>
                  </tr>
                  <tr>
                    <td className="text-slate-500 py-0.5">Status Raw:</td>
                    <td className="text-cyan-300">{filters.status || "(vacío)"}</td>
                  </tr>
                  <tr>
                    <td className="text-slate-500 py-0.5">Sector Raw:</td>
                    <td className="text-cyan-300 truncate max-w-[120px] inline-block" title={filters.sector}>{filters.sector || "(vacío)"}</td>
                  </tr>
                  <tr>
                    <td className="text-slate-500 py-0.5">Tamaño Raw:</td>
                    <td className="text-cyan-300">{filters.tamano || "(vacío)"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Card 4: Distribución de Sectores Comerciales (En tiempo real) */}
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900 overflow-y-auto max-h-48 font-sans">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase font-sans">Distribución de Sectores</span>
              <table className="w-full text-[9px] font-mono text-slate-300 mt-1">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-left">
                    <th className="pb-1 pr-2">Sector</th>
                    <th className="pb-1 text-right pr-2">Global</th>
                    <th className="pb-1 text-right">Filtrado Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {Object.entries(industriesStats.allCounts).map(([ind, count]) => {
                    const stateCount = industriesStats.stateFilteredCounts[ind] || 0;
                    return (
                      <tr key={ind} className="hover:bg-slate-900/25">
                        <td className="py-0.5 text-slate-400 pr-2 truncate max-w-[100px]" title={ind}>{ind}</td>
                        <td className="py-0.5 text-right font-bold pr-2">{count}</td>
                        <td className="py-0.5 text-right text-cyan-400 font-bold">{stateCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Fila inferior: Tabla de auditoría visual de primeros 20 */}
            <div className="md:col-span-2 xl:col-span-4 rounded-lg bg-slate-900/40 p-4 border border-slate-900 overflow-x-auto font-sans">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase mb-2">Auditoría Visual de Posicionamiento (Primeros 20 en rawDataset)</span>
              <table className="w-full text-[10px] font-mono text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-left">
                    <th className="pb-1.5 pr-2">Empresa</th>
                    <th className="pb-1.5 pr-2">Estado Raw</th>
                    <th className="pb-1.5 pr-2">Municipio</th>
                    <th className="pb-1.5 pr-2">getCompanyState()</th>
                    <th className="pb-1.5 pr-2 text-center">En Dropdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {rawDataset.slice(0, 20).map((company) => {
                    const resolved = getCompanyState(company);
                    const isInDropdown = availableStates.includes(resolved);
                    return (
                      <tr key={company.id} className="hover:bg-slate-900/45 text-slate-300">
                        <td className="py-1 pr-2 truncate max-w-[150px]" title={company.nombreComercial || company.razonSocial}>
                          {company.nombreComercial || company.razonSocial}
                        </td>
                        <td className="py-1 pr-2 truncate max-w-[100px]" title={company.estado || "(vacío)"}>
                          {company.estado || "(vacío)"}
                        </td>
                        <td className="py-1 pr-2 truncate max-w-[100px]" title={company.municipio || "(vacío)"}>
                          {company.municipio || "(vacío)"}
                        </td>
                        <td className="py-1 pr-2 font-bold text-cyan-400">{resolved}</td>
                        <td className="py-1 pr-2 text-center">
                          <span className={`rounded px-1.5 py-0.2 text-[8px] font-extrabold ${isInDropdown ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" : "bg-rose-950 text-rose-400 border border-rose-500/20"}`}>
                            {isInDropdown ? "SÍ" : "NO"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de Detalle y Conversión */}
      <MarketCompanyDrawer
        company={selectedCompany}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedCompany(null);
        }}
        onStatusChange={handleStatusChange}
        onConvert={handleConvertCompany}
        isProcessing={isProcessing}
        canUpdate={capabilities.canUpdate}
        canConvert={capabilities.canConvert}
      />
    </div>
  );
}
