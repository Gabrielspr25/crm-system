
import React, { useState } from 'react';
import { BusinessPlan } from '../types';
import { DEVICES } from '../constants';
import { Calculator as CalcIcon, Smartphone, CreditCard, X } from 'lucide-react';

interface CalculatorProps {
  plans: BusinessPlan[];
  onClose?: () => void;
}

const Calculator: React.FC<CalculatorProps> = ({ plans, onClose }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(DEVICES[0]?.id || '');

  // Flatten plans to find rows for selection (simplified logic)
  const allRows = plans.flatMap(p => p.tables.flatMap(t => t.rows));

  // Set initial selected plan if not set
  if (!selectedPlanId && allRows.length > 0) {
    setSelectedPlanId(allRows[0].code);
  }

  const selectedRow = allRows.find(r => r.code === selectedPlanId) || allRows[0];
  const selectedDevice = DEVICES.find(d => d.id === selectedDeviceId);

  const parsePrice = (priceStr: string) => {
    if (!priceStr) return 0;
    return parseFloat(priceStr.replace('$', '').replace(',', '')) || 0;
  };

  const planPrice = selectedRow ? parsePrice(selectedRow.price) : 0;
  const devicePrice = selectedDevice ? selectedDevice.basePrice / 24 : 0;
  const totalMonthly = planPrice + devicePrice;

  return (
    <div className="fixed bottom-24 right-6 bg-slate-900 rounded-[2rem] p-8 border border-slate-700 shadow-2xl max-w-sm w-full animate-in slide-in-from-bottom duration-300 z-50">
      <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
            <CalcIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Cotizador</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Estimado Mensual</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
            <CreditCard size={12} /> Plan Seleccionado
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-bold text-white appearance-none outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
              onChange={(e) => setSelectedPlanId(e.target.value)}
              value={selectedPlanId}
            >
              {allRows.map((r, i) => (
                <option key={`${r.code}-${i}`} value={r.code}>
                  {r.description.substring(0, 30)}... - {r.price}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
            <Smartphone size={12} /> Equipo (24 meses)
          </label>
          <select
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-bold text-white appearance-none outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            value={selectedDeviceId}
          >
            {DEVICES.map(d => (
              <option key={d.id} value={d.id}>{d.name} (+${(d.basePrice / 24).toFixed(2)}/m)</option>
            ))}
          </select>
        </div>

        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mt-6 flex justify-between items-center group hover:border-emerald-500/30 transition-all">
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Estimado</p>
            <p className="text-emerald-500 text-[10px] font-bold">Sin IVU / Cargos</p>
          </div>
          <p className="text-4xl font-black text-white tracking-tighter group-hover:scale-105 transition-transform">
            <span className="text-lg align-top text-slate-500">$</span>{totalMonthly.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
