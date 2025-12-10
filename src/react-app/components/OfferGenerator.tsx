import { useState, useMemo } from 'react';
import { Check, Download, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import plansData from '../data/plans-data.json';

interface OfferGeneratorProps {
  clientName: string;
  onClose: () => void;
}

export default function OfferGenerator({ clientName, onClose }: OfferGeneratorProps) {
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const plans = useMemo(() => plansData.plans, []);
  const offers = useMemo(() => plansData.offers, []);

  const selectedPlan = plans.find(p => p.code === selectedPlanCode);

  const availableOffers = useMemo(() => {
    if (!selectedPlan || selectedPlan.price === null) return [];
    // Simple matching logic: check if the offer requirement string contains the plan price or name
    // This is a heuristic based on the Excel data structure
    const price = selectedPlan.price;
    return offers.filter(offer => {
        const req = offer.plan_requirement.toLowerCase();
        return req.includes(`$${price}`) || req.includes(selectedPlan.code.toLowerCase());
    });
  }, [selectedPlan, offers]);

  const handleGeneratePDF = () => {
    if (!selectedPlan || selectedPlan.price === null) return;

    const doc = new jsPDF();

    // Header
    doc.setFillColor(220, 38, 38); // Claro Red (approx)
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Propuesta Comercial', 105, 25, { align: 'center' });

    // Client Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Cliente: ${clientName}`, 20, 55);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 62);

    // Plan Details
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38);
    doc.text('Plan Propuesto', 20, 80);
    
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 85, 170, 30, 'F');
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(selectedPlan.name, 30, 95);
    doc.setFontSize(12);
    doc.text(selectedPlan.description, 30, 105, { maxWidth: 150 });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 100, 0);
    doc.text(`$${selectedPlan.price.toFixed(2)} / mes`, 160, 95);

    // Devices
    if (selectedDevices.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(220, 38, 38);
        doc.text('Equipos Incluidos (Oferta)', 20, 130);

        const deviceRows = selectedDevices.map(d => [d, 'GRATIS', 'Financiamiento 24/30 meses']);
        
        autoTable(doc, {
            startY: 135,
            head: [['Equipo', 'Precio', 'Condición']],
            body: deviceRows,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38] }
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Esta propuesta es válida por 15 días. Sujeto a aprobación de crédito.', 105, pageHeight - 20, { align: 'center' });

    doc.save(`Propuesta_${clientName.replace(/\s+/g, '_')}.pdf`);
  };

  const toggleDevice = (deviceName: string) => {
    if (selectedDevices.includes(deviceName)) {
        setSelectedDevices(selectedDevices.filter(d => d !== deviceName));
    } else {
        setSelectedDevices([...selectedDevices, deviceName]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
                <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">Generador de Ofertas IA</h2>
                <p className="text-sm text-gray-400">Creando propuesta para: <span className="text-white font-medium">{clientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Step 1: Select Plan */}
            <section>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Selecciona el Plan Ideal
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plans.map(plan => (
                        <div 
                            key={plan.code}
                            onClick={() => setSelectedPlanCode(plan.code)}
                            className={`cursor-pointer p-4 rounded-lg border transition-all ${
                                selectedPlanCode === plan.code 
                                ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' 
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-white">{plan.code}</span>
                                <span className="text-green-400 font-bold">${plan.price}</span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-3">{plan.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Step 2: Select Devices */}
            {selectedPlan && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                        Equipos en Oferta (Basado en Plan ${selectedPlan.price})
                    </h3>
                    
                    {availableOffers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {availableOffers.map((offer, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => toggleDevice(offer.device_name)}
                                    className={`cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all ${
                                        selectedDevices.includes(offer.device_name)
                                        ? 'bg-green-900/30 border-green-500'
                                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                        selectedDevices.includes(offer.device_name) ? 'bg-green-500 border-green-500' : 'border-gray-500'
                                    }`}>
                                        {selectedDevices.includes(offer.device_name) && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{offer.device_name}</p>
                                        <p className="text-xs text-green-400">GRATIS</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-dashed border-gray-700 text-center text-gray-400">
                            No se encontraron ofertas específicas de equipos gratis para este plan en la base de datos.
                        </div>
                    )}
                </section>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-700 bg-gray-800 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleGeneratePDF}
                disabled={!selectedPlan}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                <Download className="w-4 h-4" />
                Descargar Propuesta PDF
            </button>
        </div>
      </div>
    </div>
  );
}
