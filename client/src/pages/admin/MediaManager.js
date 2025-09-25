import React from 'react';
import {
  Container,
  Typography,
  Box,
  Alert
} from '@mui/material';

const MediaManager = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1">
          Gestión de Media
        </Typography>
      </Box>

      <Alert severity="info">
        La gestión de archivos multimedia estará disponible cuando el backend esté completamente configurado.
      </Alert>
    </Container>
  );
};

export default MediaManager;