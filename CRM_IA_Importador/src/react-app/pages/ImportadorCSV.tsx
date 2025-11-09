import { useState } from "react";
import { authFetch } from "../utils/auth";

export default function ImportadorCSV(){
  const [file, setFile] = useState<File|null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string,string>>({});
  const [table, setTable] = useState("clients");
  const [upsertKey, setUpsertKey] = useState("id");

  const analyze = async ()=>{
    if(!file) return alert("Selecciona un archivo CSV/XLSX");
    const fd = new FormData(); fd.append("file", file);
    const r = await authFetch("/api/import/upload", { method:"POST", body: fd });
    const j = await r.json();
    if(!r.ok) return alert(j.error||"Error analizando archivo");
    setHeaders(j.headers||[]); setSample(j.sample||[]);
    const init:Record<string,string> = {}; (j.headers||[]).forEach((h:string)=> init[h]=h);
    setMapping(init);
  };

  const save = async ()=>{
    const res = await authFetch("/api/import/save", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ table, rows: sample.length? sample: [], mapping, upsertKey })
    });
    const j = await res.json();
    if(!res.ok) return alert(j.error||"Error guardando");
    alert(`Importación OK. Insertados: ${j.inserted}`);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-white">📂 Importador CSV/Excel</h1>

      <section className="rounded-xl border border-slate-700 p-4 bg-slate-800/60 space-y-3">
        <div className="flex gap-2 items-center">
          <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} />
          <select value={table} onChange={e=>setTable(e.target.value)} className="bg-slate-900/60 text-slate-200 border border-slate-700 rounded px-2 py-1">
            <option value="clients">public.clients</option>
            <option value="bans">public.bans</option>
            <option value="subscribers">public.subscribers</option>
            <option value="products">public.products</option>
          </select>
          <input value={upsertKey} onChange={e=>setUpsertKey(e.target.value)} placeholder="Clave de conflicto (ej. id o ban_number)" className="bg-slate-900/60 text-slate-200 border border-slate-700 rounded px-2 py-1" />
          <button onClick={analyze} className="px-3 py-1 rounded bg-slate-700 text-white">Analizar</button>
        </div>

        {headers.length>0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-100">Mapeo de columnas</h3>
            {headers.map((h)=>(
              <div key={h} className="flex items-center gap-2 text-sm">
                <span className="w-48 text-slate-300">{h}</span>
                <span>→</span>
                <input value={mapping[h]||""} onChange={e=>setMapping(prev=>({...prev, [h]: e.target.value}))}
                  className="flex-1 bg-slate-900/60 text-slate-200 border border-slate-700 rounded px-2 py-1"
                  placeholder="Nombre de columna en la tabla destino" />
              </div>
            ))}
            <button onClick={save} className="mt-2 px-3 py-1 rounded bg-emerald-600 text-white">Importar</button>
          </div>
        )}
      </section>

      {sample.length>0 && (
        <section className="rounded-xl border border-slate-700 p-4 bg-slate-800/60">
          <h2 className="font-semibold text-slate-100 mb-2">Muestra (primeras 5 filas)</h2>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap">{JSON.stringify(sample, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
