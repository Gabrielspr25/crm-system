import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button
} from '@mui/material';

const HomePage = () => {
  return (
    <Container maxWidth="lg">
      {/* BANNER CONFIGURABLE */}
      <Box 
        sx={{ 
          textAlign: 'center', 
          mb: 6,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 8,
          px: 4,
          borderRadius: 3,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}
      >
        <Typography variant="h1" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          MOM Vision
        </Typography>
        <Typography variant="h4" component="h2" sx={{ mb: 3, opacity: 0.9 }}>
          Tecnología e Innovación
        </Typography>
        <Typography variant="h6" sx={{ maxWidth: '800px', mx: 'auto', opacity: 0.8 }}>
          Transforma tu negocio con nuestras soluciones innovadoras. 
          Explora nuestras secciones dinámicas y descubre el futuro de la tecnología.
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button 
            variant="contained" 
            size="large" 
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.2)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
            }}
          >
            Descubre Más
          </Button>
        </Box>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Tecnología
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Descubre las últimas innovaciones y avances tecnológicos.
              </Typography>
              <Button variant="outlined" sx={{ mt: 2 }}>
                Explorar
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Innovación
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Conoce nuestros proyectos de innovación y desarrollo.
              </Typography>
              <Button variant="outlined" sx={{ mt: 2 }}>
                Explorar
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Recursos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Accede a documentación, guías y recursos adicionales.
              </Typography>
              <Button variant="outlined" sx={{ mt: 2 }}>
                Explorar
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="h4" component="h2" gutterBottom>
          ¿Eres administrador?
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Accede al panel de administración para gestionar el contenido
        </Typography>
        <Button 
          variant="contained" 
          size="large"
          href="/admin"
        >
          Panel de Administración
        </Button>
      </Box>
    </Container>
  );
};

export default HomePage;