
import React, { useState } from 'react';
import { BusinessPlan } from '../types';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';

interface PlanCardProps {
  plan: BusinessPlan;
  clientType?: 'REGULAR' | 'CONVERGENTE';
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, clientType = 'REGULAR' }) => {
  const [expanded, setExpanded] = useState(true);
  const isConvergent = clientType === 'CONVERGENTE';

  return (
    <div className={`bg-slate-900 rounded-2xl border shadow-xl overflow-hidden flex flex-col h-full col-span-full transition-all duration-300 ${isConvergent ? 'border-orange-500/30' : 'border-slate-800'}`}>
      <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConvergent ? 'bg-orange-500/20 text-orange-500' : 'bg-claro-red/10 text-claro-red'}`}>
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">{plan.title}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{plan.category}</p>
          </div>
        </div>
        <div className="text-slate-500">
          {expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          {plan.tables.map((table, idx) => {
            const isMobile = table.technology === 'MOVIL';
            const isIndividual = isMobile && table.rows[0]?.alphaCode === 'IND';
            const isFixed = !isMobile; // 1PLAY, 2PLAY, 3PLAY
            const customTitle = table.customHeaders?.[2] || 'DETALLES DEL PLAN';
            
            return (
              <div key={idx} className="mb-0">
                {/* Headers visuales */}
                <div className="flex w-full">
                  <div className={`px-4 py-2 text-[11px] font-black uppercase border-r border-slate-800 w-32 bg-[#002a5c] text-white`}>JOB CODE</div>
                  <div className={`px-4 py-2 text-[11px] font-black uppercase border-r border-slate-800 w-36 bg-[#da291c] text-white`}>
                    {isIndividual ? 'Renta Mensual' : isFixed ? 'Renta Base' : 'Cód. Activación'}
                  </div>
                  <div className={`px-4 py-2 text-[11px] font-black uppercase flex-1 bg-[#da291c] text-white text-center`}>
                    {isIndividual ? customTitle : isFixed ? `TECNOLOGÍA: ${table.technology}` : 'PROCESO DE ACTIVACION PLAN VOLTE BUSINESS RED'}
                  </div>
                </div>
                
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  {/* THEAD secundario solo para Fijo o Multilínea Móvil */}
                  {(!isIndividual) && (
                    <thead>
                      <tr className="bg-slate-800/80 text-[10px] font-black text-white uppercase border-b border-slate-700">
                        {isFixed ? (
                          <>
                            <th className="px-4 py-3 border-r border-slate-700 w-32">Job Code</th>
                            <th className="px-4 py-3 border-r border-slate-700 w-36 text-center">Renta</th>
                            <th className="px-4 py-3 border-r border-slate-700">Descripción del Servicio</th>
                            <th className="px-4 py-3 border-r border-slate-700 text-center w-32">Alfa Code</th>
                            <th className="px-4 py-3 border-r border-slate-700 text-center w-48 bg-slate-900/40">Instalación (0/12/24m)</th>
                            <th className="px-4 py-3 text-center w-32">Penalidad</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 border-r border-slate-700 w-32">Cant. Líneas</th>
                            <th className="px-4 py-3 border-r border-slate-700 w-36">Cód. Activación</th>
                            <th className="px-4 py-3 border-r border-slate-700 w-24 text-center">Precio Reg.</th>
                            <th className="px-4 py-3 border-r border-slate-700 w-32">Plan Asignado</th>
                            <th className="px-4 py-3 border-r border-slate-700 w-32 text-center">Renta Factura</th>
                            <th className="px-4 py-3 border-r border-slate-700 text-center">Promedio Reg/AutoPay</th>
                            <th className="px-4 py-3 text-center">Total Reg/AutoPay</th>
                          </>
                        )}
                      </tr>
                    </thead>
                  )}
                  
                  <tbody className="divide-y divide-slate-800">
                    {table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-white/5 transition-colors text-[11.5px] font-bold text-slate-200">
                        {isIndividual ? (
                          <>
                            <td className="px-4 py-4 border-r border-slate-800 w-32 font-black">{row.code}</td>
                            <td className="px-4 py-4 border-r border-slate-800 w-36 text-center font-black text-[13px] text-red-500">{row.price}</td>
                            <td className="px-4 py-4 uppercase leading-relaxed tracking-tight">{row.description}</td>
                          </>
                        ) : isFixed ? (
                          <>
                            <td className="px-4 py-3 border-r border-slate-800 font-mono text-indigo-400">{row.code}</td>
                            <td className="px-4 py-3 border-r border-slate-800 text-center font-black text-white text-[13px]">{row.price}</td>
                            <td className="px-4 py-3 border-r border-slate-800 uppercase text-slate-300">{row.description}</td>
                            <td className="px-4 py-3 border-r border-slate-800 text-center font-mono text-slate-500">{row.alphaCode}</td>
                            <td className="px-4 py-3 border-r border-slate-800 text-center font-black bg-slate-900/20">
                              <span className="text-slate-400">{row.installation?.m0}</span>
                              <span className="mx-1 text-slate-600">/</span>
                              <span className="text-slate-400">{row.installation?.m12}</span>
                              <span className="mx-1 text-slate-600">/</span>
                              <span className="text-emerald-500">{row.installation?.m24}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-red-500 font-mono">{row.penalty}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 border-r border-slate-800 font-black">{row.description}</td>
                            <td className="px-4 py-3 border-r border-slate-800 font-mono">{row.code}</td>
                            <td className="px-4 py-3 border-r border-slate-800 text-center">{row.price}</td>
                            <td className="px-4 py-3 border-r border-slate-800 font-mono">{row.customData?.[0]}</td>
                            <td className="px-4 py-3 border-r border-slate-800 text-center font-black">{row.customData?.[1]}</td>
                            <td className="px-4 py-3 text-center border-r border-slate-800">
                              <span className="text-white">{row.customData?.[2].split('/')[0]}</span>
                              <span className="mx-1 opacity-50">/</span>
                              <span className="text-red-500">{row.customData?.[2].split('/')[1]}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-white font-black">{row.customData?.[3].split('/')[0]}</span>
                              <span className="mx-1 opacity-50">/</span>
                              <span className="text-red-500 font-black">{row.customData?.[3].split('/')[1]}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlanCard;
