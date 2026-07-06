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
export async function analyzeZipFiles(zipFile: File): Promise<ZipAnalyzedFile[]> {
  const zip = await JSZip.loadAsync(zipFile);
  
  // Ignorar archivos ocultos, __MACOSX o temporales
  const excelFiles = Object.keys(zip.files).filter(
    (name) => (name.endsWith(".xlsx") || name.endsWith(".xls")) && 
              !name.startsWith("__MACOSX") && 
              !name.startsWith(".") &&
              !name.includes("/.") &&
              !name.includes("~$")
  );

  const result: ZipAnalyzedFile[] = [];

  for (const filename of excelFiles) {
    let guessedState = detectStateFromFilename(filename);
    let needsStateSelection = !guessedState;
    
    if (needsStateSelection) {
      try {
        const fileData = await zip.files[filename].async("arraybuffer");
        const workbook = read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (sheetName) {
          const sheet = workbook.Sheets[sheetName];
          const jsonRows: any[][] = utils.sheet_to_json(sheet, { header: 1 });
          if (jsonRows.length > 0) {
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
      } catch (err) {
        console.warn(`[NationalZipImport] Error al analizar cabeceras de ${filename}:`, err);
      }
    }

    result.push({
      filename,
      guessedState,
      needsStateSelection,
    });
  }

  return result;
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
  const zip = await JSZip.loadAsync(zipFile);
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
          // Forzar el estado resuelto para que herede la geografía correcta
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

      // Upsert batch en sub-lotes configurables
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

  // Registrar en Historial con type: NATIONAL_ZIP_IMPORT (Prioridad 6)
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
