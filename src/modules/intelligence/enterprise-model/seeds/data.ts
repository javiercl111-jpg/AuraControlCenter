export const INDUSTRY_SEEDS: Record<string, { id: string; name: string }[]> = {
  hospitality: [
    { id: 'dom_hosp_front_desk', name: 'Front Desk' },
    { id: 'dom_hosp_reservations', name: 'Reservations' },
    { id: 'dom_hosp_housekeeping', name: 'Housekeeping' },
    { id: 'dom_hosp_maintenance', name: 'Maintenance' },
    { id: 'dom_hosp_guest_experience', name: 'Guest Experience' },
    { id: 'dom_hosp_food_beverage', name: 'Food and Beverage' },
    { id: 'dom_hosp_workforce', name: 'Workforce' },
    { id: 'dom_hosp_administration', name: 'Administration' },
  ],
  manufacturing: [
    { id: 'dom_mfg_production', name: 'Production Line' },
    { id: 'dom_mfg_supply_chain', name: 'Supply Chain' },
    { id: 'dom_mfg_maintenance', name: 'Equipment Maintenance' },
    { id: 'dom_mfg_quality_control', name: 'Quality Control' },
  ],
  retail: [
    { id: 'dom_ret_inventory', name: 'Inventory Management' },
    { id: 'dom_ret_pos', name: 'Point of Sale' },
    { id: 'dom_ret_customer_service', name: 'Customer Service' },
    { id: 'dom_ret_logistics', name: 'Logistics' },
  ],
  professional_services: [
    { id: 'dom_ps_client_management', name: 'Client Management' },
    { id: 'dom_ps_billing', name: 'Billing and Invoicing' },
    { id: 'dom_ps_resource_allocation', name: 'Resource Allocation' },
  ],
};
