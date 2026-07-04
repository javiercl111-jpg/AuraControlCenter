import { useEffect, useMemo, useState } from "react";

import AuraDossier from "../components/consulting/AuraDossier";
import ConsultingHeader from "../components/consulting/ConsultingHeader";
import ConsultingKPIs from "../components/consulting/ConsultingKPIs";
import DiscoveryInbox from "../components/consulting/DiscoveryInbox";
import OrganizationBoard from "../components/consulting/OrganizationBoard";

import {
  convertDiscoveryRequestToOrganization,
  discardDiscoveryRequest,
  getDiscoveryRequests,
  getOrganizations,
  updateOrganizationStage,
} from "../services/consultingOrganizationService";

import type {
  ConsultingStage,
  PlatformDiscoveryRequest,
  PlatformOrganization,
} from "../types/platformOrganization";

const STAGES: { value: ConsultingStage; label: string }[] = [
  { value: "DISCOVERY", label: "Descubrir" },
  { value: "DIAGNOSIS", label: "Comprender" },
  { value: "SOLUTION", label: "Diseñar" },
  { value: "DEMO", label: "Presentar" },
  { value: "PROPOSAL", label: "Propuesta" },
  { value: "IMPLEMENTATION", label: "Implementar" },
  { value: "SUCCESS", label: "Crecer" },
  { value: "AMBASSADOR", label: "Embajador" },
];

export default function ConsultingCenterPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [discoveryRequests, setDiscoveryRequests] = useState<
    PlatformDiscoveryRequest[]
  >([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<PlatformOrganization | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const stageCounters = useMemo(() => {
    return STAGES.map((stage) => ({
      ...stage,
      count: organizations.filter((item) => item.stage === stage.value).length,
    }));
  }, [organizations]);

  async function loadConsultingData() {
    try {
      setError("");

      const [organizationsData, discoveryRequestsData] = await Promise.all([
        getOrganizations(),
        getDiscoveryRequests(),
      ]);

      setOrganizations(organizationsData);
      setDiscoveryRequests(discoveryRequestsData);

      if (!selectedOrganization && organizationsData.length > 0) {
        setSelectedOrganization(organizationsData[0]);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar Aura Consulting Center.");
    }
  }

  useEffect(() => {
    loadConsultingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConvertDiscoveryRequest(
    request: PlatformDiscoveryRequest
  ) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const organizationId = await convertDiscoveryRequestToOrganization(
        request
      );

      setSuccessMessage("Solicitud convertida en organización correctamente.");

      await loadConsultingData();

      const createdOrganization = organizations.find(
        (organization) => organization.id === organizationId
      );

      if (createdOrganization) {
        setSelectedOrganization(createdOrganization);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo comenzar el diagnóstico.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDiscardDiscoveryRequest(requestId: string) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await discardDiscoveryRequest(requestId);
      setSuccessMessage("Solicitud descartada correctamente.");
      await loadConsultingData();
    } catch (err) {
      console.error(err);
      setError("No se pudo descartar la solicitud.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStageChange(
    organization: PlatformOrganization,
    stage: ConsultingStage
  ) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await updateOrganizationStage(organization.id, stage);

      const updated = {
        ...organization,
        stage,
      };

      setSelectedOrganization(updated);
      setSuccessMessage("Etapa actualizada correctamente.");

      await loadConsultingData();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar la etapa.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <ConsultingHeader />

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
          {successMessage}
        </div>
      )}

      <ConsultingKPIs
        organizations={organizations}
        discoveryRequests={discoveryRequests}
      />

      <DiscoveryInbox
        discoveryRequests={discoveryRequests}
        isLoading={isLoading}
        onConvert={handleConvertDiscoveryRequest}
        onDiscard={handleDiscardDiscoveryRequest}
      />

      <section className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <OrganizationBoard
            organizations={organizations}
            selectedOrganization={selectedOrganization}
            isLoading={isLoading}
            onSelectOrganization={setSelectedOrganization}
            onStageChange={handleStageChange}
          />
        </div>

        <aside className="xl:col-span-5">
          <AuraDossier
            selectedOrganization={selectedOrganization}
            stageCounters={stageCounters}
          />
        </aside>
      </section>
    </div>
  );
}