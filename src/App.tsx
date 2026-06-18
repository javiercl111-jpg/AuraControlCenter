import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

import BillingPage from "./pages/BillingPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ClientEditPage from "./pages/ClientEditPage";
import ClientsPage from "./pages/ClientsPage";
import CommissionsPage from "./pages/CommissionsPage";
import CrmPage from "./pages/CrmPage";
import DashboardPage from "./pages/DashboardPage";
import LicenseManagementPage from "./pages/LicenseManagementPage";
import LoginPage from "./pages/LoginPage";
import ModulesPage from "./pages/ModulesPage";
import PaymentsPage from "./pages/PaymentsPage";
import PlansPage from "./pages/PlansPage";
import SalesAdvisorsPage from "./pages/SalesAdvisorsPage";
import SettingsPage from "./pages/SettingsPage";
import TenantEnforcementPage from "./pages/TenantEnforcementPage";
import TenantsPage from "./pages/TenantsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="crm" element={<CrmPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId" element={<ClientDetailPage />} />
        <Route path="clients/:clientId/edit" element={<ClientEditPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="licenses" element={<LicenseManagementPage />} />
        <Route path="commissions" element={<CommissionsPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenant-enforcement" element={<TenantEnforcementPage />} />
        <Route path="sales-advisors" element={<SalesAdvisorsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}