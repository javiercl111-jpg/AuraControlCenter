import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db, auth } from "../config/firebase";

import MarketIntelligenceHeader from "../modules/market-intelligence/components/MarketIntelligenceHeader";
import MarketCompaniesFilters from "../modules/market-intelligence/components/MarketCompaniesFilters";
import MarketCompaniesTable from "../modules/market-intelligence/components/MarketCompaniesTable";
import MarketCompanyDrawer from "../modules/market-intelligence/components/MarketCompanyDrawer";
import MarketSegmentsPanel from "../modules/market-intelligence/components/MarketSegmentsPanel";
import CommercialDashboard from "../modules/market-intelligence/components/CommercialDashboard";

import MarketFirestoreService from "../modules/market-intelligence/services/marketFirestoreService";
import type { CompanyStatus, InegiCompany } from "../modules/market-intelligence/types/inegi";
import PermissionDenied from "../components/PermissionDenied";
import { checkUserCapability } from "../services/rbacService";
import NationalZipImportService from "../modules/market-intelligence/services/nationalZipImportService";

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
  // Estados de carga e interfaz
  const [companies, setCompanies] = useState<InegiCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  // Estados de Filtros y Segmentos
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [availableStates, setAvailableStates] = useState<string[]>(["Querétaro", "Nuevo León"]);

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
  const [pendingStateResolutionFiles, setPendingStateResolutionFiles] = useState<{ filename: string; guessedState: string }[] | null>(null);
  const [currentResolutionIndex, setCurrentResolutionIndex] = useState<number>(-1);
  const [resolvedFilesList, setResolvedFilesList] = useState<{ filename: string; state: string }[]>([]);
  const [activeZipFile, setActiveZipFile] = useState<File | null>(null);

  // Cargar estados únicos acumulados e historial de importaciones
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [states, history] = await Promise.all([
          MarketFirestoreService.getUniqueStates(),
          MarketFirestoreService.getImportHistory()
        ]);
        setAvailableStates(states);
        setImportHistory(history);
      } catch (err) {
        console.warn("Error al cargar datos iniciales de estados/historial:", err);
      }
    }
    loadInitialData();
  }, []);

  // Estados de Paginación (Costo Protegido)
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursorsHistory, setCursorsHistory] = useState<any[]>([]); // Para regresar páginas en Firestore

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

  // Cargar datos
  async function loadData(resetPage = false) {
    setIsLoading(true);
    setError("");
    
    let cursor = lastDoc;

    if (resetPage) {
      cursor = null;
      setCurrentPage(1);
      setLastDoc(null);
      setCursorsHistory([]);
    }

    try {
      // 1. Obtener prospectos paginados
      const result = await MarketFirestoreService.getMarketCompanies(
        {
          status: filters.status as CompanyStatus || undefined,
          tamano: filters.tamano || undefined,
          sector: filters.sector || undefined,
          estado: filters.estado || undefined,
          municipio: filters.municipio || undefined,
          hasEmail: filters.hasEmail ? true : undefined,
          hasPhone: filters.hasPhone ? true : undefined,
          hasWebsite: filters.hasWebsite ? true : undefined,
          minScore: filters.minScore || undefined,
          search: filters.search || undefined,
          scian: filters.scian || undefined,
          sortBy: filters.sortBy || undefined,
        },
        25,
        cursor
      );

      setCompanies(result.companies);
      setHasMore(result.companies.length === 25 && result.lastDoc !== null);
      
      if (resetPage) {
        setLastDoc(result.lastDoc);
      }

      // 2. Cargar KPIs agregados protegiendo costos
      await fetchAggregatedKPIs(result.companies);

    } catch (err: any) {
      console.error({
        code: err.code || null,
        message: err.message || null,
        stack: err.stack || null,
        operation: "getMarketCompanies",
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

  // Consulta barata de conteos usando getCountFromServer (Filtrados dinámicamente)
  async function fetchAggregatedKPIs(loadedCompanies: InegiCompany[]) {
    try {
      const collRef = collection(db, "market_companies");
      
      // Aplicar filtros acumulativos de base de datos a las consultas de conteos
      const queryConstraints: any[] = [];
      if (filters.estado) {
        queryConstraints.push(where("estado", "==", filters.estado));
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

      const [totalSnap, convertedSnap, qualifiedSnap, contactedSnap] = await Promise.all([
        getCountFromServer(query(collRef, ...queryConstraints)),
        getCountFromServer(query(collRef, ...queryConstraints, where("status", "==", "CONVERTED"))),
        getCountFromServer(query(collRef, ...queryConstraints, where("status", "==", "QUALIFIED"))),
        getCountFromServer(query(collRef, ...queryConstraints, where("status", "==", "CONTACTED"))),
      ]);

      const total = totalSnap.data().count;
      const converted = convertedSnap.data().count;
      const qualified = qualifiedSnap.data().count + contactedSnap.data().count;

      // Calcular promedio de score de la lista cargada para no generar costos extras de base de datos
      const listAvg = loadedCompanies.length > 0
        ? loadedCompanies.reduce((acc, curr) => acc + curr.opportunityScore, 0) / loadedCompanies.length
        : 72; // Default a valor representativo de Aura si está vacío

      setStats({
        totalCount: total,
        convertedCount: converted,
        qualifiedCount: qualified,
        avgScore: listAvg,
      });
    } catch (err: any) {
      console.error({
        code: err.code || null,
        message: err.message || null,
        stack: err.stack || null,
        operation: "fetchAggregatedKPIs (getCountFromServer)",
        collection: "market_companies",
        authUid: auth.currentUser?.uid || null,
        authEmail: auth.currentUser?.email || null,
        error: err
      });
      console.warn("No se pudieron cargar los conteos del servidor:", err);
    }
  }

  // Efecto inicial y ante cambios de filtro (Incluyendo búsqueda textual reactiva)
  useEffect(() => {
    loadData(true);
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
  async function handleNextPage() {
    if (!hasMore || isLoading) return;
    setIsLoading(true);

    try {
      const history = [...cursorsHistory, lastDoc];
      setCursorsHistory(history);

      const result = await MarketFirestoreService.getMarketCompanies(
        {
          status: filters.status as CompanyStatus || undefined,
          tamano: filters.tamano || undefined,
          sector: filters.sector || undefined,
          estado: filters.estado || undefined,
          municipio: filters.municipio || undefined,
          hasEmail: filters.hasEmail ? true : undefined,
          hasPhone: filters.hasPhone ? true : undefined,
          hasWebsite: filters.hasWebsite ? true : undefined,
          minScore: filters.minScore || undefined,
          search: filters.search || undefined,
          scian: filters.scian || undefined,
          sortBy: filters.sortBy || undefined,
        },
        25,
        lastDoc
      );

      setCompanies(result.companies);
      setLastDoc(result.lastDoc);
      setHasMore(result.companies.length === 25 && result.lastDoc !== null);
      setCurrentPage((prev) => prev + 1);

    } catch (err: any) {
      setError("Error al navegar a la siguiente página: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Paginación: Página Anterior
  async function handlePrevPage() {
    if (currentPage <= 1 || isLoading) return;
    setIsLoading(true);

    try {
      const history = [...cursorsHistory];
      const prevCursor = history[currentPage - 3] || null; // cursor para cargar la página anterior
      history.pop(); // remover el actual
      setCursorsHistory(history);

      const result = await MarketFirestoreService.getMarketCompanies(
        {
          status: filters.status as CompanyStatus || undefined,
          tamano: filters.tamano || undefined,
          sector: filters.sector || undefined,
          estado: filters.estado || undefined,
          municipio: filters.municipio || undefined,
          hasEmail: filters.hasEmail ? true : undefined,
          hasPhone: filters.hasPhone ? true : undefined,
          hasWebsite: filters.hasWebsite ? true : undefined,
          minScore: filters.minScore || undefined,
          search: filters.search || undefined,
          scian: filters.scian || undefined,
          sortBy: filters.sortBy || undefined,
        },
        25,
        prevCursor
      );

      setCompanies(result.companies);
      setLastDoc(result.lastDoc);
      setHasMore(true);
      setCurrentPage((prev) => prev - 1);

    } catch (err: any) {
      setError("Error al navegar a la página anterior: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Importar desde Excel o Muestra Piloto (Batch con reporte e historial)
  async function handleImport(importedCompanies: InegiCompany[]) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);

    try {
      const result = await MarketFirestoreService.importMarketCompaniesBatch(
        importedCompanies
      );
      
      setImportReport({
        total: importedCompanies.length,
        added: result.added,
        updated: result.overwritten,
        omitted: result.omitted,
        failed: result.failed,
        timeMs: result.timeMs,
      });

      setSuccess(`Lote importado con éxito: ${result.added} nuevos, ${result.overwritten} actualizados.`);
      
      // Recargar la lista de estados únicos
      const states = await MarketFirestoreService.getUniqueStates();
      setAvailableStates(states);

      // Recargar historial
      const history = await MarketFirestoreService.getImportHistory();
      setImportHistory(history);

      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al importar lote: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  // Importar secuencialmente archivos del ZIP con estados confirmados
  async function startResolvedZipImport(file: File, resolvedList: { filename: string; state: string }[]) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);
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

      // Recargar la lista de estados únicos
      const states = await MarketFirestoreService.getUniqueStates();
      setAvailableStates(states);

      // Recargar historial
      const history = await MarketFirestoreService.getImportHistory();
      setImportHistory(history);

      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al procesar el archivo ZIP nacional: " + err.message);
    } finally {
      setIsProcessing(false);
      setZipProgress(null);
      setActiveZipFile(null);
      setPendingStateResolutionFiles(null);
      setCurrentResolutionIndex(-1);
      setResolvedFilesList([]);
    }
  }

  // Manejar archivo ZIP cargado realizando el análisis previo
  async function handleZipSelect(file: File) {
    setIsProcessing(true);
    setError("");
    setSuccess("");
    setImportReport(null);
    setActiveZipFile(file);

    try {
      const summary = await NationalZipImportService.analyzeZipFiles(file);
      setZipSummary(summary);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al analizar el ZIP nacional: " + err.message);
      setActiveZipFile(null);
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
      await startResolvedZipImport(activeZipFile, preResolved);
    } else {
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
      
      // Actualizar en lista local sin recargar todo de base de datos
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

      // Actualizar en lista local
      setCompanies((prev) =>
        prev.map((c) => (c.id === selectedCompany.id ? updated : c))
      );

      // Recargar KPIs agregados
      await fetchAggregatedKPIs(companies);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al convertir prospecto: " + err.message);
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

  return (
    <div className="space-y-6">
      {/* Cabecera / Importador */}
      <MarketIntelligenceHeader
        onImport={handleImport}
        onZipSelect={handleZipSelect}
        isLoading={isProcessing}
        canImport={capabilities.canImport}
      />

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
              onClick={() => {
                setActiveZipFile(null);
                setZipSummary(null);
              }}
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
                onClick={() => {
                  // Cancelar todo
                  setActiveZipFile(null);
                  setPendingStateResolutionFiles(null);
                  setCurrentResolutionIndex(-1);
                  setResolvedFilesList([]);
                }}
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
        companies={companies}
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
