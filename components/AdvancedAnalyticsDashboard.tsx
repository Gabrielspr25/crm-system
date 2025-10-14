import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
} from 'chart.js';
import { Line, Bar, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AdvancedAnalyticsDashboardProps {
  metas: any[];
  incomes: any[];
  salespeople: any[];
  currentUser: any;
  metasWithProgress: any[];
}

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  metas,
  incomes,
  salespeople,
  currentUser,
  metasWithProgress
}) => {
  const [analysisTimeframe, setAnalysisTimeframe] = useState<'3m' | '6m' | '12m'>('6m');
  const [selectedMetric, setSelectedMetric] = useState<'sales' | 'completion' | 'efficiency'>('sales');

  // Calcular datos históricos y tendencias
  const historicalAnalysis = useMemo(() => {
    const now = new Date();
    const monthsBack = analysisTimeframe === '3m' ? 3 : analysisTimeframe === '6m' ? 6 : 12;
    
    const monthlyData = [];
    
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      const monthMetas = metasWithProgress.filter(meta => 
        meta.month === month && meta.year === year
      );
      
      const monthIncomes = incomes.filter(income => {
        const incomeDate = new Date(income.date);
        return incomeDate.getMonth() + 1 === month && incomeDate.getFullYear() === year;
      });
      
      const totalMetaValue = monthMetas.reduce((sum, meta) => sum + meta.metaValor, 0);
      const totalSales = monthIncomes.reduce((sum, income) => sum + income.amount, 0);
      const completedMetas = monthMetas.filter(meta => meta.status === 'completada').length;
      const totalMetas = monthMetas.length;
      const completionRate = totalMetas > 0 ? (completedMetas / totalMetas) * 100 : 0;
      const efficiency = totalMetaValue > 0 ? (totalSales / totalMetaValue) * 100 : 0;
      
      monthlyData.push({
        period: `${year}-${String(month).padStart(2, '0')}`,
        label: date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        totalMetaValue,
        totalSales,
        completionRate,
        efficiency,
        metasCount: totalMetas,
        salesCount: monthIncomes.length
      });
    }
    
    return monthlyData;
  }, [metasWithProgress, incomes, analysisTimeframe]);

  // Predicción de tendencias usando regresión lineal simple
  const forecastingData = useMemo(() => {
    if (historicalAnalysis.length < 3) return null;
    
    const salesData = historicalAnalysis.map(h => h.totalSales);
    const n = salesData.length;
    
    // Regresión lineal simple para predecir próximos 3 meses
    const xSum = (n * (n + 1)) / 2;
    const ySum = salesData.reduce((sum, val) => sum + val, 0);
    const xySum = salesData.reduce((sum, val, idx) => sum + val * (idx + 1), 0);
    const x2Sum = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    const predictions = [];
    for (let i = 1; i <= 3; i++) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + i);
      
      const predictedValue = slope * (n + i) + intercept;
      predictions.push({
        period: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
        label: nextMonth.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        predictedSales: Math.max(0, predictedValue),
        confidence: Math.max(60, 95 - i * 10) // Confianza decrece con el tiempo
      });
    }
    
    return predictions;
  }, [historicalAnalysis]);

  // Análisis de patrones estacionales
  const seasonalAnalysis = useMemo(() => {
    const monthlyAverages = new Array(12).fill(0).map(() => ({ sales: 0, count: 0 }));
    
    incomes.forEach(income => {
      const month = new Date(income.date).getMonth();
      monthlyAverages[month].sales += income.amount;
      monthlyAverages[month].count++;
    });
    
    return monthlyAverages.map((data, index) => ({
      month: new Date(0, index).toLocaleDateString('es-ES', { month: 'short' }),
      avgSales: data.count > 0 ? data.sales / data.count : 0,
      dataPoints: data.count
    }));
  }, [incomes]);

  // Análisis de rendimiento por vendedor con scoring
  const vendorPerformanceAnalysis = useMemo(() => {
    return salespeople.map(vendor => {
      const vendorMetas = metasWithProgress.filter(meta => meta.vendedorId === vendor.id);
      const vendorIncomes = incomes.filter(income => income.salespersonId === vendor.id);
      
      if (vendorMetas.length === 0) return null;
      
      const completionRate = vendorMetas.filter(meta => meta.status === 'completada').length / vendorMetas.length;
      const avgProgress = vendorMetas.reduce((sum, meta) => sum + meta.progressPercent, 0) / vendorMetas.length;
      const consistency = 1 - (vendorMetas.reduce((sum, meta) => sum + Math.abs(meta.progressPercent - avgProgress), 0) / vendorMetas.length / 100);
      const totalSales = vendorIncomes.reduce((sum, income) => sum + income.amount, 0);
      const salesVelocity = vendorIncomes.length > 0 ? totalSales / vendorIncomes.length : 0;
      
      // Scoring compuesto (0-100)
      const performanceScore = Math.round(
        (completionRate * 30) +
        (Math.min(avgProgress, 100) / 100 * 25) +
        (consistency * 20) +
        (Math.min(salesVelocity / 1000, 1) * 25)
      );
      
      return {
        ...vendor,
        completionRate: completionRate * 100,
        avgProgress,
        consistency: consistency * 100,
        salesVelocity,
        performanceScore,
        metasCount: vendorMetas.length,
        salesCount: vendorIncomes.length
      };
    }).filter(Boolean);
  }, [salespeople, metasWithProgress, incomes]);

  // Datos para gráfico de tendencias
  const trendChartData = {
    labels: [...historicalAnalysis.map(h => h.label), ...(forecastingData?.map(f => f.label) || [])],
    datasets: [
      {
        label: 'Ventas Históricas',
        data: [...historicalAnalysis.map(h => h.totalSales), ...new Array(forecastingData?.length || 0).fill(null)],
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: false,
      },
      {
        label: 'Predicción',
        data: [...new Array(historicalAnalysis.length).fill(null), ...(forecastingData?.map(f => f.predictedSales) || [])],
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
      }
    ]
  };

  // Datos para análisis estacional
  const seasonalChartData = {
    labels: seasonalAnalysis.map(s => s.month),
    datasets: [
      {
        label: 'Ventas Promedio Mensuales',
        data: seasonalAnalysis.map(s => s.avgSales),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3B82F6',
        borderWidth: 2,
      }
    ]
  };

  // Datos para gráfico radar de performance
  const performanceRadarData = {
    labels: ['Tasa Completación', 'Progreso Promedio', 'Consistencia', 'Velocidad Ventas', 'Score General'],
    datasets: vendorPerformanceAnalysis.slice(0, 3).map((vendor, index) => ({
      label: vendor.name,
      data: [
        vendor.completionRate,
        vendor.avgProgress,
        vendor.consistency,
        Math.min(vendor.salesVelocity / 100, 100), // Normalizar
        vendor.performanceScore
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.2)',
        'rgba(59, 130, 246, 0.2)',
        'rgba(168, 85, 247, 0.2)'
      ][index],
      borderColor: [
        '#22C55E',
        '#3B82F6',
        '#A855F7'
      ][index],
      pointBackgroundColor: [
        '#22C55E',
        '#3B82F6',
        '#A855F7'
      ][index],
    }))
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgb(156, 163, 175)',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: 'rgb(243, 244, 246)',
        bodyColor: 'rgb(209, 213, 219)',
        borderColor: 'rgb(75, 85, 99)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        ticks: { color: 'rgb(156, 163, 175)' },
        grid: { color: 'rgba(75, 85, 99, 0.2)' }
      },
      y: {
        ticks: { color: 'rgb(156, 163, 175)' },
        grid: { color: 'rgba(75, 85, 99, 0.2)' }
      }
    }
  };

  // Calcular métricas clave
  const keyMetrics = useMemo(() => {
    const currentMonth = historicalAnalysis[historicalAnalysis.length - 1];
    const previousMonth = historicalAnalysis[historicalAnalysis.length - 2];
    
    if (!currentMonth || !previousMonth) return null;
    
    const salesGrowth = previousMonth.totalSales > 0 
      ? ((currentMonth.totalSales - previousMonth.totalSales) / previousMonth.totalSales) * 100 
      : 0;
    
    const efficiencyGrowth = previousMonth.efficiency > 0
      ? ((currentMonth.efficiency - previousMonth.efficiency) / previousMonth.efficiency) * 100
      : 0;
    
    return {
      salesGrowth,
      efficiencyGrowth,
      currentEfficiency: currentMonth.efficiency,
      predictedNextMonth: forecastingData?.[0]?.predictedSales || 0,
      bestPerformer: vendorPerformanceAnalysis[0]?.name || 'N/A'
    };
  }, [historicalAnalysis, forecastingData, vendorPerformanceAnalysis]);

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="bg-secondary rounded-lg shadow-lg p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">📊 Análisis Avanzado</h2>
          
          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-text-secondary">Período:</label>
              <select
                value={analysisTimeframe}
                onChange={(e) => setAnalysisTimeframe(e.target.value as any)}
                className="bg-tertiary text-text-primary px-3 py-1 rounded border border-border focus:ring-2 focus:ring-accent"
              >
                <option value="3m">Últimos 3 meses</option>
                <option value="6m">Últimos 6 meses</option>
                <option value="12m">Últimos 12 meses</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-text-secondary">Métrica:</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="bg-tertiary text-text-primary px-3 py-1 rounded border border-border focus:ring-2 focus:ring-accent"
              >
                <option value="sales">Ventas</option>
                <option value="completion">Completación</option>
                <option value="efficiency">Eficiencia</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas clave */}
      {keyMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-secondary rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Crecimiento Ventas</h3>
            <p className={`text-2xl font-bold ${keyMetrics.salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {keyMetrics.salesGrowth >= 0 ? '+' : ''}{keyMetrics.salesGrowth.toFixed(1)}%
            </p>
            <p className="text-xs text-text-secondary">vs mes anterior</p>
          </div>
          
          <div className="bg-secondary rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Eficiencia Actual</h3>
            <p className="text-2xl font-bold text-blue-400">{keyMetrics.currentEfficiency.toFixed(1)}%</p>
            <p className={`text-xs ${keyMetrics.efficiencyGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {keyMetrics.efficiencyGrowth >= 0 ? '↗' : '↘'} {Math.abs(keyMetrics.efficiencyGrowth).toFixed(1)}%
            </p>
          </div>
          
          <div className="bg-secondary rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Predicción Próximo Mes</h3>
            <p className="text-2xl font-bold text-purple-400">
              ${keyMetrics.predictedNextMonth.toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary">
              {forecastingData?.[0]?.confidence}% confianza
            </p>
          </div>
          
          <div className="bg-secondary rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Mejor Performer</h3>
            <p className="text-lg font-bold text-accent">{keyMetrics.bestPerformer}</p>
            <p className="text-xs text-text-secondary">
              {vendorPerformanceAnalysis[0]?.performanceScore || 0} puntos
            </p>
          </div>
          
          <div className="bg-secondary rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Datos Analizados</h3>
            <p className="text-2xl font-bold text-accent">{historicalAnalysis.length}</p>
            <p className="text-xs text-text-secondary">meses de historial</p>
          </div>
        </div>
      )}

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencias y Predicción */}
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            📈 Tendencias y Predicción
          </h3>
          <div className="h-80">
            <Line data={trendChartData} options={chartOptions} />
          </div>
          {forecastingData && (
            <div className="mt-4 p-3 bg-tertiary rounded-lg">
              <p className="text-sm text-text-secondary">
                <strong>Próximos 3 meses (predicción):</strong>
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {forecastingData.map((pred, idx) => (
                  <div key={idx} className="text-center">
                    <div className="font-medium text-text-primary">{pred.label}</div>
                    <div className="text-sm text-accent">${pred.predictedSales.toLocaleString()}</div>
                    <div className="text-xs text-text-secondary">{pred.confidence}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Análisis Estacional */}
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            🌡️ Patrones Estacionales
          </h3>
          <div className="h-80">
            <Bar data={seasonalChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Performance Radar y Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar de Performance */}
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            🎯 Análisis de Performance (Top 3)
          </h3>
          <div className="h-80">
            <Radar 
              data={performanceRadarData} 
              options={{
                ...chartOptions,
                scales: {
                  r: {
                    ticks: { color: 'rgb(156, 163, 175)' },
                    grid: { color: 'rgba(75, 85, 99, 0.2)' },
                    pointLabels: { color: 'rgb(156, 163, 175)' }
                  }
                }
              }} 
            />
          </div>
        </div>

        {/* Rankings Detallados */}
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            🏆 Rankings Detallados
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {vendorPerformanceAnalysis
              .sort((a, b) => b.performanceScore - a.performanceScore)
              .map((vendor, index) => (
                <div key={vendor.id} className="flex items-center justify-between p-3 bg-tertiary rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{vendor.name}</p>
                      <div className="flex space-x-4 text-xs text-text-secondary">
                        <span>Completación: {vendor.completionRate.toFixed(1)}%</span>
                        <span>Consistencia: {vendor.consistency.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">{vendor.performanceScore}</div>
                    <div className="text-xs text-text-secondary">Score</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Insights y Recomendaciones */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          🔍 Insights y Recomendaciones
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {keyMetrics && (
            <>
              <div className="p-4 bg-tertiary rounded-lg">
                <div className="flex items-center mb-2">
                  <span className="text-lg mr-2">
                    {keyMetrics.salesGrowth >= 0 ? '📈' : '📉'}
                  </span>
                  <h4 className="font-medium text-text-primary">Tendencia de Ventas</h4>
                </div>
                <p className="text-sm text-text-secondary">
                  {keyMetrics.salesGrowth >= 5 
                    ? 'Excelente crecimiento. Mantén las estrategias actuales.'
                    : keyMetrics.salesGrowth >= 0
                    ? 'Crecimiento positivo pero moderado. Considera intensificar esfuerzos.'
                    : 'Tendencia negativa. Revisa estrategias y procesos.'}
                </p>
              </div>

              <div className="p-4 bg-tertiary rounded-lg">
                <div className="flex items-center mb-2">
                  <span className="text-lg mr-2">⚡</span>
                  <h4 className="font-medium text-text-primary">Eficiencia</h4>
                </div>
                <p className="text-sm text-text-secondary">
                  {keyMetrics.currentEfficiency >= 100
                    ? 'Eficiencia excepcional. El equipo supera constantemente las metas.'
                    : keyMetrics.currentEfficiency >= 80
                    ? 'Buena eficiencia. Hay oportunidades de mejora menores.'
                    : 'Eficiencia por debajo del óptimo. Revisa metas y procesos.'}
                </p>
              </div>

              <div className="p-4 bg-tertiary rounded-lg">
                <div className="flex items-center mb-2">
                  <span className="text-lg mr-2">🎯</span>
                  <h4 className="font-medium text-text-primary">Predicción</h4>
                </div>
                <p className="text-sm text-text-secondary">
                  Basado en tendencias actuales, se espera{' '}
                  {forecastingData?.[0]?.predictedSales && historicalAnalysis[historicalAnalysis.length - 1]?.totalSales
                    ? forecastingData[0].predictedSales > historicalAnalysis[historicalAnalysis.length - 1].totalSales
                      ? 'un incremento'
                      : 'una disminución'
                    : 'estabilidad'}{' '}
                  en ventas el próximo mes.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;