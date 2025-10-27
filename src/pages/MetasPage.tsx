import React, { useState, useMemo } from 'react';
import { Meta, MetaNegocio } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import MetaRegistrationSystem from '../components/MetaRegistrationSystem';
import MetaCharts from '../components/MetaCharts';
import NotificationSystem from '../components/NotificationSystem';
import GamificationSystem from '../components/GamificationSystem';
import ExportSystem from '../components/ExportSystem';
import AdvancedAnalyticsDashboard from '../components/AdvancedAnalyticsDashboard';
import CollaborationSystem from '../components/CollaborationSystem';

interface MetasPageProps {
  crmData: CrmDataHook;
  currentUser: any;
}

const MetasPage: React.FC<MetasPageProps> = ({ crmData, currentUser }) => {
  const { metas = [], salespeople, incomes } = crmData;
  
  const [activeTab, setActiveTab] = useState<'registro' | 'analytics' | 'advanced-analytics' | 'gamification' | 'collaboration'>('registro');
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calcular progreso de metas para análisis
  const metasWithProgress = useMemo(() => {
    return metas.map(meta => {
      const vendorIncomes = incomes.filter(income => 
        income.salespersonId === meta.vendedorId &&
        new Date(income.date).getFullYear() === meta.year &&
        (new Date(income.date).getMonth() + 1) === meta.month
      );
      
      const totalSales = vendorIncomes.reduce((sum, income) => sum + income.amount, 0);
      const progressPercent = meta.metaValor > 0 ? (totalSales / meta.metaValor) * 100 : 0;
      
      return {
        ...meta,
        totalSales,
        progressPercent: Math.round(progressPercent * 100) / 100,
        remaining: Math.max(0, meta.metaValor - totalSales),
        status: progressPercent >= 100 ? 'completada' : progressPercent >= 75 ? 'en-progreso' : 'pendiente'
      };
    });
  }, [metas, incomes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">🎯 Gestión de Metas</h1>
          <p className="text-text-secondary mt-2">Administra las metas del negocio y de cada vendedor</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Sistema de notificaciones */}
          <NotificationSystem
            metas={metas}
            incomes={incomes}
            salespeople={salespeople}
            currentUser={currentUser}
          />
          
          {/* Sistema de exportación */}
          <ExportSystem
            metas={metas}
            incomes={incomes}
            salespeople={salespeople}
            currentUser={currentUser}
            metasWithProgress={metasWithProgress}
          />
        </div>
      </div>

      {/* Navegación por tabs */}
      <div className="bg-secondary rounded-lg p-4 shadow-lg">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('registro')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'registro'
                  ? 'bg-accent text-primary'
                  : 'bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              📋 Registro de Metas
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-accent text-primary'
                  : 'bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              📈 Análisis
            </button>
            <button
              onClick={() => setActiveTab('advanced-analytics')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'advanced-analytics'
                  ? 'bg-accent text-primary'
                  : 'bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              🚀 Análisis Avanzado
            </button>
            <button
              onClick={() => setActiveTab('gamification')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'gamification'
                  ? 'bg-accent text-primary'
                  : 'bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              🎮 Gamificación
            </button>
            <button
              onClick={() => setActiveTab('collaboration')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'collaboration'
                  ? 'bg-accent text-primary'
                  : 'bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              🤝 Colaboración
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-text-secondary">Período:</label>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-tertiary text-text-primary px-3 py-1 rounded border border-border focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'registro' ? (
        <MetaRegistrationSystem
          crmData={crmData}
          currentUser={currentUser}
        />
      ) : activeTab === 'analytics' ? (
        <MetaCharts
          metasWithProgress={metasWithProgress}
          salespeople={salespeople}
          incomes={incomes}
          selectedPeriod={selectedPeriod}
        />
      ) : activeTab === 'advanced-analytics' ? (
        <AdvancedAnalyticsDashboard
          metas={metas}
          incomes={incomes}
          salespeople={salespeople}
          currentUser={currentUser}
          metasWithProgress={metasWithProgress}
        />
      ) : activeTab === 'gamification' ? (
        <GamificationSystem
          metas={metas}
          incomes={incomes}
          salespeople={salespeople}
          currentUser={currentUser}
        />
      ) : activeTab === 'collaboration' ? (
        <CollaborationSystem
          metas={metas}
          incomes={incomes}
          salespeople={salespeople}
          currentUser={currentUser}
          metasWithProgress={metasWithProgress}
        />
      ) : null}
    </div>
  );
};

export default MetasPage;