import { useState, useEffect } from 'react';
import { X, FileText, Download, User, Phone, Mail, Package } from 'lucide-react';
import { authFetch } from '../utils/auth';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface OfferGeneratorProps {
  clientName: string;
  clientId?: number;
  onClose: () => void;
}

interface ClientData {
  id: number;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  bans: Array<{
    ban_number: string;
    subscribers: Array<{
      phone: string;
      service_type: string | null;
      monthly_value: number | null;
      contract_end_date: string | null;
    }>;
  }>;
}

export default function OfferGenerator({ clientName, clientId, onClose }: OfferGeneratorProps) {
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerText, setOfferText] = useState('');
  const [offerTitle, setOfferTitle] = useState('Propuesta Comercial');

  useEffect(() => {
    if (clientId) {
      loadClientData();
    } else {
      setLoading(false);
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      const response = await authFetch(`/api/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClientData(data);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('VentasPro CRM', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text(offerTitle, pageWidth / 2, 32, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    
    let yPos = 50;
    
    // Cliente Info
    if (clientData) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Información del Cliente', 20, yPos);
      yPos += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Empresa: ${clientData.business_name || clientData.name}`, 20, yPos);
      yPos += 7;
      if (clientData.contact_person) {
        doc.text(`Contacto: ${clientData.contact_person}`, 20, yPos);
        yPos += 7;
      }
      if (clientData.email) {
        doc.text(`Email: ${clientData.email}`, 20, yPos);
        yPos += 7;
      }
      if (clientData.phone) {
        doc.text(`Teléfono: ${clientData.phone}`, 20, yPos);
        yPos += 7;
      }
      yPos += 5;
      
      // Planes Actuales
      if (clientData.bans && clientData.bans.length > 0) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Planes Actuales', 20, yPos);
        yPos += 10;
        
        const tableData: any[] = [];
        clientData.bans.forEach(ban => {
          ban.subscribers.forEach(sub => {
            tableData.push([
              ban.ban_number,
              sub.phone,
              sub.service_type || '-',
              sub.monthly_value ? `$${sub.monthly_value}` : '-',
              sub.contract_end_date ? new Date(sub.contract_end_date).toLocaleDateString() : '-'
            ]);
          });
        });
        
        (doc as any).autoTable({
          startY: yPos,
          head: [['BAN', 'Línea', 'Tipo', 'Valor Mensual', 'Vencimiento']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] }
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
    }
    
    // Propuesta
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Propuesta Comercial', 20, yPos);
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(offerText || 'Sin propuesta', pageWidth - 40);
    doc.text(lines, 20, yPos);
    
    const fileName = `Oferta_${clientData?.business_name || clientName}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">{offerTitle}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {clientData && (
                <>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Cliente
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-400">Empresa:</span> <span className="text-white">{clientData.business_name || clientData.name}</span></div>
                      {clientData.contact_person && <div><span className="text-gray-400">Contacto:</span> <span className="text-white">{clientData.contact_person}</span></div>}
                      {clientData.email && <div><span className="text-gray-400">Email:</span> <span className="text-white">{clientData.email}</span></div>}
                      {clientData.phone && <div><span className="text-gray-400">Tel:</span> <span className="text-white">{clientData.phone}</span></div>}
                    </div>
                  </div>
                  {clientData.bans?.length > 0 && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Planes Actuales
                      </h3>
                      {clientData.bans.map((ban, i) => (
                        <div key={i} className="mb-2 text-sm">
                          <p className="text-blue-400">BAN: {ban.ban_number}</p>
                          {ban.subscribers.map((sub, j) => (
                            <div key={j} className="flex justify-between text-gray-300">
                              <span>{sub.phone}</span>
                              <span>${sub.monthly_value || 0}/mes</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
                <input
                  type="text"
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Propuesta</label>
                <textarea
                  value={offerText}
                  onChange={(e) => setOfferText(e.target.value)}
                  className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none"
                  placeholder="Escribe tu oferta comercial aquí..."
                />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Cancelar</button>
          <button onClick={generatePDF} disabled={!offerText.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
