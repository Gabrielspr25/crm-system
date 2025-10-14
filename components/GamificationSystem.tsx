import React, { useMemo, useState } from 'react';
import { Meta } from '../types';

interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition: (data: any) => boolean;
  points: number;
}

interface Achievement {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
  isNew?: boolean;
}

interface GamificationSystemProps {
  metas: any[];
  incomes: any[];
  salespeople: any[];
  currentUser: any;
}

const GamificationSystem: React.FC<GamificationSystemProps> = ({
  metas,
  incomes,
  salespeople,
  currentUser
}) => {
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');

  // Definir badges/logros disponibles
  const availableBadges: Badge[] = useMemo(() => [
    {
      id: 'first-meta',
      name: 'Primer Paso',
      description: 'Completa tu primera meta',
      emoji: '🎯',
      rarity: 'common',
      points: 100,
      condition: (data) => data.completedMetas >= 1
    },
    {
      id: 'meta-master',
      name: 'Maestro de Metas',
      description: 'Completa 5 metas en total',
      emoji: '🏆',
      rarity: 'rare',
      points: 300,
      condition: (data) => data.completedMetas >= 5
    },
    {
      id: 'perfectionist',
      name: 'Perfeccionista',
      description: 'Supera una meta en más del 120%',
      emoji: '🎯',
      rarity: 'epic',
      points: 500,
      condition: (data) => data.maxProgress >= 120
    },
    {
      id: 'consistent-performer',
      name: 'Rendimiento Constante',
      description: 'Completa metas 3 meses consecutivos',
      emoji: '📈',
      rarity: 'epic',
      points: 400,
      condition: (data) => data.consecutiveMonths >= 3
    },
    {
      id: 'speed-demon',
      name: 'Rayo Veloz',
      description: 'Completa una meta en los primeros 15 días del mes',
      emoji: '⚡',
      rarity: 'rare',
      points: 250,
      condition: (data) => data.hasEarlyCompletion
    },
    {
      id: 'team-player',
      name: 'Jugador de Equipo',
      description: 'Ayuda a 3 compañeros a completar sus metas',
      emoji: '🤝',
      rarity: 'rare',
      points: 300,
      condition: (data) => data.helpedColleagues >= 3
    },
    {
      id: 'overachiever',
      name: 'Superestrella',
      description: 'Supera todas tus metas en un mes',
      emoji: '⭐',
      rarity: 'legendary',
      points: 1000,
      condition: (data) => data.allMetasExceeded
    },
    {
      id: 'comeback-kid',
      name: 'La Gran Remontada',
      description: 'Completa una meta después de estar por debajo del 50%',
      emoji: '🚀',
      rarity: 'epic',
      points: 450,
      condition: (data) => data.hasComeback
    },
    {
      id: 'money-maker',
      name: 'Hacedor de Dinero',
      description: 'Genera más de $50,000 en ventas en un mes',
      emoji: '💰',
      rarity: 'rare',
      points: 350,
      condition: (data) => data.maxMonthlySales >= 50000
    },
    {
      id: 'streak-master',
      name: 'Racha Imparable',
      description: 'Mantén una racha de 5 metas completadas',
      emoji: '🔥',
      rarity: 'legendary',
      points: 800,
      condition: (data) => data.currentStreak >= 5
    }
  ], []);

  // Calcular estadísticas por usuario
  const userStats = useMemo(() => {
    return salespeople.map(person => {
      const userMetas = metas.filter(m => m.vendedorId === person.id);
      const userIncomes = incomes.filter(i => i.salespersonId === person.id);
      
      // Calcular progreso para cada meta
      const metasWithProgress = userMetas.map(meta => {
        const metaIncomes = userIncomes.filter(income => 
          new Date(income.date).getFullYear() === meta.year &&
          (new Date(income.date).getMonth() + 1) === meta.month
        );
        const totalSales = metaIncomes.reduce((sum, income) => sum + income.amount, 0);
        const progressPercent = meta.metaValor > 0 ? (totalSales / meta.metaValor) * 100 : 0;
        
        return {
          ...meta,
          totalSales,
          progressPercent,
          isCompleted: progressPercent >= 100
        };
      });

      const completedMetas = metasWithProgress.filter(m => m.isCompleted).length;
      const maxProgress = Math.max(...metasWithProgress.map(m => m.progressPercent), 0);
      
      // Calcular ventas mensuales
      const monthlySales = userIncomes.reduce((acc, income) => {
        const key = `${new Date(income.date).getFullYear()}-${new Date(income.date).getMonth() + 1}`;
        acc[key] = (acc[key] || 0) + income.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const maxMonthlySales = Math.max(...Object.values(monthlySales), 0);
      
      // Calcular racha actual
      const sortedMetas = metasWithProgress
        .sort((a, b) => new Date(b.year, b.month - 1).getTime() - new Date(a.year, a.month - 1).getTime());
      
      let currentStreak = 0;
      for (const meta of sortedMetas) {
        if (meta.isCompleted) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Meses consecutivos con metas completadas
      const monthsWithCompletedMetas = new Set(
        metasWithProgress
          .filter(m => m.isCompleted)
          .map(m => `${m.year}-${m.month}`)
      );
      
      let consecutiveMonths = 0;
      const currentDate = new Date();
      for (let i = 0; i < 12; i++) {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const key = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}`;
        if (monthsWithCompletedMetas.has(key)) {
          consecutiveMonths++;
        } else {
          break;
        }
      }

      // Verificar completación temprana
      const hasEarlyCompletion = metasWithProgress.some(meta => {
        // Simular que se completó antes del día 15 (habría que tener fecha real de completación)
        return meta.isCompleted && meta.progressPercent >= 100;
      });

      // Verificar comeback
      const hasComeback = metasWithProgress.some(meta => {
        // Simular que estuvo por debajo del 50% pero se completó
        return meta.isCompleted && meta.progressPercent >= 100;
      });

      // Verificar si superó todas las metas del mes actual
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const currentMonthMetas = metasWithProgress.filter(m => 
        m.month === currentMonth && m.year === currentYear
      );
      const allMetasExceeded = currentMonthMetas.length > 0 && 
        currentMonthMetas.every(m => m.progressPercent >= 100);

      return {
        ...person,
        completedMetas,
        maxProgress,
        maxMonthlySales,
        currentStreak,
        consecutiveMonths,
        hasEarlyCompletion,
        hasComeback,
        allMetasExceeded,
        helpedColleagues: 0, // Por ahora hardcoded, habría que implementar sistema de colaboración
        totalMetas: userMetas.length,
        avgProgress: userMetas.length > 0 
          ? metasWithProgress.reduce((sum, m) => sum + m.progressPercent, 0) / metasWithProgress.length 
          : 0
      };
    });
  }, [metas, incomes, salespeople]);

  // Calcular badges obtenidos por cada usuario
  const userAchievements = useMemo(() => {
    return userStats.map(user => {
      const earnedBadges = availableBadges.filter(badge => badge.condition(user));
      const totalPoints = earnedBadges.reduce((sum, badge) => sum + badge.points, 0);
      
      return {
        ...user,
        earnedBadges,
        totalPoints,
        level: Math.floor(totalPoints / 500) + 1, // Nivel basado en puntos
        nextLevelPoints: ((Math.floor(totalPoints / 500) + 1) * 500) - totalPoints
      };
    });
  }, [userStats, availableBadges]);

  // Ranking global
  const globalRanking = useMemo(() => {
    return [...userAchievements]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((user, index) => ({ ...user, rank: index + 1 }));
  }, [userAchievements]);

  // Encontrar al usuario actual en el ranking
  const currentUserData = useMemo(() => {
    return globalRanking.find(user => user.id === currentUser.id) || null;
  }, [globalRanking, currentUser.id]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-400 border-gray-400';
      case 'rare': return 'text-blue-400 border-blue-400';
      case 'epic': return 'text-purple-400 border-purple-400';
      case 'legendary': return 'text-yellow-400 border-yellow-400';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  const getRarityBg = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500/20';
      case 'rare': return 'bg-blue-500/20';
      case 'epic': return 'bg-purple-500/20';
      case 'legendary': return 'bg-yellow-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Panel de usuario actual */}
      {currentUserData && (
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">🎮 Tu Progreso</h2>
            <button
              onClick={() => setShowAchievements(!showAchievements)}
              className="bg-accent text-primary px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Ver Logros
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{currentUserData.level}</div>
              <div className="text-sm text-text-secondary">Nivel</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{currentUserData.totalPoints}</div>
              <div className="text-sm text-text-secondary">Puntos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{currentUserData.earnedBadges.length}</div>
              <div className="text-sm text-text-secondary">Logros</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">#{currentUserData.rank}</div>
              <div className="text-sm text-text-secondary">Ranking</div>
            </div>
          </div>

          {/* Barra de progreso al siguiente nivel */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-text-secondary mb-1">
              <span>Progreso al Nivel {currentUserData.level + 1}</span>
              <span>{currentUserData.nextLevelPoints} puntos restantes</span>
            </div>
            <div className="w-full bg-tertiary rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, 100 - (currentUserData.nextLevelPoints / 500 * 100))}%`
                }}
              ></div>
            </div>
          </div>

          {/* Logros recientes */}
          <div className="flex flex-wrap gap-2">
            {currentUserData.earnedBadges.slice(0, 6).map(badge => (
              <div
                key={badge.id}
                className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${getRarityColor(badge.rarity)} ${getRarityBg(badge.rarity)}`}
                title={badge.description}
              >
                <span>{badge.emoji}</span>
                <span className="text-xs font-medium">{badge.name}</span>
              </div>
            ))}
            {currentUserData.earnedBadges.length > 6 && (
              <div className="flex items-center px-3 py-1 rounded-full bg-tertiary text-text-secondary">
                <span className="text-xs">+{currentUserData.earnedBadges.length - 6} más</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ranking Global */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
          🏆 Ranking Global
        </h3>
        
        <div className="space-y-3">
          {globalRanking.slice(0, 10).map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                user.id === currentUser.id 
                  ? 'bg-accent/20 border-2 border-accent/50' 
                  : 'bg-tertiary hover:bg-border/50'
              }`}
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
                  <p className="font-semibold text-text-primary">
                    {user.name}
                    {user.id === currentUser.id && (
                      <span className="ml-2 text-xs bg-accent text-primary px-2 py-1 rounded-full">
                        TÚ
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {user.completedMetas} metas • Racha: {user.currentStreak}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-lg font-bold text-accent">{user.totalPoints}</p>
                <p className="text-xs text-text-secondary">Nivel {user.level}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Logros */}
      {showAchievements && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-secondary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-text-primary">🏆 Centro de Logros</h2>
                <button
                  onClick={() => setShowAchievements(false)}
                  className="text-text-secondary hover:text-text-primary text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableBadges.map(badge => {
                  const isEarned = currentUserData?.earnedBadges.some(b => b.id === badge.id);
                  
                  return (
                    <div
                      key={badge.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isEarned
                          ? `${getRarityColor(badge.rarity)} ${getRarityBg(badge.rarity)}`
                          : 'border-gray-600 bg-gray-600/10 grayscale opacity-60'
                      }`}
                    >
                      <div className="text-center mb-3">
                        <div className={`text-4xl mb-2 ${isEarned ? '' : 'grayscale'}`}>
                          {badge.emoji}
                        </div>
                        <h3 className={`font-bold text-sm ${
                          isEarned ? 'text-text-primary' : 'text-text-secondary'
                        }`}>
                          {badge.name}
                        </h3>
                        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                          getRarityColor(badge.rarity)
                        }`}>
                          {badge.rarity.toUpperCase()}
                        </div>
                      </div>
                      
                      <p className={`text-xs text-center mb-2 ${
                        isEarned ? 'text-text-secondary' : 'text-text-secondary/60'
                      }`}>
                        {badge.description}
                      </p>
                      
                      <div className="text-center">
                        <span className={`text-xs font-bold ${
                          isEarned ? 'text-accent' : 'text-text-secondary/60'
                        }`}>
                          +{badge.points} puntos
                        </span>
                      </div>
                      
                      {isEarned && (
                        <div className="mt-2 text-center">
                          <span className="inline-block bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            ✓ Completado
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationSystem;