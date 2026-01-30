import { BrowserRouter as Router, Routes, Route } from "react-router";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/react-app/auth/msalConfig";

import ProtectedLayout from "@/react-app/components/ProtectedLayout";
import AgendaPage from "@/react-app/pages/Agenda";
import TasksPage from "@/react-app/pages/Tasks";
import ClientsPage from "@/react-app/pages/Clients";
import FollowUpPage from "@/react-app/pages/FollowUp";
import ReportsPage from "@/react-app/pages/Reports";
import VendorsPage from "@/react-app/pages/Vendors";

import CategoriesPage from "@/react-app/pages/Categories";
import ProductsPage from "@/react-app/pages/Products";
import CommissionTiers from "@/react-app/pages/CommissionTiers";
import ProfilePage from "@/react-app/pages/Profile";
import LoginPage from "@/react-app/pages/Login";
import ImportadorVisual from "@/react-app/pages/ImportadorVisual";
import GoalsPage from "@/react-app/pages/Goals";
import AuditLogPage from "@/react-app/pages/AuditLog";
import ReferidosPage from "@/react-app/pages/Referidos";
import CorreosPage from "@/react-app/pages/Correos";
import TarifasPage from "@/react-app/pages/Tarifas";
import SystemHealthButton from "@/react-app/components/SystemHealthButton";
import SystemStatus from "@/react-app/pages/SystemStatus";
import DiscrepanciasPage from "@/react-app/pages/Discrepancias";


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
      <SystemHealthButton />
      <Routes>
        <Route path="/" element={<AgendaPage />} />
        <Route path="/panel" element={<AgendaPage />} />
        <Route path="/tareas" element={<TasksPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/seguimiento" element={<FollowUpPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/referidos" element={<ReferidosPage />} />
        <Route path="/correos" element={<CorreosPage />} />
        <Route path="/vendedores" element={<VendorsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/productos" element={<ProductsPage />} />
        <Route path="/comisiones" element={<CommissionTiers />} />
        <Route path="/metas" element={<GoalsPage />} />
        <Route path="/tarifas" element={<TarifasPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/importador" element={<ImportadorVisual />} />
        <Route path="/historial" element={<AuditLogPage />} />
        <Route path="/system-status" element={<SystemStatus />} />
        <Route path="/discrepancias" element={<DiscrepanciasPage />} />

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
