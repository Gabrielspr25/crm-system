import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/react-app/auth/msalConfig";

import ProtectedLayout from "@/react-app/components/ProtectedLayout";
import HomePage from "@/react-app/pages/Home";
import MyDayPage from "@/react-app/pages/MyDay";
import MyDayV2Page from "@/react-app/pages/MyDayV2";
import DirectorPage from "@/react-app/pages/Director";
import ClientsPage from "@/react-app/pages/Clients";
import ReportsPage from "@/react-app/pages/Reports";
import VendorsPage from "@/react-app/pages/Vendors";

import CategoriesPage from "@/react-app/pages/Categories";
import UsersPermissionsPage from "@/react-app/pages/UsersPermissions";
import ControlSecurityPage from "@/react-app/pages/ControlSecurity";
import ProductsPage from "@/react-app/pages/Products";
import ProfilePage from "@/react-app/pages/Profile";
import LoginPage from "@/react-app/pages/Login";
import ImportNew from "@/react-app/pages/ImportNew";
import AuditLogPage from "@/react-app/pages/AuditLog";
import CorreosPage from "@/react-app/pages/Correos";
import Campaigns from "@/react-app/pages/Campaigns";
import CampaignWizard from "@/react-app/pages/CampaignWizard";
import CampaignDetails from "@/react-app/pages/CampaignDetails";
import SystemTestAgent from "@/react-app/components/SystemTestAgent";
import SystemStatus from "@/react-app/pages/SystemStatus";
import TangoComparePage from "@/react-app/pages/TangoCompare";
import SubscriberBanSync from "@/react-app/pages/SubscriberBanSync";
import VoiceClientPage from "@/react-app/pages/VoiceClient";
import FollowUpPage from "@/react-app/pages/FollowUp";
import GestionPage from "@/react-app/pages/Gestion";
import MetasDashboard from "@/react-app/pages/MetasDashboard";
import MetasAdmin from "@/react-app/pages/MetasAdmin";
import OcrImportPreview from "@/react-app/pages/OcrImportPreview";


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
        {/* /panel y /director apuntan al nuevo Panel Director (Fase 2).
            HomePage viejo solo accesible vía / hasta validar reemplazo total. */}
        <Route path="/panel" element={<DirectorPage />} />
        <Route path="/mi-dia" element={<MyDayPage />} />
        <Route path="/mi-dia-v2" element={<MyDayV2Page />} />
        <Route path="/director" element={<DirectorPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/seguimiento" element={<FollowUpPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
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
        <Route path="/importador-nuevo" element={<ImportNew />} />
        <Route path="/historial" element={<AuditLogPage />} />
        <Route path="/system-status" element={<SystemStatus />} />
        <Route path="/tango" element={<TangoComparePage />} />
        <Route path="/suscriptores-ban" element={<SubscriberBanSync />} />
        <Route path="/voz-cliente" element={<VoiceClientPage />} />
        <Route path="/gestion" element={<GestionPage />} />
        <Route path="/panel-metas" element={<MetasDashboard />} />
        <Route path="/admin/metas" element={<MetasAdmin />} />
        <Route path="/ocr-preview" element={<OcrImportPreview />} />

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
