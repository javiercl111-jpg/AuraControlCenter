import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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

const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  return process.env[key];
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
};

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

    const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
    if (siteKey) {
      appCheckInstance = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.log("[Aura Control Center] Firebase App Check initialized.");
    } else {
      console.warn("[Aura Control Center] VITE_FIREBASE_APPCHECK_SITE_KEY missing. App Check not initialized in frontend.");
    }
  } catch (err) {
    console.error("[Aura Control Center] Failed to initialize App Check:", err);
  }
}

export const appCheck = appCheckInstance;import { getFunctions } from "firebase/functions"; export const functions = getFunctions(firebaseApp);
