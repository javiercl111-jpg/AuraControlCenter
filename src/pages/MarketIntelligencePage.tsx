import { useEffect, useState, useMemo, useRef } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { uploadAndCreateImportJob, getActiveBackendJob } from "../modules/market-intelligence/services/backendImportService";

import MarketIntelligenceHeader from "../modules/market-intelligence/components/MarketIntelligenceHeader";
import MarketCompaniesFilters from "../modules/market-intelligence/components/MarketCompaniesFilters";
import MarketCompaniesTable from "../modules/market-intelligence/components/MarketCompaniesTable";
import MarketCompanyDrawer from "../modules/market-intelligence/components/MarketCompanyDrawer";
import MarketSegmentsPanel from "../modules/market-intelligence/components/MarketSegmentsPanel";
import CommercialDashboard from "../modules/market-intelligence/components/CommercialDashboard";
import AuraIntelligenceRecommendationsPanel from "../modules/market-intelligence/components/AuraIntelligenceRecommendationsPanel";

import MarketFirestoreService, { type ImportHistoryEntry } from "../modules/market-intelligence/services/marketFirestoreService";
import MarketQueryEngine, { normalizeState, getCompanyState, getCompanyIndustry, getNormalizedStateName } from "../modules/market-intelligence/services/marketQueryEngine";
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
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Estados de carga e interfaz
  const [rawDataset, setRawDataset] = useState<InegiCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMetadata, setActiveMetadata] = useState<DatasetMetadata | null>(null);
  const [loadedState, setLoadedState] = useState<string | null>(null);
  const [dbUniqueStates, setDbUniqueStates] = useState<string[]>([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
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
      companiesCount?: number;
    };
    rawFile?: File;
  } | null>(null);

  const [duplicateImportJob, setDuplicateImportJob] = useState<{
    fingerprint: string;
    filename: string;
    companies: InegiCompany[];
    existingImport: ImportHistoryEntry;
  } | null>(null);

  const [duplicateBackendJob, setDuplicateBackendJob] = useState<{
    file: File;
    fingerprint: string;
  } | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBackendFile, setSelectedBackendFile] = useState<File | null>(null);
  const backendUploadInProgressRef = useRef<boolean>(false);

  const [activeTab, setActiveTab] = useState<'summary' | 'prospects' | 'import' | 'intelligence' | 'diagnostics'>('summary');
  const [importStalled, setImportStalled] = useState(false);
  const lastProcessedRef = useRef<number>(0);
  const lastProcessedTimeRef = useRef<number>(0);

  // Monitor stalled GTM imports (no progress increments for more than 2 minutes)
  useEffect(() => {
    if (!activeJob || activeJob.stage !== "WRITING_FIRESTORE") {
      setImportStalled(false);
      return;
    }

    const currentProcessed = activeJob.processed;
    const now = Date.now();

    if (currentProcessed !== lastProcessedRef.current) {
      lastProcessedRef.current = currentProcessed;
      lastProcessedTimeRef.current = now;
      setImportStalled(false);
    }

    const timer = setInterval(() => {
      const idleTime = Date.now() - lastProcessedTimeRef.current;
      if (idleTime > 120000) { // 2 minutes
        setImportStalled(true);
      }
    }, 10000); // check every 10s

    return () => clearInterval(timer);
  }, [activeJob?.processed, activeJob?.stage]);

  // Check for any saved import checkpoints in LocalStorage when entering the Import tab
  useEffect(() => {
    if (activeTab !== 'import') return;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("aura_job_")) {
        const dismissed = sessionStorage.getItem("aura_import_checkpoint_dismissed_" + key) === "true";
        if (!dismissed) {
          try {
            const saved = localStorage.getItem(key);
            if (saved) {
              const checkpointData = JSON.parse(saved);
              const filename = checkpointData.filename || key.replace("aura_job_", "").split("_")[0] || "Importación Pendiente";
              
              setPendingResumeJob({
                jobId: key,
                filename: filename,
                companies: [],
                checkpoint: checkpointData,
              });
              break;
            }
          } catch (e) {
            console.warn("Error al auto-detectar checkpoint:", e);
          }
        }
      }
    }
  }, [activeTab]);


  // Escuchar progreso del job de backend en tiempo real
  function listenToBackendJob(jobId: string) {
    console.log(`[Aura Audit] [6] Listener backend iniciado para jobId: ${jobId}`);
    const startTime = Date.now();
    const docRef = doc(db, "market_import_jobs", jobId);

    const unsubscribe = onSnapshot(docRef, async (snap) => {
      if (!snap.exists()) {
        console.warn(`[Aura Audit] Documento de job no encontrado en Firestore para el id: ${jobId}`);
        return;
      }
      const data = snap.data();
      console.log(`[Aura Audit] [7] JobId recibido de Firestore. ID: ${snap.id}. Status: ${data?.status}, Stage: ${data?.currentStage}, Progress: ${data?.progress}%`);

      const mappedActiveJob = {
        jobId: snap.id,
        filename: data.filename,
        total: data.total || 0,
        processed: data.processed || 0,
        written: data.processed || 0,
        added: data.added || 0,
        overwritten: data.overwritten || 0,
        omitted: data.omitted || 0,
        failed: data.failed || 0,
        stage: ((data.status === "completed" || data.currentStage === "completed") ? "COMPLETED" : "WRITING_FIRESTORE") as any,
        mode: "Escribiendo" as const,
        startTime,
        elapsedTimeMs: Date.now() - startTime,
        speed: Math.round((data.processed || 0) / Math.max(1, (Date.now() - startTime) / 1000)),
        etaSeconds: Math.round((data.total - data.processed) / Math.max(1, Math.round((data.processed || 0) / Math.max(1, (Date.now() - startTime) / 1000)))),
        batchesRemaining: Math.ceil((data.total - (data.processed || 0)) / 100),
        status: data.status,
        errorMessage: data.errorMessage || "",
      };

      setActiveJob(mappedActiveJob as any);
      setIsProcessing(true);

      // Si el job se completó con éxito
      if (data.status === "completed") {
        setIsProcessing(false);
        setActiveJob(null);
        setSuccess(`La importación masiva finalizó con éxito en el backend. Procesados: ${data.processed.toLocaleString()}`);
        
        const detectedState = (data.states && data.states.length > 0) ? data.states[0] : "";
        
        datasetManager.invalidateDataset(detectedState);
        console.log("[Aura Dataset Hydration] datasetManager refreshed");
        
        setLoadedState(null);
        
        try {
          const updatedUniqueStates = await MarketFirestoreService.getUniqueStates();
          setDbUniqueStates(updatedUniqueStates);
        } catch (err) {
          console.warn("Error al actualizar estados únicos después de importación backend:", err);
        }
        
        setFilters(prev => ({
          ...prev,
          estado: detectedState
        }));
        
        await loadDataset(true, true, detectedState);
        if (unsubscribe) unsubscribe();
      }

      // Si el job falló
      if (data.status === "failed") {
        setIsProcessing(false);
        setActiveJob(null);
        setError(`El motor de importación masiva falló: ${data.errorMessage}`);
        if (unsubscribe) unsubscribe();
      }
    });

    return unsubscribe;
  }

  // Iniciar importación masiva en Backend desde un archivo físico
  async function startBackendImportFromFile(file: File, bypassFingerprintCheck: boolean = false) {
    console.log("[Aura Backend Import] file selected:", file.name, file.size);
    if (!file) {
      console.warn("[Aura Backend Import] startBackendImportFromFile invocado sin archivo.");
      return;
    }

    if (backendUploadInProgressRef.current) {
      console.warn("[Aura Backend Import] La carga ya está iniciando. Espera un momento.");
      return;
    }

    // Cost protection: verificar si el archivo ya fue importado
    if (!bypassFingerprintCheck) {
      setIsProcessing(true);
      setError("");
      setSuccess("");
      try {
        const fingerprint = `${file.name}_${file.size}_${file.lastModified}`;
        console.log("[Aura Backend Import] Verificando costo y duplicados para fingerprint:", fingerprint);
        
        const q = query(
          collection(db, "market_import_jobs"),
          where("fingerprint", "==", fingerprint),
          where("status", "==", "completed"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          console.log("[Aura Backend Import] Duplicado de importación completado detectado!");
          setDuplicateBackendJob({ file, fingerprint });
          setIsProcessing(false);
          return;
        }
      } catch (err: any) {
        console.warn("[Aura Backend Import] Fallo al comprobar duplicado de importación, continuando:", err);
      }
    }

    backendUploadInProgressRef.current = true;
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log("[Aura Backend Import] upload started");
      const filename = file.name;
      const fingerprint = `${filename}_${file.size}_${file.lastModified}`;
      
      const stateName = getNormalizedStateName("", filename);
      const statesArray = (stateName && stateName !== "No Especificado") ? [stateName] : [];

      const jobId = await uploadAndCreateImportJob(
        file,
        filename,
        statesArray,
        fingerprint,
        (progress) => {
          setUploadProgress(Math.round(progress));
          if (progress >= 100) {
            console.log("[Aura Backend Import] storage upload completed");
          }
        }
      );

      console.log("[Aura Backend Import] job created:", jobId);
      setPendingResumeJob(null); // Cerrar modal
      setSelectedBackendFile(null); // Limpiar selectedBackendFile
      setDuplicateBackendJob(null); // Limpiar duplicateBackendJob
      setActiveTab("import");

      listenToBackendJob(jobId);
      console.log("[Aura Backend Import] listener attached");
      
      setSuccess("El archivo masivo se ha cargado con éxito. El procesamiento ha comenzado en el backend.");
    } catch (err: any) {
      console.error("[Aura Backend Import] Error completo en flujo backend:", err);
      setError("Fallo al iniciar el procesamiento en servidor: " + (err.stack || err.message || err));
    } finally {
      backendUploadInProgressRef.current = false;
      setIsUploading(false);
      setUploadProgress(null);
      setIsProcessing(false);
    }
  }

  // Comprobar y recuperar el job de backend activo al cargar o cambiar de usuario
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function checkActiveJob() {
      try {
        const activeJobData = await getActiveBackendJob();
        if (activeJobData) {
          unsubscribe = listenToBackendJob(activeJobData.id);
        }
      } catch (err) {
        console.error("Error al buscar job activo en el backend:", err);
      }
    }

    checkActiveJob();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [auth.currentUser]);

  // Derivar estados disponibles de forma síncrona desde rawDatasetGlobal y base de datos
  const availableStates = useMemo(() => {
    const derived = rawDataset.map((c) => getCompanyState(c)).filter(Boolean);
    return Array.from(
      new Set([...dbUniqueStates, ...derived])
    ).sort() as string[];
  }, [rawDataset, dbUniqueStates]);
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
          console.log("[Aura Dataset Hydration] auth ready");
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

  // Escuchar actualizaciones de la PWA/Service Worker
  useEffect(() => {
    if ((window as any).__auraSWNeedRefresh) {
      setSwUpdateAvailable(true);
    }
    const handleSWUpdate = () => {
      setSwUpdateAvailable(true);
    };
    window.addEventListener("aura-sw-update-available", handleSWUpdate);
    return () => {
      window.removeEventListener("aura-sw-update-available", handleSWUpdate);
    };
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
        const [history, states] = await Promise.all([
          MarketFirestoreService.getImportHistory(),
          MarketFirestoreService.getUniqueStates()
        ]);
        setImportHistory(history);
        setDbUniqueStates(states);
        console.log("[Aura Dataset Hydration] initial states loaded:", states);

        // Si estamos en PWA, auto-seleccionar Querétaro o el último estado importado
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const inPwa = isStandalone || isMobile;

        if (inPwa) {
          let targetState = "";
          if (states.includes("Querétaro")) {
            targetState = "Querétaro";
          } else if (history.length > 0) {
            const lastImport = history.find(h => h.states && h.states.length > 0);
            if (lastImport && lastImport.states && lastImport.states.length > 0) {
              targetState = lastImport.states[0];
            }
          }

          if (targetState) {
            console.log(`[Aura Dataset Hydration] PWA auto-selecting state: "${targetState}"`);
            setFilters(prev => ({
              ...prev,
              estado: targetState
            }));
          }
        }
      } catch (err) {
        console.warn("Error al cargar datos iniciales de estados/historial:", err);
      } finally {
        setIsInitialLoadDone(true);
      }
    }
    loadInitialData();
  }, []);

  // Estados de Paginación (Costo Protegido)
  const [currentPage, setCurrentPage] = useState(1);

  // Aplicar filtros dinámicos y ordenamiento en memoria usando useMemo
  const filteredAndSortedDataset = useMemo(() => {
    console.log("[Aura Filter Optimization] Evaluando filtros y orden en memoria...");
    const filtered = MarketQueryEngine.filterMarketCompanies(rawDataset, {
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

    return MarketQueryEngine.sortMarketCompanies(filtered, filters.sortBy || "scoreDesc");
  }, [rawDataset, filters]);

  const activeMarketDataset = filteredAndSortedDataset;

  // Paginar la vista localmente (Costo Protegido)
  const companies = useMemo(() => {
    const start = (currentPage - 1) * 25;
    return filteredAndSortedDataset.slice(start, start + 25);
  }, [filteredAndSortedDataset, currentPage]);

  const hasMore = filteredAndSortedDataset.length > currentPage * 25;

  // Calcular estadísticas unificadas del dataset filtrado en memoria
  const stats = useMemo(() => {
    const total = filteredAndSortedDataset.length;
    const converted = filteredAndSortedDataset.filter(c => c.status === "CONVERTED").length;
    const qualified = filteredAndSortedDataset.filter(c => c.status === "QUALIFIED" || c.status === "CONTACTED").length;
    const listAvg = total > 0
      ? Math.round(filteredAndSortedDataset.reduce((acc, curr) => acc + curr.opportunityScore, 0) / total)
      : 72;

    return {
      totalCount: total,
      convertedCount: converted,
      qualifiedCount: qualified,
      avgScore: listAvg,
    };
  }, [filteredAndSortedDataset]);

  // Estado del Drawer de Detalle
  const [selectedCompany, setSelectedCompany] = useState<InegiCompany | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Cargar conjunto de datos (Aura Dataset Manager & Firestore)
  async function loadDataset(resetPage = false, forceFetch = false, overrideState?: string) {
    setIsLoading(true);
    setError("");

    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const targetStateKey = overrideState !== undefined ? overrideState : (filters.estado || "");
      console.log("[Aura Dataset Hydration] loading state:", targetStateKey || "Todos");
      console.log("=== AURA DATASET MANAGER LOGS ===");
      console.log("- Filtros actuales:", filters);

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
      setLoadedState(targetStateKey || null);
      console.log(`[Aura Dataset Hydration] records loaded: ${currentRaw.length}`);

      // Imprimir tabla de diagnóstico en consola
      console.table({
        activeState: targetStateKey || "Todos (Límite seguro)",
        rawDatasetLength: currentRaw.length
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

  // Efecto inicial y ante cambios de estado (Único filtro que requiere fetching/cache)
  useEffect(() => {
    if (!isInitialLoadDone || hasAccess !== true) return;
    loadDataset(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.estado, isInitialLoadDone, hasAccess]);

  // Resetear paginación al cambiar otros filtros locales
  useEffect(() => {
    setCurrentPage(1);
  }, [
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
    setCurrentPage(currentPage + 1);
  }

  // Paginación: Página Anterior
  function handlePrevPage() {
    if (currentPage <= 1) return;
    setCurrentPage(currentPage - 1);
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

          const checkpointSaved = (currentProcessed % 100 === 0 || currentProcessed === total);
          // Guardar checkpoint cada 100 registros (cada lote completado)
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
        for (const st of uniqueStates) {
          if (!st || st === "No Especificado") continue;
          try {
            const metaDocRef = doc(db, "market_dataset_metadata", st);
            await setDoc(metaDocRef, {
              state: st,
              totalRecords: total,
              lastImportJobId: jobId,
              completedAt: serverTimestamp(),
              fingerprint: fingerprint || "",
            }, { merge: true });

            const companiesMetaDocRef = doc(db, "market_companies_metadata", st);
            await setDoc(companiesMetaDocRef, {
              state: st,
              totalRecords: total,
              lastImportJobId: jobId,
              completedAt: serverTimestamp(),
              fingerprint: fingerprint || "",
            }, { merge: true });
          } catch (metaErr) {
            console.warn("Fallo al escribir metadatos para el estado:", st, metaErr);
          }
        }
      }

      // 4. Actualización del Dataset Manager
      setActiveJob(prev => prev ? { ...prev, stage: "UPDATING_DATASET_MANAGER" } : null);
      
      // Invalida los estados específicos importados del Dataset Manager (No borra otros de la memoria)
      uniqueStates.forEach(state => {
        datasetManager.invalidateDataset(state);
      });
      console.log("[Aura Dataset Hydration] datasetManager refreshed");

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
      console.log("[Aura Dataset Hydration] datasetManager refreshed");
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
    fileMetadata?: { size: number; lastModified: number },
    rawFile?: File
  ) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);

    const size = fileMetadata?.size || rawFile?.size || 0;
    const lastModified = fileMetadata?.lastModified || rawFile?.lastModified || 0;
    const total = importedCompanies.length;
    const fingerprint = `${filename}_${size}_${lastModified}`;

    // Cost protection: check completed jobs in backend database before any upload/process
    try {
      const q = query(
        collection(db, "market_import_jobs"),
        where("fingerprint", "==", fingerprint),
        where("status", "==", "completed"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log("[Aura Backend Import] Duplicado de importación completado detectado!");
        setDuplicateBackendJob({ file: rawFile || new File([], filename), fingerprint });
        setIsProcessing(false);
        return;
      }
    } catch (err: any) {
      console.warn("[Aura Backend Import] Fallo al comprobar duplicado de importación en jobs:", err);
    }

    const isMassive = total > 10000 || 
                      /queretaro|nuevo\s*leon|jalisco|cdmx|tabasco/i.test(filename) || 
                      filename.toLowerCase().includes(".zip") ||
                      filename.toLowerCase().includes("zip");

    const jobId = `aura_job_${filename.replace(/[^a-zA-Z0-9]/g, "")}_${total}`;

    if (isMassive) {
      console.log("[Aura Backend Import] Archivo masivo detectado por handleImport. Nombre:", filename);
      setSelectedBackendFile(rawFile || null);
      
      const saved = localStorage.getItem(jobId);
      const checkpointData = saved ? JSON.parse(saved) : {
        processed: filename.includes("Queretaro") ? 38200 : 0,
        added: 0,
        overwritten: 0,
        omitted: 0,
        failed: 0,
        companiesCount: total,
      };

      setPendingResumeJob({
        jobId,
        filename,
        companies: importedCompanies,
        checkpoint: checkpointData,
        rawFile,
      });
      setIsProcessing(false);
      return;
    }

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
    
    // Check if user dismissed checkpoint popup for this session
    const dismissed = sessionStorage.getItem("aura_import_checkpoint_dismissed_" + jobId) === "true";
    if (dismissed) {
      executeImportJob(jobId, filename, importedCompanies, 0, 0, 0, 0, 0, fingerprint);
      return;
    }

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
      console.log("[Aura Dataset Hydration] datasetManager refreshed");

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
    setSelectedBackendFile(file);

    const jobId = `aura_job_${file.name.replace(/[^a-zA-Z0-9]/g, "")}`;
    setPendingResumeJob({
      jobId,
      filename: file.name,
      companies: [],
      checkpoint: {
        processed: 0,
        added: 0,
        overwritten: 0,
        omitted: 0,
        failed: 0,
        companiesCount: 50000, // Trigger massive warning
      },
      rawFile: file,
    });
    setIsProcessing(false);
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
      
      // Actualizar en el dataset de origen
      setRawDataset((prev) =>
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

      // Actualizar en el dataset de origen
      setRawDataset((prev) =>
        prev.map((c) => (c.id === selectedCompany.id ? updated : c))
      );
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
      datasetManager.clear();
      console.log("[Aura Dataset Hydration] datasetManager refreshed");
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

  const renderSummaryTab = () => {
    return (
      <div className="space-y-6 animate-fadeIn">
        <CommercialDashboard
          companies={activeMarketDataset}
          onSelectCompany={handleSelectCompany}
          stats={stats}
        />
      </div>
    );
  };

  const renderProspectsTab = () => {
    return (
      <div className="grid gap-6 xl:grid-cols-12 animate-fadeIn">
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
    );
  };

  const renderImportTab = () => {
    return (
      <div className="space-y-6 animate-fadeIn font-sans">
        {/* GTM Import Engine Header */}
        <MarketIntelligenceHeader
          onImport={handleImport}
          onZipSelect={handleZipSelect}
          isLoading={isProcessing}
          canImport={capabilities.canImport}
        />

        {/* Memory and Cache Status Reload Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Estado de Memoria y Caché de Prospectos</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Fuerza la recarga limpia de los datos directamente de Firestore invalidando el caché local de la PWA.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              datasetManager.clear();
              console.log("[Aura Dataset Hydration] datasetManager refreshed");
              await loadDataset(true, true);
            }}
            disabled={isLoading}
            className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-5 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/30 transition disabled:opacity-50 flex items-center gap-1.5 font-sans active:scale-95 whitespace-nowrap"
          >
            <span>🔄</span> Recargar dataset
          </button>
        </div>

        {/* 1. Confirmación de Carga de ZIP (Prioridad 3) */}
        {pendingStateResolutionFiles && currentResolutionIndex === -1 && resolvedFilesList.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 space-y-4 font-sans animate-fadeIn">
            {renderZipTimeline()}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <span>📦</span> Importación Nacional: {activeZipFile?.name}
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono font-sans font-sans">Total Archivos: {pendingStateResolutionFiles.length}</span>
            </div>
            
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[9px] text-cyan-300 max-h-40 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase">
                    <th className="pb-1 font-sans">Archivo Excel</th>
                    <th className="pb-1 text-right font-sans">Estado Asignado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/30">
                  {resolvedFilesList.map((res) => (
                    <tr key={res.filename}>
                      <td className="py-1 truncate max-w-xs">{res.filename}</td>
                      <td className="py-1 text-right font-bold">{res.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition active:scale-95 animate-pulse"
              >
                Comenzar Importación
              </button>
            </div>
          </div>
        )}

        {/* 2. Panel de Progreso en Tiempo Real del ZIP */}
        {zipProgress && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 space-y-4 font-sans animate-fadeIn">
            {renderZipTimeline()}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2 font-sans">
                <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400 animate-pulse" />
                Procesando Importación Nacional ZIP
              </h3>
              <span className="text-xs text-slate-400 font-semibold font-mono">
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

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-center text-xs font-mono">
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-900">
                <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Procesados</span>
                <span className="block font-bold text-white mt-0.5">{zipProgress.totalRowsProcessed}</span>
              </div>
              <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/10">
                <span className="block text-emerald-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Nuevos</span>
                <span className="block font-bold text-emerald-400 mt-0.5">{zipProgress.added}</span>
              </div>
              <div className="rounded-lg bg-cyan-500/5 p-3 border border-cyan-500/10">
                <span className="block text-cyan-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Actualizados</span>
                <span className="block font-bold text-cyan-400 mt-0.5">{zipProgress.overwritten}</span>
              </div>
              <div className="rounded-lg bg-rose-500/5 p-3 border border-rose-500/10 font-sans">
                <span className="block text-rose-500 font-semibold uppercase tracking-wider text-[10px]">Errores</span>
                <span className="block font-bold text-rose-400 mt-0.5 font-mono">{zipProgress.failed}</span>
              </div>
            </div>

            {zipStep === "COMPLETED" && (
              <div className="flex justify-end pt-2 font-sans">
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

        {/* 3. Asistente de Selección Manual de Estado para ZIP (Prioridad 4) */}
        {pendingStateResolutionFiles && currentResolutionIndex !== -1 && (
          <div className="rounded-2xl border border-amber-500/20 bg-slate-900 p-6 space-y-4 shadow-xl font-sans">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-sans">
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

            {renderZipTimeline()}

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400">
                Selecciona el estado de la República correspondiente:
              </label>
              <select
                onChange={(e) => {
                  const stateVal = e.target.value;
                  if (!stateVal) return;
                  
                  const filename = pendingStateResolutionFiles[currentResolutionIndex].filename;
                  const newResolvedList = [...resolvedFilesList, { filename, state: stateVal }];
                  setResolvedFilesList(newResolvedList);

                  e.target.value = "";

                  if (currentResolutionIndex + 1 < pendingStateResolutionFiles.length) {
                    setCurrentResolutionIndex(currentResolutionIndex + 1);
                  } else {
                    startResolvedZipImport(activeZipFile!, newResolvedList);
                  }
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white"
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
        )}

        {/* Duplicate protection prompt */}
        {duplicateImportJob && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6 space-y-4 animate-fadeIn font-sans">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-300">Carga duplicada detectada</h3>
                <p className="text-xs text-slate-400 mt-1">
                  El archivo <strong className="text-slate-200">{duplicateImportJob.filename}</strong> ya se importó anteriormente.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
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
                  const fingerprint = duplicateImportJob.fingerprint;
                  const filename = duplicateImportJob.filename;
                  const companiesToImport = duplicateImportJob.companies;
                  setDuplicateImportJob(null);
                  const jobId = `aura_job_${filename.replace(/[^a-zA-Z0-9]/g, "")}_${companiesToImport.length}`;
                  executeImportJob(jobId, filename, companiesToImport, 0, 0, 0, 0, 0, fingerprint);
                }}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                Forzar reimportación (Sobrescribir)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateImportJob(null);
                  setSuccess("Importación cancelada para evitar duplicidad.");
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Omitir Carga
              </button>
            </div>
          </div>
        )}

        {/* Progress loop panel */}
        {activeJob && (
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/60 to-slate-950/60 p-6 space-y-5 animate-fadeIn font-sans font-sans">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2 text-white">
                <span className="animate-spin h-3.5 w-3.5 border-2 border-cyan-400 border-t-transparent rounded-full shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">Aura GTM Import Job Engine</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono font-sans font-sans font-sans">ID: {activeJob.jobId}</div>
            </div>

            {renderZipTimeline()}

            {importStalled && (
              <div className="bg-amber-950/40 border border-amber-500/30 text-amber-200 p-4.5 rounded-2xl flex flex-col gap-2 font-sans font-sans">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span>⚠️ La importación parece detenida.</span>
                </div>
                <p className="text-[11px] leading-relaxed font-sans">
                  No se ha detectado actividad en los últimos 2 minutos. Puedes cancelar de forma segura la importación actual. El checkpoint se encuentra guardado en este navegador y podrás reanudar el proceso desde el registro <strong className="font-mono text-white">{activeJob.processed}</strong> una vez que la red o el servicio se estabilicen.
                </p>
                <div className="text-[10px] text-amber-400 font-mono">
                  Último lote procesado: {activeJob.processed} / {activeJob.total} ({(activeJob.processed ? Math.round(activeJob.processed / activeJob.total * 100) : 0)}%) | Última actividad: {new Date(lastProcessedTimeRef.current).toLocaleTimeString()}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400 font-sans">
                <span className="flex items-center gap-1.5">
                  {activeJob.stage === "WRITING_FIRESTORE" ? (
                    <>Escribiendo registros en Firestore...</>
                  ) : activeJob.stage === "VALIDATING_WRITE" ? (
                    <>Validando escrituras de base de datos...</>
                  ) : activeJob.stage === "UPDATING_DATASET_MANAGER" ? (
                    <>Refrescando caché del Dataset Manager...</>
                  ) : activeJob.stage === "COMPLETED" ? (
                    <span className="text-emerald-400 font-bold font-sans">¡Lote finalizado con éxito!</span>
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

            <div className="grid gap-4 grid-cols-2 md:grid-cols-5 text-center pt-2 font-mono">
              <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-sans font-sans">
                  Escritos / Total
                </span>
                <span className="block text-sm font-extrabold text-white mt-1">
                  {activeJob.written.toLocaleString()} / {activeJob.total.toLocaleString()}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-sans">
                  Nuevos
                </span>
                <span className="block text-sm font-extrabold text-emerald-400 mt-1">
                  +{activeJob.added.toLocaleString()}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-sans font-sans">
                  Actualizados
                </span>
                <span className="block text-sm font-extrabold text-cyan-400 mt-1">
                  +{activeJob.overwritten.toLocaleString()}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-sans">
                  Omitidos
                </span>
                <span className="block text-sm font-extrabold text-slate-400 mt-1 font-mono">
                  +{activeJob.omitted.toLocaleString()}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Fallidos
                </span>
                <span className="block text-sm font-extrabold text-red-400 mt-1 font-mono">
                  {activeJob.failed.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-900 font-sans">
              <div className="flex items-center gap-6 text-[10px] font-mono text-slate-400">
                <div>
                  <span className="text-slate-500 mr-1.5 font-sans">Velocidad:</span>
                  <span className="font-bold text-slate-200 font-mono">{activeJob.speed} reg/s</span>
                </div>
                <div className="h-3 w-[1px] bg-slate-800" />
                <div>
                  <span className="text-slate-500 mr-1.5 font-sans font-sans">ETA:</span>
                  <span className="font-bold text-amber-400 font-mono">{activeJob.etaSeconds > 0 ? `${activeJob.etaSeconds}s` : "0s"}</span>
                </div>
                <div className="h-3 w-[1px] bg-slate-800" />
                <div>
                  <span className="text-slate-500 mr-1.5 font-sans">Procesados:</span>
                  <span className="font-bold text-cyan-400 font-mono">{activeJob.processed.toLocaleString()}</span>
                </div>
              </div>

              {activeJob.stage !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={async () => {
                    isCancelledRef.current = true;
                    if (activeJob && activeJob.jobId) {
                      const collectionName = "market_import_jobs";
                      const payload = {
                        status: "cancelled",
                        currentStage: "cancelled",
                        updatedAt: serverTimestamp(),
                      };
                      console.log("[AUDIT] writing collection:", collectionName, payload);
                      try {
                        const jobRef = doc(db, "market_import_jobs", activeJob.jobId);
                        await updateDoc(jobRef, payload);
                        console.log("[AUDIT] success:", collectionName, activeJob.jobId);
                      } catch (err: any) {
                        console.error("[AUDIT FIRESTORE ERROR]", {
                          collectionName,
                          code: err.code,
                          message: err.message,
                          stack: err.stack,
                          raw: err
                        });
                        setError(`Falló escritura en: ${collectionName}`);
                      }
                    }
                    setIsProcessing(false);
                    setActiveJob(null);
                    setImportStalled(false);
                    setSuccess("Importación interrumpida. El estado de la plataforma se ha limpiado correctamente.");
                  }}
                  className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition flex items-center gap-1.5 font-sans"
                >
                  🛑 Cancelar e Interrumpir Importación
                </button>
              )}
            </div>
          </div>
        )}

        {/* Import report */}
        {importReport && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-4">
            <div className="flex items-center justify-between font-sans">
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
            <div className="grid gap-4 sm:grid-cols-5 text-center font-mono">
              <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800">
                <span className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider font-sans">Procesados</span>
                <span className="block text-2xl font-bold text-white mt-1">{importReport.total}</span>
              </div>
              <div className="rounded-xl bg-emerald-500/5 p-4 border border-emerald-500/20 font-sans font-sans">
                <span className="block text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Nuevos</span>
                <span className="block text-2xl font-bold text-emerald-300 mt-1">+{importReport.added}</span>
              </div>
              <div className="rounded-xl bg-cyan-500/5 p-4 border border-cyan-500/20 font-sans">
                <span className="block text-cyan-400 text-[10px] font-semibold uppercase tracking-wider">Actualizados</span>
                <span className="block text-2xl font-bold text-cyan-300 mt-1">+{importReport.updated}</span>
              </div>
              <div className="rounded-xl bg-amber-500/5 p-4 border border-amber-500/20 font-sans">
                <span className="block text-amber-400 text-[10px] font-semibold uppercase tracking-wider font-sans">Sin cambios</span>
                <span className="block text-2xl font-bold text-amber-300 mt-1">+{importReport.omitted}</span>
              </div>
              <div className="rounded-xl bg-rose-500/5 p-4 border border-rose-500/20 font-sans">
                <span className="block text-rose-400 text-[10px] font-semibold uppercase tracking-wider font-sans">Fallidos</span>
                <span className="block text-2xl font-bold text-rose-300 mt-1">{importReport.failed}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 text-right">
              Tiempo de ejecución: <span className="font-semibold text-slate-400">{importReport.timeMs} ms</span>
            </div>
          </div>
        )}

        {/* Audit History List */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 font-sans font-sans">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-405 outline-none font-sans"
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
                <table className="w-full border-collapse text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-2.5">Fecha / Hora</th>
                      <th className="py-2.5">Total Registros</th>
                      <th className="py-2.5 text-emerald-400">Nuevos</th>
                      <th className="py-2.5 text-cyan-400 font-sans">Actualizados</th>
                      <th className="py-2.5 text-amber-400">Sin Cambios</th>
                      <th className="py-2.5 text-rose-400 font-sans">Fallidos</th>
                      <th className="py-2.5 text-right font-sans">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-855 text-slate-300 font-mono">
                    {importHistory.map((entry) => {
                      const date = entry.timestamp?.seconds
                        ? new Date(entry.timestamp.seconds * 1000).toLocaleString()
                        : "Reciente";
                      return (
                        <tr key={entry.id} className="hover:bg-slate-900/20">
                          <td className="py-2.5 font-sans font-medium">{date}</td>
                          <td className="py-2.5">{entry.totalProcessed}</td>
                          <td className="py-2.5 font-semibold text-emerald-400">{entry.newAdded}</td>
                          <td className="py-2.5 font-semibold text-cyan-400">{entry.updated}</td>
                          <td className="py-2.5 text-slate-400">{entry.omitted}</td>
                          <td className="py-2.5 font-semibold text-rose-400">{entry.failed}</td>
                          <td className="py-2.5 text-right text-slate-450">{entry.timeMs} ms</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIntelligenceTab = () => {
    return (
      <div className="space-y-6 animate-fadeIn font-sans">
        <AuraIntelligenceRecommendationsPanel companies={activeMarketDataset} />

        {/* Core Memory & Knowledge Summary Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-cyan-300">
            <span>🧠</span>
            <h4 className="text-sm font-bold uppercase tracking-wider">Aura Core memory timeline</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Historial de interacción empresarial y eventos críticos de memoria corporativa.
          </p>
          <div className="border border-slate-850 rounded-xl p-4 bg-slate-900/30 space-y-4 font-sans font-sans">
            <div className="flex justify-between items-center border-b border-slate-855 pb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Resumen de Memoria Activa (Mock/Demo):</span>
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-1.5 py-0.2 uppercase font-extrabold tracking-wider">Demo Tenant</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
{`[MOCK/DEMO MEMORY LOG] - 22_Queretaro.xlsx
- Lead Creado: Registrado automáticamente en el Control Center.
- Objeción Registrada: El contacto comentó que el costo de la suscripción completa excede su presupuesto. Recomendó iniciar con Aura HCM Básico.
- Seguimiento: Llamada comercial agendada para discutir el ROI de la propuesta básica.`}
            </p>
            <div className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-850 pt-2 flex items-center gap-1 font-sans font-sans">
              <span>💡</span>
              <span>
                <strong>Tip de Prospección:</strong> El core ha detectado una objeción de precio. Al abrir el drawer de cualquier prospecto de Querétaro, el Asesor de Ventas recibirá sugerencias que priorizan comenzar con <strong>Aura HCM Básico</strong> para mitigar esta barrera presupuestaria.
              </span>
            </div>
          </div>
        </div>

        {/* Knowledge Engine Summary Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-sans">
            <span>📚</span>
            <h4 className="text-sm font-bold uppercase tracking-wider">Aura Knowledge Engine</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Conocimiento regulatorio general del ecosistema Aura HCM para auditorías laborales en México.
          </p>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3 font-sans">
            <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4 space-y-1">
              <span className="block text-[10px] text-indigo-400 font-extrabold uppercase font-sans font-sans">NOM-035-STPS</span>
              <span className="block text-xs font-bold text-white font-sans font-sans">Riesgos Psicosociales</span>
              <span className="block text-[10px] text-slate-400 leading-normal font-sans">Evaluación de entorno organizacional favorable obligatorio para empresas en México.</span>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4 space-y-1 font-sans">
              <span className="block text-[10px] text-indigo-400 font-extrabold uppercase">NOM-037-STPS</span>
              <span className="block text-xs font-bold text-white">Teletrabajo Obligatorio</span>
              <span className="block text-[10px] text-slate-400 leading-normal">Regulación de higiene, seguridad y herramientas de trabajo remoto.</span>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4 space-y-1 font-sans">
              <span className="block text-[10px] text-indigo-400 font-extrabold uppercase">NOM-151-SCFI</span>
              <span className="block text-xs font-bold text-white font-sans">Conservación de Mensajes</span>
              <span className="block text-[10px] text-slate-400 leading-normal font-sans">Requisitos de firmas electrónicas y contratos digitales para validez jurídica.</span>
            </div>
          </div>
        </div>

        {/* Business Assessment Brain Simulation Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 font-sans">
            <span>📄</span>
            <h4 className="text-sm font-bold uppercase tracking-wider">Business Assessment Brain</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Módulo de simulación de auditorías laborales y multas STPS. Preparado para generación de informes interactivos.
          </p>
          <div className="rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans font-sans">
            <div className="space-y-1 max-w-xl">
              <span className="inline-flex items-center gap-1 rounded bg-cyan-950 px-2 py-0.5 text-[9px] font-extrabold text-cyan-400 border border-cyan-500/20 uppercase tracking-wide">Core Module Ready</span>
              <h5 className="text-xs font-bold text-white">Reporte Ejecutivo STPS & SAT</h5>
              <p className="text-[11px] text-slate-400 leading-normal">
                Una vez habilitado el motor, podrás generar diagnósticos de cumplimiento normativo y exportar simulaciones financieras en PDF interactivos para clientes enterprise.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="self-start md:self-center rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400/60 px-4 py-2.5 text-xs font-bold whitespace-nowrap cursor-not-allowed font-sans"
            >
              Preparar Diagnóstico (Assessment in-core)
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiagnosticsTab = () => {
    return (
      <div className="space-y-6 animate-fadeIn font-sans">
        {/* Banner de Diagnóstico del Dataset Activo */}
        {activeMetadata && (
          <div className="rounded-2xl border border-cyan-500/25 bg-slate-950/40 p-5 backdrop-blur-md space-y-4 animate-fadeIn font-sans">
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-sans font-sans">
              {/* Estado Activo */}
              <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60">
                <span className="block text-[10px] text-slate-500 uppercase font-semibold font-sans">Estado Cargado</span>
                <span className="block text-sm font-extrabold text-white mt-1">
                  {loadedState || "Todos los Estados (Muestra)"}
                </span>
              </div>

              {/* Total empresas */}
              <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Empresas en Memoria</span>
                <span className="block text-sm font-extrabold text-cyan-400 mt-1 font-mono">
                  {activeMetadata.count.toLocaleString()}
                </span>
              </div>

              {/* Fuente / Versión */}
              <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60 font-sans">
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Fuente / Versión</span>
                <span className="block text-sm font-extrabold text-slate-300 mt-1 font-sans">
                  {activeMetadata.source} — {activeMetadata.sourceVersion}
                </span>
              </div>

              {/* Mercado Potencial */}
              <div className="rounded-xl bg-slate-900/30 p-3 border border-slate-900/60">
                <div className="space-y-0.5 font-sans">
                  <span className="block text-[10px] text-slate-500 uppercase font-semibold">Mercado Potencial</span>
                  <span className="block text-[8px] text-slate-450 leading-none">Valor mensual máximo del dataset</span>
                </div>
                <span className="block text-sm font-extrabold text-emerald-400 mt-1.5 font-mono">
                  {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(activeMetadata.estimatedMrr)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-1 font-sans">
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

        {/* Diagnostic Console card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 space-y-4 font-sans">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between font-sans">
            <span>📊 Consola de Diagnóstico & Telemetría GTM</span>
            <span className="text-cyan-400 font-mono text-[10px]">Modo Admin</span>
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Consola técnica de rendimiento. Muestra la velocidad de procesamiento, carga en paralelo de hilos concurrentes, y tiempos de duplicidad/commit de Firestore para control de lints de Firebase.
          </p>

          <div className="grid gap-4 md:grid-cols-4 text-center font-mono">
            <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800">
              <span className="block text-slate-500 text-[10px] font-bold uppercase">Memoria Asignada</span>
              <span className="block text-xl font-bold text-white mt-1">
                ${(performance as any).memory ? `${Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))} MB` : "N/D"}
              </span>
            </div>
            <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800 font-sans">
              <span className="block text-slate-500 text-[10px] font-bold uppercase">Hilos Paralelos</span>
              <span className="block text-xl font-bold text-white mt-1 font-mono">4 Hilos</span>
            </div>
            <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800 font-sans">
              <span className="block text-slate-500 text-[10px] font-bold uppercase">Tamaño Lote Write</span>
              <span className="block text-xl font-bold text-white mt-1 font-mono">100 reg</span>
            </div>
            <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800 font-sans font-sans">
              <span className="block text-slate-500 text-[10px] font-bold uppercase">Dataset en Memoria</span>
              <span className="block text-xl font-bold text-cyan-400 mt-1 font-mono">${rawDataset.length.toLocaleString()} reg</span>
            </div>
          </div>

          {/* Diagnostic Tables Grid */}
          <div className="grid gap-6 xl:grid-cols-4 font-sans font-sans">
            {/* Card 1: Estatus de Importación por Estado */}
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase">Estatus del Dataset por Estado</span>
              <table className="w-full text-[9px] font-mono text-slate-300 mt-1">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-left">
                    <th className="pb-1 pr-2">Estado</th>
                    <th className="pb-1 text-right">Registros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-855">
                  {availableStates.map((st) => {
                    const count = rawDataset.filter((c) => getCompanyState(c) === st).length;
                    return (
                      <tr key={st} className="hover:bg-slate-900/20">
                        <td className="py-0.5 text-slate-400 pr-2 truncate max-w-[120px]" title={st}>{st}</td>
                        <td className="py-0.5 text-right font-bold text-cyan-400">{count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card 2: Diagnóstico de Duplicidad por Estado */}
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase">Duplicidad e Integridad</span>
              <table className="w-full text-[9px] font-mono text-slate-300 mt-1">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-left font-sans">
                    <th className="pb-1 pr-2">Estado</th>
                    <th className="pb-1 text-right">Únicos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-855">
                  {availableStates.map((st) => {
                    const list = rawDataset.filter((c) => getCompanyState(c) === st);
                    const unique = new Set(list.map((c) => c.nombreComercial || c.razonSocial)).size;
                    return (
                      <tr key={st} className="hover:bg-slate-900/20">
                        <td className="py-0.5 text-slate-400 pr-2 truncate max-w-[120px]" title={st}>{st}</td>
                        <td className="py-0.5 text-right font-bold text-emerald-400">{unique}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card 3: Parámetros del Filtro GTM */}
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900 font-sans">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase">Parámetros del Filtro</span>
              <table className="w-full text-[9px] font-mono text-slate-300 mt-1">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-left font-sans">
                    <th className="pb-1 pr-2">Parámetro</th>
                    <th className="pb-1 text-left">Valor Activo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  <tr className="hover:bg-slate-900/20">
                    <td className="py-0.5 text-slate-400 pr-2 font-bold font-sans">Filtro Estado</td>
                    <td className="text-cyan-300">{filters.estado || "(vacío)"}</td>
                  </tr>
                  <tr className="hover:bg-slate-900/20">
                    <td className="py-0.5 text-slate-400 pr-2 font-bold font-sans">Filtro Sector</td>
                    <td className="text-cyan-300">{filters.sector || "(vacío)"}</td>
                  </tr>
                  <tr className="hover:bg-slate-900/20">
                    <td className="py-0.5 text-slate-400 pr-2 font-bold font-sans">Filtro Rango</td>
                    <td className="text-cyan-300">{filters.tamano || "(vacío)"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Card 4: Distribución de Sectores Comerciales (En tiempo real) */}
            <div className="space-y-1.5 rounded-lg bg-slate-900/40 p-3 border border-slate-900 overflow-y-auto max-h-48 font-sans">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase">Distribución de Sectores</span>
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
            <div className="md:col-span-2 xl:col-span-4 rounded-lg bg-slate-900/40 p-4 border border-slate-900 overflow-x-auto font-sans font-sans">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase mb-2">Auditoría Visual de Posicionamiento (Primeros 20 en rawDataset)</span>
              <table className="w-full text-[10px] font-mono text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-left font-sans">
                    <th className="pb-1.5 pr-2">Empresa</th>
                    <th className="pb-1.5 pr-2">Estado Raw</th>
                    <th className="pb-1.5 pr-2">Municipio</th>
                    <th className="pb-1.5 pr-2">getCompanyState()</th>
                    <th className="pb-1.5 pr-2 text-center">En Dropdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono text-[9.5px]">
                  {rawDataset.slice(0, 20).map((company) => {
                    const resolved = getCompanyState(company);
                    const isInDropdown = availableStates.includes(resolved);
                    return (
                      <tr key={company.id} className="hover:bg-slate-900/45 text-slate-300 font-sans">
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

          {/* Consola de Telemetría */}
          <div className="rounded-2xl border border-slate-855 bg-slate-950 p-4 font-mono text-[9px] text-cyan-400/90 space-y-2.5 max-h-96 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-855 pb-1.5 flex justify-between font-sans">
              <span>Registros de Auditoría GTM Engine (Historial de Lotes)</span>
              <span className="text-cyan-300">Total Logs: {telemetryLogs.length}</span>
            </div>
            <div className="overflow-x-auto font-mono font-mono">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 text-[8px] uppercase tracking-wider">
                    <th className="py-1">Lote #</th>
                    <th className="py-1">Rango Reg</th>
                    <th className="py-1">Conf</th>
                    <th className="py-1">Dup R/W</th>
                    <th className="py-1">Commit</th>
                    <th className="py-1 text-emerald-400">Nue</th>
                    <th className="py-1 text-cyan-400">Act</th>
                    <th className="py-1 text-rose-400">Fal</th>
                    <th className="py-1">Time</th>
                    <th className="py-1">Memoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/30 text-slate-300">
                  {telemetryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-slate-500 italic">No hay logs de telemetría activos. Inicia una importación para ver datos.</td>
                    </tr>
                  ) : (
                    telemetryLogs.map((log) => (
                      <tr key={log.batchNumber} className="hover:bg-slate-900/30">
                        <td className="py-1 font-bold text-slate-400">#{log.batchNumber}</td>
                        <td className="py-1">{log.startIndex}-{log.endIndex}</td>
                        <td className="py-1 text-slate-400">{log.processedConfirmed}</td>
                        <td className="py-1 text-slate-500">{log.duplicateReadMs}ms</td>
                        <td className="py-1 text-cyan-400 font-bold">{log.batchCommitMs}ms</td>
                        <td className="py-1 text-emerald-400 font-bold">+{log.newAdded}</td>
                        <td className="py-1 text-cyan-300 font-semibold font-sans font-sans">+{log.updated}</td>
                        <td className="py-1 text-rose-400">{log.failed}</td>
                        <td className="py-1 text-slate-500">{log.timestamp}</td>
                        <td className="py-1 font-semibold text-slate-500">{log.memoryMb}MB {log.checkpointSaved ? "💾" : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Maintenance & Repair Tools */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 p-5 space-y-4 font-sans">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>🔧</span> Herramientas de Reparación Laboral
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed font-sans font-sans">
            Consolidación administrativa y normalización de geografía. Permite asociar municipios huérfanos con sus estados federativos según catálogos oficiales del DENUE.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRepairStates}
              disabled={isProcessing}
              className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 px-4 py-2.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-950/30 transition disabled:opacity-50 font-sans"
            >
              Normalizar Municipios Huérfanos
            </button>
            <button
              type="button"
              onClick={async () => {
                datasetManager.clear();
                console.log("[Aura Dataset Hydration] datasetManager refreshed");
                await loadDataset(true, true);
              }}
              disabled={isLoading}
              className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/30 transition disabled:opacity-50 flex items-center gap-1.5 font-sans active:scale-95"
            >
              <span>🔄</span> Recargar dataset
            </button>
          </div>
          {/* Storage duplicates warning */}
          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-200 leading-relaxed font-sans">
            ⚠️ <strong>Nota:</strong> Archivos duplicados detectados en Storage: limpiar manualmente si corresponde.
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-[env(safe-area-inset-bottom)] min-w-0 w-full font-sans">
      {/* SW Update Available Banner */}
      {swUpdateAvailable && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>Nueva versión disponible de Aura Control Center.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if ((window as any).__auraSWUpdateFn) {
                (window as any).__auraSWUpdateFn();
              } else {
                window.location.reload();
              }
            }}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 transition active:scale-95"
          >
            Actualizar Ahora
          </button>
        </div>
      )}
      {/* Page Title & Subtitle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <span>🌍</span> Aura Market Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
            Consola del Control Center para prospección de mercado, auditoría de regiones y recomendación de HCM.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <span className="font-semibold">Éxito:</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <span className="font-semibold">Error:</span>
          <span>{error}</span>
        </div>
      )}
      {activeTab === 'import' && pendingResumeJob && (() => {
        const isMassive = (pendingResumeJob.checkpoint as any)?.companiesCount > 10000 || 
                         pendingResumeJob.companies.length > 10000 || 
                         /queretaro|nuevo\s*leon|jalisco|cdmx/i.test(pendingResumeJob.filename) ||
                         /queretaro|nuevo\s*leon|jalisco|cdmx/i.test(pendingResumeJob.jobId) ||
                         pendingResumeJob.filename.toLowerCase().includes("zip") ||
                         pendingResumeJob.jobId.toLowerCase().includes("zip");
        const checkpointData = pendingResumeJob.checkpoint;
        const isStalled = (checkpointData as any).stalled === true || (checkpointData as any).status === "stalled" || isMassive;
        const hasCompanies = pendingResumeJob.companies && pendingResumeJob.companies.length > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
            <input 
              type="file" 
              ref={modalFileInputRef} 
              className="hidden" 
              accept=".xlsx,.xls,.zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  console.log("[Aura Backend Import] Archivo seleccionado por el usuario:", file.name, file.size);
                  setSelectedBackendFile(file);
                  event.target.value = "";
                }
              }}
            />
            <div className="w-full max-w-lg rounded-3xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-6 font-sans">
              <div className="flex items-start gap-4 flex-col sm:flex-row">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg shrink-0 ${isMassive ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"}`}>
                  {isMassive ? "⚠️" : "🔄"}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white font-sans">
                    {isMassive ? "Importación Masiva Protegida" : "Importación Interrumpida Detectada"}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    Se encontró un checkpoint local para el archivo: <strong className="text-slate-200 font-mono">{pendingResumeJob.filename}</strong>
                  </p>
                </div>
              </div>

              {isMassive ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5 font-sans">
                    <p className="text-xs text-amber-200 font-semibold leading-relaxed">
                      Esta carga requiere Aura Import Engine V2 Backend. El archivo es demasiado grande para procesarse de forma segura desde el navegador.
                    </p>
                    {pendingResumeJob.filename.toLowerCase().includes("queretaro") && pendingResumeJob.checkpoint.processed > 0 && (
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Se han procesado parcialmente <strong className="text-slate-200">38,200 registros</strong> de este dataset. La validación final de integridad queda pendiente hasta habilitar el Backend V2.
                      </p>
                    )}
                  </div>
                  {isUploading && (
                    <div className="space-y-1.5 font-sans">
                      <div className="flex justify-between text-xs text-slate-400 font-semibold">
                        <span>Subiendo archivo al servidor...</span>
                        <span className="font-mono text-cyan-400">{uploadProgress || 0}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
                        <div 
                          className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                          style={{ width: `${uploadProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {!selectedBackendFile && !pendingResumeJob.rawFile && (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4 text-xs text-cyan-300 leading-relaxed font-sans animate-fadeIn">
                      Este checkpoint no contiene el archivo físico. Selecciona el archivo original una sola vez para iniciar el Backend V2.
                    </div>
                  )}
                  {(selectedBackendFile || pendingResumeJob.rawFile) && !isUploading && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-xs text-emerald-300 leading-relaxed font-sans animate-fadeIn">
                      💡 Archivo preparado: <strong className="font-mono text-emerald-200">{(selectedBackendFile || pendingResumeJob.rawFile)?.name}</strong>. Listo para subir y procesar en el backend.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 font-sans">
                  {isStalled && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300 font-semibold leading-relaxed">
                      ⚠️ Este trabajo de importación se detuvo inesperadamente. Intentar reanudarlo podría causar duplicados o inestabilidad.
                    </div>
                  )}
                  {!hasCompanies && (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4 text-xs text-cyan-300 leading-relaxed">
                      💡 Sube el archivo original para habilitar la opción de reanudar esta importación.
                    </div>
                  )}
                  <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Registros procesados en checkpoint:</span>
                      <span className="font-bold text-white font-mono">{pendingResumeJob.checkpoint.processed.toLocaleString()}</span>
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
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 justify-end pt-2">
                {isMassive && (
                  <button
                    type="button"
                    disabled={isUploading || isProcessing || backendUploadInProgressRef.current === true}
                    onClick={() => {
                      if (isUploading || isProcessing || backendUploadInProgressRef.current === true) {
                        console.warn("[Aura Backend Import] Operación bloqueada: carga en progreso.");
                        return;
                      }
                      const fileToUpload = selectedBackendFile || pendingResumeJob.rawFile;
                      if (fileToUpload) {
                        startBackendImportFromFile(fileToUpload);
                      } else {
                        modalFileInputRef.current?.click();
                      }
                    }}
                    className="rounded-xl bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 px-4 py-2.5 text-xs font-bold hover:bg-cyan-300 transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/10 font-sans"
                  >
                    {isUploading ? `Subiendo: ${uploadProgress}%` : ((selectedBackendFile || pendingResumeJob.rawFile) ? "Subir archivo al Backend V2" : "Seleccionar archivo original")}
                  </button>
                )}

                {!isMassive && hasCompanies && (
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
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${isStalled ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-500/10"}`}
                  >
                    {isStalled ? "⚠️ Reintentar bajo tu responsabilidad" : `Reanudar desde Registro ${pendingResumeJob.checkpoint.processed.toLocaleString()}`}
                  </button>
                )}

                {isMassive && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingResumeJob(null);
                      sessionStorage.setItem("aura_import_checkpoint_dismissed_" + pendingResumeJob.jobId, "true");
                      setActiveTab('diagnostics');
                    }}
                    className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-4 py-2.5 text-xs font-bold hover:bg-cyan-500/20 transition"
                  >
                    Ver Roadmap V2
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(pendingResumeJob.jobId);
                    setSelectedBackendFile(null);
                    setPendingResumeJob(prev => prev ? {
                      ...prev,
                      checkpoint: {
                        processed: 0,
                        added: 0,
                        overwritten: 0,
                        omitted: 0,
                        failed: 0,
                        companiesCount: 0,
                      }
                    } : null);
                    setSuccess("Checkpoint local eliminado. Puedes iniciar una nueva importación limpia al Backend V2.");
                  }}
                  className="rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-red-500/30 px-4 py-2.5 text-xs font-bold text-red-400 transition font-sans"
                >
                  Limpiar Checkpoint
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingResumeJob(null);
                    sessionStorage.setItem("aura_import_checkpoint_dismissed_" + pendingResumeJob.jobId, "true");
                  }}
                  className="rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition font-sans"
                >
                  Continuar sin importar
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setPendingResumeJob(null);
                    sessionStorage.setItem("aura_import_checkpoint_dismissed_" + pendingResumeJob.jobId, "true");
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 transition font-sans"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {duplicateBackendJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl space-y-6 font-sans">
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-sans">
                  Archivo ya Importado
                </h3>
                <p className="text-xs text-slate-400 font-sans font-mono leading-relaxed">
                  {duplicateBackendJob.file.name}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200 leading-relaxed font-sans">
              Este archivo ya fue importado correctamente.
            </div>

            <div className="flex flex-wrap gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingResumeJob(null);
                  setDuplicateBackendJob(null);
                  setSelectedBackendFile(null);
                  setSuccess("Utilizando el dataset cargado existente con éxito.");
                  setActiveTab("prospects");
                }}
                className="rounded-xl bg-cyan-400 text-slate-950 px-4 py-2.5 text-xs font-bold hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/10 font-sans"
              >
                Usar dataset existente
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Fuerza reimportación: ¿Seguro de volver a importar y procesar este dataset masivo?")) {
                    startBackendImportFromFile(duplicateBackendJob.file, true);
                  }
                }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 text-xs font-bold hover:bg-red-500/20 transition font-sans"
              >
                Forzar reimportación
              </button>

              <button
                type="button"
                onClick={() => {
                  setDuplicateBackendJob(null);
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 transition font-sans"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation Menu */}
      <div className="flex border-b border-slate-800/80 overflow-x-auto select-none scroll-smooth no-scrollbar gap-1 font-sans font-sans">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'summary'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5 font-extrabold animate-pulse'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📊 Executive Center
        </button>
        <button
          onClick={() => setActiveTab('prospects')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'prospects'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5 font-extrabold animate-pulse'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          👥 Prospectos
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'import'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📥 Importación
        </button>
        <button
          onClick={() => setActiveTab('intelligence')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'intelligence'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5 font-extrabold animate-pulse'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🧠 Aura Intelligence
        </button>
        {capabilities.canImport && (
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap shrink-0 ${
              activeTab === 'diagnostics'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5 font-extrabold animate-pulse'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ Diagnóstico
          </button>
        )}
      </div>

      {/* Conditionally Render Selected Tab content */}
      <div className="min-w-0 w-full">
        {activeTab === 'summary' && renderSummaryTab()}
        {activeTab === 'prospects' && renderProspectsTab()}
        {activeTab === 'import' && renderImportTab()}
        {activeTab === 'intelligence' && renderIntelligenceTab()}
        {activeTab === 'diagnostics' && renderDiagnosticsTab()}
      </div>

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