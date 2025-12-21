
import React, { useState } from 'react';
import { DEVICES, FINANCING_OFFERS } from '../constants';
import { Smartphone, Tag, ShieldCheck, XCircle, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface OfferListProps {
  clientType?: 'REGULAR' | 'CONVERGENTE';
}

const OfferList: React.FC<OfferListProps> = ({ clientType = 'REGULAR' }) => {
  const [expandedTerms, setExpandedTerms] = useState<string | null>(null);
  const isConvergent = clientType === 'CONVERGENTE';

  const getBrandIcon = (brand: string) => {
    switch (brand) {
      case 'Apple': return '';
      case 'Samsung': return 'S';
      case 'Motorola': return 'M';
      default: return '📱';
    }
  };

  return (
    <div className="space-y-12 pb-10">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-white">Equipos y Ofertas de Financiamiento</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Catálogo vigente del 1 al 17 de diciembre de 2025. 
          {isConvergent ? (
            <span className="block mt-2 text-orange-400 font-bold flex items-center justify-center gap-2">
              <Zap size={16} className="fill-current" /> Modo Convergente Activo: Beneficios de Bono Streaming aplicables.
            </span>
          ) : (
            <span className="block mt-2 text-slate-500">
              Selecciona la oferta para ver los equipos elegibles.
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FINANCING_OFFERS.map((offer) => {
          const eligibleDevices = DEVICES.filter(d => offer.devices.includes(d.id));
          const hasStreamingBono = offer.streamingBonus;

          return (
            <div key={offer.id} className={`bg-slate-900 border rounded-2xl overflow-hidden shadow-xl flex flex-col h-full transition-all duration-300 ${
              isConvergent && hasStreamingBono ? 'border-orange-500 ring-1 ring-orange-500/20' : 'border-slate-800'
            }`}>
              <div className={`${offer.color} p-5 text-white relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Tag size={64} />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-black/30 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      {offer.condition === 'TRADE_IN' ? <ShieldCheck size={10} /> : <XCircle size={10} />}
                      {offer.condition === 'TRADE_IN' ? 'Requiere Trade-In' : 'Sin Trade-In'}
                    </span>
                    <span className="font-mono text-xs bg-white/20 px-2 py-1 rounded">
                      {offer.priceCode}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold leading-tight mb-1">{offer.title}</h3>
                  <p className="text-xs opacity-90">{offer.description}</p>
                  
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="bg-black/20 px-2 py-1 rounded">Plazo: {offer.termMonths} Meses</span>
                    {hasStreamingBono && (
                      <span className={`px-2 py-1 rounded flex items-center gap-1 shadow-sm ${
                        isConvergent ? 'bg-orange-500 text-white animate-bounce' : 'bg-slate-700 text-slate-300'
                      }`}>
                        <Zap size={10} className={isConvergent ? 'fill-current' : ''} /> Bono Streaming {isConvergent ? 'ACTIVO' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 bg-slate-900 flex flex-col gap-4">
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Planes Elegibles:
                  </h4>
                  <ul className="space-y-1">
                    {offer.applicablePlans.map((plan, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-snug flex items-start gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-slate-500 shrink-0"></span>
                        {plan}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                    <Smartphone size={12} /> Equipos Incluidos:
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {eligibleDevices.map((device) => (
                      <div key={device.id} className="bg-slate-950 border border-slate-800 p-2 rounded flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-slate-200 font-bold text-[10px] shrink-0">
                          {getBrandIcon(device.brand)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-200 text-[11px] font-medium leading-none truncate">{device.name}</p>
                          {device.storage && <span className="text-[9px] text-slate-500">{device.storage}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 bg-slate-950 p-4">
                <button 
                  onClick={() => setExpandedTerms(expandedTerms === offer.id ? null : offer.id)}
                  className="w-full flex items-center justify-between text-sm text-slate-300 hover:text-white transition-colors font-medium"
                >
                  <span className="flex items-center gap-2"><FileText size={14} /> Términos y Condiciones</span>
                  {expandedTerms === offer.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedTerms === offer.id && (
                  <div className="mt-4 text-xs text-slate-400 space-y-2 border-t border-slate-800 pt-3 animate-in slide-in-from-top-2">
                    {offer.terms.map((term, i) => (
                      <p key={i} className="leading-relaxed flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
                        {term}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OfferList;
