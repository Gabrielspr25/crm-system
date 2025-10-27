import React from 'react';
import MainApp from './MainApp';

// Página principal de la aplicación
const HomePage: React.FC = () => {
  // Aquí podrías obtener los datos del usuario desde tu sistema de autenticación
  const currentUser = {
    id: 'vendedor1',
    name: 'Gabriel Sánchez',
    role: 'vendedor' as const
  };

  return <MainApp currentUser={currentUser} />;
};

export default HomePage;