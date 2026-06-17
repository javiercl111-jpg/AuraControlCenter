export const CLIENT_STATUS_OPTIONS = [
    { value: "ACTIVE", label: "Activo" },
    { value: "GRACE_PERIOD", label: "Periodo de gracia" },
    { value: "SUSPENDED", label: "Suspendido" },
    { value: "CANCELLED", label: "Cancelado" },
  ] as const;
  
  export const BILLING_CYCLE_OPTIONS = [
    { value: "MONTHLY", label: "Mensual" },
    { value: "YEARLY", label: "Anual" },
  ] as const;
  
  export const PLAN_OPTIONS = [
    { value: "HCM_BASIC", label: "Aura HCM Básico" },
    { value: "HCM_PROFESSIONAL", label: "Aura HCM Professional" },
    { value: "HCM_ENTERPRISE", label: "Aura HCM Enterprise" },
    { value: "MAINTENANCE_PILOT_STARTER", label: "Maintenance Pilot Starter" },
    {
      value: "MAINTENANCE_PILOT_PROFESSIONAL",
      label: "Maintenance Pilot Professional",
    },
    {
      value: "MAINTENANCE_PILOT_ENTERPRISE",
      label: "Maintenance Pilot Enterprise",
    },
  ] as const;
  
  export const MODULE_OPTIONS = [
    { value: "AURA_HCM", label: "Aura HCM" },
    { value: "AURA_MAINTENANCE", label: "Aura Maintenance OS" },
    { value: "AURA_SIGNATURE", label: "Aura Signature" },
    { value: "AURA_INTELLIGENCE", label: "Aura Intelligence" },
  ] as const;