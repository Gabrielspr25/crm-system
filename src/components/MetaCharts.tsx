import React, { useMemo } from 'react';
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
import { Bar, Line, Doughnut } from 'react-chartjs-2';

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

interface MetaChartsProps {
  metasWithProgress: any[];
  salespeople: any[];
  incomes: any[];
  selectedPeriod: string;
}

const MetaCharts: React.FC<MetaChartsProps> = ({ 
  metasWithProgress, 
  salespeople, 
  incomes, 
  selectedPeriod 
}) => {
  // Preparar datos para gráfico de progreso por vendedor
  const progressChartData = useMemo(() => {
    const vendorProgress = salespeople.map(vendor => {
      const vendorMetas = metasWithProgress.filter(meta => meta.vendedorId === vendor.id);
      const avgProgress = vendorMetas.length > 0 
        ? vendorMetas.reduce((sum, meta) => sum + meta.progressPercent, 0) / vendorMetas.length
        : 0;
      
      return {
        name: vendor.name,
        progress: Math.round(avgProgress),
        metas: vendorMetas.length
      };
    }).filter(v => v.metas > 0);

    return {
      labels: vendorProgress.map(v => v.name),
      datasets: [
        {
          label: 'Progreso Promedio (%)',
          data: vendorProgress.map(v => v.progress),
          backgroundColor: vendorProgress.map(v => 
            v.progress >= 100 ? '#10B981' :
            v.progress >= 75 ? '#F59E0B' : '#EF4444'
          ),
          borderColor: vendorProgress.map(v => 
            v.progress >= 100 ? '#059669' :
            v.progress >= 75 ? '#D97706' : '#DC2626'
          ),
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  }, [metasWithProgress, salespeople]);

  // Datos para gráfico de tendencia mensual
  const trendChartData = useMemo(() => {
    const currentDate = new Date();
    const months = [];
    
    // Obtener últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        label: date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
      });
    }

    const trendData = months.map(({ month, year }) => {
      const monthMetas = metasWithProgress.filter(meta => 
        meta.month === month && meta.year === year
      );
      
      const totalMeta = monthMetas.reduce((sum, meta) => sum + meta.metaValor, 0);
      const totalSales = monthMetas.reduce((sum, meta) => sum + meta.totalSales, 0);
      
      return {
        month: `${month}/${year}`,
        meta: totalMeta,
        ventas: totalSales,
        cumplimiento: totalMeta > 0 ? (totalSales / totalMeta) * 100 : 0
      };
    });

    return {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Metas ($)',
          data: trendData.map(d => d.meta),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Ventas Reales ($)',
          data: trendData.map(d => d.ventas),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [metasWithProgress]);

  // Datos para gráfico de distribución de estados
  const statusChartData = useMemo(() => {
    const statusCounts = metasWithProgress.reduce((acc, meta) => {
      acc[meta.status] = (acc[meta.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const labels = ['Completadas', 'En Progreso', 'Pendientes'];
    const data = [
      statusCounts['completada'] || 0,
      statusCounts['en-progreso'] || 0,
      statusCounts['pendiente'] || 0,
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
          borderColor: ['#059669', '#D97706', '#DC2626'],
          borderWidth: 2,
        },
      ],
    };
  }, [metasWithProgress]);

  // Top performers
  const topPerformers = useMemo(() => {
    return salespeople
      .map(vendor => {
        const vendorMetas = metasWithProgress.filter(meta => meta.vendedorId === vendor.id);
        const completedMetas = vendorMetas.filter(meta => meta.status === 'completada').length;
        const totalMetas = vendorMetas.length;
        const avgProgress = totalMetas > 0 
          ? vendorMetas.reduce((sum, meta) => sum + meta.progressPercent, 0) / totalMetas
          : 0;
        
        return {
          ...vendor,
          completedMetas,
          totalMetas,
          avgProgress: Math.round(avgProgress),
          completionRate: totalMetas > 0 ? Math.round((completedMetas / totalMetas) * 100) : 0
        };
      })
      .filter(vendor => vendor.totalMetas > 0)
      .sort((a, b) => b.avgProgress - a.avgProgress)
      .slice(0, 5);
  }, [salespeople, metasWithProgress]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgb(156, 163, 175)', // text-gray-400
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)', // gray-900 with opacity
        titleColor: 'rgb(243, 244, 246)', // gray-100
        bodyColor: 'rgb(209, 213, 219)', // gray-300
        borderColor: 'rgb(75, 85, 99)', // gray-600
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgb(156, 163, 175)', // text-gray-400
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)', // gray-600 with opacity
        },
      },
      y: {
        ticks: {
          color: 'rgb(156, 163, 175)', // text-gray-400
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)', // gray-600 with opacity
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progreso por Vendedor */}
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
            📊 Progreso por Vendedor
          </h3>
          <div className="h-64">
            <Bar data={progressChartData} options={chartOptions} />
          </div>
        </div>

        {/* Distribución de Estados */}
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
            🎯 Estado de Metas
          </h3>
          <div className="h-64">
            <Doughnut 
              data={statusChartData} 
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    ...chartOptions.plugins.legend,
                    position: 'bottom' as const,
                  },
                },
              }} 
            />
          </div>
        </div>
      </div>

      {/* Tendencia Mensual */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
          📈 Tendencia de Últimos 6 Meses
        </h3>
        <div className="h-80">
          <Line data={trendChartData} options={chartOptions} />
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
          🏆 Mejores Performers
        </h3>
        <div className="space-y-4">
          {topPerformers.map((performer, index) => (
            <div 
              key={performer.id} 
              className="flex items-center justify-between p-4 bg-tertiary rounded-lg hover:bg-border/50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-orange-600' :
                  'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{performer.name}</p>
                  <p className="text-sm text-text-secondary">
                    {performer.completedMetas}/{performer.totalMetas} metas completadas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-accent">{performer.avgProgress}%</p>
                <p className="text-xs text-text-secondary">progreso promedio</p>
              </div>
            </div>
          ))}
          
          {topPerformers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-text-secondary">No hay datos suficientes para mostrar rankings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetaCharts;