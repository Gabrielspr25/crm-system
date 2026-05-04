import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2, Save, Loader2, Check } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Product { id: string; name: string }
interface Vendor { id: number; name: string }
interface GoalsData {
  business: Record<string, number>;
  vendors: { vendor_id: number; vendor_name: string; goals: Record<string, number> }[];
}

export default function Gestion() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [biz, setBiz] = useState<Record<string, string>>({});
  const [vendorGoals, setVendorGoals] = useState<Record<number, Record<string, string>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const { data: products } = useApi<Product[]>("/api/products");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");

  const monthOptions = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, i, 1);
      return { value: d.toISOString().slice(0, 7), label: d.toLocaleDateString("es-ES", { year: "numeric", month: "long" }) };
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split("-").map(Number);
    const r = await authFetch(`/api/gestion/goals?year=${y}&month=${m}`);
    if (!r.ok) return;
    const data = await r.json() as GoalsData;

    const bizMap: Record<string, string> = {};
    Object.entries(data.business).forEach(([pid, amt]) => { bizMap[pid] = amt > 0 ? String(amt) : ""; });
    setBiz(bizMap);

    const vMap: Record<number, Record<string, string>> = {};
    data.vendors.forEach(v => {
      vMap[v.vendor_id] = {};
      Object.entries(v.goals).forEach(([pid, amt]) => { vMap[v.vendor_id][pid] = amt > 0 ? String(amt) : ""; });
    });
    setVendorGoals(vMap);
  }, [selectedMonth]);

  useEffect(() => { void load(); }, [load]);

  const flash = (key: string) => setSaved(p => ({ ...p, [key]: true }));

  const saveBiz = async () => {
    if (!products || !selectedMonth) return;
    setSaving(p => ({ ...p, biz: true }));
    const [y, m] = selectedMonth.split("-").map(Number);
    await Promise.all(products.map(p =>
      authFetch("/api/gestion/goals/business", {
        method: "POST",
        json: { product_id: p.id, period_year: y, period_month: m, amount: parseFloat(biz[p.id] || "0") || 0 },
      })
    ));
    setSaving(p => ({ ...p, biz: false }));
    flash("biz");
  };

  const saveVendor = async (vendorId: number) => {
    if (!products || !selectedMonth) return;
    const k = String(vendorId);
    setSaving(p => ({ ...p, [k]: true }));
    const [y, m] = selectedMonth.split("-").map(Number);
    await Promise.all(products.map(p =>
      authFetch("/api/gestion/goals/vendor", {
        method: "POST",
        json: { vendor_id: vendorId, product_id: p.id, period_year: y, period_month: m, amount: parseFloat(vendorGoals[vendorId]?.[p.id] || "0") || 0 },
      })
    ));
    setSaving(p => ({ ...p, [k]: false }));
    flash(k);
  };

  if (!products || !vendors) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const SaveBtn = ({ rowKey, onClick }: { rowKey: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={saving[rowKey]}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
        saved[rowKey] ? "bg-emerald-600 text-white" : "bg-slate-600 hover:bg-emerald-600 text-white"
      } disabled:opacity-50`}
    >
      {saving[rowKey] ? <Loader2 className="w-3 h-3 animate-spin" /> : saved[rowKey] ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
      {saved[rowKey] ? "Guardado" : "Guardar"}
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-emerald-500" />
            Gestión
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Configuración de metas por producto</p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setSaved({}); }}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Meta del Negocio */}
      <section>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Meta del Negocio</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {products.map(p => (
                  <th key={p.id} className="px-4 py-3 text-center text-slate-400 font-semibold text-xs uppercase">{p.name}</th>
                ))}
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              <tr>
                {products.map(p => (
                  <td key={p.id} className="px-3 py-3 text-center">
                    <input
                      type="number" min="0" step="1"
                      value={biz[p.id] ?? ""}
                      onChange={(e) => { setBiz(prev => ({ ...prev, [p.id]: e.target.value })); setSaved(s => ({ ...s, biz: false })); }}
                      placeholder="0"
                      className="w-24 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </td>
                ))}
                <td className="px-3 py-3 text-center">
                  <SaveBtn rowKey="biz" onClick={() => void saveBiz()} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Meta por Vendedor */}
      <section>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Meta por Vendedor</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase w-36">Vendedor</th>
                {products.map(p => (
                  <th key={p.id} className="px-4 py-3 text-center text-slate-400 font-semibold text-xs uppercase">{p.name}</th>
                ))}
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {vendors.map((v, idx) => {
                const colors = ["bg-emerald-600","bg-blue-600","bg-amber-600","bg-rose-600","bg-cyan-600","bg-violet-600","bg-pink-600","bg-teal-600"];
                const color = colors[idx % colors.length];
                const vk = String(v.id);
                return (
                  <tr key={v.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {v.name.charAt(0)}
                        </div>
                        <span className="text-white font-semibold text-sm">{v.name}</span>
                      </div>
                    </td>
                    {products.map(p => (
                      <td key={p.id} className="px-3 py-3 text-center">
                        <input
                          type="number" min="0" step="1"
                          value={vendorGoals[v.id]?.[p.id] ?? ""}
                          onChange={(e) => {
                            setVendorGoals(prev => ({ ...prev, [v.id]: { ...(prev[v.id] || {}), [p.id]: e.target.value } }));
                            setSaved(s => ({ ...s, [vk]: false }));
                          }}
                          placeholder="0"
                          className="w-24 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <SaveBtn rowKey={vk} onClick={() => void saveVendor(v.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
