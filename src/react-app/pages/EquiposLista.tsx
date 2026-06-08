import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Package,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

type EquipoMensualidad = { meses: number; monto: number | string };
type EquipoPospago = { plan: number | string; monto: number | string };

type Equipo = {
  item_code: string;
  sap_code?: string | null;
  modelo: string;
  marca: string;
  categoria: string;
  precio_regular?: number | string | null;
  fuera_portafolio?: boolean;
  mensualidades?: EquipoMensualidad[] | null;
  pospago_precios?: EquipoPospago[] | null;
};

type PreviewPayload = {
  resumen: { total: number; por_categoria: Record<string, number> };
  items: Equipo[];
};

type UploadItem = {
  id: number;
  nombre_archivo: string;
  subido_por: string;
  fecha_subida: string;
  vigencia_inicio?: string | null;
  vigencia_fin?: string | null;
  total_items: number;
};

const money = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number === 0) return "Gratis";
  return `$${number.toFixed(2)}`;
};

const label = (value: string) => {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Sin clasificar";
};

export default function EquiposLista() {
  const user = getCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const canAdmin = role === "admin" || role === "supervisor";

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [vigenciaInicio, setVigenciaInicio] = useState("");
  const [vigenciaFin, setVigenciaFin] = useState("");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadEquipos = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/equipos-lista");
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "No se pudo cargar la lista.");
      setEquipos(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  };

  const loadUploads = async () => {
    if (!canAdmin) return;
    const response = await authFetch("/api/equipos-lista/uploads");
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setUploads(Array.isArray(payload.data) ? payload.data : []);
  };

  useEffect(() => {
    void loadEquipos();
    void loadUploads();
  }, []);

  const categories = useMemo(
    () => [...new Set(equipos.map((item) => item.categoria).filter(Boolean))].sort(),
    [equipos]
  );
  const brands = useMemo(
    () => [...new Set(equipos.map((item) => item.marca).filter(Boolean))].sort(),
    [equipos]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return equipos.filter((item) => {
      if (category !== "all" && item.categoria !== category) return false;
      if (brand !== "all" && item.marca !== brand) return false;
      if (!term) return true;
      return [item.item_code, item.sap_code, item.modelo, item.marca, item.categoria]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [brand, category, equipos, search]);

  const onFile = (selected: File | null) => {
    setFile(selected);
    setPreview(null);
    setMessage("");
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await authFetch("/api/equipos-lista/preview", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "No se pudo generar preview.");
      setPreview(payload);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo generar preview.");
    } finally {
      setBusy(false);
    }
  };

  const applyUpload = async () => {
    if (!file) return;
    if (!confirm(`Aplicar "${file.name}" como nueva lista de precios?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vigencia_inicio", vigenciaInicio);
      formData.append("vigencia_fin", vigenciaFin);
      formData.append("notas", notas);
      const response = await authFetch("/api/equipos-lista/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "No se pudo aplicar la lista.");
      setMessage(payload.message || "Lista aplicada.");
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadEquipos();
      await loadUploads();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo aplicar la lista.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-950 p-4 text-slate-100 md:p-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-500/30 bg-red-600/20">
              <Package className="h-6 w-6 text-red-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Lista de Precios de Equipos</h1>
              <p className="text-sm text-slate-400">Equipos PYMES / Corporativo, mensualidades y precios por plan.</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadEquipos()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-sky-500/50"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </header>

      {canAdmin && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-semibold text-white">Administrar lista</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-sky-500/30 bg-sky-500/5 px-4 py-8 text-center transition hover:border-sky-400/70"
              >
                <FileSpreadsheet className="mb-3 h-10 w-10 text-sky-300" />
                <span className="text-sm font-semibold text-slate-100">{file ? file.name : "Seleccionar Excel"}</span>
                <span className="mt-1 text-xs text-slate-500">Formato .xlsx / .xls</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => onFile(event.currentTarget.files?.[0] || null)}
              />
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.currentTarget.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
                <input type="date" value={vigenciaFin} onChange={(e) => setVigenciaFin(e.currentTarget.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
              </div>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.currentTarget.value)}
                placeholder="Notas de carga"
                className="min-h-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <div className="flex gap-2">
                <button type="button" disabled={!file || busy} onClick={() => void runPreview()} className="h-10 rounded-lg bg-sky-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-40">
                  Ver preview
                </button>
                <button type="button" disabled={!file || busy} onClick={() => void applyUpload()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-40">
                  Aplicar lista
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200">
              {message.toLowerCase().includes("error") ? <AlertTriangle className="h-4 w-4 text-red-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
              {message}
            </div>
          )}

          {preview && (
            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="mb-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Total" value={preview.resumen.total} />
                {Object.entries(preview.resumen.por_categoria).map(([key, value]) => <Stat key={key} label={label(key)} value={value} />)}
              </div>
              <EquipoTable equipos={preview.items.slice(0, 80)} compact />
              {preview.items.length > 80 && <p className="mt-3 text-center text-xs text-slate-500">Preview limitado a 80 filas; la carga aplica {preview.items.length} items.</p>}
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.currentTarget.value)} placeholder="Buscar por modelo, marca o codigo" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.currentTarget.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            <option value="all">Todas las categorias</option>
            {categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
          <select value={brand} onChange={(e) => setBrand(e.currentTarget.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            <option value="all">Todas las marcas</option>
            {brands.map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Cargando lista...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : (
          <>
            <div className="mb-3 text-sm text-slate-500">Mostrando {filtered.length} de {equipos.length} equipos.</div>
            <EquipoTable equipos={filtered} />
          </>
        )}
      </section>

      {canAdmin && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-semibold text-white">Historial</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {uploads.length === 0 && <p className="text-sm text-slate-500">Sin uploads registrados.</p>}
            {uploads.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-100">{item.nombre_archivo}</p>
                  <p className="text-xs text-slate-500">{item.subido_por} · {new Date(item.fecha_subida).toLocaleString("es-PR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-sky-300">{item.total_items}</p>
                  <p className="text-xs text-slate-500">items</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-center">
      <div className="text-xl font-bold text-sky-300">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function EquipoTable({ equipos, compact = false }: { equipos: Equipo[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-950">
          <tr>
            <th className="px-3 py-3 text-left font-semibold text-slate-400">Codigo</th>
            <th className="px-3 py-3 text-left font-semibold text-slate-400">Equipo</th>
            <th className="px-3 py-3 text-left font-semibold text-slate-400">Marca</th>
            <th className="px-3 py-3 text-left font-semibold text-slate-400">Categoria</th>
            <th className="px-3 py-3 text-left font-semibold text-slate-400">Precio</th>
            <th className="px-3 py-3 text-left font-semibold text-slate-400">Mensualidades / Planes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
          {equipos.map((item, index) => (
            <tr key={`${item.item_code}-${index}`} className="hover:bg-slate-800/70">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-400">{item.item_code}</td>
              <td className="max-w-md px-3 py-3">
                <div className="font-medium text-slate-100">{item.modelo?.replace(/\*/g, "").trim()}</div>
                {item.fuera_portafolio && <span className="mt-1 inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">Fuera de portafolio</span>}
              </td>
              <td className="px-3 py-3 text-slate-300">{label(item.marca)}</td>
              <td className="px-3 py-3">
                <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300">{label(item.categoria)}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-emerald-300">{money(item.precio_regular)}</td>
              <td className="px-3 py-3 text-xs text-slate-400">
                <div className={compact ? "line-clamp-2" : ""}>
                  {(item.mensualidades || []).map((m) => `${m.meses}m ${money(m.monto)}`).join(" · ") ||
                    (item.pospago_precios || []).slice(0, 5).map((p) => `$${p.plan}: ${money(p.monto)}`).join(" · ") ||
                    "-"}
                </div>
              </td>
            </tr>
          ))}
          {equipos.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center text-slate-500">No hay equipos para mostrar.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
