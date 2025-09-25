import React from 'react';
import {
  Container,
  Typography,
  Box,
  Alert
} from '@mui/material';

const SectionEditor = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1">
          Editor de Secciones
        </Typography>
      </Box>

      <Alert severity="info">
        El editor de secciones dinámicas estará disponible cuando el backend esté completamente configurado.
      </Alert>
    </Container>
  );
};

export default SectionEditor;