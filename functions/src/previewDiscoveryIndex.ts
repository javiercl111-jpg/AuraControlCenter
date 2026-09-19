import { getApps, initializeApp } from "firebase-admin/app";

import { createCrmLead as createCrmLeadHandler } from "./crm/createCrmLead";
import { growthLinkedInRuntimeReadinessV1 as growthLinkedInRuntimeReadinessV1Handler } from "./composition/linkedin/GrowthLinkedInPreviewCallableRuntimeV1";
import { growthLinkedInOrganizationAccessV1 as growthLinkedInOrganizationAccessV1Handler } from "./composition/linkedin/GrowthLinkedInPreviewOrganizationAccessCallableRuntimeV1";
import { growthSocialProfileManagementV1 as growthSocialProfileManagementV1Handler } from "./composition/socialProfiles/GrowthSocialProfileManagementPreviewCallableRuntimeV1";
import { evaluateExecutiveDiscoveryV1 as evaluateExecutiveDiscoveryV1Handler } from "./discovery/executive-intelligence/receiver/evaluateExecutiveDiscoveryV1";

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
export const evaluateExecutiveDiscoveryV1 = evaluateExecutiveDiscoveryV1Handler;
export const growthLinkedInRuntimeReadinessV1 = growthLinkedInRuntimeReadinessV1Handler;
export const growthLinkedInOrganizationAccessV1 = growthLinkedInOrganizationAccessV1Handler;
export const growthSocialProfileManagementV1 = growthSocialProfileManagementV1Handler;
