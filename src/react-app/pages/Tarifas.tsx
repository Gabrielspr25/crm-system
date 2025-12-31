import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, Phone, Wifi, MonitorPlay, Package, Layers, FileText,
  Search, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Star, Clock,
  Upload, X, Check, AlertTriangle, History, Database, Layout,
  Filter, Download, RefreshCw, Eye, Save, Loader2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

// ==================== TIPOS ====================
interface PlanRow {
  id?: number;
  code: string;
  description: string;
  price: number;
  alpha_code: string;
  installation_0m?: number;
  installation_12m?: number;
  installation_24m?: number;
  penalty?: number;
  technology?: string;
  data_included?: string;
  voice_included?: string;
}

interface PlanStructure {
  id?: number;
  title: string;
  category: string;
  technology: string;
  is_convergent_only: boolean;
  rows: PlanRow[];
}

interface AuditItem {
  id: string;
  fileName: string;
  date: string;
  status: 'pending' | 'applied' | 'rejected';
  changes: any[];
}

// ==================== CONSTANTES ====================
const CATEGORIES = [
  { code: 'ALL', name: 'Todos', icon: Layers, color: 'bg-slate-600' },
  { code: 'MOVIL', name: 'Móvil', icon: Smartphone, color: 'bg-red-600' },
  { code: '1PLAY', name: '1Play', icon: Phone, color: 'bg-blue-600' },
  { code: '2PLAY', name: '2Play', icon: Wifi, color: 'bg-cyan-600' },
  { code: '3PLAY', name: '3Play', icon: Package, color: 'bg-orange-600' },
  { code: 'TV', name: 'TV', icon: MonitorPlay, color: 'bg-purple-600' },
];

const INITIAL_STRUCTURES: PlanStructure[] = [
  {
    title: 'Planes Nacionales Individuales',
    category: 'MOVIL',
    technology: 'VOLTE',
    is_convergent_only: false,
    rows: []
  },
  {
    title: 'Business RED PLUS - Multilínea',
    category: 'MOVIL', 
    technology: 'VOLTE',
    is_convergent_only: false,
    rows: []
  },
  {
    title: '1PLAY - Voz Empresarial (Cobre/Fiber)',
    category: '1PLAY',
    technology: 'COBRE/VRAD',
    is_convergent_only: false,
    rows: []
  },
  {
    title: '2PLAY - Internet + Voz (GPON)',
    category: '2PLAY',
    technology: 'GPON',
    is_convergent_only: false,
    rows: []
  },
  {
    title: '3PLAY - Internet + Voz + TV',
    category: '3PLAY',
    technology: 'GPON',
    is_convergent_only: false,
    rows: []
  },
];

// ==================== COMPONENTE PRINCIPAL ====================
export default function TarifasPage() {
  const [structures, setStructures] = useState<PlanStructure[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [clientType, setClientType] = useState<'REGULAR' | 'CONVERGENTE'>('REGULAR');
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [expandedStructures, setExpandedStructures] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [currentView, setCurrentView] = useState<'visualizer' | 'structures' | 'import'>('visualizer');
  
  // Auditoría
  const [auditHistory, setAuditHistory] = useState<AuditItem[]>([]);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  
  // Modal de importación
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de edición
  const [editingRow, setEditingRow] = useState<PlanRow | null>(null);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('crm_token');
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  // Permitir importación a todos los usuarios (antes solo admin)
  const isAdmin = true;

  // ==================== CARGAR DATOS ====================
  useEffect(() => {
    loadStructures();
  }, []);

  const loadStructures = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/tarifas/plans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const grouped = groupPlansByStructure(data);
        setStructures(grouped.length > 0 ? grouped : INITIAL_STRUCTURES);
      } else {
        setStructures(INITIAL_STRUCTURES);
      }
    } catch (error) {
      console.error('Error loading structures:', error);
      setStructures(INITIAL_STRUCTURES);
    }
    setLoading(false);
  };

  const groupPlansByStructure = (plans: any[]): PlanStructure[] => {
    const groups: { [key: string]: PlanStructure } = {};
    
    plans.forEach(plan => {
      const key = plan.category_code || 'OTROS';
      if (!groups[key]) {
        groups[key] = {
          id: plan.category_id,
          title: plan.category_name || key,
          category: key,
          technology: plan.technology || 'GENERAL',
          is_convergent_only: plan.is_convergent_only || false,
          rows: []
        };
      }
      groups[key].rows.push({
        id: plan.id,
        code: plan.code || '',
        description: plan.description || plan.name || '',
        price: parseFloat(plan.price) || 0,
        alpha_code: plan.alpha_code || '',
        installation_0m: parseFloat(plan.installation_0m) || 0,
        installation_12m: parseFloat(plan.installation_12m) || 0,
        installation_24m: parseFloat(plan.installation_24m) || 0,
        penalty: parseFloat(plan.penalty) || 0,
        technology: plan.technology,
        data_included: plan.data_included,
        voice_included: plan.voice_included
      });
    });
    
    return Object.values(groups);
  };

  // ==================== FILTRADO ====================
  const filteredStructures = structures.filter(s => {
    if (activeCategory !== 'ALL' && s.category !== activeCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = s.title.toLowerCase().includes(term);
      const matchRows = s.rows.some(r => 
        r.code.toLowerCase().includes(term) || 
        r.description.toLowerCase().includes(term)
      );
      return matchTitle || matchRows;
    }
    return true;
  });

  // ==================== IMPORTACIÓN ARCHIVOS (via Backend) ====================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFileName(file.name);
    setIsProcessing(true);
    
    try {
      console.log('Enviando archivo al backend:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_URL}/api/tarifas/parse-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error procesando archivo');
      }
      
      const result = await response.json();
      console.log('Respuesta del backend:', result);
      
      if (result.plans.length === 0) {
        alert('No se encontraron planes en el archivo. Verifica el formato.');
      } else {
        setImportData(result.plans);
        setShowImportModal(true);
      }
    } catch (error: any) {
      console.error('Error procesando archivo:', error);
      alert(`Error: ${error.message || 'No se pudo procesar el archivo'}`);
    }
    
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyImportedData = async () => {
    setIsProcessing(true);
    
    let saved = 0;
    let errors = 0;
    
    for (const plan of importData) {
      try {
        const payload = {
          category_id: getCategoryId(plan.category),
          name: plan.description,
          code: plan.code,
          alpha_code: plan.alpha_code || plan.alfaCode || '',
          description: plan.description,
          price: plan.price,
          technology: plan.technology || 'GENERAL',
          installation_0m: plan.installation_0m || 0,
          installation_12m: plan.installation_12m || 0,
          installation_24m: plan.installation_24m || 0,
          penalty: plan.penalty || 0
        };
        
        const response = await fetch(`${API_URL}/api/tarifas/plans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          saved++;
        } else {
          errors++;
          console.error('Error guardando plan:', plan.code, await response.text());
        }
      } catch (err) {
        errors++;
        console.error('Error:', err);
      }
    }
    
    setShowImportModal(false);
    setImportData([]);
    setIsProcessing(false);
    
    alert(`✅ Guardados: ${saved} planes\n❌ Errores: ${errors}`);
    
    // Recargar datos
    loadStructures();
  };
  
  const getCategoryId = (categoryCode: string): number => {
    const map: Record<string, number> = {
      'MOVIL': 1, '1PLAY': 2, '2PLAY': 3, '3PLAY': 4, 'TV': 5, 'GENERAL': 6, 'OTROS': 6
    };
    return map[categoryCode] || 6;
  };

  const detectChangesOnly = () => {
    const changes: any[] = [];
    
    importData.forEach(imported => {
      const existing = structures
        .flatMap(s => s.rows)
        .find(r => r.code === imported.code);
      
      if (existing) {
        if (existing.price !== imported.price) {
          changes.push({
            type: 'price_change',
            code: imported.code,
            field: 'price',
            oldValue: existing.price,
            newValue: imported.price,
            description: imported.description
          });
        }
      } else {
        changes.push({
          type: 'new_plan',
          code: imported.code,
          price: imported.price,
          description: imported.description,
          category: imported.category
        });
      }
    });
    
    return changes;
  };

  // ==================== CRUD ====================
  const saveRowToServer = async (structureTitle: string, row: PlanRow) => {
    const structure = structures.find(s => s.title === structureTitle);
    if (!structure) return;
    
    const payload = {
      category_id: CATEGORIES.findIndex(c => c.code === structure.category) + 1,
      name: row.description,
      code: row.code,
      alpha_code: row.alpha_code,
      description: row.description,
      price: row.price,
      technology: structure.technology,
      installation_0m: row.installation_0m,
      installation_12m: row.installation_12m,
      installation_24m: row.installation_24m,
      penalty: row.penalty,
      is_convergent_only: structure.is_convergent_only
    };
    
    try {
      const url = row.id 
        ? `${API_URL}/api/tarifas/plans/${row.id}`
        : `${API_URL}/api/tarifas/plans`;
      
      const response = await fetch(url, {
        method: row.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        loadStructures();
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const deleteRow = async (structureTitle: string, rowCode: string) => {
    if (!confirm('¿Eliminar este plan?')) return;
    
    const structure = structures.find(s => s.title === structureTitle);
    const row = structure?.rows.find(r => r.code === rowCode);
    
    if (row?.id) {
      try {
        await fetch(`${API_URL}/api/tarifas/plans/${row.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        loadStructures();
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const applyPendingChange = (changeIndex: number) => {
    const change = pendingChanges[changeIndex];
    setStructures(prev => prev.map(s => ({
      ...s,
      rows: s.rows.map(r => {
        if (r.code === change.code && change.field === 'price') {
          return { ...r, price: change.newValue };
        }
        return r;
      })
    })));
    
    setPendingChanges(prev => prev.filter((_, i) => i !== changeIndex));
  };

  const toggleStructure = (title: string) => {
    setExpandedStructures(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* SIDEBAR */}
      {showSidebar && (
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
              Estructuras Maestras
            </h2>
            <p className="text-xs text-slate-600 mt-1">{structures.length} estructuras</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {CATEGORIES.filter(c => c.code !== 'ALL').map(cat => {
              const catStructures = structures.filter(s => s.category === cat.code);
              if (catStructures.length === 0) return null;
              
              return (
                <div key={cat.code} className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${cat.color} text-white`}>
                      {cat.code}
                    </span>
                    <span className="text-xs text-slate-500">{catStructures.length}</span>
                  </div>
                  
                  {catStructures.map(s => (
                    <button
                      key={s.title}
                      onClick={() => {
                        setSelectedStructure(s.title);
                        setActiveCategory(s.category);
                        toggleStructure(s.title);
                      }}
                      className={`w-full text-left px-3 py-3 rounded-xl mb-1 transition-all flex items-center justify-between group ${
                        selectedStructure === s.title
                          ? 'bg-slate-800 text-white'
                          : 'hover:bg-slate-800/50 text-slate-400'
                      }`}
                    >
                      <span className="text-sm font-bold truncate">{s.title}</span>
                      <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          
          {/* HISTORIAL */}
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-slate-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Historial de Origen
              </span>
            </div>
            {auditHistory.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Sin documentos procesados aún.</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {auditHistory.slice(0, 5).map(item => (
                  <div key={item.id} className="text-xs bg-slate-800 rounded-lg p-2">
                    <div className="font-bold text-white truncate">{item.fileName}</div>
                    <div className="text-slate-500">{item.date} • {item.changes.length} cambios</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* COLA DE AUDITORÍA */}
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-slate-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Cola de Auditoría
              </span>
            </div>
            {pendingChanges.length === 0 ? (
              <div className="text-center py-4">
                <AlertTriangle size={24} className="mx-auto text-slate-700 mb-2" />
                <p className="text-xs text-slate-600">Sin cambios pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingChanges.slice(0, 3).map((change, idx) => (
                  <div key={idx} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-400">{change.code}</span>
                      <button
                        onClick={() => applyPendingChange(idx)}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Aplicar
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {change.field}: ${change.oldValue} → ${change.newValue}
                    </div>
                  </div>
                ))}
                {pendingChanges.length > 3 && (
                  <p className="text-xs text-slate-500 text-center">
                    +{pendingChanges.length - 3} más...
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* BOTÓN LIMPIAR */}
          {isAdmin && (
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={() => {
                  if (confirm('¿Limpiar toda la mesa de trabajo?')) {
                    setPendingChanges([]);
                    setAuditHistory([]);
                  }
                }}
                className="w-full py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-500 hover:border-red-500/50 hover:text-red-400 transition-all text-sm font-bold"
              >
                Limpiar Mesa de Trabajo
              </button>
            </div>
          )}
        </aside>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="flex-none bg-slate-900 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                <span className="font-black text-white text-xl">C</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">Claro B2B Auditor</h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Intelligence Hub</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* TABS */}
              <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setCurrentView('visualizer')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentView === 'visualizer' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Visualizador
                </button>
                <button
                  onClick={() => setCurrentView('structures')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentView === 'structures' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Estructuras
                </button>
              </nav>
              
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-2.5 rounded-xl border transition-all ${
                  showSidebar
                    ? 'text-red-500 bg-red-500/10 border-red-500/20'
                    : 'text-slate-500 border-slate-700 hover:border-slate-600'
                }`}
              >
                <Layout size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* FILTERS BAR */}
        <div className="flex-none bg-slate-900/50 border-b border-slate-800 px-6 py-3">
          <div className="flex items-center justify-between">
            {/* CLIENT TYPE */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setClientType('REGULAR')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                  clientType === 'REGULAR'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                Cliente Regular
              </button>
              <button
                onClick={() => setClientType('CONVERGENTE')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                  clientType === 'CONVERGENTE'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                Convergente
              </button>
            </div>
            
            {/* CATEGORIES */}
            <div className="flex gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  onClick={() => setActiveCategory(cat.code)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeCategory === cat.code
                      ? `${cat.color} text-white`
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SEARCH & ACTIONS */}
        <div className="flex-none px-6 py-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Buscar por código, descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
            />
          </div>
          
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Upload size={18} />
                )}
                Audit Document
              </button>
            </>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={32} className="animate-spin text-red-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {filteredStructures.map(structure => {
                const isExpanded = expandedStructures.has(structure.title);
                const cat = CATEGORIES.find(c => c.code === structure.category);
                const CatIcon = cat?.icon || Layers;
                
                return (
                  <div
                    key={structure.title}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
                  >
                    {/* STRUCTURE HEADER */}
                    <button
                      onClick={() => toggleStructure(structure.title)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${cat?.color || 'bg-slate-600'}`}>
                          <CatIcon size={24} className="text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">
                            {structure.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${cat?.color || 'bg-slate-600'} text-white`}>
                              {structure.category}
                            </span>
                            {structure.is_convergent_only && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white">
                                CONVERGENTE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        size={24}
                        className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {/* TABLE */}
                    {isExpanded && (
                      <div className="border-t border-slate-800">
                        {/* TABLE HEADER */}
                        <div className="bg-red-600 px-6 py-3 grid grid-cols-12 gap-4 text-xs font-black uppercase text-white">
                          <div className="col-span-1">Job Code</div>
                          <div className="col-span-1">Renta</div>
                          <div className="col-span-4">Descripción del Servicio</div>
                          <div className="col-span-1">Alfa Code</div>
                          <div className="col-span-3 text-center">
                            <span className="bg-slate-900/30 px-2 py-0.5 rounded">
                              Instalación (0/12/24M)
                            </span>
                          </div>
                          <div className="col-span-1 text-center">Penalidad</div>
                          <div className="col-span-1"></div>
                        </div>
                        
                        {/* TABLE BODY */}
                        {structure.rows.length === 0 ? (
                          <div className="px-6 py-12 text-center text-slate-500">
                            <Database size={32} className="mx-auto mb-3 opacity-50" />
                            <p className="font-bold">Sin planes cargados</p>
                            <p className="text-xs mt-1">Usa "Audit Document" para importar</p>
                          </div>
                        ) : (
                          structure.rows.map((row, idx) => (
                            <div
                              key={row.code + idx}
                              className="px-6 py-4 grid grid-cols-12 gap-4 items-center border-b border-slate-800/50 hover:bg-slate-800/30 transition-all group"
                            >
                              <div className="col-span-1">
                                <span className="font-mono font-black text-red-400">{row.code}</span>
                              </div>
                              <div className="col-span-1">
                                <span className="font-black text-emerald-400">${row.price.toFixed(2)}</span>
                              </div>
                              <div className="col-span-4">
                                <p className="text-sm text-slate-300">{row.description}</p>
                              </div>
                              <div className="col-span-1">
                                <span className="text-xs font-mono text-slate-500">{row.alpha_code}</span>
                              </div>
                              <div className="col-span-3 text-center">
                                <span className="text-xs text-slate-400">
                                  ${row.installation_0m?.toFixed(2) || '0.00'} / 
                                  ${row.installation_12m?.toFixed(2) || '0.00'} / 
                                  <span className="text-emerald-400">${row.installation_24m?.toFixed(2) || '0.00'}</span>
                                </span>
                              </div>
                              <div className="col-span-1 text-center">
                                <span className="text-xs font-bold text-red-400">
                                  ${row.penalty?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                              <div className="col-span-1 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isAdmin && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingRow(row);
                                        setEditingStructureId(structure.title);
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => deleteRow(structure.title, row.code)}
                                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-300"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {filteredStructures.length === 0 && (
                <div className="text-center py-20">
                  <FileText size={48} className="mx-auto text-slate-700 mb-4" />
                  <h3 className="text-xl font-bold text-slate-500">Sin estructuras</h3>
                  <p className="text-slate-600 mt-2">Importa un documento para comenzar</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL IMPORTACIÓN */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-xl font-black text-white">
                  Auditoría: {importFileName}
                </h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
                  {importData.length} registros detectados
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-500 font-black text-[10px] uppercase">
                    <th className="p-3">Código</th>
                    <th className="p-3">Precio</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {importData.map((item, idx) => {
                    const existing = structures.flatMap(s => s.rows).find(r => r.code === item.code);
                    const isNew = !existing;
                    const priceChanged = existing && existing.price !== item.price;
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-white">{item.code}</td>
                        <td className="p-3 font-bold text-emerald-400">${item.price.toFixed(2)}</td>
                        <td className="p-3 text-slate-400 truncate max-w-xs">{item.description}</td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3">
                          {isNew ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">NUEVO</span>
                          ) : priceChanged ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                              PRECIO: ${existing?.price} → ${item.price}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-500">SIN CAMBIOS</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-end gap-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={applyImportedData}
                disabled={isProcessing}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-2"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Procesar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-black text-white">Editar Plan</h3>
              <p className="text-xs text-slate-500">{editingRow.code}</p>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingStructureId) {
                  saveRowToServer(editingStructureId, editingRow);
                }
                setEditingRow(null);
                setEditingStructureId(null);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Código</label>
                <input
                  type="text"
                  value={editingRow.code}
                  onChange={(e) => setEditingRow({ ...editingRow, code: e.target.value })}
                  className="w-full mt-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRow.price}
                  onChange={(e) => setEditingRow({ ...editingRow, price: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                <textarea
                  value={editingRow.description}
                  onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                  rows={3}
                  className="w-full mt-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500">Inst. 0M</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRow.installation_0m || 0}
                    onChange={(e) => setEditingRow({ ...editingRow, installation_0m: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Inst. 12M</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRow.installation_12m || 0}
                    onChange={(e) => setEditingRow({ ...editingRow, installation_12m: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Inst. 24M</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRow.installation_24m || 0}
                    onChange={(e) => setEditingRow({ ...editingRow, installation_24m: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Penalidad</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRow.penalty || 0}
                  onChange={(e) => setEditingRow({ ...editingRow, penalty: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRow(null);
                    setEditingStructureId(null);
                  }}
                  className="px-4 py-2 text-slate-500 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold flex items-center gap-2"
                >
                  <Save size={16} />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
