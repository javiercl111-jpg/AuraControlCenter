import JSZip from "jszip";
import { read, utils } from "xlsx";
import NormalizationService from "./normalizationService";
import MarketFirestoreService from "./marketFirestoreService";
import type { InegiCompany } from "../types/inegi";

const MEXICAN_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Coahuila",
  "Colima", "Chiapas", "Chihuahua", "Ciudad de México", "Durango", "Guanajuato",
  "Guerrero", "Hidalgo", "Jalisco", "México", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
];

function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Detecta qué estado de la República corresponde al nombre del archivo Excel.
 */
export function detectStateFromFilename(filename: string): string {
  const normFile = normalizeName(filename);
  for (const state of MEXICAN_STATES) {
    const normState = normalizeName(state);
    if (normFile.includes(normState)) {
      return state;
    }
  }
  // Casos comunes
  if (normFile.includes("cdmx") || normFile.includes("distrito federal") || normFile.includes("df")) {
    return "Ciudad de México";
  }
  if (normFile.includes("edomex") || normFile.includes("estado de mexico")) {
    return "México";
  }
  return "";
}

export interface ZipAnalyzedFile {
  filename: string;
  guessedState: string;
  needsStateSelection: boolean;
  rowCount: number;
}

export interface ZipAnalysisSummary {
  totalFiles: number;
  unresolvedFilesCount: number;
  totalEstimatedRows: number;
  statesCount: number;
  files: ZipAnalyzedFile[];
}

export interface ZipImportProgress {
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  totalRowsProcessed: number;
  added: number;
  overwritten: number;
  omitted: number;
  failed: number;
}

export interface NationalZipImportResult {
  totalFiles: number;
  processedFiles: number;
  omittedFiles: number;
  totalRowsProcessed: number;
  added: number;
  overwritten: number;
  omitted: number;
  failed: number;
  importedStates: string[];
  timeMs: number;
}

/**
 * Analiza los archivos internos del ZIP, identificando cuáles son Excel
 * y cuáles carecen de estado geográfico (para resolverlos interactivamente).
 */
export async function analyzeZipFiles(zipFile: File): Promise<ZipAnalysisSummary> {
  console.log("=== DIAGNÓSTICO DE ARCHIVO ZIP ===");
  console.log(`Nombre: ${zipFile.name}`);
  console.log(`Tipo MIME: ${zipFile.type}`);
  console.log(`Tamaño: ${zipFile.size} bytes`);
  const extension = zipFile.name.split(".").pop() || "";
  console.log(`Extensión: ${extension}`);

  // Magic numbers validation
  try {
    const slice = zipFile.slice(0, 4);
    const arrBuf = await slice.arrayBuffer();
    const view = new DataView(arrBuf);
    const magic = [];
    for (let i = 0; i < arrBuf.byteLength; i++) {
      magic.push(view.getUint8(i).toString(16).padStart(2, "0").toUpperCase());
    }
    console.log(`Primeros bytes (Hex): ${magic.join(" ")}`);
    if (magic.join(" ") === "50 4B 03 04") {
      console.log("Firma mágica confirmada: Formato ZIP válido (PK..)");
    } else {
      console.warn("Firma mágica no coincide con PK (50 4B 03 04).");
    }
  } catch (err) {
    console.error("Fallo al leer magic bytes:", err);
  }

  let zip: JSZip;
  try {
    const zipData = await zipFile.arrayBuffer();
    zip = await JSZip.loadAsync(zipData);
    console.log("JSZip cargó el archivo correctamente.");
  } catch (jszipErr: any) {
    console.error("Fallo crítico de JSZip:", jszipErr);
    throw new Error(`El archivo ZIP está dañado o no es un formato válido: ${jszipErr.message}`);
  }

  // Filtrar archivos Excel recursivos, ignorando carpetas de sistema y ocultos
  const excelFiles = Object.keys(zip.files).filter((name) => {
    const isFolder = zip.files[name].dir;
    if (isFolder) return false;

    const basename = name.split("/").pop() || "";
    const lowercaseName = name.toLowerCase();

    // Ignorar basura de macOS/Windows
    if (
      lowercaseName.includes("__macosx") ||
      lowercaseName.includes("thumbs.db") ||
      lowercaseName.includes("desktop.ini")
    ) {
      return false;
    }

    // Ignorar archivos ocultos o temporales
    if (basename.startsWith(".") || basename.startsWith("~$")) {
      return false;
    }

    // Aceptar únicamente Excel (.xlsx, .xls)
    const isExcel = basename.toLowerCase().endsWith(".xlsx") || basename.toLowerCase().endsWith(".xls");
    return isExcel;
  });

  const files: ZipAnalyzedFile[] = [];
  let totalEstimatedRows = 0;
  let unresolvedFilesCount = 0;
  const statesSet = new Set<string>();

  for (const filename of excelFiles) {
    let guessedState = detectStateFromFilename(filename);
    let needsStateSelection = !guessedState;
    let rowCount = 0;

    try {
      const fileData = await zip.files[filename].async("arraybuffer");
      const workbook = read(fileData, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const jsonRows: any[][] = utils.sheet_to_json(sheet, { header: 1 });
        if (jsonRows.length > 0) {
          rowCount = Math.max(0, jsonRows.length - 1); // Descontar fila de cabecera
          totalEstimatedRows += rowCount;

          if (needsStateSelection) {
            const { headerMap } = NormalizationService.detectHeaderRowAndBuildMap(jsonRows);
            if (headerMap.estadoIdx !== -1 && jsonRows[1]) {
              const rowState = String(jsonRows[1][headerMap.estadoIdx] || "").trim();
              if (rowState && rowState !== "No Especificado") {
                guessedState = rowState;
                needsStateSelection = false;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[NationalZipImport] Error al pre-analizar ${filename}:`, err);
    }

    if (needsStateSelection) {
      unresolvedFilesCount++;
    } else if (guessedState) {
      statesSet.add(guessedState);
    }

    files.push({
      filename,
      guessedState,
      needsStateSelection,
      rowCount,
    });
  }

  if (files.length === 0) {
    throw new Error("No se encontraron archivos Excel (.xlsx, .xls) válidos dentro del ZIP.");
  }

  return {
    totalFiles: files.length,
    unresolvedFilesCount,
    totalEstimatedRows,
    statesCount: statesSet.size,
    files,
  };
}

/**
 * Procesa e importa secuencialmente un lote de archivos ZIP con estados ya resueltos.
 * Se realiza de forma secuencial de un archivo a la vez para proteger Firestore.
 */
export async function importResolvedFiles(
  zipFile: File,
  resolvedFiles: { filename: string; state: string }[],
  onProgress?: (progress: ZipImportProgress) => void
): Promise<NationalZipImportResult> {
  const startTime = Date.now();
  const zipData = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(zipData);
  const totalFiles = resolvedFiles.length;

  let processedFiles = 0;
  let omittedFiles = 0;
  let totalRowsProcessed = 0;
  let added = 0;
  let overwritten = 0;
  let omitted = 0;
  let failed = 0;
  const importedStatesMap = new Set<string>();

  for (const item of resolvedFiles) {
    const { filename, state } = item;
    
    if (onProgress) {
      onProgress({
        currentFile: filename,
        processedFiles,
        totalFiles,
        totalRowsProcessed,
        added,
        overwritten,
        omitted,
        failed,
      });
    }

    try {
      const fileData = await zip.files[filename].async("arraybuffer");
      const workbook = read(fileData, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        omittedFiles++;
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonRows: any[][] = utils.sheet_to_json(sheet, { header: 1 });
      
      if (jsonRows.length <= 1) {
        omittedFiles++;
        continue;
      }

      const { headerMap } = NormalizationService.detectHeaderRowAndBuildMap(jsonRows);
      
      if (state && state !== "No Especificado") {
        importedStatesMap.add(state);
      }

      const companies: InegiCompany[] = [];
      
      for (let r = 1; r < jsonRows.length; r++) {
        const rowArray = jsonRows[r];
        if (!rowArray || rowArray.length === 0) continue;
        
        try {
          const company = NormalizationService.normalizeRowWithMap(rowArray, headerMap);
          company.estado = state;
          companies.push(company);
        } catch (rowErr) {
          console.warn(`[NationalZipImport] Error parseando fila ${r} en ${filename}:`, rowErr);
        }
      }

      if (companies.length === 0) {
        omittedFiles++;
        continue;
      }

      const upsertResult = await MarketFirestoreService.importMarketCompaniesBatch(companies);
      
      added += upsertResult.added;
      overwritten += upsertResult.overwritten;
      omitted += upsertResult.omitted;
      failed += upsertResult.failed;
      totalRowsProcessed += companies.length;
      processedFiles++;

    } catch (err) {
      console.error(`[NationalZipImport] Falló procesamiento de ${filename}:`, err);
      omittedFiles++;
    }
  }

  const timeMs = Date.now() - startTime;

  // Registrar en Historial con type: NATIONAL_ZIP_IMPORT
  try {
    const db = (await import("../../../config/firebase")).db;
    const { doc, collection, serverTimestamp, setDoc } = await import("firebase/firestore");
    const historyRef = doc(collection(db, "market_imports_history"));
    await setDoc(historyRef, {
      id: historyRef.id,
      timestamp: serverTimestamp(),
      filename: zipFile.name,
      totalProcessed: totalRowsProcessed,
      newAdded: added,
      updated: overwritten,
      omitted,
      failed,
      timeMs,
      source: "INEGI",
      sourceVersion: "DENUE-2026",
      type: "NATIONAL_ZIP_IMPORT",
    });
  } catch (err) {
    console.error("Error al registrar historial de importación nacional:", err);
  }

  return {
    totalFiles,
    processedFiles,
    omittedFiles,
    totalRowsProcessed,
    added,
    overwritten,
    omitted,
    failed,
    importedStates: Array.from(importedStatesMap),
    timeMs,
  };
}

const NationalZipImportService = {
  analyzeZipFiles,
  importResolvedFiles,
  detectStateFromFilename,
  MEXICAN_STATES,
};

export default NationalZipImportService;
