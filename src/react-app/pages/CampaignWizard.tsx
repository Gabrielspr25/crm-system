import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Users, FileText, Paperclip, Send, CheckCircle, Upload, Trash2 } from 'lucide-react';
import { authFetch } from '../utils/auth';

interface Client {
  id: string;
  name: string;
  email: string;
  salesperson_name: string;
}

interface Attachment {
  file: File;
  preview: string;
}

export default function CampaignWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form data
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  // Client selection
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    // Si vienen clientes pre-seleccionados desde Campaigns, cargarlos y saltar al paso 2
    const state = location.state as { preSelectedClientIds?: string[], scheduledAt?: string | null };
    if (state?.preSelectedClientIds && state.preSelectedClientIds.length > 0) {
      // Esperar a que se carguen los clientes
      if (clients.length > 0) {
        const preSelected = clients.filter(c => state.preSelectedClientIds!.includes(c.id));
        setSelectedClients(preSelected);
        setStep(2); // Saltar al paso 2 (contenido)
        if (state.scheduledAt) {
          setScheduledAt(state.scheduledAt);
        }
      }
    }
  }, [location.state, clients]);

  const loadClients = async () => {
    try {
      const response = await authFetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        console.log('Clients data:', data); // Debug
        
        // Validar que data sea un array
        const clientsArray = Array.isArray(data) ? data : (data.clients || []);
        
        // Solo clientes con email válido
        const clientsWithEmail = clientsArray.filter((c: any) => c.email && c.email.includes('@'));
        setClients(clientsWithEmail);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const toggleClient = (client: Client) => {
    if (selectedClients.find(c => c.id === client.id)) {
      setSelectedClients(selectedClients.filter(c => c.id !== client.id));
    } else {
      setSelectedClients([...selectedClients, client]);
    }
  };

  const selectAll = () => {
    const filtered = getFilteredClients();
    setSelectedClients(filtered);
  };

  const deselectAll = () => {
    setSelectedClients([]);
  };

  const getFilteredClients = () => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];

    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`Archivo ${file.name} supera el límite de 10MB`);
        return;
      }
      newAttachments.push({
        file,
        preview: file.name
      });
    });

    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name || !subject || !bodyHtml || selectedClients.length === 0) {
      alert('Completa todos los campos obligatorios');
      return;
    }

    setLoading(true);

    try {
      // 1. Crear campaña
      const campaignData = {
        name,
        subject,
        body_html: bodyHtml,
        client_ids: selectedClients.map(c => c.id),
        scheduled_at: scheduledAt
      };

      const response = await authFetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error creando campaña');
      }

      const result = await response.json();
      const campaign = result.campaign; // Backend devuelve {campaign: {...}, message: '...'}

      // 2. Subir attachments si hay
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach(att => {
          formData.append('attachments', att.file);
        });

        const uploadResponse = await authFetch(`/api/campaigns/${campaign.id}/attachments`, {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          console.error('Error subiendo archivos adjuntos');
        }
      }

      // 3. Enviar campaña (preparar mailto)
      const sendResponse = await authFetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST'
      });

      if (!sendResponse.ok) {
        throw new Error('Error preparando envío');
      }

      const sendData = await sendResponse.json();

      // Construir mailto: link
      const bccEmails = sendData.recipients.join(',');
      const subject = encodeURIComponent(sendData.subject);
      const body = encodeURIComponent(sendData.body.replace(/<[^>]*>/g, '')); // Remover HTML tags
      
      const mailtoLink = `mailto:?bcc=${bccEmails}&subject=${subject}&body=${body}`;

      // Si hay adjuntos, mostrar alert con links
      if (sendData.attachments && sendData.attachments.length > 0) {
        const attachmentLinks = sendData.attachments
          .map(a => `${a.filename}: ${window.location.origin}${a.downloadUrl}`)
          .join('\\n');
        
        alert(`✅ Campaña preparada!

Se abrirá tu cliente de correo con ${sendData.recipients.length} destinatarios.

📎 ADJUNTOS (descarga y agrega manualmente):
${attachmentLinks}`);
      } else {
        alert(`✅ Campaña preparada! Se abrirá tu cliente de correo con ${sendData.recipients.length} destinatarios.`);
      }

      // Abrir mailto: en nueva ventana
      window.location.href = mailtoLink;

      // Esperar un momento antes de navegar
      setTimeout(() => {
        navigate('/campanas');
      }, 2000);

    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Error creando campaña');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-500" />
          Paso 1: Seleccionar Destinatarios
        </h2>
        <p className="text-gray-400">Elige los clientes que recibirán el email</p>
      </div>

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={selectAll}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors"
        >
          Seleccionar Todos
        </button>
        <button
          onClick={deselectAll}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors"
        >
          Deseleccionar
        </button>
      </div>

      <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
        <p className="text-indigo-300 font-medium">
          {selectedClients.length} cliente{selectedClients.length !== 1 ? 's' : ''} seleccionado{selectedClients.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loadingClients ? (
        <div className="text-center py-12 text-gray-400">Cargando clientes...</div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  <input
                    type="checkbox"
                    checked={selectedClients.length === getFilteredClients().length && getFilteredClients().length > 0}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {getFilteredClients().map(client => (
                <tr
                  key={client.id}
                  onClick={() => toggleClient(client)}
                  className="hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!selectedClients.find(c => c.id === client.id)}
                      onChange={() => {}}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-gray-300">{client.email}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{client.salesperson_name || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-500" />
          Paso 2: Contenido del Email
        </h2>
        <p className="text-gray-400">Escribe el mensaje que enviarás</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Nombre de la Campaña *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Promoción Navidad 2024"
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Asunto del Email *
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ej: ¡Ofertas especiales para ti!"
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Contenido del Mensaje *
        </label>
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="Escribe tu mensaje aquí... Puedes usar HTML o texto simple"
          rows={15}
          className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-indigo-500 focus:outline-none font-mono text-sm"
        />
        <p className="text-gray-500 text-xs mt-2">
          💡 Puedes escribir texto simple o HTML. Ejemplo: &lt;p&gt;Hola &lt;strong&gt;cliente&lt;/strong&gt;&lt;/p&gt;
        </p>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Paperclip className="w-6 h-6 text-indigo-500" />
          Paso 3: Archivos Adjuntos (Opcional)
        </h2>
        <p className="text-gray-400">Añade archivos PDF, imágenes u otros documentos (máx 10MB por archivo)</p>
      </div>

      <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-indigo-500 transition-colors">
        <Upload className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <p className="text-gray-300 mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
        <p className="text-gray-500 text-sm mb-4">Máximo 10MB por archivo</p>
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg cursor-pointer inline-flex items-center gap-2 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Seleccionar Archivos
        </label>
      </div>

      {attachments.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-medium mb-3">Archivos adjuntos ({attachments.length})</h3>
          <div className="space-y-2">
            {attachments.map((att, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-700 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <Paperclip className="w-4 h-4 text-gray-400" />
                  <span className="text-white">{att.preview}</span>
                  <span className="text-gray-400 text-sm">
                    ({(att.file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-500" />
          Paso 4: Revisión y Envío
        </h2>
        <p className="text-gray-400">Revisa todos los detalles antes de enviar</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
        <div>
          <p className="text-gray-400 text-sm">Nombre de la Campaña</p>
          <p className="text-white font-medium text-lg">{name}</p>
        </div>

        <div>
          <p className="text-gray-400 text-sm">Asunto</p>
          <p className="text-white font-medium">{subject}</p>
        </div>

        <div>
          <p className="text-gray-400 text-sm mb-2">Contenido HTML (Vista Previa)</p>
          <div
            className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        <div>
          <p className="text-gray-400 text-sm">Destinatarios</p>
          <p className="text-white font-medium text-lg">{selectedClients.length} clientes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedClients.slice(0, 10).map(client => (
              <span key={client.id} className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                {client.name}
              </span>
            ))}
            {selectedClients.length > 10 && (
              <span className="text-gray-400 text-sm">
                +{selectedClients.length - 10} más...
              </span>
            )}
          </div>
        </div>

        {attachments.length > 0 && (
          <div>
            <p className="text-gray-400 text-sm">Archivos Adjuntos</p>
            <p className="text-white font-medium">{attachments.length} archivo{attachments.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
        <p className="text-yellow-300 text-sm">
          ⚠️ Los emails se enviarán en lotes de 10 cada 30 segundos para respetar límites de Office365.
          El proceso puede tomar {Math.ceil(selectedClients.length / 10) * 30} segundos aproximadamente.
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => step === 1 ? navigate('/campanas') : setStep(step - 1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Volver a Campañas' : 'Paso Anterior'}
        </button>
        <h1 className="text-3xl font-bold text-white">Nueva Campaña de Email</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  num === step
                    ? 'bg-indigo-600 text-white scale-110'
                    : num < step
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {num < step ? <CheckCircle className="w-5 h-5" /> : num}
              </div>
              {num < 4 && (
                <div
                  className={`h-1 w-24 mx-2 transition-all ${
                    num < step ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-400">Destinatarios</span>
          <span className="text-xs text-gray-400">Contenido</span>
          <span className="text-xs text-gray-400">Adjuntos</span>
          <span className="text-xs text-gray-400">Enviar</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-gray-900 rounded-lg p-8 border border-gray-700">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step === 1}
          className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-colors ${
            step === 1
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Anterior
        </button>

        {step < 4 ? (
          <button
            onClick={() => {
              if (step === 1 && selectedClients.length === 0) {
                alert('Selecciona al menos un destinatario');
                return;
              }
              if (step === 2 && (!name || !subject || !bodyHtml)) {
                alert('Completa todos los campos obligatorios');
                return;
              }
              setStep(step + 1);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
          >
            Siguiente
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Enviar Campaña
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
