import { BrowserRouter as Router, Routes, Route } from "react-router";
import ProtectedLayout from "@/react-app/components/ProtectedLayout";
import ClientsPage from "@/react-app/pages/Clients";
import FollowUpPage from "@/react-app/pages/FollowUp";
import ReportsPage from "@/react-app/pages/Reports";
import VendorsPage from "@/react-app/pages/Vendors";

import CategoriesPage from "@/react-app/pages/Categories";
import ProductsPage from "@/react-app/pages/Products";
import ProfilePage from "@/react-app/pages/Profile";
import LoginPage from "@/react-app/pages/Login";
function ProtectedRoutes() {
  return (
    <ProtectedLayout>
      <Routes>
        <Route path="/" element={<ClientsPage />} />
        <Route path="/seguimiento" element={<FollowUpPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/vendedores" element={<VendorsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/productos" element={<ProductsPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
      </Routes>
    </ProtectedLayout>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </Router>
  );
}
