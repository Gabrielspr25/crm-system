
import React from 'react';
import { BENEFITS } from '../constants';
import { BusinessCategory } from '../types';
import { Sparkles, Gift, Zap, CheckCircle2, Lock, Unlock, ArrowRight } from 'lucide-react';

interface BenefitsPanelProps {
  clientType: 'REGULAR' | 'CONVERGENTE';
  activeCategory: BusinessCategory | 'ALL';
}

const BenefitsPanel: React.FC<BenefitsPanelProps> = ({ clientType, activeCategory }) => {
  const isConvergent = clientType === 'CONVERGENTE';

  const visibleBenefits = BENEFITS.filter(benefit => {
    const matchesCategory = 
      activeCategory === 'ALL' || 
      activeCategory === 'BENEFICIOS' as any ||
      (activeCategory === 'MOVIL' && benefit.category === 'MOVIL') ||
      ((activeCategory === '1PLAY' || activeCategory === '2PLAY' || activeCategory === '3PLAY') && benefit.category === 'FIJO') ||
      benefit.category === 'AMBOS';

    return matchesCategory;
  });

  if (visibleBenefits.length === 0) return null;

  return (
    <div className={`rounded-xl border p-6 mb-8 transition-all duration-500 overflow-hidden relative ${
      isConvergent 
        ? 'bg-gradient-to-r from-slate-900 to-slate-800 border-orange-500/50 shadow-lg shadow-orange-900/20' 
        : 'bg-slate-900 border-slate-700'
    }`}>
      
      {isConvergent && (
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
          <Sparkles size={120} className="text-orange-500" />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${isConvergent ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {isConvergent ? <Zap size={24} className="fill-current" /> : <Gift size={24} />}
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isConvergent ? 'text-white' : 'text-slate-200'}`}>
              {isConvergent ? 'Beneficios Activos (Nivel Convergente)' : 'Beneficios del Portafolio'}
            </h3>
            <p className="text-sm text-slate-400">
              {isConvergent 
                ? 'El cliente disfruta de bonos máximos y descuentos de streaming.' 
                : 'Analiza cómo mejoran los bonos al activar la Convergencia.'}
            </p>
          </div>
        </div>

        {!isConvergent && (
          <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-lg flex items-center gap-3">
             <div className="text-orange-500 font-bold text-xs uppercase tracking-wider">Potencial de Venta</div>
             <ArrowRight size={16} className="text-orange-500" />
             <div className="text-slate-300 text-xs">Añade un servicio fijo para duplicar bonos.</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
        {visibleBenefits.map(benefit => {
          const isLocked = !isConvergent && benefit.requiredClientType === 'CONVERGENTE';
          const isUniversal = benefit.requiredClientType === 'AMBOS';
          
          return (
            <div key={benefit.id} className={`p-4 rounded-xl border flex flex-col justify-between group transition-all relative overflow-hidden ${
              isLocked 
                ? 'bg-slate-950/50 border-slate-800 opacity-75 grayscale' 
                : isUniversal && !isConvergent 
                  ? 'bg-slate-800/40 border-slate-700 hover:border-slate-500'
                  : 'bg-slate-800/60 border-orange-500/40 shadow-sm'
            }`}>
              
              {isLocked && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  <Lock size={10} className="text-slate-500" />
                  <span className="text-[8px] font-bold text-slate-500">BLOQUEADO</span>
                </div>
              )}

              {isUniversal && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  <span className="text-[8px] font-bold text-emerald-500 uppercase">Universal</span>
                </div>
              )}

              {!isLocked && benefit.requiredClientType === 'CONVERGENTE' && (
                 <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                   <Unlock size={10} className="text-orange-500" />
                   <span className="text-[8px] font-bold text-orange-500 uppercase">Convergente</span>
                 </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                    benefit.type === 'CASH' ? 'bg-emerald-500/10 text-emerald-400' : 
                    benefit.type === 'DISCOUNT' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {benefit.type === 'CASH' ? 'Bono Efectivo' : benefit.type === 'SERVICE' ? 'Servicio' : 'Descuento'}
                  </span>
                </div>
                
                <div className={`text-2xl font-bold mb-1 tracking-tight ${isLocked ? 'text-slate-600' : 'text-white'}`}>
                    {benefit.value}
                </div>
                <h4 className={`text-sm font-bold leading-tight mb-2 ${isLocked ? 'text-slate-600' : 'text-slate-200'}`}>
                    {benefit.title}
                </h4>
                <p className={`text-xs leading-snug line-clamp-2 ${isLocked ? 'text-slate-700' : 'text-slate-400'}`}>
                    {benefit.description}
                </p>
              </div>

              <div className={`mt-4 pt-3 border-t ${isLocked ? 'border-slate-800' : 'border-slate-700/50'}`}>
                 <div className="flex items-start gap-1.5">
                   <CheckCircle2 size={12} className={`mt-0.5 shrink-0 ${isLocked ? 'text-slate-700' : 'text-emerald-500'}`} />
                   <span className={`text-[10px] font-medium ${isLocked ? 'text-slate-700' : 'text-slate-400'}`}>
                     {benefit.requirements}
                   </span>
                 </div>
                 {isLocked && (
                     <div className="mt-2 text-[10px] text-orange-400/80 font-bold text-center bg-orange-900/10 py-1 rounded animate-pulse">
                         ACTIVA CONVERGENCIA PARA DESBLOQUEAR
                     </div>
                 )}
              </div>
              
              <div className="absolute inset-0 bg-slate-900/95 p-4 text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-center pointer-events-none border border-slate-600 rounded-xl z-30">
                 <p className="font-medium">{benefit.legalTerm}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BenefitsPanel;
