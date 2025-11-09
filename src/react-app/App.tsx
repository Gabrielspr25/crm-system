import { BrowserRouter as Router, Routes, Route } from "react-router";
import Layout from "@/react-app/components/Layout";
import ClientsPage from "@/react-app/pages/Clients";
import FollowUpPage from "@/react-app/pages/FollowUp";
import ReportsPage from "@/react-app/pages/Reports";
import VendorsPage from "@/react-app/pages/Vendors";

import GoalsPage from "@/react-app/pages/Goals";
import CategoriesPage from "@/react-app/pages/Categories";
import ProductsPage from "@/react-app/pages/Products";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ClientsPage />} />
          <Route path="/seguimiento" element={<FollowUpPage />} />
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="/vendedores" element={<VendorsPage />} />
          <Route path="/metas" element={<GoalsPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/productos" element={<ProductsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
