import { getApps, initializeApp } from "firebase-admin/app";

import { createCrmLead as createCrmLeadHandler } from "./crm/createCrmLead";
import { growthLinkedInRuntimeReadinessV1 as growthLinkedInRuntimeReadinessV1Handler } from "./composition/linkedin/GrowthLinkedInPreviewCallableRuntimeV1";

import { completeDiscoverySession as completeDiscoverySessionHandler } from
  "./discovery/completeDiscoverySession";
import { createDiscoveryLead as createDiscoveryLeadHandler } from
  "./discovery/createDiscoveryLead";
import { exchangeDiscoveryToken as exchangeDiscoveryTokenHandler } from
  "./discovery/exchangeDiscoveryToken";
import { resolveDiscoverySession as resolveDiscoverySessionHandler } from
  "./discovery/resolveDiscoverySession";
import { evaluateConversation as evaluateConversationHandler } from
  "./intelligence/evaluateConversation";

if (getApps().length === 0) initializeApp();

export const createDiscoveryLead = createDiscoveryLeadHandler;
export const createCrmLead = createCrmLeadHandler;
export const exchangeDiscoveryToken = exchangeDiscoveryTokenHandler;
export const resolveDiscoverySession = resolveDiscoverySessionHandler;
export const evaluateConversation = evaluateConversationHandler;
export const completeDiscoverySession = completeDiscoverySessionHandler;
export const growthLinkedInRuntimeReadinessV1 = growthLinkedInRuntimeReadinessV1Handler;
