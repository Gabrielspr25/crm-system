import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  Chip,
  ColorPicker,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Save, Preview, Refresh } from '@mui/icons-material';

const VisualSettings = () => {
  const [tabValue, setTabValue] = useState(0);
  const [config, setConfig] = useState({
    // Configuración del banner
    banner: {
      title: 'MOM Vision',
      subtitle: 'Tecnología e Innovación',
      description: 'Transforma tu negocio con nuestras soluciones innovadoras',
      background: 'gradient',
      customGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textColor: '#ffffff',
      buttonText: 'Descubre Más',
      showButton: true
    },
    
    // Configuración de colores
    colors: {
      primary: '#5a67d8',
      secondary: '#6b46c1',
      background: '#ffffff',
      surface: '#f7fafc',
      text: '#2d3748',
      accent: '#4299e1'
    },
    
    // Configuración de secciones
    sections: {
      defaultBackground: '#f8f9fa',
      borderRadius: 8,
      spacing: 24,
      animation: true
    }
  });

  const backgroundOptions = [
    { value: 'solid', label: 'Color Sólido' },
    { value: 'gradient', label: 'Gradiente' },
    { value: 'image', label: 'Imagen' },
    { value: 'pattern', label: 'Patrón' }
  ];

  const gradientPresets = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  ];

  const handleSave = () => {
    // Aquí se guardaría la configuración
    console.log('Configuración guardada:', config);
    alert('¡Configuración guardada exitosamente!');
  };

  const handlePreview = () => {
    // Aquí se abriría una vista previa
    window.open('/', '_blank');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          🎨 Configuración Visual
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Preview />}
            onClick={handlePreview}
            sx={{ mr: 2 }}
          >
            Vista Previa
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
          >
            Guardar Cambios
          </Button>
        </Box>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="🖼️ Banner Principal" />
          <Tab label="🎨 Colores" />
          <Tab label="📄 Fondo de Página" />
          <Tab label="🎯 Secciones" />
        </Tabs>

        {/* TAB 1: CONFIGURACIÓN DEL BANNER */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuración del Banner Principal
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Título Principal"
                  value={config.banner.title}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    banner: { ...prev.banner, title: e.target.value }
                  }))}
                  margin="normal"
                />
                
                <TextField
                  fullWidth
                  label="Subtítulo"
                  value={config.banner.subtitle}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    banner: { ...prev.banner, subtitle: e.target.value }
                  }))}
                  margin="normal"
                />
                
                <TextField
                  fullWidth
                  label="Descripción"
                  multiline
                  rows={3}
                  value={config.banner.description}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    banner: { ...prev.banner, description: e.target.value }
                  }))}
                  margin="normal"
                />
                
                <TextField
                  fullWidth
                  label="Texto del Botón"
                  value={config.banner.buttonText}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    banner: { ...prev.banner, buttonText: e.target.value }
                  }))}
                  margin="normal"
                />
                
                <FormControlLabel
                  control={
                    <Switch 
                      checked={config.banner.showButton}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        banner: { ...prev.banner, showButton: e.target.checked }
                      }))}
                    />
                  }
                  label="Mostrar Botón"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Vista Previa del Banner
                </Typography>
                <Card
                  sx={{
                    background: config.banner.customGradient,
                    color: config.banner.textColor,
                    p: 4,
                    textAlign: 'center',
                    minHeight: 200
                  }}
                >
                  <Typography variant="h4" gutterBottom>
                    {config.banner.title}
                  </Typography>
                  <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                    {config.banner.subtitle}
                  </Typography>
                  <Typography sx={{ mb: 3, opacity: 0.8 }}>
                    {config.banner.description}
                  </Typography>
                  {config.banner.showButton && (
                    <Button variant="contained" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                      {config.banner.buttonText}
                    </Button>
                  )}
                </Card>
                
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Gradientes Predefinidos:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {gradientPresets.map((gradient, index) => (
                    <Chip
                      key={index}
                      label={`Gradiente ${index + 1}`}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        banner: { ...prev.banner, customGradient: gradient }
                      }))}
                      sx={{
                        background: gradient,
                        color: 'white',
                        '&:hover': { opacity: 0.8 }
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 2: CONFIGURACIÓN DE COLORES */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuración de Colores
            </Typography>
            
            <Grid container spacing={3}>
              {Object.entries(config.colors).map(([key, color]) => (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1')}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: color,
                          border: '2px solid #ddd',
                          borderRadius: 1
                        }}
                      />
                      <TextField
                        size="small"
                        value={color}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          colors: { ...prev.colors, [key]: e.target.value }
                        }))}
                      />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
            
            <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
              Vista Previa de Colores
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              {Object.entries(config.colors).map(([key, color]) => (
                <Card key={key} sx={{ minWidth: 120, textAlign: 'center', p: 2 }}>
                  <Box
                    sx={{
                      width: '100%',
                      height: 60,
                      bgcolor: color,
                      borderRadius: 1,
                      mb: 1
                    }}
                  />
                  <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                    {key}
                  </Typography>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* TAB 3: FONDO DE PÁGINA */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuración del Fondo de Página
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Tipo de Fondo</InputLabel>
              <Select value="gradient" label="Tipo de Fondo">
                {backgroundOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary">
              💡 <strong>Instrucciones:</strong><br/>
              • <strong>Color Sólido:</strong> Un color uniforme en toda la página<br/>
              • <strong>Gradiente:</strong> Transición suave entre colores<br/>
              • <strong>Imagen:</strong> Fondo con imagen personalizada<br/>
              • <strong>Patrón:</strong> Diseños repetitivos decorativos
            </Typography>
          </Box>
        )}

        {/* TAB 4: SECCIONES */}
        {tabValue === 3 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuración de Secciones
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Personaliza la apariencia de las secciones dinámicas que creas en el CMS
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Color de Fondo por Defecto"
                  value={config.sections.defaultBackground}
                  margin="normal"
                />
                
                <TextField
                  fullWidth
                  label="Radio de Esquinas (px)"
                  type="number"
                  value={config.sections.borderRadius}
                  margin="normal"
                />
                
                <TextField
                  fullWidth
                  label="Espaciado entre Secciones (px)"
                  type="number"
                  value={config.sections.spacing}
                  margin="normal"
                />
                
                <FormControlLabel
                  control={<Switch checked={config.sections.animation} />}
                  label="Activar Animaciones"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Vista Previa de Sección
                </Typography>
                <Card
                  sx={{
                    p: 3,
                    bgcolor: config.sections.defaultBackground,
                    borderRadius: `${config.sections.borderRadius}px`,
                    transition: config.sections.animation ? 'all 0.3s ease' : 'none',
                    '&:hover': config.sections.animation ? { transform: 'translateY(-2px)', boxShadow: 3 } : {}
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Sección de Ejemplo
                  </Typography>
                  <Typography variant="body2">
                    Así se verán las secciones que crees con el generador de módulos.
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VisualSettings;