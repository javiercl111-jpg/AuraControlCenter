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
import {
  assertPreviewClientDomainV1,
  resolvePreviewClientConfigurationV1,
} from "./previewClientConfigurationV1";

declare global {
  interface Window {
    __AURA_APP_CHECK__?: AppCheck;
  }
}

const previewClientConfiguration = resolvePreviewClientConfigurationV1({
  VITE_AURA_RUNTIME_ENVIRONMENT:
    import.meta.env.VITE_AURA_RUNTIME_ENVIRONMENT,
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_MESSAGING_SENDER_ID:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_RECAPTCHA_SITE_KEY: import.meta.env.VITE_RECAPTCHA_SITE_KEY,
});

if (typeof window !== "undefined") {
  assertPreviewClientDomainV1(window.location.hostname);
}

const firebaseConfig: FirebaseOptions = {
  apiKey: previewClientConfiguration.apiKey,
  authDomain: previewClientConfiguration.authDomain,
  projectId: previewClientConfiguration.projectId,
  messagingSenderId: previewClientConfiguration.messagingSenderId,
  appId: previewClientConfiguration.appId,
};

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(
  firebaseApp,
  previewClientConfiguration.functionsRegion,
);

function initializeAuraAppCheck(): AppCheck | null {
  if (typeof window === "undefined") {
    return null;
  }

  const configuration = resolvePreviewAppCheckConfigurationV1({
    VITE_AURA_RUNTIME_ENVIRONMENT: previewClientConfiguration.environment,
    VITE_FIREBASE_PROJECT_ID: previewClientConfiguration.projectId,
    VITE_RECAPTCHA_SITE_KEY: previewClientConfiguration.recaptchaSiteKey,
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
