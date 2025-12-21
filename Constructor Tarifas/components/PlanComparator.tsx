
import React from 'react';
import { BusinessPlan } from '../types';

interface PlanComparatorProps {
  selectedPlans: BusinessPlan[];
  onRemove: (planId: string) => void;
  onClear: () => void;
}

const PlanComparator: React.FC<PlanComparatorProps> = () => {
  return (
    <div className="bg-slate-800 rounded-xl p-4 text-center">
      <p className="text-slate-400 text-sm">El comparador se está actualizando para soportar las nuevas tablas técnicas.</p>
    </div>
  );
};

export default PlanComparator;
