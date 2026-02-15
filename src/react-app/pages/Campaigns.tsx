import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Plus, Send, Clock, CheckCircle, XCircle, Eye, Trash2, Users, Calendar } from 'lucide-react';
import { authFetch } from '../utils/auth';
import ClientSelectorModal from '../components/ClientSelectorModal';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  sender_name: string;
  scheduled_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showClientSelector, setShowClientSelector] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await authFetch('/api/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { label: 'Borrador', color: 'bg-gray-600 text-gray-200', icon: Clock },
      scheduled: { label: 'Programada', color: 'bg-blue-600 text-blue-100', icon: Calendar },
      sending: { label: 'Enviando...', color: 'bg-yellow-600 text-yellow-100', icon: Send },
      completed: { label: 'Completada', color: 'bg-green-600 text-green-100', icon: CheckCircle },
      failed: { label: 'Falló', color: 'bg-red-600 text-red-100', icon: XCircle }
    };

    const badge = badges[status as keyof typeof badges] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const calculateOpenRate = (campaign: Campaign) => {
    if (campaign.sent_count === 0) return 0;
    return Math.round((campaign.opened_count / campaign.sent_count) * 100);
  };

  const calculateClickRate = (campaign: Campaign) => {
    if (campaign.opened_count === 0) return 0;
    return Math.round((campaign.clicked_count / campaign.opened_count) * 100);
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta campaña? Esta acción no se puede deshacer.')) return;

    try {
      const response = await authFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setCampaigns(campaigns.filter(c => c.id !== id));
      } else {
        const error = await response.json();
        alert(error.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error eliminando campaña:', error);
    }
  };

  const handleClientSelection = (clientIds: string[], scheduledAt: string | null) => {
    // Navegar al wizard con los clientes pre-seleccionados
    navigate('/campanas/nueva', { 
      state: { 
        preSelectedClientIds: clientIds,
        scheduledAt: scheduledAt 
      } 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Cargando campañas...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Mail className="w-8 h-8 text-indigo-500" />
            Campañas de Email
          </h1>
          <p className="text-gray-400 mt-1">Gestiona tus comunicaciones masivas</p>
        </div>
        <button
          onClick={() => setShowClientSelector(true)}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Nueva Campaña
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-900/50 rounded-lg">
              <Mail className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Campañas</p>
              <p className="text-2xl font-bold text-white">{campaigns.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-900/50 rounded-lg">
              <Send className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Emails Enviados</p>
              <p className="text-2xl font-bold text-white">
                {campaigns.reduce((acc, c) => acc + c.sent_count, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900/50 rounded-lg">
              <Eye className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Aperturas</p>
              <p className="text-2xl font-bold text-white">
                {campaigns.reduce((acc, c) => acc + c.opened_count, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-900/50 rounded-lg">
              <Users className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Tasa Apertura Prom</p>
              <p className="text-2xl font-bold text-white">
                {campaigns.length > 0
                  ? Math.round(campaigns.reduce((acc, c) => acc + calculateOpenRate(c), 0) / campaigns.length)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'draft', label: 'Borradores' },
          { key: 'sending', label: 'Enviando' },
          { key: 'completed', label: 'Completadas' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border-2 border-dashed border-gray-700">
          <Mail className="mx-auto h-16 w-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            {filter === 'all' ? 'No hay campañas todavía' : `No hay campañas ${filter === 'draft' ? 'en borrador' : filter === 'sending' ? 'enviando' : 'completadas'}`}
          </h3>
          <p className="text-gray-500 mb-6">
            Crea tu primera campaña para enviar emails masivos a tus clientes
          </p>
          <button
            onClick={() => setShowClientSelector(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Crear Primera Campaña
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map(campaign => (
            <div key={campaign.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">{campaign.name}</h3>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <p className="text-gray-400 text-sm mb-1">
                    <span className="font-medium">Asunto:</span> {campaign.subject}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Creada por {campaign.sender_name} el {new Date(campaign.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/campanas/${campaign.id}`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                  {campaign.status === 'draft' && (
                    <button
                      onClick={() => handleDelete(campaign.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-700">
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Destinatarios</p>
                  <p className="text-white font-semibold">{campaign.total_recipients}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Enviados</p>
                  <p className="text-green-400 font-semibold">{campaign.sent_count}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Abiertos</p>
                  <p className="text-blue-400 font-semibold">
                    {campaign.opened_count}
                    <span className="text-xs text-gray-500 ml-1">
                      ({calculateOpenRate(campaign)}%)
                    </span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Clicks</p>
                  <p className="text-purple-400 font-semibold">
                    {campaign.clicked_count}
                    <span className="text-xs text-gray-500 ml-1">
                      ({calculateClickRate(campaign)}%)
                    </span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Fallidos</p>
                  <p className="text-red-400 font-semibold">{campaign.failed_count}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Client Selector Modal */}
      <ClientSelectorModal
        isOpen={showClientSelector}
        onClose={() => setShowClientSelector(false)}
        onSelect={handleClientSelection}
      />
    </div>
  );
}
