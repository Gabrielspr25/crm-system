import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/react-app/auth/msalConfig";

import ProtectedLayout from "@/react-app/components/ProtectedLayout";
import HomePage from "@/react-app/pages/Home";
import MyDayPage from "@/react-app/pages/MyDay";
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
import ImportNew from "@/react-app/pages/ImportNew";
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
import GestionPage from "@/react-app/pages/Gestion";
import MetasDashboard from "@/react-app/pages/MetasDashboard";
import AgentMemoryPage from "@/react-app/pages/AgentMemory";


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
        <Route path="/" element={<HomePage />} />
        <Route path="/panel" element={<HomePage />} />
        <Route path="/mi-dia" element={<MyDayPage />} />
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
        <Route path="/tarifas" element={<Navigate to="/" replace />} />
        <Route path="/campanas" element={<Campaigns />} />
        <Route path="/campanas/nueva" element={<CampaignWizard />} />
        <Route path="/campanas/:id" element={<CampaignDetails />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/importador" element={<ImportadorVisual />} />
        <Route path="/importador-nuevo" element={<ImportNew />} />
        <Route path="/historial" element={<AuditLogPage />} />
        <Route path="/system-status" element={<SystemStatus />} />
        <Route path="/discrepancias" element={<DiscrepanciasFixedPage />} />
        <Route path="/tango" element={<TangoComparePage />} />
        <Route path="/suscriptores-ban" element={<SubscriberBanSync />} />
        <Route path="/voz-cliente" element={<VoiceClientPage />} />
        <Route path="/gestion" element={<GestionPage />} />
        <Route path="/panel-metas" element={<MetasDashboard />} />
        <Route path="/cuartel-agentes" element={<AgentMemoryPage />} />

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
