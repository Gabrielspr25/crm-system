import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

const Dashboard = () => {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('🔍 Fetching data from:', `${API_BASE_URL}/crm-data`);
        console.log('🔑 Token:', token ? 'PRESENT' : 'MISSING');
        
        const response = await fetch(`${API_BASE_URL}/crm-data`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Data received:', data);
        
        setData(data);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard CRM</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-secondary p-6 rounded-lg border border-border-primary">
          <h2 className="text-xl font-semibold mb-2">Categorías</h2>
          <p className="text-3xl font-bold text-accent">{data.categories?.length || 0}</p>
        </div>
        
        <div className="bg-secondary p-6 rounded-lg border border-border-primary">
          <h2 className="text-xl font-semibold mb-2">Productos</h2>
          <p className="text-3xl font-bold text-accent">{data.products?.length || 0}</p>
        </div>
        
        <div className="bg-secondary p-6 rounded-lg border border-border-primary">
          <h2 className="text-xl font-semibold mb-2">Clientes</h2>
          <p className="text-3xl font-bold text-accent">{data.clients?.length || 0}</p>
        </div>
      </div>

      <div className="bg-secondary p-6 rounded-lg border border-border-primary">
        <h2 className="text-xl font-semibold mb-4">Detalles</h2>
        <pre className="text-xs overflow-auto bg-primary p-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default Dashboard;
