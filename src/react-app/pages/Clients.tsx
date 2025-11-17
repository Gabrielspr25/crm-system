import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, Edit, Users, Building, Phone, Mail, MapPin, Hash, Clock, AlertTriangle, Calendar, Trash2, UserPlus } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";
import ClientModal from "../components/ClientModal";
import BANModal from "../components/BANModal";
import SubscriberModal from "../components/SubscriberModal";
import SalesHistoryTab from "../components/SalesHistoryTab";

interface Client {
  id: number;
  name: string;
  business_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  mobile_phone: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  includes_ban: number;
  vendor_id: number | null;
  vendor_name: string | null;
  ban_count: number;
  ban_numbers: string | null;
  has_bans: boolean;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Vendor {
  id: number;
  name: string;
  email: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface BAN {
  id: number;
  ban_number: string;
  client_id: number;
  description: string | null;
  status?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  subscribers?: Subscriber[];
}

interface Subscriber {
  id: number;
  phone: string;
  ban_id: number;
  contract_start_date: string | null;
  contract_end_date: string | null;
  service_type: string | null;
  monthly_value: number | null;
  months: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

type ClientStatus = 'overdue' | 'expired' | 'critical' | 'warning' | 'good' | 'no-date';

interface ClientItem {
  clientId: number;
  clientName: string;
  businessName: string | null;
  vendorId: number | null;
  vendorName: string | null;
  banId: number;
  banNumber: string;
  subscriberId: number;
  subscriberPhone: string;
  serviceType: string | null;
  monthlyValue: number | null;
  contractEndDate: string | null;
  subscriberCreatedAt: string | null;
  daysUntilExpiry: number;
  status: ClientStatus;
  isBeingFollowed: boolean;
  wasCompleted: boolean;
  followUpProspectId?: number;
  includesBan: boolean;
}

interface ClientRowSummary {
  clientId: number;
  clientName: string;
  businessName: string | null;
  vendorId: number | null;
  vendorName: string | null;
  totalBans: number;
  totalSubscribers: number;
  primaryBanNumber: string;
  primarySubscriberPhone: string;
  primaryContractEndDate: string | null;
  primarySubscriberCreatedAt: string | null;
  daysUntilExpiry: number;
  status: ClientStatus;
  isBeingFollowed: boolean;
  wasCompleted: boolean;
  followUpProspectId?: number;
  banNumbers: string[];
  subscriberPhones: string[];
  includesBan: boolean;
}

interface ClientDetail {
  id: number;
  name: string;
  business_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  mobile_phone: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  vendor_name: string | null;
  vendor_id: number | null;
  created_at: string;
  bans: BAN[];
}

interface FollowUpProspect {
  id: number;
  client_id: number | null;
  vendor_id: number | null;
  is_active?: boolean | number | null;
  is_completed?: boolean | number | null;
}

const computeSubscriberTiming = (contractEndDate: string | null) => {
  if (!contractEndDate) {
    return { status: 'overdue' as ClientStatus, days: -999 };
  }
  const endDate = new Date(contractEndDate);
  const today = new Date();
  const days = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let status: ClientStatus = 'good';
  if (days < 0) status = 'expired';
  else if (days <= 15) status = 'critical';
  else if (days <= 30) status = 'warning';

  return { status, days };
};

const formatDaysUntilExpiry = (days: number, status: ClientStatus, createdAt?: string | null) => {
  if (status === 'overdue') {
    return 'Vencido +30 dÃ­as';
  }
  if (status === 'no-date') {
    if (createdAt) {
      return `Cargado ${new Date(createdAt).toLocaleDateString()}`;
    }
    return 'Sin fecha definida';
  } else if (days < 0) {
    return `Vencido hace ${Math.abs(days)} dÃ­a${Math.abs(days) !== 1 ? 's' : ''}`;
  } else if (days === 0) {
    return 'Vence hoy';
  } else {
    return `Vence en ${days} dÃ­a${days !== 1 ? 's' : ''}`;
  }
};

const getStatusBadge = (status: ClientStatus, days: number, createdAt?: string | null) => {
  const label = formatDaysUntilExpiry(days, status, createdAt);

  switch (status) {
    case 'overdue':
    case 'expired':
      return { label, className: 'bg-red-900/60 text-red-100 border border-red-500/40' };
    case 'critical':
      return { label, className: 'bg-orange-900/60 text-orange-100 border border-orange-500/40' };
    case 'warning':
      return { label, className: 'bg-yellow-900/60 text-yellow-100 border border-yellow-500/40' };
    case 'no-date':
      return { label, className: 'bg-slate-800/70 text-slate-200 border border-slate-500/40' };
    case 'good':
    default:
      return { label, className: 'bg-green-900/60 text-green-100 border border-green-500/40' };
  }
};

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showClientModal, setShowClientModal] = useState(false);
  const [showBANModal, setShowBANModal] = useState(false);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [showClientDetailModal, setShowClientDetailModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedBanId, setSelectedBanId] = useState<number | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [clientBANs, setClientBANs] = useState<BAN[]>([]);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [showStopFollowModal, setShowStopFollowModal] = useState(false);
  const [selectedFollowUpProspect, setSelectedFollowUpProspect] = useState<{prospectId: number, clientName: string} | null>(null);
  const [stopFollowNotes, setStopFollowNotes] = useState('');
  
  const [clientItems, setClientItems] = useState<ClientItem[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'following' | 'completed'>('available');
const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
const [pendingBanClientId, setPendingBanClientId] = useState<number | null>(null);

  const { data: clients, loading: clientsLoading, refetch: refetchClients } = useApi<Client[]>("/api/clients");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: prospects, refetch: refetchProspects } = useApi<FollowUpProspect[]>("/api/follow-up-prospects");

  const notify = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
  };

const statusPriority: Record<ClientStatus, number> = {
  overdue: 0,
  expired: 1,
  critical: 2,
  warning: 3,
  good: 4,
  'no-date': 5,
  };

  const isBanRequirementSatisfied = (bans: BAN[]) =>
    bans.some((ban) => (ban.subscribers?.length ?? 0) > 0);

  const evaluateBanRequirement = (clientId: number, bans: BAN[]) => {
    if (pendingBanClientId === clientId && isBanRequirementSatisfied(bans)) {
      setPendingBanClientId(null);
      notify('success', 'BAN y suscriptor registrados. Puedes continuar con el cliente.');
    }
  };

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  const clientHasActiveFollowUp = useCallback((clientId: number) => {
    return (prospects || []).some(
      (p) => p.client_id === clientId && Boolean(p.is_active ?? true) && !Boolean(p.is_completed)
    );
  }, [prospects]);

  // Handle edit client event from detail modal
  useEffect(() => {
    const handleEditClient = async (event: any) => {
      const client = event.detail;
      setPendingBanClientId(null);
      setEditingClient(client);
      setSelectedClientId(client.id);
      await loadClientBANs(client.id);
      setShowClientModal(true);
    };

    const handleRefreshClients = () => {
      refetchClients();
    };

    window.addEventListener('editClient', handleEditClient);
    window.addEventListener('refreshClients', handleRefreshClients);
    return () => {
      window.removeEventListener('editClient', handleEditClient);
      window.removeEventListener('refreshClients', handleRefreshClients);
    };
  }, [refetchClients]);

  // Load all client data with their BANs and subscribers
  useEffect(() => {
    const loadClientData = async () => {
      if (!clients || clients.length === 0) {
        setClientItems([]);
        return;
      }
      
      try {
        const followUpProspects = (prospects || []) as FollowUpProspect[];
        
        const clientData: ClientItem[] = [];
        
        for (const client of clients) {
          // Check if this client is being followed
          const clientProspects = followUpProspects.filter((p) => p.client_id === client.id);
          const activeProspect = clientProspects.find((p) => Boolean(p.is_active ?? true) && !Boolean(p.is_completed));
          const completedProspectExists = !activeProspect && clientProspects.some((p) => Boolean(p.is_completed));

          const isBeingFollowed = Boolean(activeProspect);
          const wasCompleted = completedProspectExists;
          const followUpProspectId = activeProspect?.id;

          if (client.has_bans) {
            try {
              const bansResponse = await authFetch(`/api/bans?client_id=${client.id}`);
              if (bansResponse.ok) {
                const bans: BAN[] = await bansResponse.json();
                
                for (const ban of bans) {
                  try {
                    const subscribersResponse = await authFetch(`/api/subscribers?ban_id=${ban.id}`);
                    if (subscribersResponse.ok) {
                      const subscribers: Subscriber[] = await subscribersResponse.json();
                      
                      if (subscribers.length > 0) {
                        subscribers.forEach(subscriber => {
                        let daysUntilExpiry = 999999;
                        let status: ClientStatus = 'no-date';

                        if (subscriber.contract_end_date) {
                            const endDate = new Date(subscriber.contract_end_date);
                            const today = new Date();
                            daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            
                            if (daysUntilExpiry < 0) status = 'expired';
                            else if (daysUntilExpiry <= 15) status = 'critical';
                            else if (daysUntilExpiry <= 30) status = 'warning';
                            else status = 'good';
                        } else {
                          status = 'overdue';
                          daysUntilExpiry = -999;
                          }
                          
                          clientData.push({
                            clientId: client.id,
                            clientName: client.name,
                            businessName: client.business_name,
                            vendorId: client.vendor_id,
                            vendorName: client.vendor_name,
                            banId: ban.id,
                            banNumber: ban.ban_number,
                            subscriberId: subscriber.id,
                            subscriberPhone: subscriber.phone,
                            serviceType: subscriber.service_type,
                            monthlyValue: subscriber.monthly_value,
                            contractEndDate: subscriber.contract_end_date,
                            subscriberCreatedAt: subscriber.created_at,
                            daysUntilExpiry,
                            status,
                            isBeingFollowed,
                            wasCompleted,
                            followUpProspectId,
                            includesBan: true
                          });
                        });
                      } else {
                        // BAN without subscribers
                        clientData.push({
                          clientId: client.id,
                          clientName: client.name,
                          businessName: client.business_name,
                          vendorId: client.vendor_id,
                          vendorName: client.vendor_name,
                          banId: ban.id,
                          banNumber: ban.ban_number,
                          subscriberId: 0,
                          subscriberPhone: '-',
                          serviceType: null,
                          monthlyValue: null,
                          contractEndDate: null,
                          subscriberCreatedAt: null,
                          daysUntilExpiry: 999999,
                          status: 'no-date',
                          isBeingFollowed,
                          wasCompleted,
                          followUpProspectId,
                          includesBan: true
                        });
                      }
                    }
                  } catch (error) {
                    console.error(`Error loading subscribers for BAN ${ban.id}:`, error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error loading BANs for client ${client.id}:`, error);
            }
          } else {
            // Client without BANs
            clientData.push({
              clientId: client.id,
              clientName: client.name,
              businessName: client.business_name,
              vendorId: client.vendor_id,
              vendorName: client.vendor_name,
              banId: 0,
              banNumber: '-',
              subscriberId: 0,
              subscriberPhone: '-',
              serviceType: null,
              monthlyValue: null,
              contractEndDate: null,
              subscriberCreatedAt: null,
              daysUntilExpiry: 999999,
              status: 'no-date',
              isBeingFollowed,
              wasCompleted,
              followUpProspectId,
              includesBan: false
            });
          }
        }
        
        // Sort by days until expiry (ascending - most urgent first)
        clientData.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        setClientItems(clientData);
      } catch (error) {
        console.error('Error loading client data:', error);
        setClientItems([]);
      }
    };

    loadClientData();
  }, [clients, prospects]);

  const clientSummaries = useMemo<ClientRowSummary[]>(() => {
    const map = new Map<number, {
      base: ClientRowSummary;
      banIds: Set<number>;
      banNumbers: Set<string>;
      subscriberPhones: Set<string>;
      primary: {
        banNumber: string;
        subscriberPhone: string;
        contractEndDate: string | null;
        subscriberCreatedAt: string | null;
        status: ClientItem['status'];
        daysUntilExpiry: number;
      } | null;
    }>();

    clientItems.forEach(item => {
      let entry = map.get(item.clientId);
      if (!entry) {
        entry = {
          base: {
            clientId: item.clientId,
            clientName: item.clientName,
            businessName: item.businessName,
            vendorId: item.vendorId,
            vendorName: item.vendorName,
            totalBans: 0,
            totalSubscribers: 0,
            primaryBanNumber: '-',
            primarySubscriberPhone: '-',
            primaryContractEndDate: null,
            primarySubscriberCreatedAt: null,
            daysUntilExpiry: 999999,
            status: 'no-date',
            isBeingFollowed: item.isBeingFollowed,
            wasCompleted: item.wasCompleted,
            followUpProspectId: item.followUpProspectId,
            banNumbers: [],
            subscriberPhones: [],
            includesBan: item.includesBan,
          },
          banIds: new Set<number>(),
          banNumbers: new Set<string>(),
          subscriberPhones: new Set<string>(),
          primary: null,
        };
        map.set(item.clientId, entry);
      } else {
        entry.base.isBeingFollowed = entry.base.isBeingFollowed || item.isBeingFollowed;
        entry.base.wasCompleted = entry.base.wasCompleted || item.wasCompleted;
        if (!entry.base.followUpProspectId && item.followUpProspectId) {
          entry.base.followUpProspectId = item.followUpProspectId;
        }
        entry.base.includesBan = entry.base.includesBan || item.includesBan;
      }

      if (item.banId) {
        entry.banIds.add(item.banId);
        if (item.banNumber && item.banNumber !== '-') {
          entry.banNumbers.add(item.banNumber);
        }
      }

      if (item.subscriberId) {
        entry.base.totalSubscribers += 1;
        if (item.subscriberPhone && item.subscriberPhone !== '-') {
          entry.subscriberPhones.add(item.subscriberPhone);
        }
      }

      const candidate = {
        banNumber: item.banNumber,
        subscriberPhone: item.subscriberPhone,
        contractEndDate: item.contractEndDate,
        subscriberCreatedAt: item.subscriberCreatedAt,
        status: item.status,
        daysUntilExpiry: item.daysUntilExpiry,
      };

      if (
        !entry.primary ||
        statusPriority[candidate.status] < statusPriority[entry.primary.status] ||
        (
          statusPriority[candidate.status] === statusPriority[entry.primary.status] &&
          candidate.daysUntilExpiry < entry.primary.daysUntilExpiry
        )
      ) {
        entry.primary = candidate;
      }
    });

    return Array.from(map.values()).map(({ base, banIds, banNumbers, subscriberPhones, primary }) => {
      const totalBans = banIds.size;
      return {
        ...base,
        totalBans,
        primaryBanNumber: primary?.banNumber || (base.includesBan && totalBans > 0 ? Array.from(banNumbers)[0] : (base.includesBan ? '-' : 'N/A')),
        primarySubscriberPhone: primary?.subscriberPhone || (base.includesBan && subscriberPhones.size > 0 ? Array.from(subscriberPhones)[0] : (base.includesBan ? '-' : 'N/A')),
        primaryContractEndDate: primary?.contractEndDate || null,
        primarySubscriberCreatedAt: primary?.subscriberCreatedAt || null,
        daysUntilExpiry: primary?.daysUntilExpiry ?? 999999,
        status: primary?.status ?? 'no-date',
        banNumbers: Array.from(banNumbers),
        subscriberPhones: Array.from(subscriberPhones),
      };
    });
  }, [clientItems]);

  const filteredClients = clientSummaries.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.clientName.toLowerCase().includes(term) ||
      (item.businessName && item.businessName.toLowerCase().includes(term)) ||
      item.banNumbers.some(ban => ban.toLowerCase().includes(term)) ||
      item.subscriberPhones.some(phone => phone.includes(term))
    );
  });

  const availableClients = filteredClients.filter(item => !item.isBeingFollowed && !item.wasCompleted);
  const followingClients = filteredClients.filter(item => item.isBeingFollowed && !item.wasCompleted);
  const completedClients = filteredClients.filter(item => item.wasCompleted);
  const displayedClients = activeTab === 'available'
    ? availableClients
    : activeTab === 'following'
    ? followingClients
    : completedClients;

  const handleSendToFollowUp = async (clientId: number) => {
    try {
      const clientResponse = await authFetch(`/api/clients/${clientId}`);
      if (!clientResponse.ok) {
        throw new Error('No fue posible cargar el cliente.');
      }

      const client = await clientResponse.json();

      if (!client.vendor_id) {
        notify('error', 'Asigna un vendedor antes de enviar este cliente a seguimiento.');
        return;
      }

      if (clientHasActiveFollowUp(clientId)) {
        notify('info', 'Este cliente ya estÃ¡ en seguimiento activo.');
        return;
      }

      const prospectData = {
        company_name: client.business_name || client.name,
        client_id: clientId,
        vendor_id: client.vendor_id,
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        notes: 'Cliente enviado automÃ¡ticamente desde gestiÃ³n de clientes',
        fijo_ren: 0,
        fijo_new: 0,
        movil_nueva: 0,
        movil_renovacion: 0,
        claro_tv: 0,
        cloud: 0,
        mpls: 0
      };

      const response = await authFetch('/api/follow-up-prospects', {
        method: 'POST',
        json: prospectData
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'No fue posible enviar al seguimiento.');
      }

      notify('success', `Cliente ${client.business_name || client.name} enviado a seguimiento.`);
      await Promise.all([refetchProspects(), refetchClients()]);
    } catch (error) {
      console.error('Error sending client to follow-up:', error);
      notify('error', error instanceof Error ? error.message : 'No fue posible enviar el cliente a seguimiento.');
    }
  };

  const handleStopFollowing = (prospectId: number, clientName: string) => {
    setSelectedFollowUpProspect({ prospectId, clientName });
    setStopFollowNotes('');
    setShowStopFollowModal(true);
  };

  const handleConfirmStopFollowing = async () => {
    // This function is used in the modal
    if (!selectedFollowUpProspect) return;

    try {
      // Get the current prospect data
      const prospectResponse = await authFetch(`/api/follow-up-prospects`);
      if (!prospectResponse.ok) throw new Error('Error loading prospects');
      
      const prospects = await prospectResponse.json();
      const prospect = prospects.find((p: any) => p.id === selectedFollowUpProspect.prospectId);
      
      if (!prospect) {
        throw new Error('Prospecto no encontrado');
      }

      // Update prospect to mark it as inactive with notes
      const updateData = {
        ...prospect,
        is_active: 0,
        notes: prospect.notes ? `${prospect.notes}\n\n--- SEGUIMIENTO TERMINADO ---\n${stopFollowNotes}` : `--- SEGUIMIENTO TERMINADO ---\n${stopFollowNotes}`,
        updated_at: new Date().toISOString()
      };

      const response = await authFetch(`/api/follow-up-prospects/${selectedFollowUpProspect.prospectId}`, {
        method: 'PUT',
        json: updateData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error updating prospect');
      }

      if (prospect.client_id) {
        const clientRes = await authFetch(`/api/clients/${prospect.client_id}`);
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          await authFetch(`/api/clients/${prospect.client_id}`, {
            method: 'PUT',
            json: {
              name: clientData.name,
              business_name: clientData.business_name,
              contact_person: clientData.contact_person,
              email: clientData.email,
              phone: clientData.phone,
              address: clientData.address,
              includes_ban: clientData.includes_ban,
              vendor_id: null,
              is_active: clientData.is_active,
            }
          });
        }
      }

      notify('success', `Seguimiento terminado para ${selectedFollowUpProspect.clientName}.`);
      
      // Cerrar modal y recargar datos
      setShowStopFollowModal(false);
      setSelectedFollowUpProspect(null);
      setStopFollowNotes('');
      await Promise.all([refetchProspects(), refetchClients()]);
      
    } catch (error) {
      console.error('Error stopping follow-up:', error);
      notify('error', error instanceof Error ? error.message : 'No fue posible terminar el seguimiento.');
    }
  };

  const handleViewClientDetail = async (clientId: number) => {
    try {
      const clientResponse = await authFetch(`/api/clients/${clientId}`);
      if (!clientResponse.ok) throw new Error('Error loading client');
      
      const client = await clientResponse.json();
      
      // Load client's BANs with subscribers
      const bansResponse = await authFetch(`/api/bans?client_id=${clientId}`);
      let bans: BAN[] = [];
      
      if (bansResponse.ok) {
        const clientBans: BAN[] = await bansResponse.json();
        
        // Load subscribers for each BAN
        bans = await Promise.all(
          clientBans.map(async (ban) => {
            try {
              const subscribersResponse = await authFetch(`/api/subscribers?ban_id=${ban.id}`);
              if (subscribersResponse.ok) {
                const subscribers = await subscribersResponse.json();
                return { ...ban, subscribers };
              }
              return { ...ban, subscribers: [] };
            } catch (error) {
              console.error(`Error loading subscribers for BAN ${ban.id}:`, error);
              return { ...ban, subscribers: [] };
            }
          })
        );
      }
      
      setClientDetail({ ...client, bans });
      setShowClientDetailModal(true);
    } catch (error) {
      console.error('Error loading client detail:', error);
      notify('error', 'Error al cargar los detalles del cliente.');
    }
  };

  // FunciÃ³n para cargar BANs del cliente cuando se abre el modal de ediciÃ³n
  const loadClientBANs = async (clientId: number) => {
    try {
      const bansResponse = await authFetch(`/api/bans?client_id=${clientId}`);
      if (bansResponse.ok) {
        const fetchedBans: BAN[] = await bansResponse.json();
        
        // Cargar suscriptores para cada BAN
        const bansWithSubscribers = await Promise.all(
          fetchedBans.map(async (ban) => {
            try {
              const subscribersResponse = await authFetch(`/api/subscribers?ban_id=${ban.id}`);
              if (subscribersResponse.ok) {
                const subscribers = await subscribersResponse.json();
                return { ...ban, subscribers };
              }
              return { ...ban, subscribers: [] };
            } catch (error) {
              console.error(`Error loading subscribers for BAN ${ban.id}:`, error);
              return { ...ban, subscribers: [] };
            }
          })
        );
        
        setClientBANs(bansWithSubscribers);
        evaluateBanRequirement(clientId, bansWithSubscribers);
      }
    } catch (error) {
      console.error('Error loading client BANs:', error);
      setClientBANs([]);
    }
  };

  const handleCreateClient = async (data: any) => {
    try {
      const response = await authFetch("/api/clients", {
        method: "POST",
        json: data,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Error al crear el cliente");
      }

      await refetchClients();

      if (data.includes_ban) {
        notify('info', 'Cliente creado. Debes registrar al menos un BAN y un suscriptor.');
        setPendingBanClientId(responseData.id);
        setEditingClient(responseData as Client);
        setSelectedClientId(responseData.id);
        setClientBANs([]);
        setShowClientModal(true);
        setTimeout(() => setShowBANModal(true), 150);
      } else {
        setPendingBanClientId(null);
        setShowClientModal(false);
        setEditingClient(null);
        setSelectedClientId(null);
        setClientBANs([]);
        notify('success', `Cliente ${data.name} creado correctamente.`);
      }
    } catch (error) {
      console.error("Error creating client:", error);
      notify('error', error instanceof Error ? error.message : 'Error al crear el cliente.');
      throw (error instanceof Error ? error : new Error("Error al crear el cliente"));
    }
  };

  const handleUpdateClient = async (data: any) => {
    if (!editingClient) return;

    try {
      const response = await authFetch(`/api/clients/${editingClient.id}`, {
        method: "PUT",
        json: data,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar el cliente");
      }
      setPendingBanClientId(null);
      setShowClientModal(false);
      setEditingClient(null);
      setSelectedClientId(null);
      setClientBANs([]);
      refetchClients();
      notify('success', `Cliente ${data.name} actualizado correctamente.`);
    } catch (error) {
      console.error("Error updating client:", error);
      notify('error', error instanceof Error ? error.message : 'Error al actualizar el cliente.');
      throw (error instanceof Error ? error : new Error("Error al actualizar el cliente"));
    }
  };

  const handleCreateBAN = async (data: any) => {
    try {
      // Validar que tenemos un cliente seleccionado
      if (!selectedClientId) {
        notify('error', 'No hay cliente seleccionado para crear el BAN.');
        throw new Error("No client selected");
      }

      const response = await authFetch("/api/bans", {
        method: "POST",
        json: { ...data, client_id: selectedClientId },
      });

      const responseData = await response.json();

      if (!response.ok) {
        notify('error', responseData.error || 'No fue posible crear el BAN.');
        throw new Error(responseData.error || "Error al crear el BAN");
      }

      notify('success', `BAN ${data.ban_number} creado correctamente.`);
      setShowBANModal(false);
      
      // Recargar BANs del cliente si estamos editando
      if (selectedClientId) {
        const bansResponse = await authFetch(`/api/bans?client_id=${selectedClientId}`);
        if (bansResponse.ok) {
          const fetchedBans: BAN[] = await bansResponse.json();
          
          // Cargar suscriptores para cada BAN
          const bansWithSubscribers = await Promise.all(
            fetchedBans.map(async (ban) => {
              try {
                const subscribersResponse = await authFetch(`/api/subscribers?ban_id=${ban.id}`);
                if (subscribersResponse.ok) {
                  const subscribers = await subscribersResponse.json();
                  return { ...ban, subscribers };
                }
                return { ...ban, subscribers: [] };
              } catch (error) {
                console.error(`Error loading subscribers for BAN ${ban.id}:`, error);
                return { ...ban, subscribers: [] };
              }
            })
          );
          
          setClientBANs(bansWithSubscribers);
          evaluateBanRequirement(selectedClientId, bansWithSubscribers);
        }
      }
      if (pendingBanClientId === selectedClientId && response.ok) {
        setSelectedBanId(responseData.id);
        setEditingSubscriber(null);
        setTimeout(() => {
          setShowSubscriberModal(true);
          notify('info', 'BAN creado. Ahora registra al menos un suscriptor.');
        }, 150);
      }
      refetchClients();
    } catch (error) {
      console.error("Error creating BAN:", error);
      // Re-lanzar el error para que el modal sepa que hubo un fallo
      throw error;
    }
  };

  const handleSaveSubscriber = async (data: any) => {
    try {
      const isEditing = data.id !== undefined;
      const url = isEditing ? `/api/subscribers/${data.id}` : "/api/subscribers";
      const method = isEditing ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        json: data,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Error al ${isEditing ? 'actualizar' : 'crear'} el suscriptor`);
      }

      notify('success', `Suscriptor ${isEditing ? 'actualizado' : 'creado'} correctamente.`);
      setShowSubscriberModal(false);
      setSelectedBanId(null);
      setEditingSubscriber(null);
      
      if (selectedClientId) {
        await loadClientBANs(selectedClientId);
      }
      if (clientDetail) {
        await handleViewClientDetail(clientDetail.id);
      }
      await refetchClients();
    } catch (error) {
      console.error("Error creating/updating subscriber:", error);
      notify('error', error instanceof Error ? error.message : `Error al guardar el suscriptor`);
    }
  };

  const handleClientModalClose = () => {
    if (pendingBanClientId !== null) {
      notify('error', 'Debes registrar al menos un BAN y un suscriptor antes de cerrar el cliente.');
      return;
    }
    setPendingBanClientId(null);
    setShowClientModal(false);
    setEditingClient(null);
    setSelectedClientId(null);
    setClientBANs([]);
  };

  

  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Cargando clientes...</div>
      </div>
    );
  }

  // Calculate statistics
  const totalClients = clientItems.length;
  const expiredContracts = clientItems.filter(item => item.status === 'expired').length;
  const criticalContracts = clientItems.filter(item => item.status === 'critical').length;
  const warningContracts = clientItems.filter(item => item.status === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 mt-1">InformaciÃ³n completa de todos los clientes ordenados por vencimiento de contrato</p>
        </div>
        <button
          onClick={() => {
            setPendingBanClientId(null);
            setEditingClient(null);
            setSelectedClientId(null);
            setClientBANs([]);
            setShowClientModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg shadow-sm border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Total Registros</p>
              <p className="text-2xl font-bold text-white">{totalClients}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-sm border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Contratos Vencidos</p>
              <p className="text-2xl font-bold text-red-400">{expiredContracts}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-sm border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">PrÃ³ximos 15 dÃ­as</p>
              <p className="text-2xl font-bold text-orange-400">{criticalContracts}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-sm border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">PrÃ³ximos 30 dÃ­as</p>
              <p className="text-2xl font-bold text-yellow-400">{warningContracts}</p>
            </div>
            <Calendar className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {notification && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm transition-colors ${
            notification.type === 'success'
              ? 'border-green-500/60 bg-green-900/40 text-green-100'
              : notification.type === 'info'
              ? 'border-blue-500/60 bg-blue-900/40 text-blue-100'
              : 'border-red-500/60 bg-red-900/40 text-red-100'
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'available'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('available')}
        >
          Disponibles ({availableClients.length})
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'following'
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('following')}
        >
          En seguimiento ({followingClients.length})
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'completed'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('completed')}
        >
          Completados ({completedClients.length})
        </button>
      </div>

      {/* Clients Table */}
      <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vendedor Asignado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Num BAN</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Suscriptor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {displayedClients.map((item, index) => {
                const banDisplay = item.includesBan
                  ? `${item.primaryBanNumber}${item.totalBans > 1 ? ` (+${item.totalBans - 1})` : ''}`
                  : 'N/A';
                const subscriberDisplay = item.includesBan
                  ? `${item.primarySubscriberPhone}${item.totalSubscribers > 1 ? ` (+${item.totalSubscribers - 1})` : ''}`
                  : 'N/A';
                const contractDisplay = item.primaryContractEndDate
                  ? new Date(item.primaryContractEndDate).toLocaleDateString()
                  : item.primarySubscriberCreatedAt
                    ? new Date(item.primarySubscriberCreatedAt).toLocaleDateString()
                    : '-';

                return (
                  <tr key={`${item.clientId}-${index}`} className="hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewClientDetail(item.clientId)}
                        className="text-left hover:text-blue-400 transition-colors"
                      >
                        <div className="text-sm font-medium text-blue-300 hover:text-blue-200 cursor-pointer underline">
                          {item.businessName || item.clientName}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-left">
                      <span className="text-sm text-gray-300">
                        {item.vendorName || 'Sin asignar'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-300">{banDisplay}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-300">{subscriberDisplay}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-gray-300">{contractDisplay}</span>
                        <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                          item.status === 'expired' ? 'bg-red-900 text-red-200' :
                          item.status === 'critical' ? 'bg-orange-900 text-orange-200' :
                          item.status === 'warning' ? 'bg-yellow-900 text-yellow-200' :
                          item.status === 'good' ? 'bg-green-900 text-green-200' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {formatDaysUntilExpiry(item.daysUntilExpiry, item.status, item.primarySubscriberCreatedAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {item.wasCompleted ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-900/60 text-purple-200 text-xs font-medium">
                          âœ“ Completado
                        </span>
                      ) : item.isBeingFollowed ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-900/60 text-green-200 text-xs font-medium">
                            <UserPlus className="w-3 h-3" /> Siguiendo
                          </span>
                          <button
                            onClick={() => handleStopFollowing(item.followUpProspectId!, item.businessName || item.clientName)}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs transition-colors"
                            title="Devolver al pool de clientes"
                          >
                            Devolver
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSendToFollowUp(item.clientId)}
                          className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 mx-auto ${
                            item.vendorId
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          }`}
                          title={item.vendorId ? "Enviar a seguimiento" : "Asigna un vendedor antes de enviar"}
                          disabled={!item.vendorId}
                        >
                          <UserPlus className="w-3 h-3" />
                          {item.vendorId ? "A Seguimiento" : "Sin Vendedor"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayedClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-600" />
            <h3 className="mt-2 text-sm font-medium text-gray-300">No hay clientes</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm
                ? "No se encontraron clientes con ese criterio de bÃºsqueda"
                : activeTab === 'available'
                  ? "No hay clientes disponibles en el pool"
                  : activeTab === 'following'
                    ? "No hay clientes actualmente en seguimiento"
                    : "No hay clientes completados"}
            </p>
          </div>
        )}
      </div>

      {/* Client Modal */}
      {showClientModal && (
        <ClientModal
          client={editingClient}
          vendors={vendors || []}
          onSave={editingClient ? handleUpdateClient : handleCreateClient}
          onClose={handleClientModalClose}
          clientBANs={clientBANs}
          onCreateBAN={() => {
            // Asegurar que tenemos un cliente seleccionado
            const clientId = editingClient ? editingClient.id : selectedClientId;
            if (!clientId) {
              notify('error', 'No hay cliente seleccionado para crear el BAN.');
              return;
            }
            setSelectedClientId(clientId);
            setShowBANModal(true);
          }}
          onAddSubscriber={(banId: number) => {
            setSelectedBanId(banId);
            setEditingSubscriber(null); // Asegurar que no hay suscriptor siendo editado
            setShowSubscriberModal(true);
          }}
          banRequirementPending={pendingBanClientId !== null && ((editingClient?.id ?? null) === pendingBanClientId)}
        />
      )}

      {/* BAN Modal */}
      {showBANModal && (
        <BANModal
          onSave={handleCreateBAN}
          onClose={() => setShowBANModal(false)}
        />
      )}

      {/* Subscriber Modal */}
      {showSubscriberModal && selectedBanId && (
        <div style={{ zIndex: 9999 }}>
          <SubscriberModal
            banId={selectedBanId}
            subscriber={editingSubscriber}
            onSave={handleSaveSubscriber}
            onClose={() => {
              setShowSubscriberModal(false);
              setSelectedBanId(null);
              setEditingSubscriber(null);
            }}
          />
        </div>
      )}

      {/* Stop Following Modal */}
      {showStopFollowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16">
          <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Dejar de Seguir Cliente</h3>
              <p className="text-gray-400 mt-1">
                Â¿EstÃ¡s seguro de que quieres dejar de seguir a {selectedFollowUpProspect?.clientName}?
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motivo / Nota *
                </label>
                <textarea
                  value={stopFollowNotes}
                  onChange={(e) => setStopFollowNotes(e.target.value)}
                  className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  placeholder="Ej: Cliente no estÃ¡ interesado en renovar contrato, Cliente cambiÃ³ de proveedor, etc."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Esta nota se guardarÃ¡ en el historial del cliente
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowStopFollowModal(false);
                  setSelectedFollowUpProspect(null);
                  setStopFollowNotes('');
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStopFollowing}
                disabled={!stopFollowNotes.trim()}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
              >
                Dejar de Seguir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Management Modal */}
      {showClientDetailModal && clientDetail && (
        <ClientManagementModal
          client={clientDetail}
          onClose={() => {
            setShowClientDetailModal(false);
            setClientDetail(null);
          }}
          onEditSubscriber={(subscriber, banId) => {
            setEditingSubscriber(subscriber);
            setSelectedBanId(banId);
            setShowSubscriberModal(true);
          }}
          onAddSubscriber={(banId) => {
            setSelectedBanId(banId);
            setEditingSubscriber(null);
            setShowSubscriberModal(true);
          }}
          onRefreshClient={async () => {
            if (clientDetail) {
              await handleViewClientDetail(clientDetail.id);
            }
          }}
          onFollowUpUpdated={async () => {
            await Promise.all([refetchProspects(), refetchClients()]);
          }}
          clientHasActiveFollowUp={clientHasActiveFollowUp}
        />
      )}
    </div>
  );
}

// Client Management Modal Component
function ClientManagementModal({
  client,
  onClose,
  onEditSubscriber,
  onAddSubscriber,
  onRefreshClient,
  onFollowUpUpdated,
  clientHasActiveFollowUp
}: {
  client: ClientDetail;
  onClose: () => void;
  onEditSubscriber: (subscriber: Subscriber, banId: number) => void;
  onAddSubscriber?: (banId: number) => void;
  onRefreshClient?: () => Promise<void>;
  onFollowUpUpdated?: () => Promise<void> | void;
  clientHasActiveFollowUp: (clientId: number) => boolean;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'bans' | 'history' | 'calls'>('bans');
  const [showBANForm, setShowBANForm] = useState(false);
  const [editingBAN, setEditingBAN] = useState<BAN | null>(null);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSendingToFollowUp, setIsSendingToFollowUp] = useState(false);

  useEffect(() => {
    if (!formMessage) return;
    const timer = setTimeout(() => setFormMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [formMessage]);

  const handleEditSubscriber = (subscriber: Subscriber, banId: number) => {
     // Close this modal first to avoid z-index issues
     onClose();
     // Then trigger the edit
     setTimeout(() => {
       onEditSubscriber(subscriber, banId);
     }, 100);
  };

  const handleSendToFollowUpFromDetail = async () => {
    try {
      if (!client.vendor_id) {
        setFormMessage({ type: 'error', text: 'Asigna un vendedor antes de enviar este cliente a seguimiento.' });
        return;
      }

      if (clientHasActiveFollowUp(client.id)) {
        setFormMessage({ type: 'info', text: 'Este cliente ya estÃ¡ en seguimiento activo.' });
        return;
      }

      setIsSendingToFollowUp(true);

      const prospectData = {
        company_name: client.business_name || client.name,
        client_id: client.id,
        vendor_id: client.vendor_id,
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        notes: `Cliente enviado automÃ¡ticamente desde gestiÃ³n de clientes`,
        fijo_ren: 0,
        fijo_new: 0,
        movil_nueva: 0,
        movil_renovacion: 0,
        claro_tv: 0,
        cloud: 0,
        mpls: 0
      };

      const response = await authFetch('/api/follow-up-prospects', {
        method: 'POST',
        json: prospectData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible enviar a seguimiento.');
      }

      setFormMessage({ type: 'success', text: 'Cliente enviado a seguimiento.' });
      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
      if (onRefreshClient) {
        await onRefreshClient();
      }
    } catch (error) {
      console.error('Error sending client to follow-up:', error);
      setFormMessage({ type: 'error', text: error instanceof Error ? error.message : 'No fue posible enviar a seguimiento.' });
    } finally {
      setIsSendingToFollowUp(false);
    }
  };

  const handleUpdateBAN = async (banId: number, data: any) => {
    try {
      const response = await authFetch(`/api/bans/${banId}`, {
        method: "PUT",
        json: data,
      });

      if (!response.ok) {
        const error = await response.json();
        setFormMessage({ type: 'error', text: error.error || "Error al actualizar el BAN" });
        return;
      }

      setFormMessage({ type: 'success', text: `BAN ${data.ban_number} actualizado correctamente.` });
      setEditingBAN(null);
      
      if (onRefreshClient) {
        await onRefreshClient();
      }
      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
    } catch (error) {
      console.error("Error updating BAN:", error);
      setFormMessage({ type: 'error', text: 'Error al actualizar el BAN.' });
    }
  };

  const handleCreateBAN = async (data: any) => {
    try {
      const response = await authFetch("/api/bans", {
        method: "POST",
        json: { ...data, client_id: client.id },
      });

      const responseData = await response.json();

      if (!response.ok) {
        setFormMessage({ type: 'error', text: responseData.error || "Error desconocido al crear el BAN" });
        return;
      }

      setFormMessage({ type: 'success', text: `BAN ${data.ban_number} creado correctamente.` });
      setShowBANForm(false);
      
      if (onRefreshClient) {
        await onRefreshClient();
      }
      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
    } catch (error) {
      console.error("Error creating BAN:", error);
      setFormMessage({ type: 'error', text: 'Error al crear el BAN.' });
    }
  };

  const handleDeleteBAN = async (banId: number) => {
    try {
      const ban = client.bans.find(b => b.id === banId);
      if (!ban) {
        setFormMessage({ type: 'error', text: 'BAN no encontrado.' });
        return;
      }

      if (!confirm(`Â¿EstÃ¡s seguro de que quieres eliminar el BAN ${ban.ban_number}?\n\nEsta acciÃ³n eliminarÃ¡ permanentemente el BAN y todos sus suscriptores asociados.`)) {
        return;
      }

      const response = await authFetch(`/api/bans/${banId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de conexiÃ³n' }));
        setFormMessage({ type: 'error', text: errorData.error || 'Error al eliminar el BAN.' });
        return;
      }

      setFormMessage({ type: 'success', text: `BAN ${ban.ban_number} eliminado exitosamente.` });
      if (onRefreshClient) {
        await onRefreshClient();
      }
      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
    } catch (error) {
      console.error('Error deleting BAN:', error);
      setFormMessage({ type: 'error', text: 'No fue posible eliminar el BAN. Intenta nuevamente.' });
    }
  };

  const handleDeleteSubscriber = async (subscriberId: number, banId: number) => {
    try {
      const ban = client.bans.find(b => b.id === banId);
      if (!ban || !ban.subscribers) {
        setFormMessage({ type: 'error', text: 'BAN o suscriptor no encontrado.' });
        return;
      }

      const subscriber = ban.subscribers.find(s => s.id === subscriberId);
      if (!subscriber) {
        setFormMessage({ type: 'error', text: 'Suscriptor no encontrado.' });
        return;
      }

      if (ban.subscribers.length <= 1) {
        setFormMessage({ type: 'info', text: 'Un BAN debe tener al menos un suscriptor activo.' });
        return;
      }

      if (!confirm(`Â¿EstÃ¡s seguro de que quieres eliminar el suscriptor ${subscriber.phone}?\n\nEsta acciÃ³n no se puede deshacer.`)) {
        return;
      }

      const response = await authFetch(`/api/subscribers/${subscriberId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de conexiÃ³n' }));
        setFormMessage({ type: 'error', text: errorData.error || 'Error al eliminar el suscriptor.' });
        return;
      }

      setFormMessage({ type: 'success', text: `Suscriptor ${subscriber.phone} eliminado correctamente.` });
      if (onRefreshClient) {
        await onRefreshClient();
      }
    } catch (error) {
      console.error('Error deleting subscriber:', error);
      setFormMessage({ type: 'error', text: 'No fue posible eliminar el suscriptor. Intenta nuevamente.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">{client.business_name || client.name}</h2>
            <p className="text-gray-300 mt-1">GestiÃ³n completa del cliente</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSendToFollowUpFromDetail}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                client.vendor_id && !isSendingToFollowUp
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
              title={client.vendor_id ? "Enviar a seguimiento" : "Asignar vendedor primero"}
              disabled={!client.vendor_id || isSendingToFollowUp}
            >
              <UserPlus className="w-4 h-4" />
              {isSendingToFollowUp ? 'Enviando...' : client.vendor_id ? 'Enviar a Seguimiento' : 'Sin Vendedor'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Ã—
            </button>
          </div>
        </div>

        {/* Form Message */}
        {formMessage && (
          <div
            className={`p-4 text-sm border-b ${
              formMessage.type === 'success'
                ? 'bg-green-900/40 border-green-500/40 text-green-100'
                : formMessage.type === 'info'
                ? 'bg-blue-900/40 border-blue-500/40 text-blue-100'
                : 'bg-red-900/40 border-red-500/40 text-red-100'
            }`}
          >
            {formMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
                : 'text-gray-400 hover:text-white hover:bg-gray-750'
            }`}
          >
            InformaciÃ³n del Cliente
          </button>
          <button
            onClick={() => setActiveTab('bans')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'bans'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
                : 'text-gray-400 hover:text-white hover:bg-gray-750'
            }`}
          >
            BANs y Suscriptores ({client.bans.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
                : 'text-gray-400 hover:text-white hover:bg-gray-750'
            }`}
          >
            Historial
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'calls'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
                : 'text-gray-400 hover:text-white hover:bg-gray-750'
            }`}
          >
            Llamadas y Fechas
          </button>
        </div>

        {/* Content */}
        <div className="p-6 h-[60vh] overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">InformaciÃ³n del Cliente</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      // Close this modal and open edit modal
                      onClose();
                      setTimeout(() => {
                        const fullClient = {
                          id: client.id,
                          name: client.name,
                          business_name: client.business_name,
                          contact_person: client.contact_person,
                          email: client.email,
                          phone: client.phone,
                          secondary_phone: client.secondary_phone,
                          mobile_phone: client.mobile_phone,
                          address: client.address,
                          city: client.city,
                          zip_code: client.zip_code,
                          vendor_id: client.vendor_id,
                          includes_ban: client.bans.length > 0 ? 1 : 0,
                          is_active: 1,
                          created_at: client.created_at,
                          updated_at: client.created_at,
                          vendor_name: client.vendor_name,
                          ban_count: client.bans.length,
                          ban_numbers: null,
                          has_bans: client.bans.length > 0
                        };
                        // Use the existing edit functionality
                        window.dispatchEvent(new CustomEvent('editClient', { detail: fullClient }));
                      }, 100);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Editar Cliente
                  </button>
                  <button
                    onClick={async () => {
                      if (client.bans.length > 0) {
                        setFormMessage({ type: 'info', text: 'No se puede eliminar un cliente con BANs activos. Elimina los BANs primero.' });
                        return;
                      }
                      
                      if (confirm(`Â¿EstÃ¡s seguro de que quieres eliminar el cliente "${client.business_name || client.name}"?\n\nEsta acciÃ³n no se puede deshacer.`)) {
                        try {
                          const response = await authFetch(`/api/clients/${client.id}`, {
                            method: "DELETE"
                          });

                          if (!response.ok) {
                            const error = await response.json();
                            setFormMessage({ type: 'error', text: error.error || "Error al eliminar el cliente" });
                            return;
                          }

                          setFormMessage({ type: 'success', text: 'Cliente eliminado exitosamente.' });
                          if (onFollowUpUpdated) {
                            await onFollowUpUpdated();
                          }
                          if (onRefreshClient) {
                            await onRefreshClient();
                          }
                          onClose();
                        } catch (error) {
                          console.error("Error deleting client:", error);
                          setFormMessage({ type: 'error', text: 'Error al eliminar el cliente.' });
                        }
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Cliente
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                  <h4 className="text-lg font-medium text-white mb-4">Datos de Contacto</h4>
                  
                  {client.contact_person && (
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Persona de Contacto</p>
                        <p className="text-white font-medium">{client.contact_person}</p>
                      </div>
                    </div>
                  )}

                  {client.email && (
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Email</p>
                        <p className="text-white font-medium">{client.email}</p>
                      </div>
                    </div>
                  )}

                  {client.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">TelÃ©fono</p>
                        <p className="text-white font-medium">{client.phone}</p>
                      </div>
                    </div>
                  )}

                  {client.address && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">DirecciÃ³n</p>
                        <p className="text-white font-medium">{client.address}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                  <h4 className="text-lg font-medium text-white mb-4">InformaciÃ³n Comercial</h4>
                  
                  {client.business_name && (
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Empresa</p>
                        <p className="text-white font-medium">{client.business_name}</p>
                      </div>
                    </div>
                  )}

                  {client.vendor_name && (
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Vendedor Asignado</p>
                        <p className="text-white font-medium">{client.vendor_name}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-3">
                    <Hash className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-400">Total de BANs</p>
                      <p className="text-white font-medium">{client.bans.length}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-400">Total de Suscriptores</p>
                      <p className="text-white font-medium">
                        {client.bans.reduce((total, ban) => total + (ban.subscribers?.length || 0), 0)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-400">Cliente desde</p>
                      <p className="text-white font-medium">
                        {new Date(client.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bans' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-white">BANs y Suscriptores</h3>
                <button
                  onClick={() => setShowBANForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all duration-200 shadow-lg shadow-blue-500/25"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo BAN
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {client.bans.length > 0 ? (
                  client.bans.map((ban) => (
                    <div key={ban.id} className="bg-gray-800 rounded-lg p-3 border border-gray-600 shadow-sm">
                      {/* BAN Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded">
                            <Hash className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white">BAN: {ban.ban_number}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(ban.status === "cancelled" || ban.status === "cancelado") ? "bg-red-900/40 text-red-100 border border-red-500/30" : "bg-emerald-900/40 text-emerald-100 border border-emerald-500/30"}`}>
                              {(ban.status === "cancelled" || ban.status === "cancelado") ? "Cancelado" : "Activo"}
                            </span>
                            {ban.description && (
                              <p className="text-xs text-gray-400">{ban.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingBAN(ban)}
                            className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
                            title="Editar BAN"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteBAN(ban.id)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                            title="Eliminar BAN"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Subscribers Section */}
                      {ban.subscribers && ban.subscribers.length > 0 ? (
                        <div className="space-y-2">
                          <h5 className="text-xs font-medium text-gray-300 flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            Suscriptores ({ban.subscribers.length})
                          </h5>
                          <div className="space-y-1">
                            {ban.subscribers.map((subscriber) => (
                              <div key={subscriber.id} className="bg-gray-700 rounded p-2">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center space-x-3 text-xs flex-1">
                                    <div className="flex items-center space-x-1">
                                      <Phone className="w-3 h-3 text-gray-400" />
                                      <span className="text-white font-mono">{subscriber.phone}</span>
                                    </div>
                                    
                                    {subscriber.service_type && (
                                      <div className="flex items-center space-x-1">
                                        <Building className="w-3 h-3 text-gray-400" />
                                        <span className="text-gray-300">{subscriber.service_type}</span>
                                      </div>
                                    )}
                                    
                                    {subscriber.monthly_value && (
                                      <div className="text-green-400 font-semibold">${subscriber.monthly_value}/mes</div>
                                    )}
                                    
                                    {(() => {
                                      const { status, days } = computeSubscriberTiming(subscriber.contract_end_date);
                                      const badge = getStatusBadge(status, days, subscriber.created_at);
                                      return (
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className="text-gray-300">
                                            {subscriber.contract_end_date
                                              ? new Date(subscriber.contract_end_date).toLocaleDateString()
                                              : 'Sin fecha'}
                                          </span>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
                                            {badge.label}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => handleEditSubscriber(subscriber, ban.id)}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                                    >
                                      <Edit className="w-3 h-3" />
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubscriber(subscriber.id, ban.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              if (onAddSubscriber) {
                                onAddSubscriber(ban.id);
                              }
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Agregar Suscriptor
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-700/50 rounded p-3 text-center border border-dashed border-gray-600">
                          <Users className="mx-auto h-4 w-4 text-gray-500 mb-1" />
                          <p className="text-gray-400 text-xs mb-2">Este BAN no tiene suscriptores</p>
                          <button
                            onClick={() => {
                              if (onAddSubscriber) {
                                onAddSubscriber(ban.id);
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs transition-colors"
                          >
                            Agregar Suscriptor
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600">
                    <Hash className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                    <h3 className="text-base font-medium text-gray-300 mb-2">Este cliente no tiene BANs asignados</h3>
                    <p className="text-gray-500 text-sm mb-4">Crea el primer BAN para comenzar a gestionar suscriptores</p>
                    <button
                      onClick={() => setShowBANForm(true)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 shadow-lg shadow-blue-500/25"
                    >
                      Crear Primer BAN
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <SalesHistoryTab clientId={client.id} />
          )}

          {activeTab === 'calls' && (
            <div className="text-center py-12">
              <Phone className="mx-auto h-12 w-12 text-gray-600" />
              <h3 className="mt-2 text-lg font-medium text-gray-300">Llamadas y Fechas</h3>
              <p className="mt-1 text-sm text-gray-500">
                PrÃ³ximamente: Registro de llamadas, fechas importantes y seguimiento
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* BAN Edit Form */}
      {editingBAN && (
        <BANModal
          ban={editingBAN}
          onSave={async (data) => await handleUpdateBAN(editingBAN.id, data)}
          onClose={() => setEditingBAN(null)}
        />
      )}

      {/* BAN Creation Form */}
      {showBANForm && (
        <BANModal
          onSave={handleCreateBAN}
          onClose={() => setShowBANForm(false)}
        />
      )}

      
    </div>
  );
}


