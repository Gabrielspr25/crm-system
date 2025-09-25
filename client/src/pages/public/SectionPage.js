import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getSectionBySlug } from '../../services/sections';

const SectionPage = () => {
  const { slug } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['section', slug],
    queryFn: () => getSectionBySlug(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">
          Error cargando la sección: {error.message}
        </Alert>
      </Container>
    );
  }

  const section = data?.data?.section;

  if (!section) {
    return (
      <Container maxWidth="lg">
        <Alert severity="warning">
          Sección no encontrada
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          {section.title}
        </Typography>
        
        {section.fields && section.fields.length > 0 && (
          <Box sx={{ mt: 4 }}>
            {section.fields.map((field, index) => (
              <Box key={index} sx={{ mb: 3 }}>
                {field.type === 'text' && (
                  <Typography variant="body1">
                    {field.value}
                  </Typography>
                )}
                
                {field.type === 'richtext' && (
                  <Box 
                    sx={{ '& > *': { mb: 2 } }}
                    dangerouslySetInnerHTML={{ __html: field.value }}
                  />
                )}
                
                {field.type === 'image' && field.value && (
                  <Box 
                    component="img"
                    src={field.value}
                    alt={field.name}
                    sx={{ 
                      maxWidth: '100%', 
                      height: 'auto',
                      borderRadius: 1 
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}

        {(!section.fields || section.fields.length === 0) && (
          <Typography variant="body1" color="text.secondary">
            Esta sección aún no tiene contenido configurado.
          </Typography>
        )}
      </Box>
    </Container>
  );
};

export default SectionPage;