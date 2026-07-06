import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../config/firebase";

import MarketIntelligenceHeader from "../modules/market-intelligence/components/MarketIntelligenceHeader";
import MarketIntelligenceKPIs from "../modules/market-intelligence/components/MarketIntelligenceKPIs";
import MarketCompaniesFilters from "../modules/market-intelligence/components/MarketCompaniesFilters";
import MarketCompaniesTable from "../modules/market-intelligence/components/MarketCompaniesTable";
import MarketCompanyDrawer from "../modules/market-intelligence/components/MarketCompanyDrawer";
import MarketSegmentsPanel from "../modules/market-intelligence/components/MarketSegmentsPanel";

import MarketFirestoreService from "../modules/market-intelligence/services/marketFirestoreService";
import type { CompanyStatus, InegiCompany } from "../modules/market-intelligence/types/inegi";

interface FiltersState {
  status: string;
  tamano: string;
  sector: string;
  municipio: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  minScore: number;
  search: string;
}

const DEFAULT_FILTERS: FiltersState = {
  status: "",
  tamano: "",
  sector: "",
  municipio: "",
  hasEmail: false,
  hasPhone: false,
  hasWebsite: false,
  minScore: 0,
  search: "",
};

export default function MarketIntelligencePage() {
  // Estados de carga e interfaz
  const [companies, setCompanies] = useState<InegiCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Estados de Filtros y Segmentos
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

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
          municipio: filters.municipio || undefined,
          hasEmail: filters.hasEmail ? true : undefined,
          hasPhone: filters.hasPhone ? true : undefined,
          hasWebsite: filters.hasWebsite ? true : undefined,
          minScore: filters.minScore || undefined,
          search: filters.search || undefined,
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
      console.error(err);
      setError("Error al cargar los prospectos de mercado: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Consulta barata de conteos usando getCountFromServer
  async function fetchAggregatedKPIs(loadedCompanies: InegiCompany[]) {
    try {
      const collRef = collection(db, "market_companies");

      const [totalSnap, convertedSnap, qualifiedSnap, contactedSnap] = await Promise.all([
        getCountFromServer(collRef),
        getCountFromServer(query(collRef, where("status", "==", "CONVERTED"))),
        getCountFromServer(query(collRef, where("status", "==", "QUALIFIED"))),
        getCountFromServer(query(collRef, where("status", "==", "CONTACTED"))),
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
    } catch (err) {
      console.warn("No se pudieron cargar los conteos del servidor:", err);
    }
  }

  // Efecto inicial y ante cambios de filtro
  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.status,
    filters.tamano,
    filters.sector,
    filters.municipio,
    filters.hasEmail,
    filters.hasPhone,
    filters.hasWebsite,
    filters.minScore,
  ]);

  // Ejecución de búsqueda por texto con debounce o manual
  function handleSearchTrigger() {
    loadData(true);
  }

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
          municipio: filters.municipio || undefined,
          hasEmail: filters.hasEmail ? true : undefined,
          hasPhone: filters.hasPhone ? true : undefined,
          hasWebsite: filters.hasWebsite ? true : undefined,
          minScore: filters.minScore || undefined,
          search: filters.search || undefined,
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
          municipio: filters.municipio || undefined,
          hasEmail: filters.hasEmail ? true : undefined,
          hasPhone: filters.hasPhone ? true : undefined,
          hasWebsite: filters.hasWebsite ? true : undefined,
          minScore: filters.minScore || undefined,
          search: filters.search || undefined,
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

  // Importar desde Excel o Muestra Piloto (Batch)
  async function handleImport(importedCompanies: InegiCompany[]) {
    setIsProcessing(true);
    setError("");
    setSuccess("");

    try {
      const { added } = await MarketFirestoreService.importMarketCompaniesBatch(
        importedCompanies
      );
      setSuccess(`Lote importado con éxito: ${added} prospectos cargados en base local.`);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al importar lote: " + err.message);
    } finally {
      setIsProcessing(false);
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

  return (
    <div className="space-y-6">
      {/* Cabecera / Importador */}
      <MarketIntelligenceHeader onImport={handleImport} isLoading={isProcessing} />

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

      {/* Tarjetas KPI */}
      <MarketIntelligenceKPIs
        totalCount={stats.totalCount}
        convertedCount={stats.convertedCount}
        qualifiedCount={stats.qualifiedCount}
        avgScore={stats.avgScore}
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
          />

          {/* Gatillo de búsqueda manual (cuando edita search text) */}
          {filters.search && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSearchTrigger}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
              >
                Ejecutar búsqueda textual
              </button>
            </div>
          )}

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
      />
    </div>
  );
}
