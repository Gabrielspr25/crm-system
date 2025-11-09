import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../utils/auth";

type Doc = {
  id?: number; title: string; original_filename: string; mime_type: string;
  size_bytes: number; status: "ready"|"processing"|"failed"; updated_at?: string;
};

export default function IASalesPanel(){
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<{role:"user"|"assistant"; content:string}[]>([]);
  const list = useCallback(async()=>{
    setLoading(true);
    try{
      const r = await authFetch("/api/ai/documents");
      const d = await r.json(); setDocs(d);
    } finally { setLoading(false); }
  },[]);
  useEffect(()=>{ list(); },[list]);

  const upload = async () => {
    if(!file) return;
    const fd = new FormData(); fd.append("file", file);
    setBusy(true);
    try{
      const r = await authFetch("/api/ai/documents", { method:"POST", body: fd });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||"Error al subir");
      await list();
      alert("Documento indexado.");
    } catch(e:any){ alert(e.message); } finally{ setBusy(false); }
  };

  const send = async () => {
    if(!msg.trim()) return;
    const user = { role:"user" as const, content: msg };
    setChat(prev=>[...prev, user]); setMsg("");
    const r = await authFetch("/api/ai/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ message: user.content }) });
    const j = await r.json();
    setChat(prev=>[...prev, { role:"assistant", content: j.answer || "[Sin respuesta]" }]);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-white">🤖 Asistente IA de Ventas</h1>

      <section className="rounded-xl border border-slate-700 p-4 bg-slate-800/60">
        <h2 className="font-semibold text-slate-100 mb-2">Biblioteca de documentos</h2>
        <div className="flex gap-3 items-center">
          <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} />
          <button onClick={upload} disabled={busy} className="px-3 py-1 rounded bg-emerald-600 text-white">Cargar</button>
          <button onClick={list} className="px-3 py-1 rounded bg-slate-700 text-white">Actualizar</button>
        </div>
        <div className="mt-3 text-sm text-slate-300">{loading? "Cargando..." : `${docs.length} documento(s)`}</div>
        <ul className="mt-2 max-h-48 overflow-auto text-slate-300 text-sm">
          {docs.map(d=>(
            <li key={d.id} className="border-b border-slate-700 py-1">{d.title || d.original_filename} · {Math.round((d.size_bytes||0)/1024)} KB</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700 p-4 bg-slate-800/60">
        <h2 className="font-semibold text-slate-100 mb-2">Chat</h2>
        <div className="space-y-2 max-h-64 overflow-auto bg-slate-900/40 p-3 rounded">
          {chat.map((m, i)=>(
            <div key={i} className={m.role==="user" ? "text-right" : "text-left"}>
              <span className="text-xs text-slate-400">{m.role==="user"?"Tú":"IA"}:</span> <span className="text-slate-200 whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="flex-1 bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-slate-200" value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Pregúntale a la IA sobre tus ofertas..." />
          <button onClick={send} className="px-3 py-1 rounded bg-emerald-600 text-white">Enviar</button>
        </div>
      </section>
    </div>
  );
}
