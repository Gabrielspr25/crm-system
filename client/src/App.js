import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthContext } from './contexts/AuthContext';
import { momvisionColors } from './theme/colors';

// Layouts
import PublicLayout from './components/layouts/PublicLayout';
import AdminLayout from './components/layouts/AdminLayout';

// Páginas públicas
import HomePage from './pages/public/HomePage';
import SectionPage from './pages/public/SectionPage';
import LoginPage from './pages/auth/LoginPage';

// Páginas del admin
import Dashboard from './pages/admin/Dashboard';
import SectionsManager from './pages/admin/SectionsManager';
import SectionEditor from './pages/admin/SectionEditor';
import MediaManager from './pages/admin/MediaManager';
import UsersManager from './pages/admin/UsersManager';
import Settings from './pages/admin/Settings';

// Componente de ruta protegida
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box 
      sx={{
        minHeight: '100vh',
        background: momvisionColors.backgrounds.gradient,
        // Alternativas de fondo:
        // background: momvisionColors.backgrounds.main, // Fondo sólido blanco
        // background: `linear-gradient(45deg, ${momvisionColors.primary.light} 0%, ${momvisionColors.secondary.light} 100%)`,
        // backgroundImage: 'url(/path/to/background-image.jpg)', // Imagen de fondo
        // backgroundColor: '#f5f7fa' // Color sólido
      }}
    >
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={
          user ? <Navigate to="/admin" replace /> : <LoginPage />
        } />
        
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="seccion/:slug" element={<SectionPage />} />
        </Route>
        
        {/* Rutas del administrador */}
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="secciones" element={<SectionsManager />} />
          <Route path="secciones/nueva" element={<SectionEditor />} />
          <Route path="secciones/:id/editar" element={<SectionEditor />} />
          <Route path="media" element={<MediaManager />} />
          <Route path="usuarios" element={<UsersManager />} />
          <Route path="configuracion" element={<Settings />} />
        </Route>
        
        {/* Redirecciones */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}

export default App;