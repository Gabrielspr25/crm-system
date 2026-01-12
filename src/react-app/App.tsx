import { BrowserRouter as Router, Routes, Route } from "react-router";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/react-app/auth/msalConfig";

import ProtectedLayout from "@/react-app/components/ProtectedLayout";
import ClientsPage from "@/react-app/pages/Clients";
import ClientsNew from "@/react-app/pages/ClientsNew"; // <- NUEVO
import FollowUpPage from "@/react-app/pages/FollowUp";
import ReportsPage from "@/react-app/pages/Reports";
import VendorsPage from "@/react-app/pages/Vendors";

import CategoriesPage from "@/react-app/pages/Categories";
import ProductsPage from "@/react-app/pages/Products";
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

// Inicializar MSAL fuera del componente
const msalInstance = new PublicClientApplication(msalConfig);

function ProtectedRoutes() {
  return (
    <ProtectedLayout>
      <SystemHealthButton />
      <Routes>
        <Route path="/" element={<ClientsPage />} />
        <Route path="/clientes" element={<ClientsNew />} /> {/* <- CAMBIAR */}
        <Route path="/seguimiento" element={<FollowUpPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/referidos" element={<ReferidosPage />} />
        <Route path="/correos" element={<CorreosPage />} />
        <Route path="/vendedores" element={<VendorsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/productos" element={<ProductsPage />} />
        <Route path="/metas" element={<GoalsPage />} />
        <Route path="/tarifas" element={<TarifasPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/importador" element={<ImportadorVisual />} />
        <Route path="/historial" element={<AuditLogPage />} />
        <Route path="/system-status" element={<SystemStatus />} />
      </Routes>
    </ProtectedLayout>
  );
}

export default function App() {
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
