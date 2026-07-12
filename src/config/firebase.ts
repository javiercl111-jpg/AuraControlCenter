import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// Only enforce environment variables in the browser (Vite context)
if (typeof import.meta !== 'undefined' && import.meta.env) {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  requiredEnvVars.forEach(key => {
    if (!import.meta.env[key]) {
      console.warn(`Environment variable missing: ${key}`);
    }
  });
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
};

const apiKey = firebaseConfig.apiKey?.trim();

if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  console.info("[Firebase Config Check]", {
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey?.length ?? 0,
    apiKeyPrefixValid: apiKey?.startsWith("AIza") ?? false,
    projectId: firebaseConfig.projectId,
    hasAppId: Boolean(firebaseConfig.appId),
  });
} else {
  if (!apiKey || !apiKey.startsWith("AIza")) {
    throw new Error("FIREBASE_CONFIGURATION_INVALID");
  }
}


export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// App Check Initialization
let appCheckInstance = null;

if (typeof window !== "undefined") {
  try {
    if (import.meta.env.DEV) {
      const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
      if (!debugToken) {
        console.info("[Aura Control Center] No VITE_FIREBASE_APPCHECK_DEBUG_TOKEN found. Firebase will generate a debug token in the console. Please register it in Firebase Console -> App Check -> Apps -> Manage debug tokens.");
      }
    }

    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      appCheckInstance = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.log("[Aura Control Center] Firebase App Check initialized.");
    } else {
      console.warn("[Aura Control Center] VITE_RECAPTCHA_SITE_KEY missing. App Check not initialized in frontend.");
    }
  } catch (err) {
    console.error("[Aura Control Center] Failed to initialize App Check:", err);
  }
}

export const appCheck = appCheckInstance;
import { getFunctions } from "firebase/functions"; 
export const functions = getFunctions(firebaseApp);
