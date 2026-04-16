import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/react-app/auth/msalConfig";

import ProtectedLayout from "@/react-app/components/ProtectedLayout";
import TasksPage from "@/react-app/pages/Tasks";
import ClientsPage from "@/react-app/pages/Clients";
import ReportsPage from "@/react-app/pages/Reports";
import VendorsPage from "@/react-app/pages/Vendors";

import CategoriesPage from "@/react-app/pages/Categories";
import UsersPermissionsPage from "@/react-app/pages/UsersPermissions";
import ControlSecurityPage from "@/react-app/pages/ControlSecurity";
import ProductsPage from "@/react-app/pages/Products";
import ProfilePage from "@/react-app/pages/Profile";
import LoginPage from "@/react-app/pages/Login";
import ImportadorVisual from "@/react-app/pages/ImportadorVisual";
import MetasPage from "@/react-app/pages/Metas";
import GoalsConfigPage from "@/react-app/pages/GoalsConfig";
import AuditLogPage from "@/react-app/pages/AuditLog";
import ReferidosPage from "@/react-app/pages/Referidos";
import CorreosPage from "@/react-app/pages/Correos";
import Campaigns from "@/react-app/pages/Campaigns";
import CampaignWizard from "@/react-app/pages/CampaignWizard";
import CampaignDetails from "@/react-app/pages/CampaignDetails";
import SystemTestAgent from "@/react-app/components/SystemTestAgent";
import SystemStatus from "@/react-app/pages/SystemStatus";
import DiscrepanciasFixedPage from "@/react-app/pages/DiscrepanciasFixed";
import TangoComparePage from "@/react-app/pages/TangoCompare";
import SubscriberBanSync from "@/react-app/pages/SubscriberBanSync";
import VoiceClientPage from "@/react-app/pages/VoiceClient";
import FollowUpPage from "@/react-app/pages/FollowUp";


// Inicializar MSAL fuera del componente
// Inicializar MSAL de forma segura
let msalInstance: PublicClientApplication | null = null;
try {
  msalInstance = new PublicClientApplication(msalConfig);
} catch (error) {
  console.error("Error inicializando MSAL:", error);
}

function ProtectedRoutes() {
  return (
    <ProtectedLayout>
      <SystemTestAgent />
      <Routes>
        <Route path="/" element={<ClientsPage />} />
        <Route path="/panel" element={<ClientsPage />} />
        <Route path="/tareas" element={<TasksPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/seguimiento" element={<FollowUpPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/referidos" element={<ReferidosPage />} />
        <Route path="/correos" element={<CorreosPage />} />
        <Route path="/vendedores" element={<VendorsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/usuarios-permisos" element={<UsersPermissionsPage />} />
        <Route path="/control-seguridad" element={<ControlSecurityPage />} />
        <Route path="/productos" element={<ProductsPage />} />
        <Route path="/metas" element={<MetasPage />} />
        <Route path="/metas/configurar" element={<GoalsConfigPage />} />
        <Route path="/tarifas" element={<Navigate to="/" replace />} />
        <Route path="/campanas" element={<Campaigns />} />
        <Route path="/campanas/nueva" element={<CampaignWizard />} />
        <Route path="/campanas/:id" element={<CampaignDetails />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/importador" element={<ImportadorVisual />} />
        <Route path="/historial" element={<AuditLogPage />} />
        <Route path="/system-status" element={<SystemStatus />} />
        <Route path="/discrepancias" element={<DiscrepanciasFixedPage />} />
        <Route path="/tango" element={<TangoComparePage />} />
        <Route path="/suscriptores-ban" element={<SubscriberBanSync />} />
        <Route path="/voz-cliente" element={<VoiceClientPage />} />

      </Routes>
    </ProtectedLayout>
  );
}

export default function App() {
  if (!msalInstance) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </Router>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </Router>
    </MsalProvider>
  );
}
