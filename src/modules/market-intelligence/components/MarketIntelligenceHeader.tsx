import React, { useRef, useState } from "react";
import { read, utils } from "xlsx";
import {
  Database,
  HelpCircle,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { normalizeRow, detectHeaderRowAndBuildMap, normalizeRowWithMap } from "../services/normalizationService";
import type { InegiCompany } from "../types/inegi";

interface MarketIntelligenceHeaderProps {
  onImport: (companies: InegiCompany[]) => Promise<void>;
  isLoading: boolean;
  canImport: boolean;
}

// 12 registros de muestra piloto INEGI de alta fidelidad para el DENUE 2026
const MOCK_PILOT_DATA = [
  {
    "Razón Social": "GRUPO BIMBO S.A.B. DE C.V.",
    "Nombre Comercial": "BIMBO PLANTA SANTA MARIA",
    Sector: "Industrias Manufactureras",
    Tamaño: "Grande (251 y más personas)",
    "Rango Personal": "251 y más personas",
    Teléfono: "5552686600",
    Email: "contacto.bimbo@grupobimbo.com",
    "Sitio Web": "www.grupobimbo.com",
    Dirección: "Prolongación Mimosas 117, Santa María Insurgentes",
    Municipio: "Cuauhtémoc",
    Estado: "Ciudad de México",
    "C.P.": "06430",
    SCIAN: "311812",
    Actividad: "Panificación industrial",
    Latitud: 19.4623,
    Longitud: -99.1554,
    "Alta DENUE": "2010-07",
    Score: 92,
  },
  {
    "Razón Social": "FOMENTO ECONOMICO MEXICANO S.A.B. DE C.V.",
    "Nombre Comercial": "FEMSA CORPORATIVO",
    Sector: "Servicios Financieros y Corporativos",
    Tamaño: "Grande (251 y más personas)",
    "Rango Personal": "251 y más personas",
    Teléfono: "8183286000",
    Email: "inversionista@femsa.com.mx",
    "Sitio Web": "www.femsa.com",
    Dirección: "General Anaya 601 Poniente, Bella Vista",
    Municipio: "Monterrey",
    Estado: "Nuevo León",
    "C.P.": "64410",
    SCIAN: "551111",
    Actividad: "Corporativos y oficinas de control de empresas",
    Latitud: 25.6948,
    Longitud: -100.3162,
    "Alta DENUE": "2010-07",
    Score: 95,
  },
  {
    "Razón Social": "SOFTTEK DE MEXICO S.A. DE C.V.",
    "Nombre Comercial": "SOFTTEK TECNOLOGIA",
    Sector: "Información en Medios Masivos",
    Tamaño: "Grande (251 y más personas)",
    "Rango Personal": "251 y más personas",
    Teléfono: "8181532000",
    Email: "info@softtek.com",
    "Sitio Web": "www.softtek.com",
    Dirección: "Av. Constitución 3000, Obispado",
    Municipio: "Monterrey",
    Estado: "Nuevo León",
    "C.P.": "64060",
    SCIAN: "541512",
    Actividad: "Servicios de diseño de sistemas de cómputo y servicios relacionados",
    Latitud: 25.6725,
    Longitud: -100.3475,
    "Alta DENUE": "2014-11",
    Score: 89,
  },
  {
    "Razón Social": "KAVAK TECNOLOGIA S. DE R.L. DE C.V.",
    "Nombre Comercial": "KAVAK SHOWROOM LERMA",
    Sector: "Comercio al por menor",
    Tamaño: "Mediana (51 a 100 personas)",
    "Rango Personal": "51 a 100 personas",
    Teléfono: "5541629800",
    Email: "contacto@kavak.com",
    "Sitio Web": "www.kavak.com",
    Dirección: "Carretera México-Toluca KM 52.5",
    Municipio: "Lerma",
    Estado: "Estado de México",
    "C.P.": "52000",
    SCIAN: "461110",
    Actividad: "Comercio al por menor de automóviles usados",
    Latitud: 19.2882,
    Longitud: -99.5103,
    "Alta DENUE": "2018-05",
    Score: 84,
  },
  {
    "Razón Social": "CLARA TECHNOLOGIES MEXICO S.A. DE C.V.",
    "Nombre Comercial": "CLARA FINTECH",
    Sector: "Servicios Financieros y Corporativos",
    Tamaño: "Mediana (101 a 250 personas)",
    "Rango Personal": "101 a 250 personas",
    Teléfono: "5585263300",
    Email: "soporte@clara.com",
    "Sitio Web": "www.clara.com",
    Dirección: "Paseo de la Reforma 412, Juárez",
    Municipio: "Cuauhtémoc",
    Estado: "Ciudad de México",
    "C.P.": "06600",
    SCIAN: "522190",
    Actividad: "Otras instituciones de intermediación crediticia no bancaria",
    Latitud: 19.4272,
    Longitud: -99.1676,
    "Alta DENUE": "2021-03",
    Score: 88,
  },
  {
    "Razón Social": "FARMACIAS DE SIMILARES S.A. DE C.V.",
    "Nombre Comercial": "FARMACIAS SIMILARES CENTRO",
    Sector: "Comercio al por menor",
    Tamaño: "Grande (251 y más personas)",
    "Rango Personal": "251 y más personas",
    Teléfono: "5554224500",
    Email: "contacto@farmaciasdesimilares.com",
    "Sitio Web": "www.farmaciasdesimilares.com",
    Dirección: "Paseo de la Reforma 101, Guerrero",
    Municipio: "Cuauhtémoc",
    Estado: "Ciudad de México",
    "C.P.": "06300",
    SCIAN: "464111",
    Actividad: "Comercio al por menor de productos farmacéuticos",
    Latitud: 19.4394,
    Longitud: -99.1468,
    "Alta DENUE": "2010-07",
    Score: 80,
  },
  {
    "Razón Social": "SERVICIOS PROFESIONALES DEL BAJIO S.C.",
    "Nombre Comercial": "SERVICIOS PROFESIONALES DEL BAJIO",
    Sector: "Servicios Profesionales, Científicos y Técnicos",
    Tamaño: "Pequeña (11 a 30 personas)",
    "Rango Personal": "11 a 30 personas",
    Teléfono: "4777174500",
    Email: "informes@spbajio.com.mx",
    "Sitio Web": "www.spbajio.com",
    Dirección: "Blvd. Adolfo López Mateos 2001, Centro",
    Municipio: "León",
    Estado: "Guanajuato",
    "C.P.": "37000",
    SCIAN: "541110",
    Actividad: "Bufetes jurídicos y servicios legales",
    Latitud: 21.1219,
    Longitud: -101.6601,
    "Alta DENUE": "2015-09",
    Score: 68,
  },
  {
    "Razón Social": "METALES Y ESTRUCTURAS DEL NORTE S.A. DE C.V.",
    "Nombre Comercial": "METALES DEL NORTE COAHUILA",
    Sector: "Industrias Manufactureras",
    Tamaño: "Mediana (51 a 100 personas)",
    "Rango Personal": "51 a 100 personas",
    Teléfono: "8444152000",
    Email: "no disponible",
    "Sitio Web": "www.metalesdelnorte.com",
    Dirección: "Calzada Antonio Narro KM 4.5",
    Municipio: "Saltillo",
    Estado: "Coahuila",
    "C.P.": "25070",
    SCIAN: "331221",
    Actividad: "Fabricación de estructuras metálicas",
    Latitud: 25.3855,
    Longitud: -101.0212,
    "Alta DENUE": "2012-04",
    Score: 71,
  },
  {
    "Razón Social": "TECNOLOGIA E INNOVACION DIGITAL S.A. DE C.V.",
    "Nombre Comercial": "INNOVACION DIGITAL GDL",
    Sector: "Servicios Profesionales, Científicos y Técnicos",
    Tamaño: "Pequeña (31 a 50 personas)",
    "Rango Personal": "31 a 50 personas",
    Teléfono: "3336158000",
    Email: "hola@innovaciondigitalgdl.com",
    "Sitio Web": "n/a",
    Dirección: "Av. Chapultepec Norte 150, Ladrón de Guevara",
    Municipio: "Guadalajara",
    Estado: "Jalisco",
    "C.P.": "44600",
    SCIAN: "541511",
    Actividad: "Desarrollo de software y páginas web",
    Latitud: 20.6789,
    Longitud: -103.3695,
    "Alta DENUE": "2019-08",
    Score: 73,
  },
  {
    "Razón Social": "COMERCIALIZADORA DE ABARROTES LA LUPITA S.A.",
    "Nombre Comercial": "ABARROTES LA LUPITA MERIDA",
    Sector: "Comercio al por menor",
    Tamaño: "Micro (0 a 10 personas)",
    "Rango Personal": "1 a 5 personas",
    Teléfono: "9999245500",
    Email: "admin@lalupita.com.mx",
    "Sitio Web": "",
    Dirección: "Calle 60 #450, Centro Histórico",
    Municipio: "Mérida",
    Estado: "Yucatán",
    "C.P.": "97000",
    SCIAN: "461111",
    Actividad: "Comercio al por menor en tiendas de abarrotes y ultramarinos",
    Latitud: 20.9702,
    Longitud: -89.6225,
    "Alta DENUE": "2010-07",
    Score: 35,
  },
  {
    "Razón Social": "FINANCIERA LIBERTAD S.A. DE C.V. S.F.P.",
    "Nombre Comercial": "LIBERTAD SERVICIOS FINANCIEROS",
    Sector: "Servicios Financieros y Corporativos",
    Tamaño: "Mediana (101 a 250 personas)",
    "Rango Personal": "101 a 250 personas",
    Teléfono: "4422514000",
    Email: "buzon@libertad.com.mx",
    "Sitio Web": "www.libertad.com.mx",
    Dirección: "Av. Constituyentes 124 Oriente, Carretas",
    Municipio: "Querétaro",
    Estado: "Querétaro",
    "C.P.": "76050",
    SCIAN: "522240",
    Actividad: "Cajas de ahorro popular y cooperativas de ahorro y préstamo",
    Latitud: 20.5912,
    Longitud: -100.3789,
    "Alta DENUE": "2011-06",
    Score: 82,
  },
  {
    "Razón Social": "HOTELERA CAMINO REAL S.A. DE C.V.",
    "Nombre Comercial": "HOTEL CAMINO REAL POLANCO",
    Sector: "Servicios de Alojamiento y Alimentos",
    Tamaño: "Grande (251 y más personas)",
    "Rango Personal": "251 y más personas",
    Teléfono: "5552638888",
    Email: "reservaciones@caminoreal.com.mx",
    "Sitio Web": "www.caminoreal.com",
    Dirección: "Calz. General Mariano Escobedo 700, Anzures",
    Municipio: "Miguel Hidalgo",
    Estado: "Ciudad de México",
    "C.P.": "11590",
    SCIAN: "721110",
    Actividad: "Hoteles con servicios integrados",
    Latitud: 19.4299,
    Longitud: -99.1781,
    "Alta DENUE": "2010-07",
    Score: 86,
  }
];

const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas"
];

export default function MarketIntelligenceHeader({
  onImport,
  isLoading,
  canImport,
}: MarketIntelligenceHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseStatus, setParseStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showStateSelector, setShowStateSelector] = useState(false);
  const [selectedImportState, setSelectedImportState] = useState("");
  const [pendingImportData, setPendingImportData] = useState<{
    rows2D: any[][];
    headerMap: any;
    headers: string[];
  } | null>(null);

  // Confirmar la importación tras seleccionar el estado manual
  async function handleConfirmImportWithState() {
    if (!pendingImportData || !selectedImportState) return;
    
    setPendingImportData(null);
    setShowStateSelector(false);
    setParseStatus(`Normalizando registros con Estado: ${selectedImportState}...`);
    setError("");

    try {
      const { rows2D, headerMap } = pendingImportData;
      const dataRows = rows2D.slice(headerMap.headerRowIndex + 1);
      const processedRows: InegiCompany[] = [];

      const limitCount = Math.min(dataRows.length, 500);

      for (let i = 0; i < limitCount; i++) {
        const rowArray = dataRows[i];
        if (!rowArray || rowArray.length === 0) continue;

        const normalized = normalizeRowWithMap(rowArray, headerMap);
        // Sobrescribir estado al seleccionado manualmente
        normalized.estado = selectedImportState;
        
        if (normalized.razonSocial || normalized.nombreComercial) {
          processedRows.push(normalized);
        }
      }

      if (processedRows.length === 0) {
        throw new Error("Ninguno de los registros leídos contiene campos válidos (Razón Social o Nombre Comercial).");
      }

      setParseStatus(`Importando ${processedRows.length} registros a Firestore...`);
      await onImport(processedRows);

      setParseStatus(`Importación completada con éxito. ${processedRows.length} registros cargados.`);
      setTimeout(() => setParseStatus(""), 5000);
      setSelectedImportState("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al importar los datos.");
      setParseStatus("");
    }
  }

  // Cancelar la importación
  function handleCancelImport() {
    setShowStateSelector(false);
    setPendingImportData(null);
    setSelectedImportState("");
    setParseStatus("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Manejar el archivo Excel subido
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  }

  function processExcelFile(file: File) {
    setParseStatus("Leyendo archivo Excel...");
    setError("");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        
        // Buscar la hoja llamada "Datos" (o usar la primera)
        const sheetName =
          workbook.SheetNames.find(
            (name) => name.toLowerCase() === "datos"
          ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error("No se pudo leer ninguna hoja de datos en el Excel.");
        }

        // Convertir a matriz 2D para buscar encabezados y mapearlos dinámicamente
        const rows2D = utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows2D.length === 0) {
          throw new Error("El archivo Excel no contiene registros en la hoja '" + sheetName + "'.");
        }

        // Detectar encabezados y construir mapa de índices
        const { headerRowIndex, headerMap, headers } = detectHeaderRowAndBuildMap(rows2D);

        // Imprimir en consola de depuración para diagnóstico
        console.log("=== ENCABEZADOS DETECTADOS EN EXCEL ===");
        console.log(headers);
        console.log("=== MAPEO DE COLUMNAS A VARIABLES ===");
        console.log(headerMap);

        // Si no se detectó columna de estado, pausar e interrogar al usuario
        if (headerMap.estadoIdx === -1) {
          setPendingImportData({ rows2D, headerMap, headers });
          setShowStateSelector(true);
          setParseStatus("Falta columna de Estado. Esperando selección manual...");
          return;
        }

        setParseStatus(`Hoja '${sheetName}' detectada (Fila encabezados: ${headerRowIndex + 1}). Procesando...`);

        const dataRows = rows2D.slice(headerRowIndex + 1);
        const processedRows: InegiCompany[] = [];

        // Aplicar límite estricto de 500 registros para proteger costo Firestore
        const limitCount = Math.min(dataRows.length, 500);

        for (let i = 0; i < limitCount; i++) {
          const rowArray = dataRows[i];
          if (!rowArray || rowArray.length === 0) continue;

          const normalized = normalizeRowWithMap(rowArray, headerMap);
          // Validar que al menos tenga Razón Social o Nombre Comercial
          if (normalized.razonSocial || normalized.nombreComercial) {
            processedRows.push(normalized);
          }
        }

        if (processedRows.length === 0) {
          throw new Error("Ninguno de los registros leídos contiene campos válidos mapeables (Razón Social o Nombre Comercial).");
        }

        setParseStatus(
          `Normalizados ${processedRows.length} registros (Límite máximo: 500). Importando a Firestore...`
        );
        
        await onImport(processedRows);

        setParseStatus(`Importación completada con éxito. ${processedRows.length} registros cargados.`);
        setTimeout(() => setParseStatus(""), 5000);
        
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al procesar el archivo Excel. Revisa el formato.");
        setParseStatus("");
      }
    };

    reader.onerror = () => {
      setError("Error al leer el archivo físico.");
      setParseStatus("");
    };

    reader.readAsArrayBuffer(file);
  }

  // Cargar muestra piloto de 12 registros de INEGI
  async function handleLoadPilotSample() {
    setParseStatus("Generando muestra piloto INEGI...");
    setError("");
    try {
      const normalizedSamples = MOCK_PILOT_DATA.map((row) => normalizeRow(row));
      setParseStatus(`Procesando 12 registros de muestra piloto. Guardando...`);
      await onImport(normalizedSamples);
      setParseStatus("Muestra piloto cargada y guardada correctamente.");
      setTimeout(() => setParseStatus(""), 4000);
    } catch (err: any) {
      console.error(err);
      setError("Error al cargar la muestra piloto: " + err.message);
      setParseStatus("");
    }
  }

  return (
    <header className="relative mb-8 rounded-3xl border border-cyan-500/10 bg-slate-900/40 p-6 backdrop-blur md:p-8">
      {/* Glow Effects */}
      <div className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute -left-20 -bottom-20 -z-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 items-center gap-1.5 rounded-full bg-cyan-400/10 px-3 text-xs font-semibold uppercase tracking-wider text-cyan-200">
              <Sparkles className="h-3 w-3 text-cyan-300" />
              DENUE 2026
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Aura Prospect Intelligence
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">
            Asesor comercial inteligente para segmentar, priorizar y calificar prospectos del
            Directorio DENUE 2026 y convertirlos en oportunidades de venta activas.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Botón muestra piloto */}
          <button
            type="button"
            onClick={handleLoadPilotSample}
            disabled={isLoading || !canImport}
            className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="h-4 w-4" />
            Cargar muestra piloto INEGI
          </button>

          {/* Uploader Excel */}
          {canImport ? (
            <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-95">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Importar Excel DENUE
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                disabled={isLoading}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          ) : (
            <button
              type="button"
              disabled
              title="No tienes permisos de importación"
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/55 px-5 py-3 text-sm font-bold text-slate-500 cursor-not-allowed"
            >
              <UploadCloud className="h-4 w-4 text-slate-600" />
              Importar Excel DENUE
            </button>
          )}
        </div>
      </div>

      {/* Selector de Estado en caso de que falte en el Excel */}
      {showStateSelector && pendingImportData && (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 md:p-6">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-amber-200">
              ⚠️ Estado no detectado en el archivo
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              El archivo Excel subido no contiene una columna de <strong>Estado</strong>. Por favor, selecciona a qué estado de la República pertenecen estos registros para poder guardarlos con la clasificación correcta:
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedImportState}
              onChange={(e) => setSelectedImportState(e.target.value)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">-- Seleccionar Estado --</option>
              {MEXICAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmImportWithState}
                disabled={!selectedImportState}
                className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition"
              >
                Confirmar e Importar
              </button>
              <button
                type="button"
                onClick={handleCancelImport}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Estado o Error */}
      {parseStatus && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-xs text-cyan-200">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          <span>{parseStatus}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <span className="font-semibold">Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* Nota de Costos y Límites */}
      <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-800/60 pt-4">
        <HelpCircle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
        <span>
          * Costo Firestore Protegido: El importador procesa los registros de forma eficiente utilizando Upsert por lotes.
          Los duplicados sin cambios se omiten de forma automática para proteger los costos de base de datos.
        </span>
      </div>
    </header>
  );
}
