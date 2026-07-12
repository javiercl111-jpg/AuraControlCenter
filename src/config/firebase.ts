import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    __AURA_APP_CHECK__?: AppCheck;
  }
}

function readRequiredEnv(name: string): string {
  const rawValue = import.meta.env[name] as string | undefined;
  const normalizedValue = rawValue?.trim();

  if (!normalizedValue) {
    throw new Error(`FIREBASE_CONFIGURATION_MISSING:${name}`);
  }

  return normalizedValue;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: readRequiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readRequiredEnv(
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
  ),
  appId: readRequiredEnv("VITE_FIREBASE_APP_ID"),
};

if (!firebaseConfig.apiKey?.startsWith("AIza")) {
  throw new Error("FIREBASE_CONFIGURATION_INVALID:API_KEY_FORMAT");
}

if (import.meta.env.DEV) {
  console.info("[Firebase Config Check]", {
    hasApiKey: Boolean(firebaseConfig.apiKey),
    apiKeyLength: firebaseConfig.apiKey?.length ?? 0,
    apiKeyPrefixValid: firebaseConfig.apiKey?.startsWith("AIza") ?? false,
    projectId: firebaseConfig.projectId,
    hasAppId: Boolean(firebaseConfig.appId),
  });
}

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp, "us-central1");

function initializeAuraAppCheck(): AppCheck | null {
  if (typeof window === "undefined") {
    return null;
  }

  const siteKey = (
    import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
  )?.trim();

  if (!siteKey) {
    console.warn(
      "[Aura Control Center] APP_CHECK_CONFIGURATION_REQUIRED: " +
      "VITE_RECAPTCHA_SITE_KEY is missing.",
    );
    return null;
  }

  if (import.meta.env.DEV) {
    const debugToken = (
      import.meta.env
        .VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined
    )?.trim();

    window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
  }

  if (window.__AURA_APP_CHECK__) {
    return window.__AURA_APP_CHECK__;
  }

  try {
    const instance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });

    window.__AURA_APP_CHECK__ = instance;
    return instance;
  } catch (error) {
    console.error(
      "[Aura Control Center] Failed to initialize App Check.",
      error,
    );
    return null;
  }
}

export const appCheck = initializeAuraAppCheck();