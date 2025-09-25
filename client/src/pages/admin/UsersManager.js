import React from 'react';
import {
  Container,
  Typography,
  Box,
  Alert
} from '@mui/material';

const UsersManager = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1">
          Gestión de Usuarios
        </Typography>
      </Box>

      <Alert severity="info">
        La gestión de usuarios estará disponible cuando el backend esté completamente configurado.
      </Alert>
    </Container>
  );
};

export default UsersManager;