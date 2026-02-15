import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Mail, Users, Eye, MousePointer, XCircle, Clock, Send } from 'lucide-react';
import { authFetch } from '../utils/auth';

interface Recipient {
  id: string;
  client_name: string;
  client_email: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failure_reason: string | null;
}

interface TrackingEvent {
  id: string;
  recipient_id: string;
  event_type: string;
  link_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  client_name: string;
  client_email: string;
}

interface CampaignDetails {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  sender_name: string;
  sender_email: string;
  scheduled_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  recipients: Recipient[];
  attachments: any[];
  recent_events: TrackingEvent[];
}

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'recipients' | 'events'>('overview');

  useEffect(() => {
    loadCampaignDetails();
    const interval = setInterval(loadCampaignDetails, 10000); // Actualizar cada 10s
    return () => clearInterval(interval);
  }, [id]);

  const loadCampaignDetails = async () => {
    try {
      const response = await authFetch(`/api/campaigns/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCampaign(data);
      } else {
        console.error('Error cargando detalles');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      queued: { label: 'En Cola', color: 'bg-gray-600 text-gray-200' },
      sent: { label: 'Enviado', color: 'bg-blue-600 text-blue-100' },
      opened: { label: 'Abierto', color: 'bg-green-600 text-green-100' },
      clicked: { label: 'Click', color: 'bg-purple-600 text-purple-100' },
      failed: { label: 'Falló', color: 'bg-red-600 text-red-100' }
    };
    const badge = badges[status as keyof typeof badges] || badges.queued;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const calculateOpenRate = () => {
    if (!campaign || campaign.sent_count === 0) return 0;
    return Math.round((campaign.opened_count / campaign.sent_count) * 100);
  };

  const calculateClickRate = () => {
    if (!campaign || campaign.opened_count === 0) return 0;
    return Math.round((campaign.clicked_count / campaign.opened_count) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-400">Cargando detalles...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-400">Campaña no encontrada</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/campanas')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Campañas
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{campaign.name}</h1>
            <p className="text-gray-400">
              <span className="font-medium">Asunto:</span> {campaign.subject}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Creada por {campaign.sender_name} el {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <p className="text-gray-400 text-sm">Destinatarios</p>
          </div>
          <p className="text-3xl font-bold text-white">{campaign.total_recipients}</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Send className="w-5 h-5 text-green-400" />
            <p className="text-gray-400 text-sm">Enviados</p>
          </div>
          <p className="text-3xl font-bold text-green-400">{campaign.sent_count}</p>
          <p className="text-xs text-gray-500 mt-1">
            {campaign.total_recipients > 0
              ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
              : 0}%
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-5 h-5 text-blue-400" />
            <p className="text-gray-400 text-sm">Abiertos</p>
          </div>
          <p className="text-3xl font-bold text-blue-400">{campaign.opened_count}</p>
          <p className="text-xs text-gray-500 mt-1">{calculateOpenRate()}% de enviados</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <MousePointer className="w-5 h-5 text-purple-400" />
            <p className="text-gray-400 text-sm">Clicks</p>
          </div>
          <p className="text-3xl font-bold text-purple-400">{campaign.clicked_count}</p>
          <p className="text-xs text-gray-500 mt-1">{calculateClickRate()}% de abiertos</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-gray-400 text-sm">Fallidos</p>
          </div>
          <p className="text-3xl font-bold text-red-400">{campaign.failed_count}</p>
          <p className="text-xs text-gray-500 mt-1">
            {campaign.total_recipients > 0
              ? Math.round((campaign.failed_count / campaign.total_recipients) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-500" />
          Embudo de Engagement
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">Enviados</span>
              <span className="text-white font-medium">{campaign.sent_count}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-6">
              <div
                className="bg-gradient-to-r from-blue-600 to-blue-500 h-6 rounded-full flex items-center justify-end px-2"
                style={{ width: '100%' }}
              >
                <span className="text-xs text-white font-medium">100%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">Abiertos</span>
              <span className="text-white font-medium">{campaign.opened_count}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-6">
              <div
                className="bg-gradient-to-r from-green-600 to-green-500 h-6 rounded-full flex items-center justify-end px-2"
                style={{ width: `${calculateOpenRate()}%` }}
              >
                <span className="text-xs text-white font-medium">{calculateOpenRate()}%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">Clicks</span>
              <span className="text-white font-medium">{campaign.clicked_count}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-6">
              <div
                className="bg-gradient-to-r from-purple-600 to-purple-500 h-6 rounded-full flex items-center justify-end px-2"
                style={{
                  width: `${campaign.sent_count > 0 ? (campaign.clicked_count / campaign.sent_count) * 100 : 0}%`
                }}
              >
                <span className="text-xs text-white font-medium">
                  {campaign.sent_count > 0 ? Math.round((campaign.clicked_count / campaign.sent_count) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'overview', label: 'Resumen', icon: Mail },
          { key: 'recipients', label: 'Destinatarios', icon: Users },
          { key: 'events', label: 'Eventos', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Vista Previa del Contenido</h3>
          <div
            className="bg-white rounded-lg p-6 max-h-96 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: campaign.body_html }}
          />
        </div>
      )}

      {activeTab === 'recipients' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Enviado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Abierto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Click</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {campaign.recipients.map(recipient => (
                  <tr key={recipient.id} className="hover:bg-gray-700">
                    <td className="px-4 py-3 text-white">{recipient.client_name}</td>
                    <td className="px-4 py-3 text-gray-300">{recipient.client_email}</td>
                    <td className="px-4 py-3">{getStatusBadge(recipient.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {recipient.sent_at ? new Date(recipient.sent_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {recipient.opened_at ? new Date(recipient.opened_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {recipient.clicked_at ? new Date(recipient.clicked_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {campaign.recent_events.map(event => (
                  <tr key={event.id} className="hover:bg-gray-700">
                    <td className="px-4 py-3">
                      {event.event_type === 'open' ? (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <Eye className="w-4 h-4" />
                          Apertura
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-purple-400">
                          <MousePointer className="w-4 h-4" />
                          Click
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white">{event.client_name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-xs">
                      {event.link_url || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-xs">
                      {event.user_agent || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {campaign.recent_events.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No hay eventos de tracking todavía
            </div>
          )}
        </div>
      )}

      {/* Status Info */}
      {campaign.status === 'sending' && (
        <div className="mt-6 bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300">
            ⚡ Campaña enviándose en segundo plano. Esta página se actualiza automáticamente cada 10 segundos.
          </p>
        </div>
      )}
    </div>
  );
}
