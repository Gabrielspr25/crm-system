
import React, { useState, useEffect } from 'react';
import { LayoutGrid, UploadCloud, MessageSquare, Phone, Wifi, MonitorPlay, Smartphone, CheckCircle2, Circle, Star, Sparkles, Zap, Settings, Save, Trash2, Plus, FileText, ChevronRight, Layout, History, AlertCircle, Clock, CheckCircle, Database, Calendar } from 'lucide-react';
import { INITIAL_BUSINESS_PLANS } from './constants';
import { BusinessPlan, ViewState, BusinessCategory } from './types';
import PlanCard from './components/PlanCard';
import ChatBot from './components/ChatBot';
import AdminUpload from './components/AdminUpload';
import OfferList from './components/OfferList';
import BenefitsPanel from './components/BenefitsPanel';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('catalog');
  const [plans, setPlans] = useState<BusinessPlan[]>(() => {
    const saved = localStorage.getItem('claro_plans_db');
    return saved ? JSON.parse(saved) : INITIAL_BUSINESS_PLANS;
  });
  
  // MESA DE TRABAJO (ESTADO CENTRALIZADO)
  const [fileHistory, setFileHistory] = useState<{name: string, date: string, type: string}[]>([]);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id || null);
  const [activeCategory, setActiveCategory] = useState<BusinessCategory | 'ALL'>('ALL');
  const [clientType, setClientType] = useState<'REGULAR' | 'CONVERGENTE'>('REGULAR');
  const [showSpecialOffers, setShowSpecialOffers] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('claro_plans_db', JSON.stringify(plans));
  }, [plans]);

  const isConvergent = clientType === 'CONVERGENTE';
  const editingPlan = plans.find(p => p.id === selectedPlanId);

  // FUNCIÓN DE LIMPIEZA (RESET)
  const resetSystem = () => {
    if (confirm("¿Deseas borrar toda la data actual y volver a las estructuras base en blanco para empezar la carga de documentos?")) {
      setPlans(INITIAL_BUSINESS_PLANS);
      setFileHistory([]);
      setPendingChanges([]);
      localStorage.removeItem('claro_plans_db');
      alert("Sistema reseteado. Mesa de trabajo lista para carga.");
    }
  };

  const handleAuditFinish = (result: any, fileName: string) => {
    setFileHistory(prev => [{name: fileName, date: new Date().toLocaleDateString(), type: 'Boletín'}, ...prev]);
    if (result.changes) {
      // Añadimos la fecha de detección a cada cambio
      const changesWithDate = result.changes.map((c: any) => ({
        ...c,
        detectedAt: new Date().toLocaleString()
      }));
      setPendingChanges(prev => [...prev, ...changesWithDate]);
    }
    setCurrentView('admin');
  };

  const handlePlansUpdate = (newPlans: BusinessPlan[]) => {
    setPlans(newPlans);
  };

  const approveChange = (changeIndex: number) => {
    // Aquí iría la lógica para inyectar el cambio en el plan correspondiente
    setPendingChanges(prev => prev.filter((_, i) => i !== changeIndex));
  };

  const filteredPlans = plans.filter(plan => {
    const isOffer = !!plan.isSpecialOffer;
    if (showSpecialOffers && !isOffer) return false;
    if (!showSpecialOffers && isOffer) return false;
    const matchesCategory = activeCategory === 'ALL' || plan.category === activeCategory;
    return matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col h-screen">
      
      {/* HEADER FIJO REDUCIDO */}
      <header className="flex-none bg-slate-900 border-b border-slate-800 shadow-xl z-50">
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-claro-red rounded-xl flex items-center justify-center shadow-lg shadow-claro-red/20">
              <span className="font-bold text-white text-xl">C</span>
            </div>
            <div>
              <h1 className="text-white font-black text-lg tracking-tighter">Claro B2B Auditor</h1>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none">Intelligence Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mr-4">
              <button onClick={() => setCurrentView('catalog')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'catalog' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Visualizador</button>
              <button onClick={() => setCurrentView('admin')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Estructuras</button>
              <button onClick={() => setCurrentView('chat')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'chat' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>Asistente</button>
            </nav>
            <button onClick={() => setShowSidebar(!showSidebar)} className={`p-2.5 rounded-xl transition-all border ${showSidebar ? 'text-claro-red bg-claro-red/10 border-claro-red/20' : 'text-slate-500 border-slate-800 hover:border-slate-700'}`}>
              <Layout size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* PANEL IZQUIERDO: ÁREA DE TRABAJO */}
        <main className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-950 relative">
          
          {currentView === 'catalog' && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800/50 backdrop-blur-sm">
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                  <button onClick={() => setClientType('REGULAR')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${clientType === 'REGULAR' ? 'bg-slate-700 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>CLIENTE REGULAR</button>
                  <button onClick={() => setClientType('CONVERGENTE')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${clientType === 'CONVERGENTE' ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-xl shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}>CONVERGENTE</button>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-lg">
                  {['ALL', 'MOVIL', '1PLAY', '2PLAY', '3PLAY', 'TV'].map((cat) => (
                    <button key={cat} onClick={() => setActiveCategory(cat as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border transition-all ${activeCategory === cat ? 'bg-claro-red border-claro-red text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {filteredPlans.length > 0 ? (
                  filteredPlans.map(plan => <PlanCard key={plan.id} plan={plan} clientType={clientType} />)
                ) : (
                  <div className="text-center py-40">
                    <Database size={64} className="mx-auto text-slate-800 mb-6" />
                    <p className="text-slate-600 font-bold text-xl">Sin planes cargados en esta categoría.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'admin' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               {editingPlan ? (
                 <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="bg-slate-800/40 p-8 flex items-center justify-between border-b border-slate-800">
                       <div className="flex items-center gap-5">
                          <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                             <FileText size={28} />
                          </div>
                          <div>
                            <h4 className="text-3xl font-black text-white tracking-tighter uppercase">{editingPlan.title}</h4>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Estructura Fija / Maestro</p>
                          </div>
                       </div>
                       <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
                          <Save size={20} /> GUARDAR CAMBIOS
                       </button>
                    </div>
                    
                    <div className="p-8">
                       {editingPlan.tables.map((table, tIdx) => (
                         <div key={tIdx} className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden mb-8">
                            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                               <span>TECNOLOGÍA: {table.technology}</span>
                               <span className="text-indigo-400">CÓDIGOS TÉCNICOS</span>
                            </div>
                            <table className="w-full text-left text-sm">
                               <thead>
                                 <tr className="text-slate-600 font-bold border-b border-slate-900">
                                   <th className="p-5">JOB CODE</th>
                                   <th className="p-5">DESCRIPCIÓN COMERCIAL</th>
                                   <th className="p-5 text-right">RENTA MENSUAL</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-900/50">
                                 {table.rows.map((row, rIdx) => (
                                   <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                                     <td className="p-5 font-mono text-indigo-400 font-bold">{row.code}</td>
                                     <td className="p-5"><input type="text" className="bg-transparent text-slate-200 outline-none w-full border-b border-transparent focus:border-indigo-500/30" defaultValue={row.description} /></td>
                                     <td className="p-5"><input type="text" className="bg-transparent text-right font-black text-white outline-none w-full border-b border-transparent focus:border-indigo-500/30 text-lg" defaultValue={row.price} /></td>
                                   </tr>
                                 ))}
                               </tbody>
                            </table>
                         </div>
                       ))}
                    </div>
                 </div>
               ) : (
                 <div className="text-center py-40 border-4 border-dashed border-slate-900 rounded-[3rem]">
                    <Settings size={80} className="mx-auto text-slate-900 mb-8" />
                    <h2 className="text-3xl font-black text-slate-700">MODO CONFIGURACIÓN</h2>
                    <p className="text-slate-800 font-bold mt-2">Selecciona un plan del panel derecho para editar su esqueleto.</p>
                 </div>
               )}
            </div>
          )}

          {currentView === 'import' && <AdminUpload currentPlans={plans} onPlansUpdated={handlePlansUpdate} onAuditFinish={handleAuditFinish} />}
          {currentView === 'chat' && <ChatBot plans={plans} clientType={clientType} />}
          {currentView === 'devices' && <OfferList clientType={clientType} />}
        </main>

        {/* PANEL DERECHO (SIDEBAR): MESA DE OPERACIONES */}
        {showSidebar && (
          <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-40">
            {/* Sección: Estructuras Físicas */}
            <div className="flex-none p-6 border-b border-slate-800">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                <span>Estructuras Maestras</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500">{plans.length}</span>
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                {plans.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => {setSelectedPlanId(p.id); setCurrentView('admin')}}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${selectedPlanId === p.id && currentView === 'admin' ? 'bg-claro-red/10 border-claro-red shadow-lg' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-[9px] font-black uppercase mb-1 ${selectedPlanId === p.id ? 'text-claro-red' : 'text-slate-600'}`}>{p.category}</p>
                      <p className={`text-xs font-bold truncate ${selectedPlanId === p.id ? 'text-white' : 'text-slate-300'}`}>{p.title}</p>
                    </div>
                    <ChevronRight size={14} className={`transition-transform ${selectedPlanId === p.id ? 'translate-x-1 text-claro-red' : 'text-slate-800 group-hover:text-slate-500'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sección: Archivos Procesados */}
            <div className="flex-none p-6 border-b border-slate-800 bg-slate-900/50">
               <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                 <History size={14} className="text-slate-500" /> Historial de Origen
               </h3>
               <div className="space-y-2">
                 {fileHistory.length === 0 ? (
                   <p className="text-[10px] text-slate-600 italic">Sin documentos procesados aún.</p>
                 ) : (
                   fileHistory.map((file, i) => (
                     <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                           <FileText size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="text-[11px] font-bold text-slate-300 truncate">{file.name}</p>
                           <p className="text-[9px] text-slate-500">{file.date} • {file.type}</p>
                        </div>
                     </div>
                   ))
                 )}
               </div>
            </div>

            {/* Sección: Cola de Auditoría (Cambios Pendientes) */}
            <div className="flex-1 p-6 flex flex-col min-h-0">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Clock size={14} className="text-indigo-400" /> Cola de Auditoría
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-4">
                {pendingChanges.length === 0 ? (
                  <div className="bg-slate-950/50 border-2 border-dashed border-slate-800 rounded-[2rem] p-10 text-center">
                    <AlertCircle size={32} className="mx-auto text-slate-800 mb-4" />
                    <p className="text-[11px] text-slate-600 font-bold uppercase tracking-widest">Esperando boletines...</p>
                  </div>
                ) : (
                  pendingChanges.map((change, i) => (
                    <div key={i} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 relative group animate-in slide-in-from-right-4 duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">Propuesta IA</span>
                        <button onClick={() => setPendingChanges(prev => prev.filter((_ , idx) => idx !== i))} className="text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                      </div>
                      <p className="text-[10px] font-black text-white mb-2 uppercase tracking-tighter">{change.planId}</p>
                      <div className="flex items-center gap-3 text-sm bg-slate-900/50 p-2 rounded-lg border border-slate-900">
                        <span className="text-slate-600 line-through text-xs">{change.oldValue}</span>
                        <div className="h-px flex-1 bg-slate-800"></div>
                        <span className="text-emerald-400 font-black tracking-tight">{change.newValue}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-3 flex items-center gap-1">
                        <Calendar size={10} /> Vigencia detectada: {change.message}
                      </p>
                      <button onClick={() => approveChange(i)} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/10 transition-all active:scale-95">
                         Aplicar Cambio
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Panel de Control Inferior */}
            <div className="flex-none p-6 bg-slate-950 border-t border-slate-800">
               <button onClick={resetSystem} className="w-full border-2 border-dashed border-red-500/30 text-red-500/60 hover:border-red-500 hover:text-red-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all mb-4">
                  LIMPIAR MESA DE TRABAJO
               </button>
               <button onClick={() => setCurrentView('import')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all active:scale-95">
                  <UploadCloud size={20} /> Audit Document
               </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// Arrow helper missing in some versions
const ArrowRight = ({size, className}: {size: number, className: string}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);

export default App;
