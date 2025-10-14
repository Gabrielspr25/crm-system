import React, { useState, useEffect, useMemo } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';

interface MotivationalDashboardProps {
  crmData: CrmDataHook;
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

interface SalespersonStats {
  id: string;
  name: string;
  currentSales: number;
  monthlyGoal: number;
  percentage: number;
  position: number;
  trend: 'up' | 'down' | 'stable';
  streakDays: number;
}

const MotivationalDashboard: React.FC<MotivationalDashboardProps> = ({ crmData, currentUser }) => {
  const { salespeople, incomes, metas } = crmData;
  const [animateProgress, setAnimateProgress] = useState(false);
  
  // Debug log para verificar metas
  console.log('🎯 MotivationalDashboard: Metas recibidas:', metas?.length || 0, metas);

  // Calcular estadísticas de vendedores usando metas reales
  const salespersonStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const stats: SalespersonStats[] = salespeople
      .filter(sp => sp.role !== 'admin') // Solo vendedores, no admins
      .map(salesperson => {
      // Buscar TODAS las metas activas para este vendedor y sumarlas
      const vendedorMetas = metas?.filter(m => 
        m.vendedor_id === salesperson.id && 
        m.activa && 
        m.periodo === 'mensual'
      ) || [];
      
      // Calcular ventas del mes actual usando incomes
      const monthlySales = incomes
        .filter(income => {
          const incomeDate = new Date(income.date);
          return income.salespersonId === salesperson.id &&
                 incomeDate.getMonth() === currentMonth &&
                 incomeDate.getFullYear() === currentYear;
        })
        .reduce((total, income) => total + income.amount, 0);

      // Sumar TODAS las metas del vendedor
      const totalGoal = vendedorMetas.reduce((sum, meta) => {
        return sum + (parseFloat(meta.meta_valor.toString()) || 0);
      }, 0);
      
      // Si no tiene metas en BD, usar meta por defecto
      const goal = totalGoal > 0 ? totalGoal : (salesperson.monthlySalesGoal || 5000);
      const percentage = goal > 0 ? Math.round((monthlySales / goal) * 100) : 0;

      console.log(`📊 ${salesperson.name}: ${vendedorMetas.length} metas, Total: $${goal.toLocaleString()}`);

      return {
        id: salesperson.id,
        name: salesperson.name,
        currentSales: monthlySales,
        monthlyGoal: goal,
        percentage,
        position: 0, // Se calculará después del sort
        trend: monthlySales > goal * 0.8 ? 'up' : monthlySales < goal * 0.4 ? 'down' : 'stable',
        streakDays: Math.floor(Math.random() * 10) + 1 // Simulado por ahora
      };
    });

    // Ordenar por porcentaje de meta y asignar posiciones
    return stats
      .sort((a, b) => b.percentage - a.percentage)
      .map((stat, index) => ({ ...stat, position: index + 1 }));
  }, [salespeople, incomes, metas]);

  // Encontrar stats del usuario actual
  const currentUserStats = salespersonStats.find(stat => stat.id === currentUser.id);

  // Calcular estadísticas del equipo
  const teamStats = useMemo(() => {
    const totalSales = salespersonStats.reduce((sum, stat) => sum + stat.currentSales, 0);
    const totalGoal = salespersonStats.reduce((sum, stat) => sum + stat.monthlyGoal, 0);
    const teamPercentage = totalGoal > 0 ? Math.round((totalSales / totalGoal) * 100) : 0;
    
    return {
      totalSales,
      totalGoal,
      percentage: teamPercentage,
      activeSalespeople: salespeople.length,
      topPerformer: salespersonStats[0]
    };
  }, [salespersonStats, salespeople]);

  // Animación de las barras de progreso
  useEffect(() => {
    const timer = setTimeout(() => setAnimateProgress(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Mensajes motivacionales dinámicos
  const getMotivationalMessage = (stats: SalespersonStats) => {
    if (stats.position === 1 && stats.percentage >= 100) {
      return {
        title: "🎊 ¡BIENVENIDO CAMPEÓN! 🎊",
        subtitle: `🔥 ${stats.name.toUpperCase()} - VENDEDOR #1 🔥`,
        message: `¡Eres IMPARABLE! ${stats.percentage}% de tu meta completada`,
        subMessage: "Todo el equipo te admira. ¡Sigue brillando! ⭐",
        bgGradient: "from-yellow-400 via-yellow-500 to-yellow-600",
        textColor: "text-yellow-900"
      };
    } else if (stats.position === 1) {
      return {
        title: "🏆 ¡ERES EL LÍDER! 🏆",
        subtitle: `⚡ ${stats.name.toUpperCase()} - PRIMER LUGAR ⚡`,
        message: `${stats.percentage}% completado - ¡Vas en la cima!`,
        subMessage: "¡La corona es tuya! Mantén el ritmo 🔥",
        bgGradient: "from-purple-500 via-purple-600 to-indigo-600",
        textColor: "text-white"
      };
    } else if (stats.position === 2) {
      return {
        title: "⚡ ¡EXCELENTE TRABAJO! ⚡",
        subtitle: `💪 ${stats.name.toUpperCase()} - SEGUNDO LUGAR 💪`,
        message: `¡Estás a solo $${(salespersonStats[0].currentSales - stats.currentSales).toLocaleString()} del primer lugar!`,
        subMessage: "¡El liderazgo está al alcance! 🚀",
        bgGradient: "from-green-500 via-green-600 to-emerald-600",
        textColor: "text-white"
      };
    } else if (stats.percentage >= 80) {
      return {
        title: "💪 ¡SIGUE ASÍ! 💪",
        subtitle: `🎯 ${stats.name.toUpperCase()} - EXCELENTE RITMO 🎯`,
        message: `${stats.percentage}% completado - ¡Vas por buen camino!`,
        subMessage: `Solo $${(stats.monthlyGoal - stats.currentSales).toLocaleString()} más para tu meta 🎯`,
        bgGradient: "from-blue-500 via-blue-600 to-cyan-600",
        textColor: "text-white"
      };
    } else {
      const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
      return {
        title: "💡 ¡TÚ PUEDES! 💡",
        subtitle: `🚀 ${stats.name.toUpperCase()} - ¡VAMOS POR MÁS! 🚀`,
        message: `${stats.percentage}% completado - Aún tienes ${daysLeft} días para brillar`,
        subMessage: "Cada llamada te acerca más a tu meta 📞",
        bgGradient: "from-orange-500 via-red-500 to-pink-500",
        textColor: "text-white"
      };
    }
  };

  // Vista Admin - Dashboard General CON RANKING
  if (currentUser.role === 'admin') {
    return (
      <div className="mb-8">
        {/* Header Principal */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl p-6 mb-6 shadow-2xl border border-slate-600">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              🏆 RANKING DE VENDEDORES - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
            </h1>
            <p className="text-slate-300">Dashboard administrativo • Meta total: ${teamStats.totalGoal.toLocaleString()}</p>
          </div>
        </div>

        {/* Métricas Generales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Meta Empresa</p>
                <p className="text-3xl font-bold">${teamStats.totalGoal.toLocaleString()}</p>
                <p className="text-emerald-200 text-sm">{teamStats.percentage}% completado</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
            <div className="mt-4 bg-emerald-800 rounded-full h-3">
              <div 
                className={`bg-white rounded-full h-3 transition-all duration-1000 ease-out ${animateProgress ? 'animate-pulse' : ''}`}
                style={{ width: `${Math.min(teamStats.percentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Vendedores Activos</p>
                <p className="text-3xl font-bold">{teamStats.activeSalespeople}</p>
                <p className="text-blue-200 text-sm">En el equipo</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Top Performer</p>
                <p className="text-xl font-bold">{teamStats.topPerformer?.name}</p>
                <p className="text-purple-200 text-sm">{teamStats.topPerformer?.percentage}% meta</p>
              </div>
              <div className="text-4xl">🏆</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">Ventas Totales</p>
                <p className="text-3xl font-bold">${teamStats.totalSales.toLocaleString()}</p>
                <p className="text-indigo-200 text-sm">Este mes</p>
              </div>
              <div className="text-4xl">💸</div>
            </div>
          </div>
        </div>

        {/* Nueva sección: Progreso Individual por Vendedor */}
        <div className="bg-secondary p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">🎯 Progreso Individual de Vendedores</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {salespersonStats.map(sp => {
              // Calcular progreso por categoría (simulado por ahora)
              const vendedorMetas = metas?.filter(m => 
                m.vendedor_id === sp.id && 
                m.activa && 
                m.periodo === 'mensual'
              ) || [];
              
              const categoryProgress = vendedorMetas.map(meta => {
                const categoryNames = {
                  20000: 'Móvil Nuevo',
                  15000: 'Fijo Nuevo', 
                  12000: 'Móvil Renovación',
                  10000: 'Fijo Renovación',
                  8000: 'Claro TV'
                };
                
                const categoryName = categoryNames[meta.meta_valor as keyof typeof categoryNames] || 'Categoría';
                const categoryProportion = meta.meta_valor / sp.monthlyGoal;
                const categorySales = sp.currentSales * categoryProportion;
                const categoryProgress = meta.meta_valor > 0 ? (categorySales / meta.meta_valor) * 100 : 0;
                
                return {
                  categoria: categoryName,
                  meta: meta.meta_valor,
                  ventas: categorySales,
                  progreso: categoryProgress
                };
              });
              
              return (
                <div key={sp.id} className="p-4 rounded-lg bg-tertiary">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-text-primary">{sp.name}</h3>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        sp.percentage >= 100 ? 'text-green-400' :
                        sp.percentage >= 75 ? 'text-yellow-400' :
                        sp.percentage >= 50 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {sp.percentage}%
                      </span>
                      {sp.percentage >= 100 && <span className="ml-2 text-lg">🏆</span>}
                      {sp.percentage >= 75 && sp.percentage < 100 && <span className="ml-2 text-lg">🔥</span>}
                      {sp.percentage >= 50 && sp.percentage < 75 && <span className="ml-2 text-lg">⚡</span>}
                    </div>
                  </div>
                  
                  {/* Progreso general */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-text-primary">Meta Total: ${sp.monthlyGoal.toLocaleString()}</span>
                      <span className="text-xs font-semibold text-text-secondary">${sp.currentSales.toLocaleString()} / ${sp.monthlyGoal.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-tertiary rounded-full h-2.5">
                      <div className="bg-accent h-2.5 rounded-full" style={{ width: `${Math.min(sp.percentage, 100)}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Desglose por categorías */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-text-secondary mb-2">🎯 Desglose por Categorías:</h4>
                    {categoryProgress.map((cat, idx) => (
                      <div key={idx} className="bg-primary/20 rounded p-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-secondary">{cat.categoria}</span>
                          <span className={`font-medium ${
                            cat.progreso >= 100 ? 'text-green-400' :
                            cat.progreso >= 75 ? 'text-yellow-400' :
                            'text-text-primary'
                          }`}>
                            {cat.progreso.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-primary rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              cat.progreso >= 100 ? 'bg-green-400' :
                              cat.progreso >= 75 ? 'bg-yellow-400' :
                              cat.progreso >= 50 ? 'bg-orange-400' :
                              'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(cat.progreso, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-text-secondary mt-1 text-center">
                          ${cat.ventas.toLocaleString('en-US', {maximumFractionDigits: 0})} / ${cat.meta.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ranking de Vendedores */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            🏆 RANKING DE VENDEDORES
          </h2>
          <div className="space-y-4">
            {salespersonStats.map((stat) => {
              const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
              const medal = medals[stat.position - 1] || `${stat.position}️⃣`;
              
              return (
                <div key={stat.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{medal}</span>
                    <div>
                      <p className="text-white font-semibold">{stat.name}</p>
                      <p className="text-slate-300 text-sm">${stat.currentSales.toLocaleString()} / ${stat.monthlyGoal.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-white font-bold">{stat.percentage}%</p>
                      <div className="w-20 bg-slate-600 rounded-full h-2 mt-1">
                        <div 
                          className={`rounded-full h-2 transition-all duration-1000 ${
                            stat.percentage >= 100 ? 'bg-green-400 animate-pulse' :
                            stat.percentage >= 80 ? 'bg-blue-400' :
                            stat.percentage >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-2xl">
                      {stat.percentage >= 100 ? '🔥' : stat.percentage >= 80 ? '⚡' : stat.percentage >= 60 ? '📈' : '⚠️'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Vista Vendedor - Dashboard Personal (SOLO SUS METAS)
  if (currentUserStats) {
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    
    // Mensaje motivacional simplificado basado solo en % de meta
    const getPersonalMessage = () => {
      if (currentUserStats.percentage >= 100) {
        return {
          title: "🎆 ¡META COMPLETADA! 🎆",
          subtitle: "Felicitaciones por tu excelente desempeño",
          bgGradient: "from-green-400 via-green-500 to-emerald-600",
          textColor: "text-white"
        };
      } else if (currentUserStats.percentage >= 80) {
        return {
          title: "🔥 ¡Vas Excelente! 🔥",
          subtitle: "Estás muy cerca de tu meta mensual",
          bgGradient: "from-blue-500 via-blue-600 to-cyan-600",
          textColor: "text-white"
        };
      } else if (currentUserStats.percentage >= 50) {
        return {
          title: "💪 ¡Sigue Así! 💪",
          subtitle: "Vas por buen camino hacia tu meta",
          bgGradient: "from-purple-500 via-purple-600 to-indigo-600",
          textColor: "text-white"
        };
      } else {
        return {
          title: "🎯 ¡A Por Tu Meta! 🎯",
          subtitle: `Tienes ${daysLeft} días para alcanzar tu objetivo`,
          bgGradient: "from-orange-500 via-red-500 to-pink-500",
          textColor: "text-white"
        };
      }
    };
    
    const personalMsg = getPersonalMessage();

    return (
      <div className="mb-8">
        {/* Mensaje Motivacional Personal */}
        <div className={`bg-gradient-to-r ${personalMsg.bgGradient} rounded-xl p-8 mb-6 shadow-2xl relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black bg-opacity-10"></div>
          
          <div className={`relative z-10 text-center ${personalMsg.textColor}`}>
            <h1 className="text-3xl font-bold mb-2">
              {personalMsg.title}
            </h1>
            <h2 className="text-xl font-semibold mb-4">
              {personalMsg.subtitle}
            </h2>
            <div className="text-2xl font-bold mb-2">
              ${currentUserStats.currentSales.toLocaleString()} / ${currentUserStats.monthlyGoal.toLocaleString()}
            </div>
            <div className="text-lg">
              {currentUserStats.percentage}% de tu meta completada
            </div>
          </div>
        </div>

        {/* Métricas Personales Simplificadas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-green-100 text-sm font-medium">Tu Meta Mensual</p>
              <p className="text-3xl font-bold">${currentUserStats.monthlyGoal.toLocaleString()}</p>
              <p className="text-green-200 text-sm">Objetivo del mes</p>
            </div>
            <div className="absolute -top-8 -right-8 text-8xl opacity-20">🎯</div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-100 text-sm font-medium">Ventas Actuales</p>
              <p className="text-3xl font-bold">${currentUserStats.currentSales.toLocaleString()}</p>
              <p className="text-blue-200 text-sm">{currentUserStats.percentage}% completado</p>
            </div>
            <div className="absolute -top-8 -right-8 text-8xl opacity-20">💰</div>
            <div className="mt-4 bg-blue-800 rounded-full h-3">
              <div 
                className={`bg-white rounded-full h-3 transition-all duration-2000 ease-out ${
                  currentUserStats.percentage >= 100 ? 'animate-pulse' : ''
                }`}
                style={{ width: `${Math.min(currentUserStats.percentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-purple-100 text-sm font-medium">Falta Para Meta</p>
              <p className="text-2xl font-bold">${Math.max(0, currentUserStats.monthlyGoal - currentUserStats.currentSales).toLocaleString()}</p>
              <p className="text-purple-200 text-sm">{daysLeft} días restantes</p>
            </div>
            <div className="absolute -top-8 -right-8 text-8xl opacity-20">⏰</div>
          </div>
        </div>

        {/* Progreso y Motivación */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-6 text-white shadow-lg">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              🏅 TU PROGRESO
            </h3>
            <div className="space-y-3">
              {currentUserStats.percentage >= 100 ? (
                <div className="flex items-center text-green-400">
                  <span className="text-2xl mr-3">✅</span>
                  <span className="font-semibold">Meta completada - ¡Felicitaciones!</span>
                </div>
              ) : currentUserStats.percentage >= 75 ? (
                <div className="flex items-center text-blue-400">
                  <span className="text-2xl mr-3">🔥</span>
                  <span className="font-semibold">Muy cerca de tu meta - ¡Sigue así!</span>
                </div>
              ) : currentUserStats.percentage >= 50 ? (
                <div className="flex items-center text-yellow-400">
                  <span className="text-2xl mr-3">💪</span>
                  <span className="font-semibold">Vas por buen camino</span>
                </div>
              ) : (
                <div className="flex items-center text-orange-400">
                  <span className="text-2xl mr-3">🎯</span>
                  <span className="font-semibold">Enfoque en tu objetivo</span>
                </div>
              )}
              
              <div className="text-slate-300 text-sm">
                Cada venta te acerca más a tu meta de ${currentUserStats.monthlyGoal.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-700 to-indigo-800 rounded-xl p-6 text-white shadow-lg">
            <h3 className="text-xl font-bold mb-4">🞯 PRÓXIMO OBJETIVO</h3>
            <div className="text-center">
              {currentUserStats.percentage >= 100 ? (
                <>
                  <p className="text-green-300 text-lg mb-2">¡Meta superada!</p>
                  <p className="text-indigo-200 text-sm">
                    Sigue cerrando ventas para maximizar tus ingresos
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-white mb-2">
                    ${Math.max(0, currentUserStats.monthlyGoal - currentUserStats.currentSales).toLocaleString()}
                  </p>
                  <p className="text-indigo-200 text-sm">
                    Te faltan para completar tu meta de ${currentUserStats.monthlyGoal.toLocaleString()}
                  </p>
                </>
              )}
              <div className="text-3xl mt-3 animate-bounce">🎯</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MotivationalDashboard;
