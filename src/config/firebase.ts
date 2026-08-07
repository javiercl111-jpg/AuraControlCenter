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
  resolveClientFirebaseBootstrapV1,
  type ClientFirebaseBootstrapConfigurationV1,
} from "./clientFirebaseBootstrapV1";

declare global {
  interface Window {
    __AURA_APP_CHECK__?: AppCheck;
  }
}

const clientFirebaseConfiguration = resolveClientFirebaseBootstrapV1(
  {
    VITE_AURA_RUNTIME_ENVIRONMENT:
      import.meta.env.VITE_AURA_RUNTIME_ENVIRONMENT,
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_MESSAGING_SENDER_ID:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_RECAPTCHA_SITE_KEY: import.meta.env.VITE_RECAPTCHA_SITE_KEY,
  },
  typeof window === "undefined" ? undefined : window.location.hostname,
);

export const clientRuntimeEnvironment = clientFirebaseConfiguration.environment;

const firebaseConfig: FirebaseOptions = {
  apiKey: clientFirebaseConfiguration.apiKey,
  authDomain: clientFirebaseConfiguration.authDomain,
  projectId: clientFirebaseConfiguration.projectId,
  messagingSenderId: clientFirebaseConfiguration.messagingSenderId,
  appId: clientFirebaseConfiguration.appId,
};

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(
  firebaseApp,
  clientFirebaseConfiguration.functionsRegion,
);

function initializeAuraAppCheck(
  clientConfiguration: ClientFirebaseBootstrapConfigurationV1,
): AppCheck | null {
  if (
    typeof window === "undefined" ||
    clientConfiguration.environment !== "PREVIEW" ||
    !clientConfiguration.appCheckEnabled
  ) {
    return null;
  }

  const configuration = resolvePreviewAppCheckConfigurationV1({
    VITE_AURA_RUNTIME_ENVIRONMENT: clientConfiguration.environment,
    VITE_FIREBASE_PROJECT_ID: clientConfiguration.projectId,
    VITE_RECAPTCHA_SITE_KEY: clientConfiguration.recaptchaSiteKey,
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

export const appCheck = initializeAuraAppCheck(clientFirebaseConfiguration);
