import React, { useState, useMemo } from 'react';
import { Income, Expense } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import { Download, Filter, Calendar, User, Package, DollarSign, TrendingUp, Target, Users, Award, BarChart3, PieChart, FileText, Plus, Edit, Trash2, X } from 'lucide-react';
import IncomeModal from '../components/IncomeModal';
import ExpenseModal from '../components/ExpenseModal';

interface FinancesPageProps {
  crmData: CrmDataHook;
}

// Categorías de gastos con sus nombres legibles y colores
const EXPENSE_CATEGORIES = {
  oficina: { name: 'Oficina', icon: '🏢', color: 'bg-blue-100 text-blue-800' },
  transporte: { name: 'Transporte', icon: '🚗', color: 'bg-green-100 text-green-800' },
  marketing: { name: 'Marketing', icon: '💻', color: 'bg-purple-100 text-purple-800' },
  personal: { name: 'Personal', icon: '👥', color: 'bg-yellow-100 text-yellow-800' },
  equipamiento: { name: 'Equipamiento', icon: '🛠️', color: 'bg-red-100 text-red-800' },
  otros: { name: 'Otros', icon: '📦', color: 'bg-gray-100 text-gray-800' }
};

const FinancesPageImproved: React.FC<FinancesPageProps> = ({ crmData }) => {
  const { incomes, expenses, products, salespeople, deleteIncome, deleteExpense, metas } = crmData;
  
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ingresos' | 'gastos'>('dashboard');
  
  // Filtros
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [salespersonFilter, setSalespersonFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [amountFilter, setAmountFilter] = useState({ min: '', max: '' });
  const [categoryFilter, setCategoryFilter] = useState('');

  // Filtros aplicados a ingresos
  const filteredIncomes = useMemo(() => {
    return incomes.filter(income => {
      // Filtro de fecha
      if (dateFilter.from || dateFilter.to) {
        const incomeDate = new Date(income.date);
        if (dateFilter.from && incomeDate < new Date(dateFilter.from)) return false;
        if (dateFilter.to && incomeDate > new Date(dateFilter.to)) return false;
      }
      
      // Filtro de vendedor
      if (salespersonFilter && income.salespersonId !== salespersonFilter) return false;
      
      // Filtro de producto
      if (productFilter && income.productId !== productFilter) return false;
      
      // Filtro de monto
      if (amountFilter.min && income.amount < parseFloat(amountFilter.min)) return false;
      if (amountFilter.max && income.amount > parseFloat(amountFilter.max)) return false;
      
      return true;
    });
  }, [incomes, dateFilter, salespersonFilter, productFilter, amountFilter]);
  
  // Filtros aplicados a gastos
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Filtro de fecha
      if (dateFilter.from || dateFilter.to) {
        const expenseDate = new Date(expense.date);
        if (dateFilter.from && expenseDate < new Date(dateFilter.from)) return false;
        if (dateFilter.to && expenseDate > new Date(dateFilter.to)) return false;
      }
      
      // Filtro de categoría
      if (categoryFilter && expense.category !== categoryFilter) return false;
      
      // Filtro de monto
      if (amountFilter.min && expense.amount < parseFloat(amountFilter.min)) return false;
      if (amountFilter.max && expense.amount > parseFloat(amountFilter.max)) return false;
      
      return true;
    });
  }, [expenses, dateFilter, categoryFilter, amountFilter]);

  // Cálculos con filtros aplicados
  const totalIncome = filteredIncomes.reduce((sum, income) => sum + income.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  
  // Estadísticas avanzadas
  const stats = useMemo(() => {
    // Top vendedores por ingresos
    const salespersonStats = salespeople.map(sp => {
      const spIncomes = filteredIncomes.filter(income => income.salespersonId === sp.id);
      const total = spIncomes.reduce((sum, income) => sum + income.amount, 0);
      const count = spIncomes.length;
      const avgSale = count > 0 ? total / count : 0;
      
      // Progreso vs meta
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const meta = metas?.find(m => 
        m.vendedorId === sp.id && 
        m.activa && 
        m.year === currentYear && 
        m.month === currentMonth
      );
      
      return {
        id: sp.id,
        name: sp.name,
        total,
        count,
        avgSale,
        meta: meta?.metaValor || 0,
        metaProgress: meta ? (total / meta.metaValor) * 100 : 0
      };
    }).sort((a, b) => b.total - a.total);
    
    // Productos más vendidos
    const productStats = products.map(product => {
      const productIncomes = filteredIncomes.filter(income => income.productId === product.id);
      const total = productIncomes.reduce((sum, income) => sum + income.amount, 0);
      const count = productIncomes.length;
      
      return {
        id: product.id,
        name: product.name,
        total,
        count
      };
    }).filter(p => p.count > 0).sort((a, b) => b.total - a.total);
    
    return {
      salespersonStats,
      productStats,
      avgIncomeAmount: filteredIncomes.length > 0 ? totalIncome / filteredIncomes.length : 0,
      avgExpenseAmount: filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0
    };
  }, [filteredIncomes, filteredExpenses, salespeople, products, metas, totalIncome, totalExpenses]);
  
  // Funciones de manejo
  const handleAddIncome = () => {
    setEditingIncome(null);
    setIsIncomeModalOpen(true);
  };

  const handleEditIncome = (income: Income) => {
    setEditingIncome(income);
    setIsIncomeModalOpen(true);
  };

  const handleDeleteIncome = (incomeId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este ingreso?')) {
      deleteIncome(incomeId);
    }
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este gasto?')) {
      deleteExpense(expenseId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  // Función de exportación a CSV
  const exportToCSV = (type: 'ingresos' | 'gastos' | 'completo') => {
    let data: any[] = [];
    let filename = '';
    
    if (type === 'ingresos' || type === 'completo') {
      const incomeData = filteredIncomes.map(income => ({
        Fecha: formatDate(income.date),
        Descripción: income.description,
        Producto: income.productName || 'N/A',
        Vendedor: income.salespersonName || 'N/A',
        Monto: income.amount,
        Tipo: 'Ingreso'
      }));
      data.push(...incomeData);
    }
    
    if (type === 'gastos' || type === 'completo') {
      const expenseData = filteredExpenses.map(expense => ({
        Fecha: formatDate(expense.date),
        Descripción: expense.description,
        Categoría: expense.categoryName || 'Sin categoría',
        Monto: expense.amount,
        Tipo: 'Gasto'
      }));
      data.push(...expenseData);
    }
    
    filename = type === 'completo' ? 'finanzas-completo' : `finanzas-${type}`;
    filename += `-${new Date().toISOString().split('T')[0]}.csv`;
    
    // Convertir a CSV
    if (data.length === 0) {
      alert('No hay datos para exportar con los filtros aplicados.');
      return;
    }
    
    const headers = Object.keys(data[0]).join(',');
    const csvContent = [headers, ...data.map(row => Object.values(row).join(','))].join('\n');
    
    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setDateFilter({ from: '', to: '' });
    setSalespersonFilter('');
    setProductFilter('');
    setAmountFilter({ min: '', max: '' });
    setCategoryFilter('');
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            💰 Finanzas Avanzadas
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => exportToCSV('completo')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar Todo
            </button>
            <button
              onClick={handleAddIncome}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Ingreso
            </button>
            <button
              onClick={handleAddExpense}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Gasto
            </button>
          </div>
        </div>
        
        {/* Navegación por tabs */}
        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { key: 'ingresos', label: `Ingresos (${filteredIncomes.length})`, icon: TrendingUp },
            { key: 'gastos', label: `Gastos (${filteredExpenses.length})`, icon: DollarSign }
          ].map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Total Ingresos</h3>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              <p className="text-sm text-gray-500 mt-1">{filteredIncomes.length} transacciones</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Total Gastos</h3>
              <p className="text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              <p className="text-sm text-gray-500 mt-1">{filteredExpenses.length} transacciones</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Beneficio Neto</h3>
              <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netProfit)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {netProfit >= 0 ? 'Ganancia' : 'Pérdida'}
              </p>
            </div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </h3>
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Limpiar filtros
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Fecha desde
            </label>
            <input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Fecha hasta
            </label>
            <input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Vendedor
            </label>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todos los vendedores</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Producto
            </label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todos los productos</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Vendedores */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Top Vendedores
            </h3>
            <div className="space-y-3">
              {stats.salespersonStats.slice(0, 5).map((sp, index) => (
                <div key={sp.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{sp.name}</p>
                      <p className="text-sm text-gray-500">{sp.count} ventas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(sp.total)}</p>
                    {sp.meta > 0 && (
                      <p className="text-sm text-gray-500">
                        {Math.round(sp.metaProgress)}% de meta
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Productos más vendidos */}
          {stats.productStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Productos más vendidos
              </h3>
              <div className="space-y-3">
                {stats.productStats.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.count} ventas</p>
                      </div>
                    </div>
                    <p className="font-semibold text-green-600">{formatCurrency(product.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ingresos' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">Lista de Ingresos</h3>
            <button
              onClick={() => exportToCSV('ingresos')}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {filteredIncomes.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendedor</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Monto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredIncomes.map(income => (
                    <tr key={income.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(income.date)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{income.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {income.productName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {income.salespersonName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">{formatCurrency(income.amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditIncome(income)} className="text-blue-600 hover:text-blue-900 p-1 mr-2">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteIncome(income.id)} className="text-red-600 hover:text-red-900 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mt-2">No hay ingresos que mostrar con los filtros aplicados.</p>
                <button
                  onClick={handleAddIncome}
                  className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Agregar primer ingreso
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'gastos' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">Lista de Gastos</h3>
            <button
              onClick={() => exportToCSV('gastos')}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {filteredExpenses.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Monto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredExpenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(expense.date)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{expense.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expense.category ? (
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            EXPENSE_CATEGORIES[expense.category]?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {EXPENSE_CATEGORIES[expense.category]?.icon} {EXPENSE_CATEGORIES[expense.category]?.name || expense.category}
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Sin categoría</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-red-600">{formatCurrency(expense.amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditExpense(expense)} className="text-blue-600 hover:text-blue-900 p-1 mr-2">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-600 hover:text-red-900 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mt-2">No hay gastos que mostrar con los filtros aplicados.</p>
                <button
                  onClick={handleAddExpense}
                  className="mt-4 text-red-600 hover:text-red-800 font-medium"
                >
                  + Agregar primer gasto
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {isIncomeModalOpen && (
        <IncomeModal
          isOpen={isIncomeModalOpen}
          onClose={() => {
            setIsIncomeModalOpen(false);
            setEditingIncome(null);
          }}
          income={editingIncome}
          crmData={crmData}
        />
      )}

      {isExpenseModalOpen && (
        <ExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => {
            setIsExpenseModalOpen(false);
            setEditingExpense(null);
          }}
          expense={editingExpense}
          crmData={crmData}
        />
      )}
    </div>
  );
};

export default FinancesPageImproved;