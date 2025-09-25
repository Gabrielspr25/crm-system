import React from 'react';
import {
  Container,
  Typography,
  Box,
  Alert
} from '@mui/material';

const Settings = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1">
          Configuración
        </Typography>
      </Box>

      <Alert severity="info">
        Las opciones de configuración estarán disponibles cuando el backend esté completamente configurado.
      </Alert>
    </Container>
  );
};

export default Settings;