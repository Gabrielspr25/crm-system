import { useState, useMemo } from 'react';
import { X, Send, Mail, Users } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Uno o varios emails. Acepta string con separadores (, ; espacio) o array. */
  recipientEmail: string | string[];
  recipientName: string;
}

// Extrae lista de emails desde un string mixto o array. Filtra vacíos y deduplica.
function parseEmails(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join(',') : (input || '');
  const list = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean)
    // Validación básica: tiene @ y al menos un punto en el dominio
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return Array.from(new Set(list));
}

export default function EmailModal({ isOpen, onClose, recipientEmail, recipientName }: EmailModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const emails = useMemo(() => parseEmails(recipientEmail), [recipientEmail]);
  const hasMultiple = emails.length > 1;

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();

    if (emails.length === 0) {
      alert('No hay correos válidos para este destinatario.');
      return;
    }

    // Multi-destinatario → BCC para no exponer la lista entre clientes.
    // Único destinatario → To: directo.
    const params = new URLSearchParams();
    params.set('subject', subject);
    params.set('body', message);
    const queryString = params.toString();

    const mailtoUrl = hasMultiple
      ? `mailto:?bcc=${encodeURIComponent(emails.join(','))}&${queryString}`
      : `mailto:${encodeURIComponent(emails[0])}?${queryString}`;

    window.location.href = mailtoUrl;

    setSubject('');
    setMessage('');
    onClose();
  };

  const canSend = emails.length > 0 && subject.trim().length > 0 && message.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            Enviar correo
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700/50"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          <form onSubmit={handleSend} className="space-y-4">
            {/* Destinatario */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Para
              </label>
              {emails.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-3 py-2 rounded-lg text-sm">
                  ⚠️ Este cliente no tiene un correo válido cargado.
                </div>
              ) : hasMultiple ? (
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold mb-2">
                    <Users className="w-4 h-4" />
                    {emails.length} correos · se enviarán en <strong>BCC</strong>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {emails.map((e) => (
                      <span key={e} className="text-xs bg-slate-700 text-slate-200 px-2 py-1 rounded font-mono">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                  <span className="text-slate-300 font-medium">{recipientName}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-blue-300 font-mono text-sm">{emails[0]}</span>
                </div>
              )}
            </div>

            {/* Asunto */}
            <div>
              <label htmlFor="subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Asunto
              </label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 placeholder:text-slate-500"
                placeholder="Asunto del correo"
                required
                autoFocus
              />
            </div>

            {/* Mensaje */}
            <div>
              <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Mensaje
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 h-56 resize-none placeholder:text-slate-500"
                placeholder="Escribí tu mensaje acá..."
                required
              />
            </div>

            {/* Aviso */}
            <p className="text-[11px] text-slate-500 italic">
              💡 Al hacer click en <strong>Abrir Outlook</strong> se va a abrir tu cliente de correo con los datos cargados. Confirmá el envío desde ahí.
            </p>

            {/* Acciones */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSend}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2 rounded-lg flex items-center gap-2 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                <Send size={16} />
                Abrir Outlook
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
