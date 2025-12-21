
import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Bot, Save, X, AlertTriangle } from 'lucide-react';
import { analyzePlanDocument } from '../services/geminiService';
import { BusinessPlan } from '../types';
// @ts-ignore
import readXlsxFile from 'read-excel-file';

interface AdminUploadProps {
  currentPlans: BusinessPlan[];
  onPlansUpdated: (newPlans: BusinessPlan[]) => void;
  onAuditFinish?: (result: any, fileName: string) => void;
}

const AdminUpload: React.FC<AdminUploadProps> = ({ currentPlans, onPlansUpdated, onAuditFinish }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setCurrentFileName(file.name);
    setIsAnalyzing(true);
    try {
      let textContext: string | undefined = undefined;
      if (file.name.match(/\.(xlsx|xls)$/)) {
        const rows = await readXlsxFile(file);
        textContext = JSON.stringify(rows);
      } else if (file.name.endsWith('.csv')) {
        textContext = await file.text();
      }

      const result = await analyzePlanDocument(file, textContext, currentPlans);
      setComparisonResult(result);
      setShowModal(true);
    } catch (error) {
      alert("Error analizando documento.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyChanges = () => {
    if (onAuditFinish) onAuditFinish(comparisonResult, currentFileName);
    setShowModal(false);
    setComparisonResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto py-20">
      <div className="text-center mb-12">
        <div className="inline-flex p-5 rounded-full bg-indigo-500/10 text-indigo-400 mb-6 border border-indigo-500/20">
          <Bot size={48} />
        </div>
        <h2 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase">Laboratorio de Carga</h2>
        <p className="text-slate-500 font-bold text-lg">Sube tus archivos de oferta para la comparación técnica.</p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-4 border-dashed rounded-[3rem] p-24 text-center cursor-pointer transition-all border-slate-800 bg-slate-900/50 hover:border-claro-red/50 hover:bg-slate-900 relative overflow-hidden group`}
      >
        <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
        
        {isAnalyzing ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-24 h-24 text-indigo-500 animate-spin mb-8" />
            <h3 className="text-3xl font-black text-white tracking-widest uppercase">Escaneando Data...</h3>
            <p className="text-slate-500 mt-4 font-bold">Analizando códigos JOB y vigencias de oferta.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center transition-transform group-hover:scale-110 duration-500">
             <Upload size={80} className="text-slate-700 mb-8" />
             <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Arrastra tu Boletín</h3>
             <p className="text-slate-600 mt-2 font-black uppercase text-xs">PDF • EXCEL • IMAGEN</p>
          </div>
        )}
      </div>

      {/* MODAL DE COMPARACIÓN */}
      {showModal && comparisonResult && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                 <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                       AUDITORÍA: {currentFileName}
                    </h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Comparación vs Estructura Maestra</p>
                 </div>
                 <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={32} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                 {/* Discrepancias */}
                 {comparisonResult.discrepancies?.length > 0 && (
                   <div className="bg-red-500/10 border-2 border-red-500/30 rounded-3xl p-8">
                      <div className="flex items-center gap-4 mb-6">
                        <AlertTriangle className="text-red-500" size={32} />
                        <h4 className="text-red-500 font-black text-xl uppercase tracking-tighter">¡Discrepancias Detectadas!</h4>
                      </div>
                      <div className="space-y-3">
                         {comparisonResult.discrepancies.map((d: any, i: number) => (
                           <div key={i} className="flex items-center gap-4 text-white text-sm bg-red-950/50 p-4 rounded-2xl border border-red-500/20">
                              <span className="font-mono font-black bg-red-600 px-3 py-1 rounded-lg text-[10px]">{d.code}</span>
                              <p className="font-bold">{d.issue}</p>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}

                 {/* Cambios */}
                 <div className="space-y-6">
                    <h4 className="text-slate-400 font-black text-sm uppercase tracking-widest">Cambios Sugeridos</h4>
                    <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
                       <table className="w-full text-left text-sm">
                          <thead>
                             <tr className="bg-slate-800/50 text-slate-500 font-black border-b border-slate-800 text-[10px] uppercase">
                                <th className="p-5">Oferta</th>
                                <th className="p-5">Campo</th>
                                <th className="p-5 text-right">Anterior</th>
                                <th className="p-5 text-right">Nuevo</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                             {comparisonResult.changes?.map((c: any, i: number) => (
                               <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                                  <td className="p-5 font-black text-white tracking-tighter">{c.planId}</td>
                                  <td className="p-5 text-slate-500 font-bold uppercase text-[10px]">{c.field}</td>
                                  <td className="p-5 text-right text-slate-600 line-through font-mono">{c.oldValue}</td>
                                  <td className="p-5 text-right font-black text-emerald-400 font-mono text-lg">{c.newValue}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>

              <div className="p-8 bg-slate-950 border-t border-slate-800 flex justify-end gap-6">
                 <button onClick={() => setShowModal(false)} className="px-10 py-4 rounded-2xl font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest text-xs">Descartar</button>
                 <button onClick={applyChanges} className="bg-claro-red hover:bg-red-700 text-white px-12 py-4 rounded-2xl font-black flex items-center gap-3 shadow-2xl shadow-claro-red/20 active:scale-95 transition-all uppercase tracking-widest text-xs">
                    Mandar a Cola de Cambios
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminUpload;
