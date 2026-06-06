import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Link2, RefreshCw, Search, XCircle } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

type PendingSale = {
  id: string;
  ventaid: number;
  ban_tango: string | null;
  cliente_tango: string | null;
  telefono_tango: string | null;
  ventatipo_id: number | null;
  ventatipo_nombre: string | null;
  fecha_activacion: string | null;
  company_earnings: string | number;
  vendor_commission: string | number;
  motivo: string;
  status: "needs_review" | "linked" | "ignored";
  linked_client_id?: string | null;
  linked_ban_id?: string | null;
  linked_subscriber_id?: string | null;
  linked_client_name?: string | null;
  linked_ban_number?: string | null;
  linked_subscriber_phone?: string | null;
  raw_payload?: unknown;
};

type ClientOption = { id: string; name: string; ban_count?: number; subscriber_count?: number };
type BanOption = { id: string; ban_number: string; account_type?: string; status?: string };
type SubscriberOption = { id: string; phone: string; plan?: string; status?: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const formatMoney = (value: string | number | null | undefined) => money.format(Number(value || 0));
const isoDate = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "-");

export default function TangoPendingSalesPage() {
  const [rows, setRows] = useState<PendingSale[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<PendingSale | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [bans, setBans] = useState<BanOption[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberOption[]>([]);
  const [linkForm, setLinkForm] = useState({ client_id: "", ban_id: "", subscriber_id: "" });
  const [filters, setFilters] = useState({
    status: "needs_review",
    ban: "",
    cliente: "",
    tipo: "",
    from: "2026-06-01",
    to: "2026-06-05",
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("limit", "200");
    return params.toString();
  }, [filters]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/tango/pending-sales?${queryString}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo cargar pendientes");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(Number(data.total || 0));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error cargando pendientes");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const openDetail = async (row: PendingSale) => {
    setMessage("");
    setSelected(row);
    setDetailOpen(true);
    setIgnoreReason("");
    setClientQuery(row.cliente_tango || "");
    setLinkForm({
      client_id: row.linked_client_id || "",
      ban_id: row.linked_ban_id || "",
      subscriber_id: row.linked_subscriber_id || "",
    });

    try {
      const response = await authFetch(`/api/tango/pending-sales/${row.ventaid}`);
      const data = await response.json();
      if (response.ok) setSelected(data);
    } catch {
      // detalle no bloquea la revision
    }
  };

  const searchClients = async () => {
    if (!clientQuery.trim()) return;
    const response = await authFetch(`/api/clients/search?q=${encodeURIComponent(clientQuery.trim())}`);
    const data = await response.json();
    setClients(Array.isArray(data) ? data : []);
  };

  const loadBans = async (clientId: string) => {
    setLinkForm({ client_id: clientId, ban_id: "", subscriber_id: "" });
    setSubscribers([]);
    const response = await authFetch(`/api/bans?client_id=${encodeURIComponent(clientId)}`);
    const data = await response.json();
    setBans(Array.isArray(data) ? data : []);
  };

  const loadSubscribers = async (banId: string) => {
    setLinkForm((current) => ({ ...current, ban_id: banId, subscriber_id: "" }));
    const response = await authFetch(`/api/subscribers?ban_id=${encodeURIComponent(banId)}`);
    const data = await response.json();
    setSubscribers(Array.isArray(data) ? data : []);
  };

  const linkSelected = async () => {
    if (!selected) return;
    const response = await authFetch(`/api/tango/pending-sales/${selected.ventaid}/link`, {
      method: "PATCH",
      json: linkForm,
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data?.error || "No se pudo vincular");
      return;
    }
    setMessage(`Venta ${selected.ventaid} vinculada`);
    await loadRows();
    await openDetail({ ...selected, status: "linked", ...data.row });
  };

  const ignoreSelected = async () => {
    if (!selected) return;
    const response = await authFetch(`/api/tango/pending-sales/${selected.ventaid}/ignore`, {
      method: "PATCH",
      json: { motivo_exclusion: ignoreReason },
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data?.error || "No se pudo ignorar");
      return;
    }
    setMessage(`Venta ${selected.ventaid} ignorada`);
    setDetailOpen(false);
    await loadRows();
  };

  const convertSelected = async () => {
    if (!selected) return;
    const response = await authFetch(`/api/tango/pending-sales/${selected.ventaid}/convert`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data?.error || "No se pudo convertir");
      return;
    }
    setMessage(data.already_exists ? `Venta ${selected.ventaid} ya existia en comisiones` : `Venta ${selected.ventaid} convertida a comisiones`);
    await loadRows();
    await openDetail(selected);
  };

  const visibleCompanyTotal = rows.reduce((sum, row) => sum + Number(row.company_earnings || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/90 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Comisiones Tango V2</p>
            <h1 className="mt-1 text-2xl font-bold">Pendientes PyMES ambiguos</h1>
          </div>
          <button onClick={loadRows} className="inline-flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20">
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      <main className="space-y-4 p-6">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-amber-200">PyMES en revision</p>
            <p className="mt-2 text-3xl font-bold">{total}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-emerald-200">Comision PyMES retenida</p>
            <p className="mt-2 text-3xl font-bold">{formatMoney(visibleCompanyTotal)}</p>
          </div>
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-sky-200">Estado</p>
            <p className="mt-2 text-3xl font-bold">{filters.status || "todos"}</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="needs_review">Needs review</option>
              <option value="linked">Linked</option>
              <option value="ignored">Ignored</option>
            </select>
            <input value={filters.ban} onChange={(e) => setFilters((f) => ({ ...f, ban: e.target.value }))} placeholder="BAN" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={filters.cliente} onChange={(e) => setFilters((f) => ({ ...f, cliente: e.target.value }))} placeholder="Cliente" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))} placeholder="Tipo ID" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
        </section>

        {message && <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>}

        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Venta</th>
                  <th className="px-4 py-3">BAN</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Telefono</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.ventaid} className="hover:bg-slate-900/80">
                    <td className="px-4 py-3 font-semibold text-cyan-200">{row.ventaid}</td>
                    <td className="px-4 py-3">{row.ban_tango}</td>
                    <td className="px-4 py-3 font-medium">{row.cliente_tango}</td>
                    <td className="px-4 py-3">{row.telefono_tango}</td>
                    <td className="px-4 py-3">{row.ventatipo_id} {row.ventatipo_nombre}</td>
                    <td className="px-4 py-3">{isoDate(row.fecha_activacion)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-300">{formatMoney(row.company_earnings)}</td>
                    <td className="px-4 py-3">{formatMoney(row.vendor_commission)}</td>
                    <td className="px-4 py-3"><span className="rounded-full border border-amber-500/40 px-2 py-1 text-xs text-amber-200">{row.status}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(row)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs hover:border-cyan-400 hover:text-cyan-200">
                        <Eye size={14} /> Revisar
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Sin pendientes PyMES para los filtros actuales</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {detailOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-xl font-bold">Venta {selected.ventaid}</h2>
                <p className="text-sm text-slate-400">{selected.cliente_tango} · BAN {selected.ban_tango}</p>
              </div>
              <button onClick={() => setDetailOpen(false)} className="rounded-md border border-slate-700 px-3 py-2 text-sm">Cerrar</button>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr]">
              <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-bold">Datos Tango</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <span className="text-slate-400">Comision empresa</span><strong className="text-emerald-300">{formatMoney(selected.company_earnings)}</strong>
                  <span className="text-slate-400">Comision vendedor</span><strong>{formatMoney(selected.vendor_commission)}</strong>
                  <span className="text-slate-400">Tipo</span><strong>{selected.ventatipo_id} {selected.ventatipo_nombre}</strong>
                  <span className="text-slate-400">Motivo</span><strong>{selected.motivo}</strong>
                  <span className="text-slate-400">Status</span><strong>{selected.status}</strong>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-bold">Vincular a CRM existente</h3>
                <div className="flex gap-2">
                  <input value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} placeholder="Buscar cliente existente" className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <button onClick={searchClients} className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold"><Search size={16} /> Buscar</button>
                </div>
                <select value={linkForm.client_id} onChange={(e) => loadBans(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                <select value={linkForm.ban_id} onChange={(e) => loadSubscribers(e.target.value)} disabled={!linkForm.client_id} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">Seleccionar BAN</option>
                  {bans.map((ban) => <option key={ban.id} value={ban.id}>{ban.ban_number} · {ban.account_type || ""}</option>)}
                </select>
                <select value={linkForm.subscriber_id} onChange={(e) => setLinkForm((current) => ({ ...current, subscriber_id: e.target.value }))} disabled={!linkForm.ban_id} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">Seleccionar suscriptor</option>
                  {subscribers.map((subscriber) => <option key={subscriber.id} value={subscriber.id}>{subscriber.phone} · {subscriber.plan || ""} · {subscriber.status || ""}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button onClick={linkSelected} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold"><Link2 size={16} /> Vincular</button>
                  <button onClick={convertSelected} disabled={selected.status !== "linked" || !selected.linked_subscriber_id} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={16} /> Convertir</button>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 lg:col-span-2">
                <h3 className="font-bold text-red-100">Ignorar venta</h3>
                <div className="flex gap-2">
                  <input value={ignoreReason} onChange={(e) => setIgnoreReason(e.target.value)} placeholder="Motivo obligatorio" className="flex-1 rounded-md border border-red-500/40 bg-slate-950 px-3 py-2 text-sm" />
                  <button onClick={ignoreSelected} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold"><XCircle size={16} /> Ignorar</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
