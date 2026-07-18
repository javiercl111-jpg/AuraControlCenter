import * as fs from "fs";
import * as path from "path";
import { MEXICO_STATES } from "./types/mexicoStates";

const PROJECT_ID = "aura-control-center-debb3";

function getAccessToken(): string | null {
  const p = path.join("C:", "Users", "javie", ".config", "configstore", "firebase-tools.json");
  if (fs.existsSync(p)) {
    try {
      const content = JSON.parse(fs.readFileSync(p, "utf8"));
      return content.tokens?.access_token || null;
    } catch (err) {
      console.error("Error reading firebase-tools.json:", err);
    }
  }
  return null;
}

// Helper to convert plain object to Firestore fields format
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "number") return { integerValue: val.toString() };
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const k in obj) {
    fields[k] = toFirestoreValue(obj[k]);
  }
  return { fields };
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");

  console.log("======================================================================");
  console.log(" AURA METADATA BACKFILL ENGINE");
  console.log(` MODE: ${isApply ? "=== APPLY (WRITING TO PRODUCTION) ===" : "=== DRY-RUN (READ-ONLY) ==="}`);
  console.log("======================================================================\n");

  const accessToken = getAccessToken();
  if (!accessToken) {
    console.error("[ERROR] No se pudo recuperar el token de acceso.");
    process.exit(1);
  }

  const authHeader = `Bearer ${accessToken}`;

  async function runQueryREST(stateName: string): Promise<number> {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runAggregationQuery`;
    const queryBody = {
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: "market_companies" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "estado" },
              op: "EQUAL",
              value: { stringValue: stateName }
            }
          }
        },
        aggregations: [
          {
            count: {},
            alias: "total"
          }
        ]
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(queryBody)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed runAggregationQuery for ${stateName}: ${errTxt}`);
    }

    const data = await res.json();
    // runAggregationQuery returns an array with the result
    const result = data[0]?.result?.aggregateFields?.total?.integerValue;
    return result ? parseInt(result, 10) : 0;
  }

  async function writeMetadataREST(stateCode: string, fields: any) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platform_market_state_metadata/${stateCode}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(toFirestoreFields(fields))
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to write metadata for ${stateCode}: ${errTxt}`);
    }
  }

  try {
    console.log("[INFO] Escaneando market_companies en producción para cada estado...");
    
    const proposals: Array<{ code: string; label: string; count: number }> = [];

    for (const state of MEXICO_STATES) {
      // Query count for both exact label and normalized name if different
      const count = await runQueryREST(state.label);
      if (count > 0) {
        proposals.push({ code: state.code, label: state.label, count });
        console.log(`[FOUND] ${state.label} (${state.code}): ${count} empresas encontradas.`);
      }
    }

    console.log("\n======================================================================");
    console.log(" OPERACIONES DE BACKFILL PROPUESTAS");
    console.log("======================================================================");
    if (proposals.length === 0) {
      console.log("No se encontraron empresas en market_companies para ningún estado.");
    } else {
      proposals.forEach(p => {
        const stateObj = MEXICO_STATES.find(s => s.code === p.code);
        console.log(`Crear/Actualizar platform_market_state_metadata/${p.code}:`);
        console.log(`  * imported: true`);
        console.log(`  * companyCount: ${p.count}`);
        console.log(`  * stateCode: ${p.code}`);
        console.log(`  * inegiCode: ${stateObj ? stateObj.inegiCode : ""}`);
        console.log(`  * stateLabel: ${stateObj ? stateObj.label : ""}`);
        console.log(`  * normalizedState: ${stateObj ? stateObj.normalizedValue : ""}`);
        console.log(`  * updatedAt: ${new Date().toISOString()}`);
        console.log(`  * schemaVersion: "2026.1"`);
      });
    }
    console.log("======================================================================\n");

    if (!isApply) {
      console.log("[INFO] Dry-run finalizado con éxito. Ningún cambio realizado.");
      console.log("Para aplicar los cambios en producción, ejecute: npm run backfill -- --apply");
      return;
    }

    console.log("[INFO] Aplicando cambios en platform_market_state_metadata...");
    for (const p of proposals) {
      console.log(`  Writing metadata for ${p.label} (${p.code})...`);
      const stateObj = MEXICO_STATES.find(s => s.code === p.code);
      await writeMetadataREST(p.code, {
        imported: true,
        companyCount: p.count,
        stateCode: p.code,
        inegiCode: stateObj ? stateObj.inegiCode : "",
        stateLabel: stateObj ? stateObj.label : "",
        normalizedState: stateObj ? stateObj.normalizedValue : "",
        updatedAt: new Date().toISOString(),
        schemaVersion: "2026.1"
      });
    }
    console.log("[OK] Backfill completado con éxito.");

  } catch (err: any) {
    console.error("[ERROR] Fallo en la ejecución del backfill:", err.message);
    process.exit(1);
  }
}

main();
