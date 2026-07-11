import { Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

import BillingPage from "./pages/BillingPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ClientEditPage from "./pages/ClientEditPage";
import ClientsPage from "./pages/ClientsPage";
import CommissionsPage from "./pages/CommissionsPage";
import ConsultingCenterPage from "./pages/ConsultingCenterPage";
import CrmPage from "./pages/CrmPage";
import DashboardPage from "./pages/DashboardPage";
import LicenseManagementPage from "./pages/LicenseManagementPage";
import LoginPage from "./pages/LoginPage";
import MarketIntelligencePage from "./pages/MarketIntelligencePage";
import ModulesPage from "./pages/ModulesPage";
import PaymentsPage from "./pages/PaymentsPage";
import PlansPage from "./pages/PlansPage";
import PricingEnginePage from "./pages/PricingEnginePage";
import ReportsPage from "./pages/ReportsPage";
import SalesAdvisorsPage from "./pages/SalesAdvisorsPage";
import SettingsPage from "./pages/SettingsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import TenantEnforcementPage from "./pages/TenantEnforcementPage";
import TenantsPage from "./pages/TenantsPage";
import DiscoverPage from "./pages/DiscoverPage";
import ExecutiveIntakeSmokeTestPage from "./pages/dev/ExecutiveIntakeSmokeTestPage";
import PublicNotFoundPage from "./pages/PublicNotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/discover/advisor/:commercialCode" element={<DiscoverPage />} />
      <Route path="/discover/:linkId" element={<DiscoverPage />} />

      {import.meta.env.DEV && (
        <Route path="/dev/executive-intake-smoke-test" element={<ExecutiveIntakeSmokeTestPage />} />
      )}

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="consulting" element={<ConsultingCenterPage />} />
        <Route path="crm" element={<CrmPage />} />
        <Route path="pricing" element={<PricingEnginePage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId" element={<ClientDetailPage />} />
        <Route path="clients/:clientId/edit" element={<ClientEditPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="market-intelligence" element={<MarketIntelligencePage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="licenses" element={<LicenseManagementPage />} />
        <Route path="commissions" element={<CommissionsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenant-enforcement" element={<TenantEnforcementPage />} />
        <Route path="sales-advisors" element={<SalesAdvisorsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<PublicNotFoundPage />} />
    </Routes>
  );
}