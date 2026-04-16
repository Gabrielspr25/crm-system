import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { Mic, MicOff, RotateCcw, Check, ChevronRight, Volume2, Loader2, AlertCircle, CheckCircle2, Edit3 } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

/* ─────────── types ─────────── */
interface ClientField {
  key: string;
  label: string;
  question: string;       // TTS question to ask
  required: boolean;
  value: string;
}

type Phase = "intro" | "asking" | "confirming" | "review" | "submitting" | "done" | "error";

/* ─────────── speech helpers ─────────── */
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "es-PR";
    utt.rate = 1.05;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.speak(utt);
  });
}

/* ─────────── component ─────────── */
export default function VoiceClientPage() {
  const navigate = useNavigate();

  /* ── field definitions ── */
  const [fields, setFields] = useState<ClientField[]>([
    { key: "name",             label: "Empresa / Cliente",  question: "¿Cuál es el nombre de la empresa o cliente?",       required: true,  value: "" },
    { key: "owner_name",       label: "Dueño",              question: "¿Cuál es el nombre del dueño?",                     required: false, value: "" },
    { key: "contact_person",   label: "Persona de contacto",question: "¿Quién es la persona de contacto?",                 required: false, value: "" },
    { key: "phone",            label: "Teléfono",           question: "¿Cuál es el número de teléfono?",                   required: false, value: "" },
    { key: "cellular",         label: "Celular",            question: "¿Cuál es el número de celular?",                    required: false, value: "" },
    { key: "email",            label: "Email",              question: "¿Cuál es el correo electrónico?",                   required: false, value: "" },
    { key: "address",          label: "Dirección",          question: "¿Cuál es la dirección?",                            required: false, value: "" },
    { key: "city",             label: "Ciudad",             question: "¿En qué ciudad se encuentra?",                      required: false, value: "" },
    { key: "zip_code",         label: "Código postal",      question: "¿Cuál es el código postal?",                        required: false, value: "" },
    { key: "notes",             label: "Notas",              question: "¿Alguna nota o comentario sobre este cliente?",      required: false, value: "" },
  ]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [statusMsg, setStatusMsg] = useState("Presiona Iniciar para comenzar el cuestionario por voz.");
  const [errorMsg, setErrorMsg] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const recognitionRef = useRef<any>(null);
  const abortRef = useRef(false);

  /* ── browser support check ── */
  const supported = !!SpeechRecognition;

  /* ── cleanup on unmount ── */
  useEffect(() => {
    return () => {
      abortRef.current = true;
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  /* ── listen for one answer ── */
  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!SpeechRecognition) { reject(new Error("No soportado")); return; }
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      rec.lang = "es-PR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        resolve(text);
      };
      rec.onerror = (e: any) => {
        if (e.error === "no-speech") {
          resolve("");
        } else {
          reject(new Error(e.error));
        }
      };
      rec.onend = () => {
        setListening(false);
      };

      setListening(true);
      rec.start();
    });
  }, []);

  /* ── stop listening ── */
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  /* ── main flow: ask all questions sequentially ── */
  const startQuestionnaire = useCallback(async () => {
    abortRef.current = false;
    setPhase("asking");
    setErrorMsg("");

    for (let i = 0; i < fields.length; i++) {
      if (abortRef.current) return;
      setCurrentIdx(i);
      const field = fields[i];
      const questionText = field.question + (field.required ? " (obligatorio)" : " (opcional, di 'saltar' para omitir)");

      // Ask the question via TTS
      setStatusMsg(`Pregunta ${i + 1} de ${fields.length}: ${field.label}`);
      await speak(questionText);
      if (abortRef.current) return;

      // Listen for answer
      setStatusMsg(`Escuchando respuesta para: ${field.label}...`);
      let answer = "";
      try {
        answer = await listenOnce();
      } catch {
        // mic error - let user type manually
        answer = "";
      }
      if (abortRef.current) return;

      // Check for skip command
      const lower = answer.toLowerCase().trim();
      if (lower === "saltar" || lower === "omitir" || lower === "skip" || lower === "siguiente") {
        answer = "";
      }

      // Confirm what was heard
      if (answer) {
        setTranscript(answer);
        setPhase("confirming");
        setStatusMsg(`Escuché: "${answer}". ¿Es correcto? Di "sí" o "no".`);
        await speak(`Escuché: ${answer}. ¿Es correcto? Di sí o no.`);
        if (abortRef.current) return;

        let confirmation = "";
        try { confirmation = await listenOnce(); } catch { confirmation = ""; }
        if (abortRef.current) return;

        const confLower = confirmation.toLowerCase().trim();
        if (confLower.includes("no") || confLower.includes("repite") || confLower.includes("repetir")) {
          // Re-ask this field
          i--;
          setPhase("asking");
          setTranscript("");
          continue;
        }
      }

      // Save value
      setFields(prev => {
        const copy = [...prev];
        copy[i] = { ...copy[i], value: answer };
        return copy;
      });
      setTranscript("");
      setPhase("asking");
    }

    // All done - go to review
    setPhase("review");
    setStatusMsg("Cuestionario completo. Revisa los datos y confirma.");
    await speak("Cuestionario completo. Revisa los datos en pantalla y confirma para crear el cliente.");
  }, [fields, listenOnce]);

  /* ── re-record a single field ── */
  const reRecordField = useCallback(async (idx: number) => {
    setPhase("asking");
    setCurrentIdx(idx);
    setStatusMsg(`Repitiendo: ${fields[idx].label}`);
    await speak(fields[idx].question);

    try {
      const answer = await listenOnce();
      if (answer && answer.toLowerCase().trim() !== "saltar") {
        setFields(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], value: answer };
          return copy;
        });
      }
    } catch { /* ignore */ }

    setPhase("review");
    setStatusMsg("Revisa los datos y confirma.");
  }, [fields, listenOnce]);

  /* ── inline edit field (keyboard) ── */
  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(fields[idx].value);
  };
  const saveEdit = (idx: number) => {
    setFields(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], value: editValue };
      return copy;
    });
    setEditingIdx(null);
  };

  /* ── submit to API ── */
  const submitClient = useCallback(async () => {
    // Validate required
    const nameField = fields.find(f => f.key === "name");
    if (!nameField?.value.trim()) {
      setErrorMsg("El nombre de la empresa es obligatorio.");
      return;
    }

    setPhase("submitting");
    setStatusMsg("Creando cliente...");
    setErrorMsg("");

    const body: Record<string, string> = {};
    for (const f of fields) {
      if (f.value.trim()) {
        body[f.key] = f.value.trim();
      }
    }

    try {
      const res = await authFetch("/api/clients", {
        method: "POST",
        json: body,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || `Error ${res.status}`);
      }

      const created = await res.json();
      setPhase("done");
      setStatusMsg(`Cliente "${created.name || body.name}" creado exitosamente.`);
      await speak(`Cliente ${body.name} creado exitosamente.`);
    } catch (err: any) {
      setPhase("error");
      setErrorMsg(err.message || "Error al crear cliente");
      setStatusMsg("Hubo un error. Puedes intentar de nuevo.");
    }
  }, [fields]);

  /* ── reset everything ── */
  const resetAll = () => {
    abortRef.current = true;
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
    setFields(prev => prev.map(f => ({ ...f, value: "" })));
    setPhase("intro");
    setCurrentIdx(0);
    setTranscript("");
    setStatusMsg("Presiona Iniciar para comenzar el cuestionario por voz.");
    setErrorMsg("");
    setEditingIdx(null);
  };

  /* ─────────── render ─────────── */
  if (!supported) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <h2 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Navegador no compatible</h2>
          <p className="text-red-600 dark:text-red-400">
            Tu navegador no soporta reconocimiento de voz. Usa <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> para esta función.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mic className="w-7 h-7 text-indigo-500" />
            Crear Cliente por Voz
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Responde las preguntas hablando. El sistema capturará tus respuestas.
          </p>
        </div>
        <button
          onClick={resetAll}
          className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition"
        >
          <RotateCcw className="w-4 h-4" /> Reiniciar
        </button>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl p-4 flex items-start gap-3 ${
        phase === "error" ? "bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
        : phase === "done" ? "bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
        : "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
      }`}>
        {phase === "error" && <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />}
        {phase === "done" && <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />}
        {phase === "submitting" && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mt-0.5 shrink-0" />}
        {!["error","done","submitting"].includes(phase) && <Volume2 className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />}
        <div>
          <p className={`font-medium ${
            phase === "error" ? "text-red-700 dark:text-red-300"
            : phase === "done" ? "text-green-700 dark:text-green-300"
            : "text-indigo-700 dark:text-indigo-300"
          }`}>{statusMsg}</p>
          {errorMsg && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errorMsg}</p>}
          {transcript && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Escuchado: <span className="font-semibold">"{transcript}"</span>
            </p>
          )}
        </div>
      </div>

      {/* Listening indicator */}
      {listening && (
        <div className="flex items-center justify-center gap-3 py-4">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </span>
          <span className="text-red-600 dark:text-red-400 font-medium animate-pulse">Escuchando...</span>
          <button onClick={stopListening} className="ml-2 px-3 py-1 text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 transition">
            <MicOff className="w-3 h-3 inline mr-1" /> Detener
          </button>
        </div>
      )}

      {/* Progress bar */}
      {(phase === "asking" || phase === "confirming") && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${((currentIdx + 1) / fields.length) * 100}%` }}
          />
        </div>
      )}

      {/* Fields table – always visible so user sees progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 w-1/4">Campo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Valor</th>
              {phase === "review" && <th className="px-4 py-3 w-24"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {fields.map((f, i) => {
              const isCurrent = (phase === "asking" || phase === "confirming") && i === currentIdx;
              return (
                <tr key={f.key} className={`${isCurrent ? "bg-indigo-50 dark:bg-indigo-900/20" : ""} transition-colors`}>
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-1">*</span>}
                    {isCurrent && <ChevronRight className="inline w-4 h-4 ml-1 text-indigo-500 animate-bounce" />}
                  </td>
                  <td className="px-4 py-3">
                    {editingIdx === i ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          className="flex-1 border border-indigo-300 dark:border-indigo-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(i); if (e.key === "Escape") setEditingIdx(null); }}
                        />
                        <button onClick={() => saveEdit(i)} className="px-2 py-1 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600 transition">
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className={f.value ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500 italic"}>
                        {f.value || (isCurrent ? "Esperando respuesta..." : "—")}
                      </span>
                    )}
                  </td>
                  {phase === "review" && (
                    <td className="px-4 py-3 text-right space-x-1">
                      <button onClick={() => startEdit(i)} title="Editar con teclado" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-600 transition">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => reRecordField(i)} title="Re-grabar por voz" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-600 transition">
                        <Mic className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        {phase === "intro" && (
          <button
            onClick={startQuestionnaire}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
          >
            <Mic className="w-5 h-5" /> Iniciar Cuestionario
          </button>
        )}

        {phase === "review" && (
          <>
            <button
              onClick={submitClient}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <Check className="w-5 h-5" /> Crear Cliente
            </button>
            <button
              onClick={() => { setPhase("intro"); setStatusMsg("Reiniciado. Presiona Iniciar."); }}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Empezar de nuevo
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <button
              onClick={submitClient}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all"
            >
              Reintentar
            </button>
            <button
              onClick={() => setPhase("review")}
              className="flex items-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all"
            >
              Volver a revisar
            </button>
          </>
        )}

        {phase === "done" && (
          <>
            <button
              onClick={() => navigate("/clientes")}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all"
            >
              Ver Clientes
            </button>
            <button
              onClick={resetAll}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all"
            >
              <Mic className="w-4 h-4" /> Crear Otro
            </button>
          </>
        )}
      </div>

      {/* Help note */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">
        Usa Google Chrome o Edge para mejor compatibilidad. Di "saltar" para omitir campos opcionales.
      </div>
    </div>
  );
}
