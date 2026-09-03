import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();

export {
  growthLinkedInRuntimeReadinessV1,
} from "./composition/linkedin/GrowthLinkedInProductionCallableRuntimeV1";