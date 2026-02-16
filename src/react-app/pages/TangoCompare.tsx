import { useState, useEffect, useCallback } from 'react';
import { authFetch, API_BASE_URL } from '../utils/auth';
import {
  Search, RefreshCw, ChevronDown, ChevronRight, ArrowUpDown,
  CheckCircle2, AlertTriangle, XCircle, MinusCircle, Loader2,
  FileSpreadsheet, Eye, Calendar
} from 'lucide-react';

type TangoVenta = {
  ventaid: number;
  tipo: string;
  ventatipoid: number;
  linea: string;
  codigovoz: string;
  comisionclaro: number;
  vendedor: string;
  fecha: string;
};

type CrmSub = {
  sub_id: string;
  phone: string;
  line_type: string;
  account_type: string;
  company_earnings: number;
  vendor_commission: number;
};

type ComparisonItem = {
  ban: string;
  month: string;
  cliente: string;
  tango_count: number;
  crm_count: number;
  tango_ventas: TangoVenta[];
  crm_subs: CrmSub[];
  status: 'match' | 'partial' | 'missing_crm' | 'missing_tango';
};

type SummaryMonth = {
  tango: Record<string, number>;
  crm: Record<string, number>;
  tango_total: number;
  crm_total: number;
};

type DetailVenta = TangoVenta & {
  activo: boolean;
  nota: string;
  renovacion: boolean;
  fijo: boolean;
  plan_rate: number | null;
  comision_calculada: number | null;
  comisionvendedor: number;
  meses: number;
  fechaactivacion?: string;
};

type DetailCrm = {
  sub_id: string;
  phone: string;
  line_type: string;
  account_type: string;
  client_name: string;
  report_month: string;
  company_earnings: number;
  vendor_commission: number;
  paid_amount: number;
};

const STATUS_CONFIG = {
  match: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800', label: 'Match' },
  partial: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800', label: 'Parcial' },
  missing_crm: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800', label: 'Falta en CRM' },
  missing_tango: { icon: MinusCircle, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800', label: 'Solo en CRM' },
};

const TIPO_LABELS: Record<number, string> = {
  138: 'Update REN',
  139: 'Update NEW',
  140: 'Fijo REN',
  141: 'Fijo NEW',
};

export default function TangoComparePage() {
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [summary, setSummary] = useState<Record<string, SummaryMonth>>({});
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'compare' | 'summary' | 'detail'>('summary');
  const [detailBan, setDetailBan] = useState('');
  const [detailData, setDetailData] = useState<{ tango: DetailVenta[]; crm: DetailCrm[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoadingSummary(true);
    setError('');
    try {
      const res = await authFetch(`${API_BASE_URL}/api/tango/summary`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.months);
      } else {
        setError(data.error || 'Error cargando resumen');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoadingSummary(false);
    }
  };

  const doSearch = useCallback(async () => {
    if (!search.trim() && !monthFilter) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (monthFilter) params.set('month', monthFilter);
      const res = await authFetch(`${API_BASE_URL}/api/tango/compare?${params}`);
      const data = await res.json();
      if (data.success) {
        setComparison(data.comparison);
        setActiveTab('compare');
      } else {
        setError(data.error || 'Error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, monthFilter]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (monthFilter) params.set('month', monthFilter);
      const res = await authFetch(`${API_BASE_URL}/api/tango/compare?${params}`);
      const data = await res.json();
      if (data.success) {
        setComparison(data.comparison);
        setActiveTab('compare');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (ban: string) => {
    setDetailBan(ban);
    setLoadingDetail(true);
    setError('');
    setActiveTab('detail');
    try {
      const res = await authFetch(`${API_BASE_URL}/api/tango/detail/${ban}`);
      const data = await res.json();
      if (data.success) {
        setDetailData({ tango: data.tango, crm: data.crm });
      } else {
        setError(data.error || 'Error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatMoney = (n: number | null) => {
    if (n == null) return '-';
    return `$${Number(n).toFixed(2)}`;
  };

  const stats = {
    total: comparison.length,
    match: comparison.filter(c => c.status === 'match').length,
    partial: comparison.filter(c => c.status === 'partial').length,
    missing_crm: comparison.filter(c => c.status === 'missing_crm').length,
    missing_tango: comparison.filter(c => c.status === 'missing_tango').length,
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tango vs CRM</h1>
          <p className="text-sm text-slate-400">Comparativa de ventas PYMES entre Tango Legacy y CRM</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-4 mb-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Buscar (Cliente, BAN o Línea)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Ej: FC HOME, 784175066, 7873..."
                className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-slate-400 mb-1">Mes</label>
            <input
              type="month"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
            />
          </div>
          <button
            onClick={doSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50 flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Ver Todo
          </button>
          <button
            onClick={loadSummary}
            disabled={loadingSummary}
            className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            Resumen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'summary' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1" />
          Resumen Mensual
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'compare' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpDown className="w-4 h-4 inline mr-1" />
          Comparativa ({comparison.length})
        </button>
        {detailData && (
          <button
            onClick={() => setActiveTab('detail')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'detail' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-1" />
            Detalle: {detailBan}
          </button>
        )}
      </div>

      {activeTab === 'summary' && (
        <SummaryTab summary={summary} loading={loadingSummary} onMonthClick={m => { setMonthFilter(m); loadAll(); }} />
      )}
      {activeTab === 'compare' && (
        <CompareTab
          comparison={comparison}
          stats={stats}
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          loadDetail={loadDetail}
          formatDate={formatDate}
          formatMoney={formatMoney}
          loading={loading}
        />
      )}
      {activeTab === 'detail' && (
        <DetailTab
          ban={detailBan}
          data={detailData}
          loading={loadingDetail}
          formatDate={formatDate}
          formatMoney={formatMoney}
        />
      )}
    </div>
  );
}

// ================================================================
// Summary Tab
// ================================================================
function SummaryTab({ summary, loading, onMonthClick }: {
  summary: Record<string, SummaryMonth>;
  loading: boolean;
  onMonthClick: (m: string) => void;
}) {
  if (loading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /><p className="mt-2 text-sm text-slate-400">Cargando resumen...</p></div>;

  const months = Object.entries(summary).sort(([a], [b]) => a.localeCompare(b));
  if (months.length === 0) return <div className="text-center py-8 text-slate-400">No hay datos. Presiona "Resumen" para cargar.</div>;

  return (
    <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 border-b border-slate-700">
            <th className="text-left px-4 py-3 font-medium text-slate-300">Mes</th>
            <th className="text-center px-4 py-3 font-medium text-slate-300">Tango</th>
            <th className="text-center px-4 py-3 font-medium text-slate-300">CRM</th>
            <th className="text-center px-4 py-3 font-medium text-slate-300">Diferencia</th>
            <th className="text-center px-4 py-3 font-medium text-slate-300">Estado</th>
            <th className="text-center px-4 py-3 font-medium text-slate-300">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {months.map(([month, data]) => {
            const diff = data.tango_total - data.crm_total;
            const isMatch = diff === 0;
            return (
              <tr key={month} className={`hover:bg-slate-700/50 ${!isMatch ? 'bg-yellow-900/10' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-200">{month}</td>
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-orange-400">{data.tango_total}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {Object.entries(data.tango).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-blue-400">{data.crm_total}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {Object.entries(data.crm).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold ${diff === 0 ? 'text-green-400' : diff > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {diff === 0 ? '0' : diff > 0 ? `+${diff}` : diff}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {isMatch ? (
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Match
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Diferencia
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => onMonthClick(month)} className="text-xs text-blue-400 hover:underline">
                    Ver detalle
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 font-semibold border-t-2 border-slate-600">
            <td className="px-4 py-3 text-slate-200">TOTAL</td>
            <td className="px-4 py-3 text-center text-orange-400">
              {months.reduce((s, [, d]) => s + d.tango_total, 0)}
            </td>
            <td className="px-4 py-3 text-center text-blue-400">
              {months.reduce((s, [, d]) => s + d.crm_total, 0)}
            </td>
            <td className="px-4 py-3 text-center">
              {(() => {
                const t = months.reduce((s, [, d]) => s + d.tango_total, 0);
                const c = months.reduce((s, [, d]) => s + d.crm_total, 0);
                const d = t - c;
                return <span className={d === 0 ? 'text-green-400' : 'text-red-400'}>{d === 0 ? '0' : d > 0 ? `+${d}` : d}</span>;
              })()}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ================================================================
// Compare Tab
// ================================================================
function CompareTab({ comparison, stats, expandedRows, toggleRow, loadDetail, formatDate, formatMoney, loading }: {
  comparison: ComparisonItem[];
  stats: { total: number; match: number; partial: number; missing_crm: number; missing_tango: number };
  expandedRows: Set<string>;
  toggleRow: (k: string) => void;
  loadDetail: (ban: string) => void;
  formatDate: (d: string | null) => string;
  formatMoney: (n: number | null) => string;
  loading: boolean;
}) {
  if (loading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>;
  if (comparison.length === 0) return <div className="text-center py-8 text-slate-400">Busca un cliente, BAN o línea para comparar, o presiona "Ver Todo".</div>;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <StatCard label="Total" value={stats.total} color="gray" />
        <StatCard label="Match" value={stats.match} color="green" />
        <StatCard label="Parcial" value={stats.partial} color="yellow" />
        <StatCard label="Falta CRM" value={stats.missing_crm} color="red" />
        <StatCard label="Solo CRM" value={stats.missing_tango} color="blue" />
      </div>

      <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700">
              <th className="w-8"></th>
              <th className="text-left px-3 py-2.5 font-medium text-slate-300">Cliente</th>
              <th className="text-left px-3 py-2.5 font-medium text-slate-300">BAN</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-300">Mes</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-300">Tango</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-300">CRM</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-300">Estado</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {comparison.map((item) => {
              const key = `${item.ban}|${item.month}`;
              const expanded = expandedRows.has(key);
              const cfg = STATUS_CONFIG[item.status];
              const Icon = cfg.icon;

              return (
                <tbody key={key}>
                  <tr
                    className={`cursor-pointer hover:bg-slate-700/50 ${cfg.bg} border border-slate-700`}
                    onClick={() => toggleRow(key)}
                  >
                    <td className="px-2 py-2 text-center">
                      {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-100 truncate max-w-[200px]">{item.cliente}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{item.ban}</td>
                    <td className="px-3 py-2 text-center text-xs text-slate-300">{item.month}</td>
                    <td className="px-3 py-2 text-center font-semibold text-orange-400">{item.tango_count}</td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-400">{item.crm_count}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); loadDetail(item.ban); }}
                        className="text-blue-400 hover:text-blue-300 p-1"
                        title="Ver detalle completo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {expanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-900/50 px-4 py-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-bold text-orange-400 mb-2 uppercase tracking-wide">Tango ({item.tango_ventas.length})</h4>
                            {item.tango_ventas.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No hay ventas en Tango para este BAN/mes</p>
                            ) : (
                              <div className="space-y-1">
                                {item.tango_ventas.map((v, vi) => (
                                  <div key={vi} className="bg-slate-800 rounded border border-slate-700 px-3 py-2 text-xs flex items-center justify-between">
                                    <div>
                                      <span className="font-mono text-slate-300">{v.linea || '-'}</span>
                                      <span className="mx-2 text-slate-600">|</span>
                                      <span className={`font-medium ${v.ventatipoid === 139 || v.ventatipoid === 141 ? 'text-green-400' : 'text-slate-300'}`}>
                                        {TIPO_LABELS[v.ventatipoid] || v.tipo}
                                      </span>
                                    </div>
                                    <div className="text-slate-400">
                                      {formatDate(v.fecha)} · {formatMoney(v.comisionclaro)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-blue-400 mb-2 uppercase tracking-wide">CRM ({item.crm_subs.length})</h4>
                            {item.crm_subs.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No hay suscriptores en CRM para este BAN/mes</p>
                            ) : (
                              <div className="space-y-1">
                                {item.crm_subs.map((s, si) => (
                                  <div key={si} className="bg-slate-800 rounded border border-slate-700 px-3 py-2 text-xs flex items-center justify-between">
                                    <div>
                                      <span className="font-mono text-slate-300">{s.phone || '-'}</span>
                                      <span className="mx-2 text-slate-600">|</span>
                                      <span className="font-medium text-slate-200">{s.account_type} {s.line_type}</span>
                                    </div>
                                    <div className="text-slate-400">
                                      E: {formatMoney(s.company_earnings)} · V: {formatMoney(s.vendor_commission)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ================================================================
// Detail Tab
// ================================================================
function DetailTab({ ban, data, loading, formatDate, formatMoney }: {
  ban: string;
  data: { tango: DetailVenta[]; crm: DetailCrm[] } | null;
  loading: boolean;
  formatDate: (d: string | null) => string;
  formatMoney: (n: number | null) => string;
}) {
  if (loading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /><p className="mt-2 text-sm text-slate-400">Cargando detalle BAN {ban}...</p></div>;
  if (!data) return <div className="text-center py-8 text-slate-400">Selecciona un BAN para ver el detalle completo.</div>;

  const tangoActivas = data.tango.filter(v => v.activo);
  const tangoInactivas = data.tango.filter(v => !v.activo);

  const crmBySub = new Map<string, DetailCrm[]>();
  for (const r of data.crm) {
    const existing = crmBySub.get(r.sub_id) || [];
    existing.push(r);
    crmBySub.set(r.sub_id, existing);
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-4">
        <h2 className="text-lg font-bold text-slate-100 mb-1">BAN: <span className="font-mono">{ban}</span></h2>
        <div className="flex gap-4 text-sm text-slate-400">
          <span>Tango: <strong className="text-orange-400">{tangoActivas.length} activas</strong> / {tangoInactivas.length} inactivas</span>
          <span>CRM: <strong className="text-blue-400">{crmBySub.size} suscriptores</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tango ventas */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700">
          <div className="px-4 py-3 border-b border-slate-700 bg-orange-900/20">
            <h3 className="text-sm font-bold text-orange-300">Ventas Tango ({data.tango.length})</h3>
          </div>
          <div className="divide-y divide-slate-700 max-h-[600px] overflow-auto">
            {data.tango.map(v => (
              <div key={v.ventaid} className={`p-3 text-xs ${v.activo ? '' : 'bg-slate-900/50 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-slate-200">{v.cliente}</span>
                    {!v.activo && <span className="ml-2 text-[10px] bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded font-medium">INACTIVA</span>}
                  </div>
                  <span className="text-slate-500 font-mono">#{v.ventaid}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-slate-300">
                  <div><span className="text-slate-500">Línea:</span> <span className="font-mono">{v.linea || '-'}</span></div>
                  <div><span className="text-slate-500">Tipo:</span> <span className={v.ventatipoid === 139 || v.ventatipoid === 141 ? 'text-green-400 font-medium' : ''}>
                    {TIPO_LABELS[v.ventatipoid] || v.tipo}
                  </span></div>
                  <div><span className="text-slate-500">Fecha:</span> {formatDate(v.fecha || v.fechaactivacion)}</div>
                  <div><span className="text-slate-500">Meses:</span> {v.meses}</div>
                  <div><span className="text-slate-500">Plan:</span> {v.codigovoz || '-'} ({v.plan_rate != null ? `$${v.plan_rate}` : '-'})</div>
                  <div><span className="text-slate-500">Vendedor:</span> {v.vendedor || '-'}</div>
                  <div><span className="text-slate-500">Comisión Claro:</span> <strong className="text-slate-100">{formatMoney(v.comisionclaro)}</strong></div>
                  <div><span className="text-slate-500">Com. Calculada:</span> <strong className={v.comision_calculada != null ? 'text-green-400' : 'text-slate-500'}>{v.comision_calculada != null ? formatMoney(v.comision_calculada) : 'N/A'}</strong></div>
                  {v.nota && <div className="col-span-2"><span className="text-slate-500">Nota:</span> {v.nota}</div>}
                </div>
              </div>
            ))}
            {data.tango.length === 0 && <div className="p-4 text-center text-slate-500 italic">No hay ventas en Tango</div>}
          </div>
        </div>

        {/* CRM subscribers */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700">
          <div className="px-4 py-3 border-b border-slate-700 bg-blue-900/20">
            <h3 className="text-sm font-bold text-blue-300">Suscriptores CRM ({crmBySub.size})</h3>
          </div>
          <div className="divide-y divide-slate-700 max-h-[600px] overflow-auto">
            {[...crmBySub.entries()].map(([subId, reports]) => {
              const first = reports[0];
              return (
                <div key={subId} className="p-3 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-slate-200">{first.client_name}</span>
                      <span className="ml-2 text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded font-medium">{first.account_type} {first.line_type}</span>
                    </div>
                    <span className="font-mono text-slate-500">{first.phone}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {reports.filter(r => r.report_month).map((r, ri) => (
                      <div key={ri} className="flex justify-between items-center bg-slate-900/50 rounded px-2 py-1">
                        <span className="text-slate-400">{new Date(r.report_month).toISOString().slice(0, 7)}</span>
                        <div className="flex gap-3 text-slate-300">
                          <span>Empresa: <strong>{formatMoney(r.company_earnings)}</strong></span>
                          <span>Vendedor: <strong>{formatMoney(r.vendor_commission)}</strong></span>
                          <span>Pagado: <strong>{formatMoney(r.paid_amount)}</strong></span>
                        </div>
                      </div>
                    ))}
                    {reports.filter(r => r.report_month).length === 0 && (
                      <div className="text-slate-500 italic">Sin reportes</div>
                    )}
                  </div>
                </div>
              );
            })}
            {crmBySub.size === 0 && <div className="p-4 text-center text-slate-500 italic">No hay suscriptores en CRM para este BAN</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Stat Card
// ================================================================
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-slate-800 border-slate-700 text-slate-200',
    green: 'bg-green-900/30 border-green-800 text-green-300',
    yellow: 'bg-yellow-900/30 border-yellow-800 text-yellow-300',
    red: 'bg-red-900/30 border-red-800 text-red-300',
    blue: 'bg-blue-900/30 border-blue-800 text-blue-300',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color] || colors.gray}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
