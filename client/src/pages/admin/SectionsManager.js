import React from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Alert
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const SectionsManager = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Gestión de Secciones
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          href="/admin/secciones/nueva"
        >
          Nueva Sección
        </Button>
      </Box>

      <Alert severity="info">
        Esta funcionalidad estará disponible cuando el backend esté completamente configurado.
      </Alert>
    </Container>
  );
};

export default SectionsManager;