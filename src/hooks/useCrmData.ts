import { useState, useCallback, useEffect } from 'react';
import { Salesperson, Product, Client, CrmStats, Category, Ban, Subscriber, PipelineStatus, PipelineNote, Income, Expense, Meta } from '../types';
import { useWebSocket } from './useWebSocket';

export interface CrmData {
  salespeople: Salesperson[];
  products: Product[];
  categories: Category[];
  clients: Client[];
  bans: Ban[];
  subscribers: Subscriber[];
  pipelineStatuses: PipelineStatus[];
  pipelineNotes: PipelineNote[];
  incomes: Income[];
  expenses: Expense[];
  metas: Meta[];
}

const useCrmData = () => {
  const [data, setData] = useState<CrmData>({
    salespeople: [],
    products: [],
    categories: [],
    clients: [],
    bans: [],
    subscribers: [],
    pipelineStatuses: [],
    pipelineNotes: [],
    incomes: [],
    expenses: [],
    metas: []
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // WebSocket for real-time updates
  const { socket, isConnected } = useWebSocket({
    onUpdate: (update) => {
      console.log(`📡 TIEMPO REAL - ${update.action} ${update.type}:`, update.data);
      
      switch (update.type) {
        case 'clients':
          if (update.action === 'created') {
            setData(prev => ({ 
              ...prev, 
              clients: [...prev.clients, update.data] 
            }));
          } else if (update.action === 'updated') {
            setData(prev => ({ 
              ...prev, 
              clients: prev.clients.map(c => 
                c.id === update.data.id ? update.data : c
              ) 
            }));
          } else if (update.action === 'deleted') {
            setData(prev => ({ 
              ...prev, 
              clients: prev.clients.filter(c => c.id !== update.data.id) 
            }));
          }
          break;
        
        case 'products':
          if (update.action === 'created') {
            setData(prev => ({ 
              ...prev, 
              products: [...prev.products, update.data] 
            }));
          } else if (update.action === 'updated') {
            setData(prev => ({ 
              ...prev, 
              products: prev.products.map(p => 
                p.id === update.data.id ? update.data : p
              ) 
            }));
          }
          break;
          
        case 'metas':
          if (update.action === 'created') {
            setData(prev => ({ 
              ...prev, 
              metas: [...(prev.metas || []), update.data] 
            }));
          } else if (update.action === 'updated') {
            setData(prev => ({ 
              ...prev, 
              metas: (prev.metas || []).map(m => 
                m.id === update.data.id ? update.data : m
              ) 
            }));
          }
          break;
      }
    },
    enabled: true
  });

  // Helper functions for API calls
  const apiCall = async (endpoint: string, options?: RequestInit) => {
    const token = localStorage.getItem('token');
    
    // Debug token
    console.log('🔑 TOKEN CHECK:', {
      exists: !!token,
      length: token?.length || 0,
      starts: token?.substring(0, 20) || 'NO TOKEN'
    });
    
    if (!token && endpoint !== '/crm-data') {
      throw new Error('No authentication token found. Please login again.');
    }
    
    const apiBaseUrl = '/api'; // Siempre usar la URL relativa en producción
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(`API Error: ${response.status} ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }
    
    return response.json();
  };

  // Cargar datos desde el API al inicializar
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Loading CRM data from API - Updated version...');
        
        // Usar apiCall que maneja el token JWT correctamente
        const apiData = await apiCall('/crm-data');
        console.log('CRM data loaded from API successfully:', apiData);
        
        // Asegurar que metas exista como array vacío si no viene de la API
        setData({
          ...apiData,
          metas: apiData.metas || []
        });
      } catch (error: any) {
        console.error('Failed to load data from API:', error?.status || 'Unknown error');
        
        // Si es error 401, el token es inválido
        if (error?.status === 401) {
          console.log('🔑 Token inválido, redirigiendo a login...');
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  const getNewId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // --- SALESPEOPLE ---
  const addSalesperson = async (salesperson: Omit<Salesperson, 'id'>) => {
    try {
      const newSalesperson = await apiCall('/salespeople', {
        method: 'POST',
        body: JSON.stringify({
          name: salesperson.name,
          email: salesperson.email,
          avatar: salesperson.avatar,
          monthly_sales_goal: salesperson.monthlySalesGoal,
          role: salesperson.role
        })
      });
      
      const salespersonToAdd = {
        ...salesperson,
        id: newSalesperson.id
      };
      
      setData(prev => ({ ...prev, salespeople: [...prev.salespeople, salespersonToAdd] }));
      return salespersonToAdd;
    } catch (error) {
      console.error('Error adding salesperson:', error);
      alert('Error al agregar vendedor');
      throw error;
    }
  };
  const updateSalesperson = async (updatedSalesperson: Salesperson) => {
    try {
      await apiCall(`/salespeople/${updatedSalesperson.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updatedSalesperson.name,
          email: updatedSalesperson.email,
          avatar: updatedSalesperson.avatar,
          monthly_sales_goal: updatedSalesperson.monthlySalesGoal,
          role: updatedSalesperson.role
        })
      });
      setData(prev => ({ ...prev, salespeople: prev.salespeople.map(s => s.id === updatedSalesperson.id ? updatedSalesperson : s) }));
    } catch (error) {
      console.error('Error updating salesperson:', error);
      alert('Error al actualizar vendedor');
    }
  };
  const deleteSalesperson = (salespersonId: string) => {
    setData(prev => ({
      ...prev,
      salespeople: prev.salespeople.filter(s => s.id !== salespersonId),
      clients: prev.clients.map(c => c.salespersonId === salespersonId ? { ...c, salespersonId: null } : c),
    }));
  };

  // --- CATEGORIES ---
  const addCategory = (category: Omit<Category, 'id'>) => {
    setData(prev => ({ ...prev, categories: [...prev.categories, { ...category, id: getNewId() }] }));
  };
  const updateCategory = (updatedCategory: Category) => {
    setData(prev => ({ ...prev, categories: prev.categories.map(c => c.id === updatedCategory.id ? updatedCategory : c) }));
  };
  const deleteCategory = (categoryId: string) => {
    if (data.products.some(p => p.categoryId === categoryId)) {
        alert('No se puede eliminar una categoría que tiene productos asociados.');
        return;
    }
    setData(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== categoryId) }));
  };

  // --- PRODUCTS ---
  const addProduct = (product: Omit<Product, 'id'>) => {
    setData(prev => ({ ...prev, products: [...prev.products, { ...product, id: getNewId() }] }));
  };
  const updateProduct = (updatedProduct: Product) => {
    setData(prev => ({ ...prev, products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p) }));
  };
  const deleteProduct = (productId: string) => {
    setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== productId) }));
  };

  // --- CLIENTS ---
  const addClient = async (client: Omit<Client, 'id'>) => {
    try {
      const newClient = await apiCall('/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone,
          mobile: client.mobile,
          salesperson_id: client.salespersonId,
          pipeline_status_id: client.pipelineStatusId
        })
      });
      
      const clientToAdd = { 
        ...client, 
        id: newClient.id,
        productIds: [],
        banIds: [],
        comments: 0,
        isCompleted: false,
        priority: null,
        group: client.group || 'Móvil',
        pipelineValues: client.pipelineValues || {}
      };
      
      setData(prev => ({ ...prev, clients: [...prev.clients, clientToAdd] }));
      return clientToAdd;
    } catch (error) {
      console.error('Error adding client:', error);
      alert('Error al agregar cliente');
      throw error;
    }
  };
  
  const updateClient = async (updatedClient: Client) => {
    try {
      await apiCall(`/clients/${updatedClient.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedClient)
      });
      setData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === updatedClient.id ? updatedClient : c) }));
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error al actualizar cliente');
    }
  };
  
  const deleteClient = async (clientId: string) => {
    try {
      await apiCall(`/clients/${clientId}`, { method: 'DELETE' });
      setData(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== clientId) }));
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error al eliminar cliente');
    }
  };

  // --- BANS ---
  const addBan = async (ban: Omit<Ban, 'id' | 'lastUpdated'>) => {
    try {
      console.log('🔄 Creando BAN via API:', ban);
      const newBanFromAPI = await apiCall('/bans', {
        method: 'POST',
        body: JSON.stringify({
          client_id: ban.clientId, // Mapeo clientId -> client_id
          number: ban.number
        })
      });
      
      // Convertir respuesta del backend al formato frontend
      const newBan: Ban = {
        id: newBanFromAPI.id,
        clientId: newBanFromAPI.client_id,
        number: newBanFromAPI.number,
        status: newBanFromAPI.status as 'activo' | 'inactivo',
        lastUpdated: newBanFromAPI.last_updated,
        subscribers: []
      };
      
      setData(prev => ({ ...prev, bans: [...prev.bans, newBan] }));
      console.log('✅ BAN creado exitosamente:', newBan);
      return newBan;
    } catch (error) {
      console.error('❌ Error creando BAN:', error);
      alert('Error al crear BAN');
      throw error;
    }
  };
  const updateBan = (updatedBan: Ban) => {
    setData(prev => ({ ...prev, bans: prev.bans.map(b => b.id === updatedBan.id ? updatedBan : b) }));
  };
  const deleteBan = (banId: string) => {
    setData(prev => ({ ...prev, bans: prev.bans.filter(b => b.id !== banId) }));
  };

  // --- SUBSCRIBERS ---
  const addSubscriber = async (subscriber: Omit<Subscriber, 'id'>) => {
    try {
      console.log('🔄 Creando Subscriber via API:', subscriber);
      const newSubscriberFromAPI = await apiCall('/subscribers', {
        method: 'POST',
        body: JSON.stringify({
          ban_id: subscriber.banId,
          phone_number: subscriber.phoneNumber,
          status: subscriber.status,
          product_id: subscriber.productId,
          category_id: subscriber.categoryId,
          contract_end_date: subscriber.contractEndDate,
          equipment: subscriber.equipment,
          city: subscriber.city,
          months_sold: subscriber.monthsSold || 0,
          payments_made: subscriber.paymentsMade || 0
        })
      });
      
      // Convertir respuesta del backend al formato frontend
      const newSubscriber: Subscriber = {
        id: newSubscriberFromAPI.id,
        banId: newSubscriberFromAPI.ban_id,
        phoneNumber: newSubscriberFromAPI.phone_number,
        status: newSubscriberFromAPI.status,
        productId: newSubscriberFromAPI.product_id,
        categoryId: newSubscriberFromAPI.category_id,
        contractEndDate: newSubscriberFromAPI.contract_end_date,
        equipment: newSubscriberFromAPI.equipment,
        city: newSubscriberFromAPI.city,
        monthsSold: newSubscriberFromAPI.months_sold || 0,
        paymentsMade: newSubscriberFromAPI.payments_made || 0
      };
      
      setData(prev => ({ ...prev, subscribers: [...prev.subscribers, newSubscriber] }));
      console.log('✅ Subscriber creado exitosamente:', newSubscriber);
      return newSubscriber;
    } catch (error: any) {
      console.error('❌ Error creando Subscriber:', error);
      
      // Handle duplicate phone number error specifically
      if (error.status === 409) {
        const message = error.data?.message || `El número de teléfono ${subscriber.phoneNumber} ya está registrado`;
        throw new Error(message);
      }
      
      // Handle other API errors
      if (error.status) {
        throw new Error(error.data?.message || 'Error del servidor al crear suscriptor');
      }
      
      throw new Error('Error de conexión al crear suscriptor');
    }
  };
  const updateSubscriber = (updatedSubscriber: Subscriber) => {
    setData(prev => ({ ...prev, subscribers: prev.subscribers.map(s => s.id === updatedSubscriber.id ? updatedSubscriber : s) }));
  };
  const deleteSubscriber = (subscriberId: string) => {
    setData(prev => ({ ...prev, subscribers: prev.subscribers.filter(s => s.id !== subscriberId) }));
  };
  const cancelSubscriber = (subscriberId: string) => {
    setData(prev => ({ ...prev, subscribers: prev.subscribers.map(s => s.id === subscriberId ? { ...s, status: 'cancelado' as const } : s) }));
  };

  // --- PIPELINE STATUSES ---
  const addPipelineStatus = (status: Omit<PipelineStatus, 'id'>) => {
    setData(prev => ({ ...prev, pipelineStatuses: [...prev.pipelineStatuses, { ...status, id: getNewId() }] }));
  };
  const updatePipelineStatus = (updatedStatus: PipelineStatus) => {
    setData(prev => ({ ...prev, pipelineStatuses: prev.pipelineStatuses.map(s => s.id === updatedStatus.id ? updatedStatus : s) }));
  };
  const deletePipelineStatus = (statusId: string) => {
    setData(prev => ({
        ...prev,
        pipelineStatuses: prev.pipelineStatuses.filter(s => s.id !== statusId),
        clients: prev.clients.map(c => c.pipelineStatusId === statusId ? { ...c, pipelineStatusId: null } : c)
    }));
  };

  // --- PIPELINE NOTES ---
  const addPipelineNote = (note: Omit<PipelineNote, 'id' | 'createdAt'>) => {
    const newNote = { ...note, id: getNewId(), createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, pipelineNotes: [...prev.pipelineNotes, newNote] }));
  };

  // --- FINANCES - CONECTADAS A API ---
  const addIncome = async (income: Omit<Income, 'id'>) => {
    try {
      const newIncome = await apiCall('/incomes', {
        method: 'POST',
        body: JSON.stringify({
          date: income.date,
          description: income.description,
          amount: income.amount,
          product_id: income.productId,
          salesperson_id: income.salespersonId
        })
      });
      setData(prev => ({...prev, incomes: [...prev.incomes, {
        id: newIncome.id,
        date: newIncome.date,
        description: newIncome.description,
        amount: parseFloat(newIncome.amount),
        productId: newIncome.product_id,
        salespersonId: newIncome.salesperson_id
      }] }));
    } catch (error) {
      console.error('Error adding income:', error);
      alert('Error al agregar ingreso');
    }
  };
  
  const updateIncome = async (updatedIncome: Income) => {
    try {
      await apiCall(`/incomes/${updatedIncome.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date: updatedIncome.date,
          description: updatedIncome.description,
          amount: updatedIncome.amount,
          product_id: updatedIncome.productId,
          salesperson_id: updatedIncome.salespersonId
        })
      });
      setData(prev => ({...prev, incomes: prev.incomes.map(i => i.id === updatedIncome.id ? updatedIncome : i)}));
    } catch (error) {
      console.error('Error updating income:', error);
      alert('Error al actualizar ingreso');
    }
  };
  
  const deleteIncome = async (incomeId: string) => {
    try {
      await apiCall(`/incomes/${incomeId}`, { method: 'DELETE' });
      setData(prev => ({...prev, incomes: prev.incomes.filter(i => i.id !== incomeId)}));
    } catch (error) {
      console.error('Error deleting income:', error);
      alert('Error al eliminar ingreso');
    }
  };
  
  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    try {
      const newExpense = await apiCall('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
          category: expense.category
        })
      });
      setData(prev => ({...prev, expenses: [...prev.expenses, {
        id: newExpense.id,
        date: newExpense.date,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        categoryName: newExpense.categoryName
      }] }));
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Error al agregar gasto');
    }
  };
  
  const updateExpense = async (updatedExpense: Expense) => {
    try {
      await apiCall(`/expenses/${updatedExpense.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date: updatedExpense.date,
          description: updatedExpense.description,
          amount: updatedExpense.amount,
          category: updatedExpense.category
        })
      });
      setData(prev => ({...prev, expenses: prev.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e)}));
    } catch (error) {
      console.error('Error updating expense:', error);
      alert('Error al actualizar gasto');
    }
  };
  
  const deleteExpense = async (expenseId: string) => {
    try {
      await apiCall(`/expenses/${expenseId}`, { method: 'DELETE' });
      setData(prev => ({...prev, expenses: prev.expenses.filter(e => e.id !== expenseId)}));
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Error al eliminar gasto');
    }
  };

  // --- STATS ---
  const getStats = useCallback((): CrmStats => ({
    totalClients: data.clients.length,
    totalProducts: data.products.length,
    totalSalespeople: data.salespeople.length,
    activeBans: data.bans.filter(b => b.status === 'activo').length,
  }), [data]);
  
  // --- METAS ---
  const addMeta = async (meta: Omit<Meta, 'id' | 'createdAt'>) => {
    try {
      // Solo enviar campos que acepta el backend
      const payload: any = {
        metaValor: meta.metaValor,
        periodo: meta.periodo,
        fechaInicio: meta.fechaInicio,
        fechaFin: meta.fechaFin,
        tipoMeta: meta.tipoMeta,
        categoria: meta.categoria,
        descripcion: meta.descripcion
      };
      
      // Solo agregar vendedorId si no es null
      if (meta.vendedorId && meta.vendedorId !== null) {
        payload.vendedorId = meta.vendedorId;
      }
      
      // Agregar tipoObjetivo si existe en el meta
      if ('tipoObjetivo' in meta && meta.tipoObjetivo) {
        payload.tipoObjetivo = meta.tipoObjetivo;
      }
      
      console.log('🎯 Enviando meta al backend:', payload);
      
      const response = await apiCall('/metas', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      // Agregar al estado local con el formato correcto
      const newMeta: Meta = {
        id: response.id,
        vendedorId: meta.vendedorId,
        metaValor: meta.metaValor,
        periodo: meta.periodo,
        fechaInicio: meta.fechaInicio,
        fechaFin: meta.fechaFin,
        activa: true,
        createdAt: new Date().toISOString(),
        tipoMeta: meta.tipoMeta,
        categoria: meta.categoria,
        descripcion: meta.descripcion,
        year: meta.year,
        month: meta.month
      };
      
      setData(prev => ({ ...prev, metas: [...(prev.metas || []), newMeta] }));
    } catch (error) {
      console.error('Error adding meta:', error);
      throw error;
    }
  };
  
  const updateMeta = async (metaId: string, updatedMeta: Partial<Meta>) => {
    try {
      await apiCall(`/metas/${metaId}`, {
        method: 'PUT',
        body: JSON.stringify({
          metaValor: updatedMeta.metaValor,
          periodo: updatedMeta.periodo,
          fechaInicio: updatedMeta.fechaInicio,
          fechaFin: updatedMeta.fechaFin,
          tipoMeta: updatedMeta.tipoMeta,
          categoria: updatedMeta.categoria,
          descripcion: updatedMeta.descripcion,
          activa: updatedMeta.activa
        })
      });
      
      setData(prev => ({
        ...prev,
        metas: (prev.metas || []).map(m => m.id === metaId ? { ...m, ...updatedMeta } : m)
      }));
    } catch (error) {
      console.error('Error updating meta:', error);
      throw error;
    }
  };
  
  const deleteMeta = async (metaId: string) => {
    try {
      await apiCall(`/metas/${metaId}`, { method: 'DELETE' });
      setData(prev => ({ ...prev, metas: (prev.metas || []).filter(m => m.id !== metaId) }));
    } catch (error) {
      console.error('Error deleting meta:', error);
      throw error;
    }
  };

  // --- BATCH IMPORT ---
  const batchImportData = (importData: { clients: Omit<Client, 'id'>[], bans: Omit<Ban, 'id'>[], subscribers: Omit<Subscriber, 'id'>[] }) => {
      setData(prev => {
          const newData = { ...prev };
          
          const newClients = importData.clients.map(c => ({...c, id: getNewId()}));
          const clientMap = new Map(newClients.map(c => [c.company, c.id]));
          
          const newBans = importData.bans.map(b => ({
              ...b,
              id: getNewId(),
              clientId: clientMap.get(b.clientId as any) || b.clientId,
              status: 'activo' as const,
              lastUpdated: new Date().toISOString()
          })) as Ban[];
          const banMap = new Map(newBans.map(b => [b.number, b.id]));
          
          const newSubscribers = importData.subscribers.map(s => ({
              ...s,
              id: getNewId(),
              banId: banMap.get(s.banId as any) || s.banId
          })) as Subscriber[];
          
          return {
              ...newData,
              clients: [...prev.clients, ...newClients],
              bans: [...prev.bans, ...newBans],
              subscribers: [...prev.subscribers, ...newSubscribers]
          };
      });
  };

  // Alias para consistencia con los modales
  const createIncome = addIncome;
  const createExpense = addExpense;

  return { 
    ...data, 
    isLoading, 
    addSalesperson, 
    updateSalesperson, 
    deleteSalesperson, 
    addCategory, 
    updateCategory, 
    deleteCategory, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    addClient, 
    updateClient, 
    deleteClient, 
    addBan, 
    updateBan, 
    deleteBan, 
    addSubscriber, 
    updateSubscriber, 
    deleteSubscriber, 
    cancelSubscriber, 
    addPipelineStatus, 
    updatePipelineStatus, 
    deletePipelineStatus, 
    addPipelineNote, 
    addIncome, 
    updateIncome, 
    deleteIncome, 
    addExpense, 
    updateExpense, 
    deleteExpense, 
    // Alias para los modales
    createIncome,
    createExpense,
    addMeta, 
    updateMeta, 
    deleteMeta, 
    getStats, 
    batchImportData 
  };
};

export type CrmDataHook = ReturnType<typeof useCrmData>;
export { useCrmData };