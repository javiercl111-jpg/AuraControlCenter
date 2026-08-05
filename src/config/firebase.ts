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
import {
  PreviewAppCheckContractErrorV1,
  resolvePreviewAppCheckConfigurationV1,
} from "./previewAppCheckContractV1";

declare global {
  interface Window {
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

  const configuration = resolvePreviewAppCheckConfigurationV1({
    VITE_AURA_RUNTIME_ENVIRONMENT:
      import.meta.env.VITE_AURA_RUNTIME_ENVIRONMENT,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY:
      import.meta.env
        .VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY,
  });
  if (!configuration.enabled) {
    return null;
  }

  if (window.__AURA_APP_CHECK__) {
    return window.__AURA_APP_CHECK__;
  }

  try {
    const instance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(configuration.siteKey),
      isTokenAutoRefreshEnabled: true,
    });

    window.__AURA_APP_CHECK__ = instance;
    return instance;
  } catch {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_INITIALIZATION_FAILED",
    );
  }
}

export const appCheck = initializeAuraAppCheck();
