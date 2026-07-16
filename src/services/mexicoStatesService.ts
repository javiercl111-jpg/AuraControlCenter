import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { MEXICO_STATES, type MexicoStateOption } from "../types/mexicoStates";

/**
 * Loads the Mexico states territorial catalog mapped with their import status metadata from Firestore.
 * Does not catch errors internally so the UI can detect permission errors.
 */
export async function getMexicoStatesWithMetadata(): Promise<MexicoStateOption[]> {
  const snap = await getDocs(collection(db, "platform_market_state_metadata"));
  const metadataMap: Record<string, any> = {};
  snap.docs.forEach((d) => {
    metadataMap[d.id] = d.data();
  });

  return MEXICO_STATES.map((state) => {
    const meta = metadataMap[state.code];
    if (meta) {
      return {
        ...state,
        imported: Boolean(meta.imported),
        companyCount: meta.companyCount,
        lastImportAt: meta.lastImportAt && typeof meta.lastImportAt.toDate === "function" 
          ? meta.lastImportAt.toDate().toISOString() 
          : meta.lastImportAt,
      };
    }
    return state;
  });
}
