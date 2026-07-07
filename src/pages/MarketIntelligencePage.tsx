import { useEffect, useState, useMemo } from "react";
import { auth } from "../config/firebase";

import MarketIntelligenceHeader from "../modules/market-intelligence/components/MarketIntelligenceHeader";
import MarketCompaniesFilters from "../modules/market-intelligence/components/MarketCompaniesFilters";
import MarketCompaniesTable from "../modules/market-intelligence/components/MarketCompaniesTable";
import MarketCompanyDrawer from "../modules/market-intelligence/components/MarketCompanyDrawer";
import MarketSegmentsPanel from "../modules/market-intelligence/components/MarketSegmentsPanel";
import CommercialDashboard from "../modules/market-intelligence/components/CommercialDashboard";

import MarketFirestoreService from "../modules/market-intelligence/services/marketFirestoreService";
import MarketQueryEngine, { normalizeState, getCompanyState, getCompanyIndustry } from "../modules/market-intelligence/services/marketQueryEngine";
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
  const [activeMarketDataset, setActiveMarketDataset] = useState<InegiCompany[]>([]);
  const [rawDataset, setRawDataset] = useState<InegiCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Cargar datos
  async function loadData(resetPage = false, forceFetch = false) {
    setIsLoading(true);
    setError("");

    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      console.log("=== AURAPIPELINE LOGS ===");
      console.log("- filters actuales:", filters);

      let currentRaw = rawDataset;
      const needsFetch = forceFetch || rawDataset.length === 0;

      if (needsFetch) {
        console.log("- consultando Firestore de forma global (sin filtros estructurales)...");
        // Obtener prospectos globales sin filtros en Firestore para operar 100% en memoria
        const rawCompanies = await MarketFirestoreService.getMarketCompanies({});
        currentRaw = rawCompanies;
        setRawDataset(rawCompanies);
        console.log(`- docs recibidos de Firestore (Global): ${rawCompanies.length}`);
      } else {
        console.log("- omitiendo consulta Firestore, reutilizando rawDatasetGlobal.");
      }

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

      // 5. Paginar y cargar la primera página de la tabla
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

      // Imprimir tabla en consola obligatoria
      console.table({
        filters: JSON.stringify(filters),
        availableStates: availableStates.join(", "),
        rawDatasetLength: currentRaw.length,
        activeMarketDatasetLength: sorted.length,
        paginatedLength: sliced.length
      });

    } catch (err: any) {
      console.error({
        code: err.code || null,
        message: err.message || null,
        stack: err.stack || null,
        operation: "loadData",
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
      
      // Recargar historial
      const history = await MarketFirestoreService.getImportHistory();
      setImportHistory(history);

      await loadData(true, true);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al importar lote: " + err.message);
    } finally {
      setIsProcessing(false);
    }
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

      await loadData(true, true);
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
      await loadData(true, true);
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
