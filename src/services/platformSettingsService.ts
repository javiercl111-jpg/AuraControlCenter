import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  
  import type { PlatformSettings } from "../types/platformSettings";
  
  const SETTINGS_COLLECTION = "platform_settings";
  const SETTINGS_DOCUMENT = "global";
  
  const DEFAULT_SETTINGS: Omit<
    PlatformSettings,
    "id"
  > = {
    billing: {
      defaultGraceDays: 15,
  
      maxGraceDays: 30,
  
      invoiceDueDays: 30,
  
      autoSuspendEnabled: true,
  
      autoReactivateOnPayment: true,
    },
  
    commissions: {
      year1Commission: 10,
  
      renewalCommission: 5,
  
      advisorBonusThreshold: 10,
  
      advisorBonusPercentage: 15,
    },
  };
  
  export async function getPlatformSettings(): Promise<PlatformSettings> {
    const settingsRef = doc(
      db,
      SETTINGS_COLLECTION,
      SETTINGS_DOCUMENT
    );
  
    const snapshot = await getDoc(settingsRef);
  
    if (!snapshot.exists()) {
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        updatedAt: serverTimestamp(),
      });
  
      return {
        id: SETTINGS_DOCUMENT,
        ...DEFAULT_SETTINGS,
      };
    }
  
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<PlatformSettings, "id">),
    };
  }
  
  export async function savePlatformSettings(
    settings: Omit<PlatformSettings, "id">
  ) {
    const settingsRef = doc(
      db,
      SETTINGS_COLLECTION,
      SETTINGS_DOCUMENT
    );
  
    await setDoc(
      settingsRef,
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }