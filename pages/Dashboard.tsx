import React, { useMemo, useRef, useEffect } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';
import { Salesperson } from '../types';

// Declare Chart.js for TypeScript since it's loaded from CDN
declare const Chart: any;

const chartColors = {
    primary: '#10b981', // emerald-500
    grid: 'rgba(248, 250, 252, 0.1)',
    text: '#94a3b8', // slate-400
    tooltipBg: '#020617',
    categoryPalette: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669']
};

interface ChartProps {
    type: 'bar' | 'line' | 'doughnut';
    data: any;
    options?: any;
}

const ChartComponent: React.FC<ChartProps> = ({ type, data, options }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current) {
            // Destroy previous chart instance if it exists
            if (chartRef.current) {
                chartRef.current.destroy();
            }
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartRef.current = new Chart(ctx, {
                    type,
                    data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: chartColors.text,
                                    font: {
                                        family: 'sans-serif'
                                    }
                                }
                            },
                            tooltip: {
                                backgroundColor: chartColors.tooltipBg,
                                titleColor: chartColors.text,
                                bodyColor: chartColors.text,
                                borderColor: chartColors.grid,
                                borderWidth: 1
                            }
                        },
                        scales: type === 'line' || type === 'bar' ? {
                            x: {
                                ticks: { color: chartColors.text },
                                grid: { color: 'transparent' }
                            },
                            y: {
                                ticks: { color: chartColors.text },
                                grid: { color: chartColors.grid }
                            }
                        } : undefined,
                        ...options
                    }
                });
            }
        }
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [data, type, options]);

    return <div className="h-64"><canvas ref={canvasRef}></canvas></div>;
};

const ProgressBar: React.FC<{ value: number; max: number; label: string }> = ({ value, max, label }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs font-semibold text-text-secondary">${value.toLocaleString()} / ${max.toLocaleString()}</span>
      </div>
      <div className="w-full bg-tertiary rounded-full h-2.5">
        <div className="bg-accent h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};


const Dashboard: React.FC<{ crmData: CrmDataHook; currentUser: Salesperson }> = ({ crmData, currentUser }) => {
    const { clients, updateClient, incomes, expenses, salespeople, products, categories } = crmData;

    const firstDayOfMonth = useMemo(() => {
        const date = new Date();
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const userIncomes = useMemo(() => currentUser.role === 'admin' ? incomes : incomes.filter(inc => inc.salespersonId === currentUser.id), [incomes, currentUser]);
    
    const incomesThisMonth = useMemo(() => userIncomes.filter(inc => new Date(inc.date) >= firstDayOfMonth), [userIncomes, firstDayOfMonth]);
    const expensesThisMonth = useMemo(() => expenses.filter(exp => new Date(exp.date) >= firstDayOfMonth), [expenses, firstDayOfMonth]);

    // Data for Sales by Salesperson Chart
    const salesBySalesperson = useMemo(() => {
        const salesData = salespeople.map(sp => ({
            id: sp.id,
            name: sp.name,
            total: 0
        }));
        
        incomesThisMonth.forEach(inc => {
            const salesperson = salesData.find(sp => sp.id === inc.salespersonId);
            if (salesperson) {
                salesperson.total += inc.amount;
            }
        });
        
        const sortedData = salesData.sort((a,b) => b.total - a.total);
        return {
            labels: sortedData.map(d => d.name),
            datasets: [{
                label: 'Ingresos',
                data: sortedData.map(d => d.total),
                backgroundColor: chartColors.primary,
                borderColor: chartColors.primary,
                borderWidth: 1
            }]
        };
    }, [incomesThisMonth, salespeople]);

    // Data for Income by Category Chart
    const salesByCategory = useMemo(() => {
        const categoryData = categories.map(cat => ({ id: cat.id, name: cat.name, total: 0 }));
        
        incomesThisMonth.forEach(inc => {
            const product = products.find(p => p.id === inc.productId);
            if (product) {
                const category = categoryData.find(c => c.id === product.categoryId);
                if (category) {
                    category.total += inc.amount;
                }
            }
        });

        const filteredData = categoryData.filter(d => d.total > 0);
        return {
            labels: filteredData.map(d => d.name),
            datasets: [{
                data: filteredData.map(d => d.total),
                backgroundColor: chartColors.categoryPalette,
                hoverOffset: 4
            }]
        };
    }, [incomesThisMonth, categories, products]);

    // Data for Income vs Expense Chart
    const incomeVsExpenseData = useMemo(() => {
        const daysInMonth = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth() + 1, 0).getDate();
        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        
        const dailyIncome = new Array(daysInMonth).fill(0);
        const dailyExpense = new Array(daysInMonth).fill(0);

        incomesThisMonth.forEach(inc => {
            const day = new Date(inc.date).getUTCDate() - 1;
            dailyIncome[day] += inc.amount;
        });
        expensesThisMonth.forEach(exp => {
            const day = new Date(exp.date).getUTCDate() - 1;
            dailyExpense[day] += exp.amount;
        });

        return {
            labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: dailyIncome,
                    borderColor: chartColors.primary,
                    backgroundColor: `${chartColors.primary}33`,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Gastos',
                    data: dailyExpense,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef444433',
                    fill: true,
                    tension: 0.3
                }
            ]
        };
    }, [incomesThisMonth, expensesThisMonth, firstDayOfMonth]);

    const pendingCalls = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const userClients = clients.filter(client => client.salespersonId === currentUser.id);
        return userClients.filter(client => client.dateToCall && client.dateToCall <= todayStr && (!client.dateCalled || client.dateCalled < client.dateToCall));
    }, [clients, currentUser]);

    const handleMarkAsCalled = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            updateClient({ ...client, dateCalled: new Date().toISOString().split('T')[0] });
        }
    };
    const handleReschedule = (clientId: string, newDate: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client && newDate) {
            updateClient({ ...client, dateToCall: newDate });
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('es-ES', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    
    const categoryGoals = useMemo(() => {
        return categories.map(category => {
            const categoryProducts = products.filter(p => p.categoryId === category.id);
            const totalGoal = categoryProducts.reduce((sum, p) => sum + (p.monthlyGoal || 0), 0);
            const totalIncome = incomesThisMonth.filter(income => categoryProducts.some(p => p.id === income.productId)).reduce((sum, income) => sum + income.amount, 0);
            return { ...category, totalGoal, totalIncome };
        });
    }, [categories, products, incomesThisMonth]);


    return (
        <div>
            <h1 className="text-3xl font-bold text-text-primary mb-6">Dashboard de {currentUser.name.split(' ')[0]}</h1>
            
            {currentUser.role === 'admin' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold text-text-primary mb-4">Ingresos por Vendedor</h2>
                        <ChartComponent type="bar" data={salesBySalesperson} />
                    </div>
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold text-text-primary mb-4">Ingresos vs. Gastos</h2>
                        <ChartComponent type="line" data={incomeVsExpenseData} />
                    </div>
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold text-text-primary mb-4">Ingresos por Categoría</h2>
                        <ChartComponent type="doughnut" data={salesByCategory} />
                    </div>
                </div>
            )}

            <div className="mt-8 bg-secondary p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold text-text-primary mb-4">Progreso de Metas del Mes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categoryGoals.map(cg => (
                  <ProgressBar key={cg.id} label={cg.name} value={cg.totalIncome} max={cg.totalGoal} />
                ))}
              </div>
            </div>
      
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-text-primary mb-4">Llamadas Pendientes para Hoy</h2>
              {pendingCalls.length === 0 ? (
                 <div className="text-center py-10 bg-secondary rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <h3 className="mt-2 text-lg font-medium text-text-primary">¡Todo al día!</h3>
                      <p className="mt-1 text-sm text-text-secondary">No tienes llamadas pendientes.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingCalls.map(client => (
                      <div key={client.id} className="bg-secondary p-5 rounded-lg shadow-lg flex flex-col justify-between record-item">
                          <div>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="font-bold text-lg text-text-primary">{client.company}</p>
                                      <p className="text-sm text-text-secondary -mt-1">{client.name}</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-xs text-text-secondary">Llamar el:</p>
                                     <p className="font-semibold text-accent">{formatDate(client.dateToCall)}</p>
                                  </div>
                              </div>
                              <div className="mt-4 text-sm space-y-2 border-t border-tertiary pt-4">
                                  <p><span className="font-semibold text-text-secondary">Tel:</span> {client.phone || 'N/A'}</p>
                                  <p><span className="font-semibold text-text-secondary">Cel:</span> {client.mobile || 'N/A'}</p>
                              </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-tertiary flex flex-col sm:flex-row gap-2">
                              <button onClick={() => handleMarkAsCalled(client.id)} className="w-full text-center bg-accent/20 text-accent font-semibold py-2 px-3 rounded-md text-sm hover:bg-accent/40 transition-colors">
                                  Marcar como Llamado
                              </button>
                              <input 
                                  type="date"
                                  onChange={(e) => handleReschedule(client.id, e.target.value)}
                                  className="w-full bg-tertiary p-2 rounded-md text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                  title="Reprogramar llamada"
                              />
                          </div>
                      </div>
                  ))}
                  </div>
              )}
            </div>
        </div>
    );
};

export default Dashboard;