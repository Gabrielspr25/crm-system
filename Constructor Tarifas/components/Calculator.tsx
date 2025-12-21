
import React, { useState } from 'react';
import { BusinessPlan, Device } from '../types';
import { DEVICES } from '../constants';
import { Calculator as CalcIcon, Smartphone, CreditCard } from 'lucide-react';

interface CalculatorProps {
  plans: BusinessPlan[];
}

const Calculator: React.FC<CalculatorProps> = ({ plans }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(DEVICES[0]?.id || '');

  // Flatten plans to find rows for selection (simplified logic)
  const allRows = plans.flatMap(p => p.tables.flatMap(t => t.rows));
  const selectedRow = allRows.find(r => r.code === selectedPlanId) || allRows[0];
  const selectedDevice = DEVICES.find(d => d.id === selectedDeviceId);

  const parsePrice = (priceStr: string) => parseFloat(priceStr.replace('$', '')) || 0;
  
  const planPrice = selectedRow ? parsePrice(selectedRow.price) : 0;
  const devicePrice = selectedDevice ? selectedDevice.basePrice / 24 : 0;
  const totalMonthly = planPrice + devicePrice;

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
        <div className="p-2 bg-blue-600 rounded-lg text-white">
          <CalcIcon size={24} />
        </div>
        <h2 className="text-xl font-bold text-white">Calculadora Rápida</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Selecciona Plan (Ejemplo)</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2"
            onChange={(e) => setSelectedPlanId(e.target.value)}
          >
            {allRows.map(r => (
              <option key={r.code} value={r.code}>{r.description} - {r.price}</option>
            ))}
          </select>
        </div>

         <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Selecciona Equipo</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2"
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            {DEVICES.map(d => (
              <option key={d.id} value={d.id}>{d.name} (${d.basePrice})</option>
            ))}
          </select>
        </div>

        <div className="bg-slate-900 p-4 rounded mt-4">
          <p className="text-white text-2xl font-bold text-center">${totalMonthly.toFixed(2)}/mes</p>
          <p className="text-center text-slate-500 text-xs">Estimado (Plan + Equipo a 24 meses)</p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
