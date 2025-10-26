import React, { useState, useEffect } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';
import { Salesperson } from '../types';
import { API_BASE_URL } from '../config/api';

interface ConfigurationPageProps {
  crmData: CrmDataHook;
  currentUser: Salesperson;
}

const ConfigurationPage: React.FC<ConfigurationPageProps> = ({ crmData, currentUser }) => {
  // Estado para metas del negocio
  const [businessGoals, setBusinessGoals] = useState({
    claro_tv: 0,
    fijo: 0,
    movil: 0,
    cloud: 0,
    pos: 0
  });

  // Estado para asignación de vendedores
  const [salespeopleMetas, setSalespeopleMetas] = useState<{[key: string]: any}>({});

  useEffect(() => {
    // Cargar metas actuales del negocio y vendedores
    loadCurrentGoals();
  }, []);

  const loadCurrentGoals = () => {
    // Cargar desde el backend cuando esté implementado
    console.log('Loading current goals...');
  };

  const handleBusinessGoalChange = (category: string, value: number) => {
    setBusinessGoals(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const handleSalespersonMetaChange = (salespersonId: string, category: string, value: number) => {
    setSalespeopleMetas(prev => ({
      ...prev,
      [salespersonId]: {
        ...prev[salespersonId],
        [category]: value
      }
    }));
  };

  const calculateTotalAssigned = (category: string) => {
    return Object.values(salespeopleMetas).reduce((total: number, salesperson: any) => {
      return total + (salesperson[category] || 0);
    }, 0);
  };

  const getUnassignedAmount = (category: string) => {
    const assigned = calculateTotalAssigned(category);
    return businessGoals[category as keyof typeof businessGoals] - assigned;
  };

  const saveConfiguration = async () => {
    try {
      console.log('💾 Guardando configuración real en base de datos...');
      
      // Guardar metas individuales por vendedor
      const metasToSave = [];
      
      for (const salesperson of crmData.salespeople) {
        const salespersonMeta = salespeopleMetas[salesperson.id];
        if (salespersonMeta) {
          // Calcular total de meta del vendedor
          const totalMeta = Object.values(salespersonMeta).reduce((sum: number, value: any) => sum + (value || 0), 0);
          
          if (totalMeta > 0) {
            metasToSave.push({
              vendedor_id: salesperson.id,
              meta_valor: totalMeta,
              periodo: 'mensual',
              fecha_inicio: new Date().toISOString().split('T')[0],
              activa: true
            });
          }
        }
      }
      
      // Enviar al backend
      if (metasToSave.length > 0) {
        for (const meta of metasToSave) {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/metas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(meta)
          });
          
          if (!response.ok) {
            throw new Error(`Error saving meta for vendor ${meta.vendedor_id}`);
          }
        }
        
        console.log('✅ Metas guardadas exitosamente en la base de datos');
        alert(`✅ Configuración guardada exitosamente!\n\nSe guardaron ${metasToSave.length} metas de vendedores.`);
        
        // Recargar la página para reflejar los cambios
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert('⚠️ No hay metas para guardar. Configure al menos una meta por vendedor.');
      }
      
    } catch (error) {
      console.error('❌ Error guardando configuración:', error);
      alert('Error al guardar la configuración: ' + (error as Error).message);
    }
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Acceso Denegado</h2>
          <p className="text-gray-300">Solo los administradores pueden acceder a la configuración.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-white">Configuración de Metas</h1>
        <p className="text-gray-300 mt-1">Gestiona las metas del negocio y asignación por vendedores</p>
      </div>

      {/* Metas del Negocio */}
      <div className="bg-gray-800 rounded-lg border border-gray-600 p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          🏢 <span className="ml-2">Metas Mensuales del Negocio</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { key: 'claro_tv', label: '📺 Claro TV', color: 'blue' },
            { key: 'fijo', label: '📞 Fijo', color: 'green' },
            { key: 'movil', label: '📱 Móvil', color: 'purple' },
            { key: 'cloud', label: '☁️ Cloud', color: 'indigo' },
            { key: 'pos', label: '📮 Pos', color: 'orange' }
          ].map(category => (
            <div key={category.key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                {category.label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white">$</span>
                <input
                  type="number"
                  value={businessGoals[category.key as keyof typeof businessGoals]}
                  onChange={(e) => handleBusinessGoalChange(category.key, parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 bg-green-600 border border-green-500 rounded-md text-white placeholder-green-200 focus:ring-2 focus:ring-green-400 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-gray-700 rounded-md">
          <p className="text-lg font-semibold text-white">
            💰 Total Meta del Negocio: ${Object.values(businessGoals).reduce((a, b) => a + b, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Asignación por Vendedores */}
      <div className="bg-gray-800 rounded-lg border border-gray-600 p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          👥 <span className="ml-2">Asignación de Metas por Vendedor</span>
        </h2>

        <div className="space-y-6">
          {crmData.salespeople.map(salesperson => (
            <div key={salesperson.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700">
              <h3 className="font-medium text-white mb-3 flex items-center">
                <img 
                  src={salesperson.avatar} 
                  alt={salesperson.name}
                  className="w-8 h-8 rounded-full mr-3"
                />
                {salesperson.name}
                <span className="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded-full">
                  {salesperson.role}
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { key: 'claro_tv', label: '📺 Claro TV' },
                  { key: 'fijo', label: '📞 Fijo' },
                  { key: 'movil', label: '📱 Móvil' },
                  { key: 'cloud', label: '☁️ Cloud' },
                  { key: 'pos', label: '📮 Pos' }
                ].map(category => (
                  <div key={category.key} className="space-y-1">
                    <label className="block text-xs font-medium text-gray-300">
                      {category.label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white text-sm">$</span>
                      <input
                        type="number"
                        value={salespeopleMetas[salesperson.id]?.[category.key] || 0}
                        onChange={(e) => handleSalespersonMetaChange(
                          salesperson.id, 
                          category.key, 
                          parseFloat(e.target.value) || 0
                        )}
                        className="w-full pl-6 pr-2 py-1 text-sm bg-green-600 border border-green-500 rounded text-white placeholder-green-200 focus:ring-1 focus:ring-green-400 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 text-sm text-gray-300">
                Total asignado: ${Object.values(salespeopleMetas[salesperson.id] || {}).reduce((a: number, b: any) => a + (b || 0), 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen y Validación */}
      <div className="bg-gray-800 rounded-lg border border-gray-600 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">📁 Resumen de Asignación</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { key: 'claro_tv', label: '📺 Claro TV' },
            { key: 'fijo', label: '📞 Fijo' },
            { key: 'movil', label: '📱 Móvil' },
            { key: 'cloud', label: '☁️ Cloud' },
            { key: 'pos', label: '📮 Pos' }
          ].map(category => {
            const businessGoal = businessGoals[category.key as keyof typeof businessGoals];
            const assigned = calculateTotalAssigned(category.key);
            const unassigned = businessGoal - assigned;
            const isValid = unassigned >= 0;

            return (
              <div key={category.key} className={`p-3 rounded-md ${isValid ? 'bg-green-800' : 'bg-red-800'}`}>
                <p className="font-medium text-sm text-white">{category.label}</p>
                <p className="text-xs text-gray-300">Meta: ${businessGoal.toLocaleString()}</p>
                <p className="text-xs text-gray-300">Asignado: ${assigned.toLocaleString()}</p>
                <p className={`text-xs font-medium ${isValid ? 'text-green-300' : 'text-red-300'}`}>
                  {isValid ? 'Disponible' : 'Sobreasignado'}: ${Math.abs(unassigned).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 border border-gray-500 rounded-md text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={saveConfiguration}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          💾 Guardar Configuración
        </button>
      </div>
    </div>
  );
};

export default ConfigurationPage;
