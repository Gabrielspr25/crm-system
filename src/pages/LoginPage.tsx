import React, { useState } from 'react';
import { Salesperson } from '../types';

interface LoginPageProps {
  onLogin: (user: Salesperson, token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('gabriel');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      console.log('🔐 Intentando login con username:', username);
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('✅ Login exitoso:', data.user.name);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      } else {
        console.log('❌ Login fallido:', data.message);
        setError(data.message || 'Error de autenticación');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-primary">
      <div className="w-full max-w-md p-8 space-y-8 bg-secondary rounded-lg shadow-lg">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V4m0 16v-2M8 12a4 4 0 118 0 4 4 0 01-8 0z" /></svg>
            <h1 className="text-3xl font-bold ml-3 text-text-primary">CRM Pro</h1>
          </div>
          <h2 className="text-xl font-bold text-text-primary">Iniciar Sesión</h2>
          <p className="mt-2 text-sm text-text-secondary">Ingrese su nombre de usuario para continuar</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-md">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
              className="w-full bg-tertiary p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text-primary placeholder-text-secondary"
              placeholder="gabriel, dayana, mayra, randy..."
              disabled={loading}
              autoComplete="username"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-tertiary p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text-primary placeholder-text-secondary"
              placeholder="Ingrese su contraseña"
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary bg-accent hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                  Iniciando sesión...
                </div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;