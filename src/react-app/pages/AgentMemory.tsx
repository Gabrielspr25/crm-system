import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Plus, Save, Search, X } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

type AgentMemory = {
  id: number;
  agent_name: string;
  memory_type: string;
  title: string;
  content: string;
  source_module: string | null;
  related_client_id: string | null;
  related_ban: string | null;
  importance: number;
  created_at: string;
};

const memoryTypes = [
  { value: "analysis", label: "Analisis" },
  { value: "recommendation", label: "Recomendacion" },
  { value: "execution", label: "Ejecucion" },
  { value: "context", label: "Contexto" },
  { value: "note", label: "Nota" },
];

const initialForm = {
  agent_name: "",
  memory_type: "note",
  title: "",
  content: "",
  source_module: "",
  related_client_id: "",
  related_ban: "",
  importance: "0",
};

export default function AgentMemoryPage() {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadMemories = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/agents/memory?limit=200");
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      setMemories(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      setError(err?.message || "Error cargando memorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMemories();
  }, []);

  const filteredMemories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return memories;
    return memories.filter((memory) => [
      memory.agent_name,
      memory.memory_type,
      memory.title,
      memory.content,
      memory.source_module,
      memory.related_client_id,
      memory.related_ban,
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [memories, searchTerm]);

  const updateForm = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const createMemory = async (event: React.FormEvent) => {
    event.preventDefault();
    const agentName = form.agent_name.trim();
    const title = form.title.trim();
    const content = form.content.trim();

    if (!agentName || !title || !content) {
      setError("Agente, titulo y contenido son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await authFetch("/api/agents/memory", {
        method: "POST",
        json: {
          agent_name: agentName,
          memory_type: form.memory_type,
          title,
          content,
          source_module: form.source_module.trim() || null,
          related_client_id: form.related_client_id.trim() || null,
          related_ban: form.related_ban.trim() || null,
          importance: Number(form.importance || 0),
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      setMemories((prev) => [payload, ...prev]);
      setForm(initialForm);
      setShowForm(false);
      setSuccess("Memoria guardada correctamente.");
    } catch (err: any) {
      setError(err?.message || "Error guardando memoria");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-400" />
            Cuartel de Agentes
          </h1>
          <p className="text-slate-400 text-sm mt-1">Memorias persistentes para analisis, recomendaciones y ejecuciones.</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 text-sm font-semibold transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cerrar" : "Nueva memoria"}
        </button>
      </div>

      {(error || success) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
          {error || success}
        </div>
      )}

      {showForm && (
        <form onSubmit={createMemory} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">Agente</span>
              <input value={form.agent_name} onChange={(e) => updateForm("agent_name", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">Tipo</span>
              <select value={form.memory_type} onChange={(e) => updateForm("memory_type", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                {memoryTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">Importancia</span>
              <input type="number" min="0" max="10" value={form.importance} onChange={(e) => updateForm("importance", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase text-slate-400">Titulo</span>
            <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase text-slate-400">Contenido</span>
            <textarea value={form.content} onChange={(e) => updateForm("content", e.target.value)} rows={5} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y" />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">Modulo origen</span>
              <input value={form.source_module} onChange={(e) => updateForm("source_module", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">Cliente ID opcional</span>
              <input value={form.related_client_id} onChange={(e) => updateForm("related_client_id", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">BAN opcional</span>
              <input value={form.related_ban} onChange={(e) => updateForm("related_ban", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </label>
          </div>

          <div className="flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar memoria
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Memorias</h2>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar memoria..." className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filteredMemories.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No hay memorias registradas.</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredMemories.map((memory) => (
              <article key={memory.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{memory.title}</h3>
                      <span className="rounded bg-cyan-500/15 text-cyan-300 px-2 py-0.5 text-xs">{memory.memory_type}</span>
                      <span className="rounded bg-slate-700 text-slate-300 px-2 py-0.5 text-xs">Imp. {memory.importance}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {memory.agent_name} · {new Date(memory.created_at).toLocaleString()}
                    </p>
                  </div>
                  {(memory.source_module || memory.related_ban || memory.related_client_id) && (
                    <div className="text-xs text-slate-400 md:text-right">
                      {memory.source_module && <div>Modulo: {memory.source_module}</div>}
                      {memory.related_client_id && <div>Cliente: {memory.related_client_id}</div>}
                      {memory.related_ban && <div>BAN: {memory.related_ban}</div>}
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-200 mt-3 whitespace-pre-wrap">{memory.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
