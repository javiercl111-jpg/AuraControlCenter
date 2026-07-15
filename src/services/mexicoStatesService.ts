import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { MEXICO_STATES, type MexicoStateOption } from "../types/mexicoStates";

export async function getMexicoStatesWithMetadata(): Promise<MexicoStateOption[]> {
  try {
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
  } catch (err) {
    console.error("Error loading state metadata:", err);
    return MEXICO_STATES;
  }
}
