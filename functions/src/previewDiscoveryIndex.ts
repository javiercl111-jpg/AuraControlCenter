import { getApps, initializeApp } from "firebase-admin/app";

import { completeDiscoverySession as completeDiscoverySessionHandler } from
  "./discovery/completeDiscoverySession";
import { createDiscoveryLead as createDiscoveryLeadHandler } from
  "./discovery/createDiscoveryLead";
import {
  bindPreviewDiscoverySecretResourcesV1,
} from "./discovery/deployment/previewDiscoveryDeploymentUnitV1";
import { exchangeDiscoveryToken as exchangeDiscoveryTokenHandler } from
  "./discovery/exchangeDiscoveryToken";
import { resolveDiscoverySession as resolveDiscoverySessionHandler } from
  "./discovery/resolveDiscoverySession";
import { evaluateConversation as evaluateConversationHandler } from
  "./intelligence/evaluateConversation";

if (getApps().length === 0) initializeApp();

export const createDiscoveryLead = bindPreviewDiscoverySecretResourcesV1(
  "createDiscoveryLead",
  createDiscoveryLeadHandler,
);
export const exchangeDiscoveryToken = bindPreviewDiscoverySecretResourcesV1(
  "exchangeDiscoveryToken",
  exchangeDiscoveryTokenHandler,
);
export const resolveDiscoverySession = bindPreviewDiscoverySecretResourcesV1(
  "resolveDiscoverySession",
  resolveDiscoverySessionHandler,
);
export const evaluateConversation = bindPreviewDiscoverySecretResourcesV1(
  "evaluateConversation",
  evaluateConversationHandler,
);
export const completeDiscoverySession = bindPreviewDiscoverySecretResourcesV1(
  "completeDiscoverySession",
  completeDiscoverySessionHandler,
);
