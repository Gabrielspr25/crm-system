import React, { useContext } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Article as ArticleIcon,
  Image as ImageIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { AuthContext } from '../../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useContext(AuthContext);

  const stats = [
    {
      title: 'Secciones Totales',
      value: '12',
      icon: <ArticleIcon />,
      color: '#1976d2'
    },
    {
      title: 'Secciones Publicadas',
      value: '8',
      icon: <TrendingUpIcon />,
      color: '#2e7d32'
    },
    {
      title: 'Archivos de Media',
      value: '45',
      icon: <ImageIcon />,
      color: '#ed6c02'
    },
    {
      title: 'Usuarios',
      value: '3',
      icon: <PeopleIcon />,
      color: '#9c27b0'
    }
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Bienvenido de nuevo, {user?.name}
        </Typography>
      </Box>

      {/* Estadísticas */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: stat.color, mr: 2 }}>
                    {stat.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h4" component="div">
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Acciones rápidas */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Acciones Rápidas
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button 
                variant="contained" 
                startIcon={<ArticleIcon />}
                href="/admin/secciones/nueva"
              >
                Nueva Sección
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<ImageIcon />}
                href="/admin/media"
              >
                Gestionar Media
              </Button>
              {user?.role === 'admin' && (
                <Button 
                  variant="outlined" 
                  startIcon={<PeopleIcon />}
                  href="/admin/usuarios"
                >
                  Gestionar Usuarios
                </Button>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Información del Sistema
            </Typography>
            <Box sx={{ '& > *': { mb: 1 } }}>
              <Typography variant="body2">
                <strong>Versión:</strong> 1.0.0
              </Typography>
              <Typography variant="body2">
                <strong>Usuario:</strong> {user?.name} ({user?.role})
              </Typography>
              <Typography variant="body2">
                <strong>Último acceso:</strong> {new Date().toLocaleDateString()}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;