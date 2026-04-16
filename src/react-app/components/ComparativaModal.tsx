import { useState, useEffect, useCallback } from 'react';
import { X, Save, Plus, Trash2, FileSpreadsheet, FileText, ArrowRightLeft, Package, Sparkles, Check, CheckCircle } from 'lucide-react';
import { authFetch } from '../utils/auth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// -- Types --
interface Subscriber {
  id: string | number;
  phone: string;
  plan?: string | null;
  monthly_value?: number | null;
  contract_end_date?: string | null;
  created_at?: string;
  status?: string;
  cancel_reason?: string | null;
}

interface BAN {
  id: string;
  ban_number: string;
  subscribers?: Subscriber[];
}

interface ClientForComparativa {
  id: number;
  name: string;
  business_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  bans: BAN[];
}

interface OfferRow {
  id: string;
  subId: string;
  ban: string;
  phone: string;
  plan: string;
  cost: string;
  notes: string;
}

interface SavedComparativa {
  id: string;
  title: string;
  created_at: string;
  data: {
    actual: { ban: string; phone: string; plan: string; cost: string; expiry: string }[];
    oferta: OfferRow[];
  };
}

interface ComparativaModalProps {
  client: ClientForComparativa;
  onClose: () => void;
  onRefreshClient?: () => Promise<void>;
}

// Timing helpers (duplicated for standalone)
function computeSubscriberTiming(contractEndDate: string | null | undefined): { status: string; days: number } {
  if (!contractEndDate) return { status: 'sin-fecha', days: 0 };
  // Handle both 'YYYY-MM-DD' and 'YYYY-MM-DDT00:00:00.000Z' formats
  const dateStr = contractEndDate.includes('T') ? contractEndDate.split('T')[0] : contractEndDate;
  const endDate = new Date(dateStr + 'T00:00:00');
  if (isNaN(endDate.getTime())) return { status: 'sin-fecha', days: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = endDate.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return { status: 'vencido', days: Math.abs(days) };
  if (days <= 30) return { status: 'proximo', days };
  if (days <= 90) return { status: 'atencion', days };
  return { status: 'vigente', days };
}

function getStatusBadge(status: string, days: number, _created_at?: string) {
  switch (status) {
    case 'vencido':
      return { label: `Vencido +${days}d`, className: 'bg-red-600/20 text-red-400 border border-red-500/30' };
    case 'proximo':
      return { label: `${days}d`, className: 'bg-amber-600/20 text-amber-400 border border-amber-500/30' };
    case 'atencion':
      return { label: `${days}d`, className: 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30' };
    case 'vigente':
      return { label: `${days}d`, className: 'bg-green-600/20 text-green-400 border border-green-500/30' };
    default:
      return { label: 'Sin fecha', className: 'bg-gray-600/20 text-gray-400' };
  }
}

export default function ComparativaModal({ client, onClose, onRefreshClient }: ComparativaModalProps) {
  // Notas generales para PDF
  const [generalNotes, setGeneralNotes] = useState('');
  // Editable actual data
  const [editingActual, setEditingActual] = useState<Record<string, { plan: string; cost: string; expiry: string }>>({});
  const [savingActualId, setSavingActualId] = useState<string | null>(null);
  const [savedActualId, setSavedActualId] = useState<string | null>(null);
  const [actualSubTab, setActualSubTab] = useState<'activas' | 'canceladas'>('activas');

  // Offer rows
  const [offerRows, setOfferRows] = useState<OfferRow[]>([]);

  // Save comparativa
  const [comparativaTitle, setComparativaTitle] = useState('');
  const [savedComparativas, setSavedComparativas] = useState<SavedComparativa[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [clientCheckedAt, setClientCheckedAt] = useState<string | null>(null);

  // Init offer rows from client BANs
  useEffect(() => {
    const rows: OfferRow[] = client.bans.flatMap(ban =>
      (ban.subscribers || []).filter(sub => sub.status !== 'cancelado' && sub.status !== 'cancelled').map(sub => ({
        id: crypto.randomUUID(),
        subId: String(sub.id),
        ban: ban.ban_number,
        phone: sub.phone,
        plan: '',
        cost: '',
        notes: '',
      }))
    );
    if (rows.length === 0) {
      rows.push({ id: crypto.randomUUID(), subId: '', ban: '', phone: '', plan: '', cost: '', notes: '' });
    }
    setOfferRows(rows);
  }, [client.bans]);

  // Load saved comparativas
  useEffect(() => {
    const key = `comparativas_${client.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setSavedComparativas(JSON.parse(saved)); } catch { setSavedComparativas([]); }
    }
  }, [client.id]);

  // -- Helpers --
  const getActualValue = useCallback((subId: string | number, field: 'plan' | 'cost' | 'expiry', original: Subscriber) => {
    const key = String(subId);
    if (editingActual[key]) return editingActual[key][field];
    if (field === 'plan') return original.plan || '';
    if (field === 'expiry') return original.contract_end_date || '';
    return original.monthly_value != null ? String(Number(original.monthly_value).toFixed(2)) : '';
  }, [editingActual]);

  const setActualValue = (subId: string | number, field: 'plan' | 'cost' | 'expiry', value: string) => {
    const key = String(subId);
    setEditingActual(prev => {
      const sub = client.bans.flatMap(b => b.subscribers || []).find(s => String(s.id) === key);
      const current = prev[key] || {
        plan: sub?.plan || '',
        cost: sub?.monthly_value != null ? String(Number(sub.monthly_value).toFixed(2)) : '',
        expiry: sub?.contract_end_date || '',
      };
      return { ...prev, [key]: { ...current, [field]: value } };
    });
  };

  const handleSaveActualSubscriber = async (subId: string) => {
    const edits = editingActual[subId];
    if (!edits) return;
    setSavingActualId(subId);
    try {
      const sub = client.bans.flatMap(b => b.subscribers || []).find(s => String(s.id) === subId);
      const res = await authFetch(`/api/subscribers/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: sub?.phone,
          plan: edits.plan || null,
          monthly_value: edits.cost ? parseFloat(edits.cost) : null,
          contract_end_date: edits.expiry || null,
        }),
      });
      if (res.ok) {
        setSavedActualId(subId);
        setTimeout(() => setSavedActualId(null), 2000);
        setMessage({ type: 'success', text: 'Suscriptor guardado ✓' });
        setTimeout(() => setMessage(null), 2500);
        // Keep edited values so UI stays updated without needing a full refresh
        // Don't delete from editingActual - the values stay as the new "baseline"
      } else {
        setMessage({ type: 'error', text: 'Error guardando suscriptor' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    }
    setSavingActualId(null);
  };

  const handleCancelLine = async (subId: string, phone: string) => {
    const reason = prompt(`¿Razón de cancelación para ${phone}? (opcional)`);
    if (reason === null) return;
    try {
      const res = await authFetch(`/api/subscribers/${subId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: reason || null }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Línea ${phone} cancelada.` });
        setActualSubTab('canceladas');
        if (onRefreshClient) await onRefreshClient();
      } else {
        setMessage({ type: 'error', text: 'Error al cancelar la línea.' });
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexión.' }); }
  };

  const handleReactivateLine = async (subId: string, phone: string) => {
    if (!confirm(`¿Reactivar la línea ${phone}?`)) return;
    try {
      const res = await authFetch(`/api/subscribers/${subId}/reactivate`, { method: 'PUT' });
      if (res.ok) {
        setMessage({ type: 'success', text: `Línea ${phone} reactivada.` });
        setActualSubTab('activas');
        if (onRefreshClient) await onRefreshClient();
      } else {
        setMessage({ type: 'error', text: 'Error al reactivar.' });
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexión.' }); }
  };

  const addOfferRow = () => {
    setOfferRows(prev => [...prev, { id: crypto.randomUUID(), subId: '', ban: '', phone: '', plan: '', cost: '', notes: '' }]);
  };

  const removeOfferRow = (id: string) => {
    setOfferRows(prev => prev.filter(r => r.id !== id));
  };

  const updateOfferRow = (id: string, field: keyof OfferRow, value: string) => {
    setOfferRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // -- Totals (solo activas) --
  const totalActual = client.bans.flatMap(b => b.subscribers || []).filter(s => s.status !== 'cancelado').reduce((sum, s) => {
    const edited = editingActual[String(s.id)];
    return sum + (edited ? parseFloat(edited.cost) || 0 : Number(s.monthly_value) || 0);
  }, 0);

  const totalOferta = offerRows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
  const diff = totalOferta - totalActual;

  // -- Build snapshot data (solo activas) --
  const buildActualData = () => {
    return client.bans.flatMap(ban =>
      (ban.subscribers || []).filter(s => s.status !== 'cancelado').map(s => ({
        ban: ban.ban_number,
        phone: s.phone,
        plan: getActualValue(s.id, 'plan', s),
        cost: getActualValue(s.id, 'cost', s),
        expiry: getActualValue(s.id, 'expiry', s),
      }))
    );
  };

  // -- Save comparativa to localStorage --
  const handleSaveComparativa = () => {
    const title = comparativaTitle.trim() || `Comparativa ${new Date().toLocaleDateString()}`;
    const newComp: SavedComparativa = {
      id: crypto.randomUUID(),
      title,
      created_at: new Date().toISOString(),
      data: {
        actual: buildActualData(),
        oferta: offerRows.filter(r => r.ban || r.phone || r.plan || r.cost),
      }
    };
    const key = `comparativas_${client.id}`;
    const updated = [...savedComparativas, newComp];
    localStorage.setItem(key, JSON.stringify(updated));
    setSavedComparativas(updated);
    setComparativaTitle('');
    setMessage({ type: 'success', text: `Comparativa "${title}" guardada.` });
    setTimeout(() => setMessage(null), 3000);
  };

  const deleteComparativa = (id: string) => {
    const updated = savedComparativas.filter(c => c.id !== id);
    localStorage.setItem(`comparativas_${client.id}`, JSON.stringify(updated));
    setSavedComparativas(updated);
  };

  const loadComparativa = (comp: SavedComparativa) => {
    if (comp.data.oferta && comp.data.oferta.length > 0) {
      setOfferRows(comp.data.oferta.map(r => ({
        id: crypto.randomUUID(),
        subId: r.subId || '',
        ban: r.ban || '',
        phone: r.phone || '',
        plan: r.plan || '',
        cost: r.cost || '',
        notes: r.notes || '',
      })));
    }
    setMessage({ type: 'info', text: `Comparativa "${comp.title}" cargada.` });
    setTimeout(() => setMessage(null), 2000);
  };

  // -- Excel Export --
  const exportToExcel = () => {
    const clientLabel = client.business_name || client.name;
    const actualData = buildActualData();
    const ofertaData = offerRows.filter(r => r.ban || r.phone || r.plan || r.cost);

    // Sheet 1: Plan Actual
    const wsActual = XLSX.utils.json_to_sheet(
      actualData.map(r => ({
        'BAN': r.ban,
        'Teléfono': r.phone,
        'Plan': r.plan,
        'Costo': r.cost ? `$${r.cost}` : '',
        'Vencimiento': r.expiry ? new Date(r.expiry + 'T00:00:00').toLocaleDateString() : '',
      }))
    );
    // Add total row
    XLSX.utils.sheet_add_aoa(wsActual, [
      ['', '', 'TOTAL', `$${totalActual.toFixed(2)}`, '']
    ], { origin: -1 });

    // Sheet 2: Oferta Propuesta
    const wsOferta = XLSX.utils.json_to_sheet(
      ofertaData.map(r => ({
        'BAN': r.ban,
        'Teléfono': r.phone,
        'Plan Nuevo': r.plan,
        'Costo': r.cost ? `$${r.cost}` : '',
        'Notas': r.notes,
      }))
    );
    XLSX.utils.sheet_add_aoa(wsOferta, [
      ['', '', 'TOTAL', `$${totalOferta.toFixed(2)}`, '']
    ], { origin: -1 });

    // Sheet 3: Resumen
    const wsResumen = XLSX.utils.json_to_sheet([
      { 'Concepto': 'Cliente', 'Valor': clientLabel },
      { 'Concepto': 'Fecha', 'Valor': new Date().toLocaleDateString() },
      { 'Concepto': 'Total Plan Actual', 'Valor': `$${totalActual.toFixed(2)}` },
      { 'Concepto': 'Total Oferta', 'Valor': `$${totalOferta.toFixed(2)}` },
      { 'Concepto': 'Diferencia', 'Valor': `${diff < 0 ? '-' : '+'}$${Math.abs(diff).toFixed(2)} ${diff < 0 ? '(ahorro)' : diff > 0 ? '(incremento)' : '(sin cambio)'}` },
    ]);

    // Column widths
    wsActual['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 15 }];
    wsOferta['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 25 }];
    wsResumen['!cols'] = [{ wch: 20 }, { wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsActual, 'Plan Actual');
    XLSX.utils.book_append_sheet(wb, wsOferta, 'Oferta Propuesta');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    const fileName = `Comparativa_${clientLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setMessage({ type: 'success', text: `Excel descargado: ${fileName}` });
    setTimeout(() => setMessage(null), 3000);
  };

  // -- PDF Export --
  const exportToPDF = () => {
    try {
    const clientLabel = client.business_name || client.name;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    // Header bar
    doc.setFillColor(16, 185, 129); // emerald
    doc.rect(0, 0, pw, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Comparativa de Planes', pw / 2, 18, { align: 'center' });
    doc.setFontSize(12);
    doc.text(clientLabel, pw / 2, 30, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    let y = 48;

    // Client info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, y);
    if (client.contact_person) doc.text(`Contacto: ${client.contact_person}`, 100, y);
    y += 6;
    if (client.email) { doc.text(`Email: ${client.email}`, 14, y); y += 6; }
    if (client.phone) { doc.text(`Teléfono: ${client.phone}`, 14, y); y += 6; }
    y += 4;

    // Table 1: Plan Actual
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Plan Actual', 14, y);
    y += 4;

    const actualRows = buildActualData().map(r => [
      r.ban,
      r.phone,
      r.plan,
      r.cost ? `$${r.cost}` : '-',
      r.expiry ? new Date(r.expiry + 'T00:00:00').toLocaleDateString() : '-',
    ]);
    actualRows.push(['', '', 'TOTAL', `$${totalActual.toFixed(2)}`, '']);

    autoTable(doc, {
      startY: y,
      head: [['BAN', 'Teléfono', 'Plan', 'Costo', 'Vencimiento']],
      body: actualRows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      footStyles: { fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Table 2: Oferta Propuesta
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Oferta Propuesta', 14, y);
    y += 4;

    const ofertaFiltered = offerRows.filter(r => r.ban || r.phone || r.plan || r.cost);
    const ofertaRows = ofertaFiltered.map(r => [
      r.ban,
      r.phone,
      r.plan,
      r.cost ? `$${r.cost}` : '-',
      r.notes || '',
    ]);
    ofertaRows.push(['', '', 'TOTAL', `$${totalOferta.toFixed(2)}`, '']);

    autoTable(doc, {
      startY: y,
      head: [['BAN', 'Teléfono', 'Plan Nuevo', 'Costo', 'Notas']],
      body: ofertaRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: { 3: { halign: 'right' }, 4: { cellWidth: 90 } },
      margin: { left: 14, right: 14 },
      pageBreak: 'auto',
    });
    // Usar la posición final real de la tabla, aunque haya salto de página
    y = (doc as any).lastAutoTable.finalY + 12;

    // Difference summary
    doc.setFillColor(diff < 0 ? 220 : diff > 0 ? 255 : 240, diff < 0 ? 252 : diff > 0 ? 243 : 240, diff < 0 ? 231 : diff > 0 ? 224 : 240);
    doc.roundedRect(14, y, pw - 28, 20, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`Actual: $${totalActual.toFixed(2)}`, 22, y + 8);
    doc.text(`Oferta: $${totalOferta.toFixed(2)}`, 80, y + 8);
    const diffLabel = `${diff < 0 ? '-' : '+'}$${Math.abs(diff).toFixed(2)} ${diff < 0 ? '(ahorro)' : diff > 0 ? '(incremento)' : ''}`;
    doc.setTextColor(diff < 0 ? 22 : diff > 0 ? 180 : 100, diff < 0 ? 163 : diff > 0 ? 83 : 100, diff < 0 ? 74 : diff > 0 ? 9 : 100);
    doc.text(diffLabel, pw - 22, y + 8, { align: 'right' });

    // Notas generales
    if (generalNotes && generalNotes.trim().length > 0) {
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('Notas / Observaciones:', 14, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const notesLines = doc.splitTextToSize(generalNotes, pw - 28);
      doc.text(notesLines, 14, y);
      y += notesLines.length * 6 + 2;
    }

    // Footer - Firma del vendedor
    y += 18;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pw - 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Gabriel Sanchez', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38); // red
    doc.text('Corporate and retail account Director', 14, y);
    y += 4;
    doc.setTextColor(80, 80, 80);
    doc.text('Tel Of: 787-796-2099  |  Cel: 787-319-0909', 14, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('CLARO', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('  Agente de ventas SS', 14 + doc.getTextWidth('CLARO'), y);
    y += 4;
    doc.setTextColor(80, 80, 80);
    doc.text('Email: gabriel.sanchez@claropr.com', 14, y);

    const fileName = `Comparativa_${clientLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    setMessage({ type: 'success', text: `PDF descargado: ${fileName}` });
    setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error generando PDF:', err);
      setMessage({ type: 'error', text: `Error al generar PDF: ${err.message}` });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-3">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-[1200px] max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-emerald-900/40 to-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Comparativa de Planes</h2>
              <p className="text-sm text-slate-400">{client.business_name || client.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {clientCheckedAt ? (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-500/30">
                <CheckCircle className="w-3.5 h-3.5" />
                Actualizado {new Date(clientCheckedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </span>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const resp = await authFetch(`/api/clients/${client.id}/mark-checked`, { method: 'PATCH' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setClientCheckedAt(data.last_checked_at);
                      setMessage({ type: 'success', text: 'Cliente marcado como actualizado ✓' });
                      setTimeout(() => setMessage(null), 2500);
                    }
                  } catch (err) { console.error(err); }
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 bg-gray-700 hover:bg-emerald-700 text-gray-300 hover:text-white border border-gray-600 hover:border-emerald-500 transition-colors"
                title="Marcar como actualizado"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Marcar Actualizado
              </button>
            )}
            <button onClick={exportToExcel} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors" title="Descargar Excel">
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button onClick={exportToPDF} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors" title="Descargar PDF">
              <FileText className="w-4 h-4" />
              PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl p-2 hover:bg-gray-800 rounded-lg transition-colors ml-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`px-6 py-3 text-sm border-b shrink-0 ${
            message.type === 'success' ? 'bg-green-900/40 border-green-500/40 text-green-100'
            : message.type === 'info' ? 'bg-blue-900/40 border-blue-500/40 text-blue-100'
            : 'bg-red-900/40 border-red-500/40 text-red-100'
          }`}>
            {message.text}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* === PLAN ACTUAL === */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Plan Actual del Cliente
              <span className="text-[10px] text-slate-500 font-normal ml-2">· Edita Plan, Costo y Vencimiento, luego guarda</span>
            </h3>

            {/* Sub-tabs: Activas / Canceladas */}
            {(() => {
              const allSubs = client.bans.flatMap(ban => (ban.subscribers || []).map(sub => ({ ...sub, ban_number: ban.ban_number, ban_id: ban.id })));
              const activeSubs = allSubs.filter(s => s.status !== 'cancelado' && s.status !== 'cancelled');
              const cancelledSubs = allSubs.filter(s => s.status === 'cancelado' || s.status === 'cancelled');
              const subsToShow = actualSubTab === 'activas' ? activeSubs : cancelledSubs;

              return (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setActualSubTab('activas')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${actualSubTab === 'activas' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      Activas ({activeSubs.length})
                    </button>
                    <button onClick={() => setActualSubTab('canceladas')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${actualSubTab === 'canceladas' ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      Canceladas ({cancelledSubs.length})
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800/60">
                          <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[120px]">BAN</th>
                          <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[120px]">Teléfono</th>
                          <th className="px-3 py-2.5 text-[10px] font-bold text-blue-400 uppercase w-[200px] bg-blue-500/5 border-l border-slate-700">Plan</th>
                          <th className="px-3 py-2.5 text-[10px] font-bold text-green-400 uppercase text-right w-[120px] bg-green-500/5 border-l border-slate-700">Costo</th>
                          <th className="px-3 py-2.5 text-[10px] font-bold text-amber-400 uppercase w-[140px] bg-amber-500/5 border-l border-slate-700">Vencimiento</th>
                          <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[80px]">Estado</th>
                          <th className="px-2 py-2.5 w-[100px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {subsToShow.length > 0 ? (
                          subsToShow.map(sub => {
                            const subKey = String(sub.id);
                            const expiryVal = getActualValue(sub.id, 'expiry', sub);
                            const { status, days } = computeSubscriberTiming(expiryVal || sub.contract_end_date);
                            const badge = getStatusBadge(status, days, sub.created_at);
                            const isEditing = editingActual[subKey] !== undefined;
                            const isCancelled = actualSubTab === 'canceladas';
                            return (
                              <tr key={sub.id} className={`transition-colors ${isCancelled ? 'opacity-60' : 'hover:bg-slate-800/20'}`}>
                                <td className="px-4 py-2 text-sm text-slate-300 font-mono">{sub.ban_number}</td>
                                <td className={`px-3 py-2 text-sm font-mono ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{sub.phone}</td>
                                {isCancelled ? (
                                  <>
                                    <td className="px-3 py-2 text-sm text-slate-500 border-l border-slate-700">{sub.plan || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-slate-500 text-right font-mono border-l border-slate-700">{sub.monthly_value ? `$${sub.monthly_value}` : '-'}</td>
                                    <td className="px-3 py-2 text-sm text-slate-500 font-mono border-l border-slate-700">{sub.contract_end_date ? new Date(sub.contract_end_date).toLocaleDateString() : '-'}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-1.5 bg-blue-500/5 border-l border-slate-700">
                                      <input type="text"
                                        value={getActualValue(sub.id, 'plan', sub)}
                                        onChange={e => setActualValue(sub.id, 'plan', e.target.value)}
                                        className={`w-full bg-slate-800 border text-sm px-2 py-2 rounded outline-none font-semibold transition-all ${isEditing ? 'border-blue-500 ring-1 ring-blue-500/20 text-blue-300' : 'border-slate-700 text-blue-300 hover:border-blue-500/50'}`}
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 bg-green-500/5 border-l border-slate-700">
                                      <input type="text"
                                        value={getActualValue(sub.id, 'cost', sub)}
                                        onChange={e => setActualValue(sub.id, 'cost', e.target.value)}
                                        className={`w-full bg-slate-800 border text-sm px-2 py-2 rounded outline-none text-right font-mono font-semibold transition-all ${isEditing ? 'border-green-500 ring-1 ring-green-500/20 text-green-400' : 'border-slate-700 text-green-400 hover:border-green-500/50'}`}
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 bg-amber-500/5 border-l border-slate-700">
                                      <input type="date"
                                        value={getActualValue(sub.id, 'expiry', sub)}
                                        onChange={async e => {
                                          setActualValue(sub.id, 'expiry', e.target.value);
                                          setTimeout(() => handleSaveActualSubscriber(String(sub.id)), 150);
                                        }}
                                        className={`w-full bg-slate-800 border text-sm px-2 py-2 rounded outline-none font-mono transition-all ${isEditing ? 'border-amber-500 ring-1 ring-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-300 hover:border-amber-500/50'}`}
                                      />
                                    </td>
                                  </>
                                )}
                                <td className="px-3 py-2">
                                  {isCancelled && sub.cancel_reason ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-900/40 text-orange-100 border border-orange-500/30" title={sub.cancel_reason}>
                                      {sub.cancel_reason.length > 12 ? sub.cancel_reason.slice(0, 12) + '…' : sub.cancel_reason}
                                    </span>
                                  ) : (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
                                      {badge.label}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    {isCancelled ? (
                                      <button
                                        onClick={() => handleReactivateLine(subKey, sub.phone)}
                                        className="px-2 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1"
                                        title="Reactivar línea"
                                      >
                                        <Check className="w-3 h-3" /> Reactivar
                                      </button>
                                    ) : (
                                      <>
                                        {isEditing && (
                                          <button
                                            onClick={() => handleSaveActualSubscriber(subKey)}
                                            disabled={savingActualId === subKey}
                                            className={`p-1.5 rounded-lg transition-all ${savedActualId === subKey
                                              ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40'
                                            }`} title="Guardar cambios"
                                          >
                                            {savingActualId === subKey
                                              ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                              : savedActualId === subKey
                                                ? <Check className="w-4 h-4" />
                                                : <Save className="w-4 h-4" />
                                            }
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleCancelLine(subKey, sub.phone)}
                                          className="px-2 py-1 rounded text-xs bg-orange-600 hover:bg-orange-500 text-white transition-all flex items-center gap-1"
                                          title="Cancelar línea"
                                        >
                                          <X className="w-3 h-3" /> Cancelar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                              {actualSubTab === 'activas' ? 'No hay líneas activas' : 'No hay líneas canceladas'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                {client.bans.length > 0 && actualSubTab === 'activas' && (
                  <tfoot>
                    <tr className="bg-slate-800/40 border-t border-slate-700">
                      <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-slate-300 text-right">Total Actual:</td>
                      <td className="px-3 py-2.5 text-right text-base text-green-400 font-bold font-mono bg-green-500/5 border-l border-slate-700">
                        ${totalActual.toFixed(2)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            </>
            );
            })()}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-emerald-500/30"></div>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
              <ArrowRightLeft className="w-4 h-4" />
              OFERTA PROPUESTA
            </div>
            <div className="flex-1 border-t border-emerald-500/30"></div>
          </div>

          {/* === OFERTA === */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Nueva Oferta
                <span className="text-[10px] text-slate-500 font-normal ml-2">· BANs y líneas pre-llenados, completa plan y costo</span>
              </h3>
              <button onClick={addOfferRow}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> Agregar Línea
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-900/20 border border-emerald-500/20">
                    <th className="px-4 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[120px]">BAN</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[120px]">Teléfono</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[200px] bg-emerald-500/5 border-l border-emerald-900/30">Plan Nuevo</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase text-right w-[120px] bg-emerald-500/5 border-l border-emerald-900/30">Costo</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[200px] border-l border-emerald-900/30">Notas</th>
                    <th className="px-2 py-2.5 w-[40px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-900/20">
                  {offerRows.map(row => (
                    <tr key={row.id} className="hover:bg-emerald-900/10 transition-colors">
                      <td className="px-4 py-1.5">
                        <input type="text" value={row.ban} onChange={e => updateOfferRow(row.id, 'ban', e.target.value)} placeholder="BAN"
                          className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm px-2 py-2 rounded outline-none focus:border-emerald-500 font-mono" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="text" value={row.phone} onChange={e => updateOfferRow(row.id, 'phone', e.target.value)} placeholder="Teléfono"
                          className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm px-2 py-2 rounded outline-none focus:border-emerald-500 font-mono" />
                      </td>
                      <td className="px-3 py-1.5 bg-emerald-500/5 border-l border-emerald-900/30">
                        <input type="text" value={row.plan} onChange={e => updateOfferRow(row.id, 'plan', e.target.value)} placeholder="Plan nuevo"
                          className="w-full bg-slate-800 border border-slate-700 text-emerald-300 text-sm px-2 py-2 rounded outline-none focus:border-emerald-500 font-semibold" />
                      </td>
                      <td className="px-3 py-1.5 bg-emerald-500/5 border-l border-emerald-900/30">
                        <input type="text" value={row.cost} onChange={e => updateOfferRow(row.id, 'cost', e.target.value)} placeholder="$0.00"
                          className="w-full bg-slate-800 border border-slate-700 text-green-400 text-sm px-2 py-2 rounded outline-none focus:border-emerald-500 text-right font-mono font-semibold" />
                      </td>
                      <td className="px-3 py-1.5 border-l border-emerald-900/30">
                        <input type="text" value={row.notes} onChange={e => updateOfferRow(row.id, 'notes', e.target.value)} placeholder="Notas..."
                          className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm px-2 py-2 rounded outline-none focus:border-emerald-500" />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => removeOfferRow(row.id)} className="text-red-500 hover:text-red-400 transition-colors p-1" title="Eliminar línea">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-900/20 border-t border-emerald-500/20">
                    <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-emerald-300 text-right">Total Oferta:</td>
                    <td className="px-3 py-2.5 text-right text-base text-green-400 font-bold font-mono bg-emerald-500/5 border-l border-emerald-900/30">
                      ${totalOferta.toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Difference */}
          {totalOferta > 0 && (
            <div className={`flex items-center justify-between p-5 rounded-lg border ${diff < 0 ? 'bg-green-900/20 border-green-500/30' : diff > 0 ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/40 border-slate-700'}`}>
              <div className="flex items-center gap-6">
                <div className="text-sm text-slate-400">Actual: <span className="text-white font-bold text-base">${totalActual.toFixed(2)}</span></div>
                <ArrowRightLeft className="w-5 h-5 text-slate-600" />
                <div className="text-sm text-slate-400">Oferta: <span className="text-emerald-400 font-bold text-base">${totalOferta.toFixed(2)}</span></div>
              </div>
              <span className={`text-xl font-bold ${diff < 0 ? 'text-green-400' : diff > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {diff < 0 ? '-' : diff > 0 ? '+' : ''}${Math.abs(diff).toFixed(2)}
                {diff < 0 && <span className="text-sm ml-2 text-green-500">(ahorro)</span>}
                {diff > 0 && <span className="text-sm ml-2 text-amber-500">(incremento)</span>}
              </span>
            </div>
          )}

          {/* Save comparativa */}
          <div className="flex items-center gap-3">
            <input type="text" value={comparativaTitle}
              onChange={e => setComparativaTitle(e.target.value)}
              placeholder="Nombre de la comparativa (ej: Migración Abril 2026)"
              className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-lg outline-none focus:border-emerald-500"
            />
            <button onClick={handleSaveComparativa}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30">
              <Save className="w-4 h-4" /> Guardar
            </button>
          </div>

          {/* Saved comparativas list */}
          {savedComparativas.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase">Comparativas Guardadas</h4>
              <div className="space-y-2">
                {savedComparativas.map(comp => (
                  <div key={comp.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700">
                    <div>
                      <span className="text-sm font-medium text-white">{comp.title}</span>
                      <span className="text-xs text-slate-500 ml-3">{new Date(comp.created_at).toLocaleDateString()}</span>
                      <span className="text-xs text-slate-500 ml-2">· {comp.data.actual?.length || 0} actual, {comp.data.oferta?.length || 0} oferta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => loadComparativa(comp)}
                        className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded transition-colors hover:bg-blue-900/30">Cargar</button>
                      <button onClick={() => deleteComparativa(comp.id)}
                        className="text-red-500 hover:text-red-400 transition-colors p-1" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-700 bg-gray-800/50 shrink-0">
          <textarea
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg outline-none focus:border-emerald-500 resize-vertical min-h-[48px]"
            placeholder="Notas u observaciones generales para el PDF..."
            value={generalNotes}
            onChange={e => setGeneralNotes(e.target.value)}
            maxLength={800}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-3">
              <button onClick={exportToExcel}
                className="bg-green-700/80 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Descargar Excel
              </button>
              <button onClick={exportToPDF}
                className="bg-red-700/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <FileText className="w-4 h-4" /> Descargar PDF
              </button>
            </div>
            <button onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
