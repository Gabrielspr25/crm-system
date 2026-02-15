// VERSION: 2025-01-15-T16-FINAL-V5.1.37-PRODUCTION
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Edit, Users, Building, Phone, Mail, MapPin, Hash, Calendar, Trash2, UserPlus, Download, FileSpreadsheet, FileText, Check, X, Package, BarChart3, Sparkles, Send, Merge, Save, FileDown, ShoppingCart, ArrowRightLeft } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import { APP_VERSION, BUILD_LABEL } from "@/version";
import ClientModal from "../components/ClientModal";
import BANModal from "../components/BANModal";
import SubscriberModal from "../components/SubscriberModal";
import SalesHistoryTab from "../components/SalesHistoryTab";
import OfferGenerator from "../components/OfferGenerator";
import EmailModal from "../components/EmailModal";
import ComparativaModal from "../components/ComparativaModal";
import * as XLSX from 'xlsx';

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
  last_activity?: string | null;
  all_service_types?: string | null;
  primary_service_type?: string | null;
  has_cancelled_bans?: number;
  subscriber_count?: number;
  active_subscriber_count?: number;
  cancelled_subscriber_count?: number;
  active_ban_count?: number;
  cancelled_ban_count?: number;
  subscribers_in_opportunity?: number;
  base: string | null;
  subscriber_phones?: string | null;
  subscribers_detail?: { ban_number: string; phone: string; status?: string }[] | null;
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
  cancel_reason?: string | null;
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
  plan?: string | null;
  monthly_value: number | null;
  months: number | null;
  remaining_payments: number | null;
  status?: string;
  cancel_reason?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

type ClientStatus = 'overdue' | 'expired' | 'critical' | 'warning' | 'good' | 'no-date';

interface ClientItem {
  clientId: number;
  clientName: string | null;
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
  // Campos adicionales para exportación y visualización
  banNumbers?: string[];
  totalSubscribers?: number;
  primarySubscriberPhone?: string | null;
  primaryContractEndDate?: string | null;
  lastActivity?: string | null;
  hasCancelledBans?: boolean;
  banType?: string;
  email?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  mobile_phone?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  contactPerson?: string | null;
  base?: string | null;
  notes?: string | null;
}

interface ClientRowSummary {
  clientId: number;
  clientName: string | null;
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
  lastActivity?: string | null;
  banType?: string | null;
  followUpProspectId?: number;
  banNumbers: string[];
  subscriberPhones: string[];
  includesBan: boolean;
  hasCancelledBans?: boolean;
  isIncomplete?: boolean;
  // Nuevos campos
  email?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  mobile_phone?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  contactPerson?: string | null;
  base?: string | null;
  notes?: string | null;
  subscribersDetail?: { ban_number: string; phone: string; status?: string }[] | null;
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
  base: string | null;
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

  // Parsear manualmente YYYY-MM-DD para asegurar fecha local (evitar UTC offset)
  const parts = contractEndDate.split('-');
  let endDate: Date;

  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Meses 0-11
    const day = parseInt(parts[2], 10);
    endDate = new Date(year, month, day);
  } else {
    // Fallback por si el formato no es YYYY-MM-DD
    endDate = new Date(contractEndDate);
    endDate.setHours(0, 0, 0, 0);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalizar hoy a medianoche

  // Calcular diferencia en milisegundos y convertir a días
  const diffTime = endDate.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: ClientStatus = 'good';
  if (days < 0) status = 'expired';
  else if (days <= 15) status = 'critical';
  else if (days <= 30) status = 'warning';

  return { status, days };
};

const formatDaysUntilExpiry = (days: number, status: ClientStatus, createdAt?: string | null) => {
  if (status === 'overdue') {
    return 'Vencido +30 días';
  }
  if (status === 'no-date') {
    if (createdAt) {
      return `Cargado ${new Date(createdAt).toLocaleDateString()}`;
    }
    return 'Sin fecha definida';
  } else if (days < 0) {
    return `Vencido hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`;
  } else if (days === 0) {
    return 'Vence hoy';
  } else {
    return `Vence en ${days} día${days !== 1 ? 's' : ''}`;
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

// V3.5 FINAL FIX - 2025-01-15 - Tab configuration and version display
export default function Clients() {
  const UNIQUE_BUILD_ID = APP_VERSION;

  console.log("🚀🚀🚀 ============================================");
  console.log("🚀 Clients Tab Configuration Fix", UNIQUE_BUILD_ID);
  console.log("🚀 Build Label:", BUILD_LABEL);
  console.log("🚀 Unique Build ID:", UNIQUE_BUILD_ID);
  console.log("🚀 Runtime:", new Date().toISOString());
  console.log("🚀🚀🚀 ============================================");

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // Nuevo: filtro de mes
  const [selectedBanType, setSelectedBanType] = useState<string>(""); // Nuevo: filtro tipo de BAN
  const [expirationFilter, setExpirationFilter] = useState<string>(""); // Nuevo: filtro vencimiento
  const [sortOrder, setSortOrder] = useState<string>(""); // Nuevo: orden
  const [showClientModal, setShowClientModal] = useState(false);
  const [showBANModal, setShowBANModal] = useState(false);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [showClientDetailModal, setShowClientDetailModal] = useState(false);
  const [loadingClientDetail, setLoadingClientDetail] = useState(false);
  const [clientDetailInitialTab, setClientDetailInitialTab] = useState<'info' | 'bans' | 'history' | 'calls' | 'comparativas' | 'ventas'>('bans');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedBanId, setSelectedBanId] = useState<number | null>(null);
  const [editingBAN, setEditingBAN] = useState<BAN | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [clientBANs, setClientBANs] = useState<BAN[]>([]);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [showStopFollowModal, setShowStopFollowModal] = useState(false);
  const [selectedFollowUpProspect, setSelectedFollowUpProspect] = useState<{ prospectId: number, clientName: string } | null>(null);
  const [stopFollowNotes, setStopFollowNotes] = useState('');
  const [showOfferGenerator, setShowOfferGenerator] = useState(false);
  const [offerGeneratorClientName, setOfferGeneratorClientName] = useState('');

  const [clientItems, setClientItems] = useState<ClientItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'cancelled' | 'completed' | 'incomplete' | 'following'>('active');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pendingBanClientId, setPendingBanClientId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSearchTerm, setMergeSearchTerm] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<Client[]>([]);
  const [showMergeSearchResults, setShowMergeSearchResults] = useState(false);
  const [selectedTargetClient, setSelectedTargetClient] = useState<Client | null>(null);

  const { data: clientsResponse, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useApi<{ clients: Client[], stats: { active_count: number, cancelled_count: number, following_count: number, completed_count: number, incomplete_count: number } }>(`/api/clients?tab=${activeTab}`);
  const clients = clientsResponse?.clients || [];
  const clientStats = clientsResponse?.stats;

  // DEBUG: Log para verificar filtro de vendedor
  useEffect(() => {
    if (clientsResponse) {
      console.log(`🔍 [Clients] user=${currentUser?.username} role=${currentUser?.role} → ${clients.length} clientes recibidos (tab=${activeTab})`);
      console.log(`🔍 [Clients] stats=`, clientStats);
    }
  }, [clientsResponse]);
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: prospects, refetch: refetchProspects } = useApi<FollowUpProspect[]>("/api/follow-up-prospects?include_completed=true"); const notify = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
  };

  // Mostrar error si falla la carga
  useEffect(() => {
    if (clientsError) {
      notify('error', `Error cargando clientes: ${clientsError}`);
    }
  }, [clientsError]);

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
      (p) => p.client_id === clientId && p.completed_date == null
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
    window.addEventListener('clients-updated', handleRefreshClients);
    return () => {
      window.removeEventListener('editClient', handleEditClient);
      window.removeEventListener('refreshClients', handleRefreshClients);
      window.removeEventListener('clients-updated', handleRefreshClients);
    };
  }, [refetchClients]);

  // Load all client data with their BANs and subscribers
  useEffect(() => {
    // Evitar ejecutar si aún está cargando
    if (clientsLoading) {
      return;
    }

    const loadClientData = async () => {
      console.log('🔄 loadClientData iniciado. Clientes recibidos:', clients?.length || 0);
      if (!clients || clients.length === 0) {
        console.log('⚠️ No hay clientes, limpiando clientItems');
        setClientItems([]);
        return;
      }

      try {
        const followUpProspects = (prospects || []) as FollowUpProspect[];

        // PRIMERO: Crear clientItems básicos SIN cargar BANs/suscriptores (más rápido)
        const clientData: ClientItem[] = [];
        console.log(`📊 Creando ${clients.length} clientItems básicos (sin BANs/suscriptores)...`);

        for (const client of clients) {
          // Check if this client is being followed
          const clientProspects = followUpProspects.filter((p) => p.client_id === client.id);
          const activeProspect = clientProspects.find((p) => p.completed_date == null);
          const completedProspectExists = !activeProspect && clientProspects.some((p) => p.completed_date != null);

          const isBeingFollowed = Boolean(activeProspect);
          const wasCompleted = completedProspectExists;
          const followUpProspectId = activeProspect?.id;

          // Usar datos del backend directamente (ban_numbers ya viene en la consulta)
          const banNumbers = client.ban_numbers || null;
          // Extraer TODOS los BANs (separados por coma)
          const allBanNumbers = banNumbers ? banNumbers.split(',').map(b => b.trim()).filter(b => b) : [];
          const primaryBanNumber = allBanNumbers.length > 0 ? allBanNumbers[0] : '-';
          const subscriberCount = (client as any).subscriber_count || 0;
          const primarySubscriberPhone = (client as any).primary_subscriber_phone || null;
          const primaryContractEndDate = (client as any).primary_contract_end_date || null;
          const primarySubscriberCreatedAt = (client as any).primary_subscriber_created_at || null;

          // Calcular días hasta vencimiento
          let daysUntilExpiry = 999999;
          let status: ClientItem['status'] = 'no-date';
          if (primaryContractEndDate) {
            const endDate = new Date(primaryContractEndDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = endDate.getTime() - today.getTime();
            daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry <= 15) {
              status = 'critical';
            } else if (daysUntilExpiry <= 30) {
              status = 'warning';
            } else {
              status = 'good';
            }
          }

          // Determinar tipo de BAN
          let banType = 'Indefinido';
          if (client.primary_service_type) {
            banType = client.primary_service_type;
          } else if (client.all_service_types) {
            banType = client.all_service_types.split(',')[0];
          }

          clientData.push({
            clientId: client.id,
            clientName: client.name,
            businessName: client.business_name,
            vendorId: client.vendor_id,
            vendorName: client.vendor_name,
            banId: client.has_bans ? 1 : 0,
            banNumber: primaryBanNumber,
            subscriberId: subscriberCount > 0 ? 1 : 0,
            subscriberPhone: primarySubscriberPhone || '-',
            serviceType: null,
            monthlyValue: null,
            contractEndDate: primaryContractEndDate,
            subscriberCreatedAt: primarySubscriberCreatedAt,
            daysUntilExpiry,
            status,
            isBeingFollowed,
            wasCompleted,
            followUpProspectId,
            includesBan: client.has_bans || false,
            // Nuevos campos mapeados
            banNumbers: allBanNumbers,
            totalSubscribers: subscriberCount,
            primarySubscriberPhone: primarySubscriberPhone,
            primaryContractEndDate: primaryContractEndDate,
            lastActivity: client.last_activity,
            hasCancelledBans: Boolean(client.has_cancelled_bans) && Number(client.active_ban_count || 0) === 0,
            banType: banType,
            email: client.email,
            phone: client.phone,
            secondary_phone: client.secondary_phone,
            mobile_phone: client.cellular || client.mobile_phone,
            address: client.address,
            city: client.city,
            zipCode: client.zip_code,
            contactPerson: client.contact_person,
            base: client.base,
            notes: null,
            subscribersDetail: client.subscribers_detail
          });
        }

        // Sort by client name (null-safe para incompletos sin nombre)
        clientData.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
        console.log(`✅ Procesamiento básico completado. Total clientItems: ${clientData.length}`);
        setClientItems(clientData);

        // SEGUNDO: Cargar detalles de BANs/suscriptores en segundo plano (opcional, no bloquea la UI)
        // Esto se puede hacer de forma lazy cuando el usuario expande un cliente
      } catch (error) {
        console.error('❌ Error loading client data:', error);
        setClientItems([]);
      }
    };

    loadClientData();
  }, [clients, prospects, clientsLoading]);

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
            // Nuevos campos
            email: item.email,
            phone: item.phone,
            secondary_phone: item.secondary_phone,
            mobile_phone: item.mobile_phone,
            address: item.address,
            city: item.city,
            zipCode: item.zipCode,
            contactPerson: item.contactPerson,
            base: item.base,
            notes: item.notes,
            banType: item.banType,
            hasCancelledBans: item.hasCancelledBans,
            lastActivity: item.lastActivity
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
        // Merge details if needed, simpler to take one source
        if (!entry.base.subscribersDetail && item.subscribersDetail) {
          entry.base.subscribersDetail = item.subscribersDetail;
        }
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

    // Crear un mapa de clientId a lastActivity, banType, hasCancelledBans e isIncomplete desde clients
    const clientMetadata = new Map<number, { lastActivity: string | null; banType: string | null; hasCancelledBans: boolean; isIncomplete: boolean }>();
    if (clients) {
      console.log(`🔄 Procesando ${clients.length} clientes para detectar incompletos...`);
      clients.forEach(client => {
        const lastActivity = client.last_activity || client.updated_at || null;

        // Usar ban_descriptions primero (desde la tabla bans), si no está disponible usar all_service_types (desde subscribers)
        const banDescriptions = (client as any).ban_descriptions || null;
        const allServiceTypes = client.all_service_types || null;

        let banType = null;
        if (banDescriptions) {
          // Si hay descripciones de BAN, usarlas directamente
          banType = banDescriptions;
        } else if (allServiceTypes) {
          // Si no hay descripciones, inferir del tipo de servicio de suscriptores
          const types = allServiceTypes.toLowerCase();
          const hasMovil = types.includes('móvil') || types.includes('movil') || types.includes('mobile');
          const hasFijo = types.includes('fijo') || types.includes('fixed');
          if (hasMovil && hasFijo) {
            banType = 'Convergente';
          } else if (hasMovil) {
            banType = 'Móvil';
          } else if (hasFijo) {
            banType = 'Fijo';
          }
        }
        const hasCancelledBans = Boolean(client.has_cancelled_bans) && Number(client.active_ban_count || 0) === 0;

        // Incompleto: cliente activo sin nombre/empresa
        const hasName = Boolean(
          client.name !== null &&
          client.name !== undefined &&
          typeof client.name === 'string' &&
          client.name.trim() !== ''
        );
        const hasBusinessName = Boolean(
          client.business_name !== null &&
          client.business_name !== undefined &&
          typeof client.business_name === 'string' &&
          client.business_name.trim() !== ''
        );
        const hasNameOrBusiness = hasName || hasBusinessName;

        const isIncomplete = !hasCancelledBans && !hasNameOrBusiness;

        clientMetadata.set(client.id, { lastActivity, banType, hasCancelledBans, isIncomplete });
      });

      // Estadísticas de validación
      let stats = {
        total: clients.length,
        completos: 0,
        incompletos: 0,
        sinBAN: 0,
        sinSuscriptor: 0,
        sinNombreNiEmpresa: 0,
        conNombreBAN: 0,
        conEmpresaBAN: 0,
        muestrasIncompletos: [] as any[]
      };

      clients.forEach(client => {
        const hasName = Boolean(client.name && typeof client.name === 'string' && client.name.trim() !== '');
        const hasBusinessName = Boolean(client.business_name && typeof client.business_name === 'string' && client.business_name.trim() !== '');

        // Contar clientes con nombre/empresa auto-generados (empiezan con "BAN")
        if (hasName && client.name && (client.name.startsWith('Cliente BAN ') || client.name.startsWith('BAN '))) {
          stats.conNombreBAN++;
        }
        if (hasBusinessName && client.business_name && (client.business_name.startsWith('Empresa BAN ') || client.business_name.startsWith('BAN '))) {
          stats.conEmpresaBAN++;
        }

        const hasNameOrBusiness = hasName || hasBusinessName;
        const hasBAN = Boolean(client.has_bans || (client.ban_count && client.ban_count > 0));
        const hasSubscriber = Boolean((client.subscriber_count || 0) > 0);
        const isComplete = hasBAN && hasSubscriber && hasNameOrBusiness;

        if (isComplete) {
          stats.completos++;
        } else {
          stats.incompletos++;
          if (!hasBAN) stats.sinBAN++;
          if (!hasSubscriber) stats.sinSuscriptor++;
          if (!hasNameOrBusiness) stats.sinNombreNiEmpresa++;

          // Guardar muestra de incompletos (primeros 10)
          if (stats.muestrasIncompletos.length < 10) {
            stats.muestrasIncompletos.push({
              id: client.id,
              name: client.name || 'NULL',
              business_name: client.business_name || 'NULL',
              has_bans: client.has_bans,
              ban_count: client.ban_count,
              subscriber_count: client.subscriber_count,
              faltaBAN: !hasBAN,
              faltaSuscriptor: !hasSubscriber,
              faltaNombre: !hasNameOrBusiness
            });
          }
        }
      });

      console.log('📊 ===== ESTADÍSTICAS DE VALIDACIÓN =====');
      console.log('Total clientes:', stats.total);
      console.log('✅ Completos (tienen BAN + Suscriptor + Nombre/Empresa):', stats.completos);
      console.log('⚠️ Incompletos:', stats.incompletos);
      console.log('  - Sin BAN:', stats.sinBAN);
      console.log('  - Sin Suscriptor:', stats.sinSuscriptor);
      console.log('  - Sin Nombre ni Empresa:', stats.sinNombreNiEmpresa);
      console.log('');
      console.log('🏷️ CLIENTES CON NOMBRE/EMPRESA AUTO-GENERADOS (BAN):');
      console.log('  - Con nombre "Cliente BAN ..." o "BAN ...":', stats.conNombreBAN);
      console.log('  - Con empresa "Empresa BAN ..." o "BAN ...":', stats.conEmpresaBAN);
      console.log('  - Total con nombre/empresa BAN:', stats.conNombreBAN + stats.conEmpresaBAN);
      console.log('');
      console.log('📋 Muestra de incompletos (primeros 10):', stats.muestrasIncompletos);
      console.log('==========================================');
    }

    return Array.from(map.values()).map(({ base, subscriberPhones, primary }) => {
      // Usar datos del backend directamente (conteo real y preciso)
      // IMPORTANTE: Cada BAN pertenece a UN SOLO cliente (no se repiten)
      const clientFromBackend = clients?.find(c => c.id === base.clientId);
      const totalBans = clientFromBackend?.ban_count || 0;
      const totalSubscribers = clientFromBackend?.subscriber_count || base.totalSubscribers || 0;

      // Extraer TODOS los BANs desde el backend (ban_numbers tiene todos los BANs separados por coma)
      const allBanNumbers = clientFromBackend?.ban_numbers
        ? clientFromBackend.ban_numbers.split(',').map(b => b.trim()).filter(b => b)
        : [];

      const allSubscriberPhones = clientFromBackend?.subscriber_phones
        ? clientFromBackend.subscriber_phones.split(',').map(p => p.trim()).filter(p => p)
        : Array.from(subscriberPhones);

      const metadata = clientMetadata.get(base.clientId) || { lastActivity: null, banType: null, hasCancelledBans: false, isIncomplete: false };
      return {
        ...base,
        totalBans,
        totalSubscribers,
        primaryBanNumber: primary?.banNumber || (allBanNumbers.length > 0 ? allBanNumbers[0] : (base.includesBan ? '-' : 'N/A')),
        primarySubscriberPhone: primary?.subscriberPhone || (base.includesBan && subscriberPhones.size > 0 ? Array.from(subscriberPhones)[0] : (base.includesBan ? '-' : 'N/A')),
        primaryContractEndDate: primary?.contractEndDate || null,
        primarySubscriberCreatedAt: primary?.subscriberCreatedAt || null,
        daysUntilExpiry: primary?.daysUntilExpiry ?? 999999,
        status: primary?.status ?? 'no-date',
        banNumbers: allBanNumbers,
        subscriberPhones: allSubscriberPhones,
        lastActivity: metadata.lastActivity,
        banType: metadata.banType,
        hasCancelledBans: metadata.hasCancelledBans,
        isIncomplete: metadata.isIncomplete,
        subscribersDetail: clientFromBackend?.subscribers_detail || base.subscribersDetail || [],
      };
    });
  }, [clientItems, clients]);

  const filteredClients = clientSummaries.filter(item => {
    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        (item.clientName || '').toLowerCase().includes(term) ||
        (item.businessName && item.businessName.toLowerCase().includes(term)) ||
        (item.email && item.email.toLowerCase().includes(term)) ||
        (item.phone && item.phone.toLowerCase().includes(term)) ||
        (item.contactPerson && item.contactPerson.toLowerCase().includes(term)) ||
        (item.address && item.address.toLowerCase().includes(term)) ||
        (item.city && item.city.toLowerCase().includes(term)) ||
        item.banNumbers.some(ban => ban.toLowerCase().includes(term)) ||
        item.subscriberPhones.some(phone => phone.includes(term))
      );
      if (!matchesSearch) return false;
    }

    // Filtrar por mes
    if (selectedMonth) {
      const dateToCheck = item.primaryContractEndDate || item.primarySubscriberCreatedAt || item.lastActivity;
      if (!dateToCheck) return false;
      const itemMonth = new Date(dateToCheck).toISOString().slice(0, 7); // YYYY-MM
      if (itemMonth !== selectedMonth) return false;
    }

    // Filtrar por Tipo de BAN
    if (selectedBanType) {
      if (!item.banType || !item.banType.toLowerCase().includes(selectedBanType.toLowerCase())) {
        return false;
      }
    }

    // Filtrar por Vencimiento
    if (expirationFilter) {
      if (!item.primaryContractEndDate) return false;

      const today = new Date();
      const expiryDate = new Date(item.primaryContractEndDate);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const expiryMonth = expiryDate.getMonth();
      const expiryYear = expiryDate.getFullYear();

      if (expirationFilter === 'expired') {
        if (diffDays >= 0) return false;
      } else if (expirationFilter === 'this_month') {
        if (expiryMonth !== currentMonth || expiryYear !== currentYear) return false;
      } else if (expirationFilter === 'next_month') {
        const nextMonthDate = new Date(today);
        nextMonthDate.setMonth(currentMonth + 1);
        if (expiryMonth !== nextMonthDate.getMonth() || expiryYear !== nextMonthDate.getFullYear()) return false;
      } else if (expirationFilter === 'next_3_months') {
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(currentMonth + 3);
        if (expiryDate < today || expiryDate > threeMonthsLater) return false;
      }
    }

    return true;
  });

  const followingClients = filteredClients.filter(item => item.isBeingFollowed && !item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete);
  const completedClients = filteredClients.filter(item => item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete);
  const incompleteClients = filteredClients.filter(item => item.isIncomplete);
  const cancelledClients = filteredClients.filter(item => item.hasCancelledBans);

  // Contadores para tabs (usar stats del backend si están disponibles, sino calcular localmente)
  const activeClientsCount = clientStats?.active_count ?? clientSummaries.filter(item => !item.hasCancelledBans && !item.isIncomplete).length;
  const cancelledClientsCount = clientStats?.cancelled_count ?? clientSummaries.filter(item => item.hasCancelledBans).length;
  const followingClientsCount = clientStats?.following_count ?? clientSummaries.filter(item => item.isBeingFollowed && !item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete).length;
  const completedClientsCount = clientStats?.completed_count ?? clientSummaries.filter(item => item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete).length;
  const incompleteClientsCount = clientStats?.incomplete_count ?? clientSummaries.filter(item => item.isIncomplete).length;

  // Total de todos los clientes (para verificación)
  const totalAllClients = clientSummaries.length;

  // Debug: mostrar conteo y verificar lógica
  console.log('🔍 ===== ESTADÍSTICAS CLIENTES =====');
  console.log('📊 Total filteredClients:', filteredClients.length);
  console.log('📊 Total TODOS los clientes:', totalAllClients);
  console.log('📊 Activos:', activeClientsCount);
  console.log('📊 Cancelados:', cancelledClientsCount);
  console.log('📊 Seguimiento:', followingClientsCount);
  console.log('📊 Completadas:', completedClientsCount);
  console.log('📊 Incompletos:', incompleteClientsCount);
  console.log('🧮 Suma verificación:', activeClientsCount + cancelledClientsCount + incompleteClientsCount);
  console.log('🔍 ===== FIN ESTADÍSTICAS =====');

  // Al usar backend filtering, filteredClients ya contiene solo lo que queremos
  // Sin embargo, mantenemos la lógica de búsqueda sobre los resultados retornados
  const clientsForTab = [...filteredClients].sort((a, b) => {
    if (sortOrder === 'expiry_asc') {
      // Vencidos más antiguos primero (sin fecha al final)
      const dateA = a.primaryContractEndDate ? new Date(a.primaryContractEndDate).getTime() : Infinity;
      const dateB = b.primaryContractEndDate ? new Date(b.primaryContractEndDate).getTime() : Infinity;
      return dateA - dateB;
    }
    if (sortOrder === 'expiry_desc') {
      const dateA = a.primaryContractEndDate ? new Date(a.primaryContractEndDate).getTime() : -Infinity;
      const dateB = b.primaryContractEndDate ? new Date(b.primaryContractEndDate).getTime() : -Infinity;
      return dateB - dateA;
    }
    if (sortOrder === 'name_asc') return (a.clientName || '').localeCompare(b.clientName || '');
    if (sortOrder === 'name_desc') return (b.clientName || '').localeCompare(a.clientName || '');
    return 0; // sin orden adicional
  });

  // Paginación
  const totalPages = Math.ceil(clientsForTab.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedClients = clientsForTab.slice(startIndex, endIndex);

  // Reset página cuando cambien filtros o pestañas
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, selectedMonth]);

  const handleSendToFollowUp = async (clientId: number) => {
    console.log('🔵 handleSendToFollowUp EJECUTADO - clientId:', clientId);
    try {
      const clientResponse = await authFetch(`/api/clients/${clientId}`);
      if (!clientResponse.ok) {
        throw new Error('No fue posible cargar el cliente.');
      }

      const client = await clientResponse.json();
      console.log('🔵 Cliente cargado:', client.name);

      // Verificar si tiene seguimiento activo (no completado)
      if (clientHasActiveFollowUp(clientId)) {
        notify('info', 'Este cliente ya está en seguimiento activo.');
        return;
      }

      // SIMPLIFICADO: Crear prospect directamente sin complicaciones
      const prospectData = {
        company_name: client.business_name || client.name,
        client_id: clientId,
        vendor_id: client.vendor_id || null,
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        notes: 'Cliente enviado desde gestión de clientes',
        fijo_ren: 0,
        fijo_new: 0,
        movil_nueva: 0,
        movil_renovacion: 0,
        claro_tv: 0,
        cloud: 0,
        mpls: 0
      };

      console.log('📤 Enviando prospecto:', prospectData);
      const response = await authFetch('/api/follow-up-prospects', {
        method: 'POST',
        json: prospectData
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        console.error('❌ Error del servidor:', errorPayload);
        throw new Error(errorPayload?.error || 'No fue posible enviar el cliente a seguimiento.');
      }

      const clientName = client.business_name || client.name;
      console.log('✅ Cliente enviado a seguimiento exitosamente:', clientName);
      notify('success', `✅ Cliente "${clientName}" enviado a seguimiento exitosamente.`);

      await Promise.all([refetchProspects(), refetchClients()]);

      // Redirigir al módulo de Seguimiento
      console.log('🔄 Redirigiendo a módulo Seguimiento');
      navigate('/seguimiento');
    } catch (error) {
      console.error('Error sending client to follow-up:', error);
      notify('error', error instanceof Error ? error.message : 'No fue posible enviar el cliente a seguimiento.');
    }
  };

  const handleMergeSearch = async (term: string) => {
    setMergeSearchTerm(term);
    if (!term || term.trim().length < 2) {
      setMergeSearchResults([]);
      setShowMergeSearchResults(false);
      return;
    }

    try {
      const res = await authFetch(`/api/clients/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const results = await res.json();
        setMergeSearchResults(results.filter((c: Client) => c.id !== mergeSourceId));
        setShowMergeSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
    }
  };

  const handleSelectTargetClient = (client: Client) => {
    setSelectedTargetClient(client);
    setMergeTargetId(client.id);
    setMergeSearchTerm(client.business_name || client.name || '');
    setShowMergeSearchResults(false);
  };

  const handleMergeClients = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      notify('error', 'Selecciona ambos clientes para fusionar.');
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      notify('error', 'No puedes fusionar el mismo cliente.');
      return;
    }

    if (!window.confirm("¿Estás seguro de fusionar estos clientes? Esta acción NO se puede deshacer. El cliente 'Origen' será eliminado y sus datos pasarán al 'Destino'.")) {
      return;
    }

    setIsMerging(true);
    try {
      const res = await authFetch('/api/clients/merge', {
        method: 'POST',
        json: { sourceId: mergeSourceId, targetId: mergeTargetId }
      });

      if (res.ok) {
        notify('success', 'Clientes fusionados correctamente.');
        setShowMergeModal(false);
        setMergeSourceId(null);
        setMergeTargetId(null);
        setMergeSearchTerm('');
        setMergeSearchResults([]);
        setSelectedTargetClient(null);
        refetchClients();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Error al fusionar clientes.');
      }
    } catch (error) {
      console.error("Error merging clients:", error);
      notify('error', 'Error de conexión al fusionar.');
    } finally {
      setIsMerging(false);
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

  const handleViewClientDetail = async (clientId: number, initialTab: 'info' | 'bans' | 'history' | 'calls' | 'comparativas' | 'ventas' = 'bans') => {
    try {
      setLoadingClientDetail(true);
      setClientDetailInitialTab(initialTab); // Establecer la pestaña inicial
      setShowClientDetailModal(true); // Mostrar modal inmediatamente para mejor UX

      const clientResponse = await authFetch(`/api/clients/${clientId}`);
      if (!clientResponse.ok) {
        const errorData = await clientResponse.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error al cargar el cliente');
      }

      const client = await clientResponse.json();

      // Load client's BANs and Subscribers in parallel (Optimized)
      const [bansResponse, subscribersResponse] = await Promise.all([
        authFetch(`/api/bans?client_id=${clientId}`),
        authFetch(`/api/subscribers?client_id=${clientId}`)
      ]);

      let bans: BAN[] = [];
      let allSubscribers: any[] = [];

      if (subscribersResponse.ok) {
        allSubscribers = await subscribersResponse.json();
      }

      if (bansResponse.ok) {
        const clientBans: BAN[] = await bansResponse.json();

        // Map subscribers to their BANs in memory
        bans = clientBans.map(ban => ({
          ...ban,
          subscribers: allSubscribers.filter((s: any) => s.ban_id === ban.id)
        }));
      }

      setClientDetail({ ...client, bans });
      setLoadingClientDetail(false);
    } catch (error) {
      console.error('Error loading client detail:', error);
      setLoadingClientDetail(false);
      setShowClientDetailModal(false); // Cerrar modal si hay error
      notify('error', error instanceof Error ? error.message : 'Error al cargar los detalles del cliente.');
    }
  };

  // Función para cargar BANs del cliente cuando se abre el modal de edición
  const loadClientBANs = async (clientId: number) => {
    console.log('🚨🚨🚨 loadClientBANs INICIADO para cliente:', clientId);
    try {
      // Load client's BANs and Subscribers in parallel (Optimized)
      const [bansResponse, subscribersResponse] = await Promise.all([
        authFetch(`/api/bans?client_id=${clientId}`),
        authFetch(`/api/subscribers?client_id=${clientId}`)
      ]);

      if (bansResponse.ok) {
        const fetchedBans: BAN[] = await bansResponse.json();
        console.log('🔵 BANs recibidos del API:', fetchedBans);
        let allSubscribers: any[] = [];

        if (subscribersResponse.ok) {
          allSubscribers = await subscribersResponse.json();
        }

        // Map subscribers to their BANs in memory
        const bansWithSubscribers = fetchedBans.map(ban => ({
          ...ban,
          subscribers: allSubscribers.filter((s: any) => s.ban_id === ban.id)
        }));

        console.log('🟢 BANs con suscriptores mapeados:', bansWithSubscribers);
        console.log('🟢 Primer BAN account_type:', bansWithSubscribers[0]?.account_type);
        setClientBANs(bansWithSubscribers);
        evaluateBanRequirement(clientId, bansWithSubscribers);
      } else {
        console.error('❌ Error en bansResponse:', bansResponse.status);
      }
    } catch (error) {
      console.error('❌❌❌ Error loading client BANs:', error);
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

        // Alerta recordando agregar BAN
        setTimeout(() => {
          const agregarBan = window.confirm(
            `⚠️ El cliente "${data.name}" fue creado sin BAN.\n\nRecuerda agregar al menos un BAN para que aparezca correctamente en el sistema.\n\n¿Deseas agregar un BAN ahora?`
          );
          if (agregarBan) {
            setEditingClient(responseData as Client);
            setSelectedClientId(responseData.id);
            setClientBANs([]);
            setTimeout(() => setShowBANModal(true), 150);
          }
        }, 300);
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

      // Verificar si el cliente estaba incompleto y ahora está completo
      const wasIncomplete = editingClient.business_name?.startsWith('Empresa BAN ') ||
        editingClient.business_name?.startsWith('Cliente BAN ') ||
        !editingClient.business_name ||
        !editingClient.email ||
        (!editingClient.phone && !editingClient.mobile_phone && !editingClient.contact_person);

      const hasRealBusinessName = Boolean(data.business_name &&
        !data.business_name.startsWith('Empresa BAN ') &&
        !data.business_name.startsWith('Cliente BAN '));
      const hasEmail = Boolean(data.email);
      const hasContact = Boolean(data.phone || data.mobile_phone || data.contact_person);
      const isNowComplete = hasRealBusinessName && hasEmail && hasContact;

      setPendingBanClientId(null);
      // Modal permanece abierto después de guardar - actualizar datos del cliente editando
      const updatedResponse = await authFetch(`/api/clients/${editingClient.id}`);
      if (updatedResponse.ok) {
        const updatedClient = await updatedResponse.json();
        setEditingClient(updatedClient);
      }
      await refetchClients();

      notify('success', `Cliente ${data.business_name || data.name} actualizado correctamente.`);
    } catch (error) {
      console.error("Error updating client:", error);
      notify('error', error instanceof Error ? error.message : 'Error al actualizar el cliente.');
      throw (error instanceof Error ? error : new Error("Error al actualizar el cliente"));
    }
  };

  const handleCompleteClient = async (clientId: number) => {
    try {
      const clientResponse = await authFetch(`/api/clients/${clientId}`);
      if (!clientResponse.ok) {
        throw new Error('No fue posible cargar el cliente.');
      }

      const client = await clientResponse.json();
      setEditingClient(client as Client);
      setSelectedClientId(clientId);
      await loadClientBANs(clientId);
      setShowClientModal(true);
    } catch (error) {
      console.error('Error loading client for completion:', error);
      notify('error', error instanceof Error ? error.message : 'Error al cargar el cliente.');
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

      // El backend retorna 201 cuando se crea un BAN nuevo
      if (response.ok && response.status === 201) {
        console.log('✅ BAN creado exitosamente:', responseData);
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
            if (selectedClientId !== null && selectedClientId !== undefined) {
              evaluateBanRequirement(selectedClientId as number, bansWithSubscribers);
            }
          }
        }
        return;
      }

      // Manejar errores
      console.error('❌ Error del servidor:', response.status, responseData);
      let errorMessage = responseData.error || 'No fue posible crear el BAN.';

      if (response.status === 409) {
        // El backend ahora incluye información sobre qué cliente tiene el BAN
        const backendMessage = responseData.error || '';
        if (backendMessage.includes('ya existe y está asignado a este cliente')) {
          errorMessage = backendMessage;
        } else if (backendMessage.includes('ya existe y está asignado al cliente')) {
          errorMessage = backendMessage;
        } else {
          errorMessage = `El BAN ${data.ban_number} ya existe en el sistema. Por favor, verifica el número o edita el BAN existente.`;
        }
      } else if (response.status === 400) {
        errorMessage = responseData.error || "Datos inválidos. Verifica que el número BAN tenga 9 dígitos.";
      } else if (response.status === 404) {
        errorMessage = "Cliente no encontrado. Por favor, recarga la página e intenta nuevamente.";
      } else if (response.status === 401) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      }

      notify('error', errorMessage);
      throw new Error(errorMessage);

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
          if (selectedClientId !== null && selectedClientId !== undefined) {
            evaluateBanRequirement(selectedClientId as number, bansWithSubscribers);
          }
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

  const handleUpdateBAN = async (data: any) => {
    try {
      if (!editingBAN) return false;

      const response = await authFetch(`/api/bans/${editingBAN.id}`, {
        method: "PUT",
        json: { ...data, client_id: editingBAN.client_id },
      });

      if (!response.ok) {
        const error = await response.json();
        notify('error', error.error || "Error al actualizar el BAN");
        return false; // No cerrar el modal
      }

      notify('success', `BAN ${data.ban_number} actualizado correctamente.`);
      setEditingBAN(null);

      // Recargar BANs del cliente
      if (selectedClientId) {
        const bansResponse = await authFetch(`/api/bans?client_id=${selectedClientId}`);
        if (bansResponse.ok) {
          const fetchedBans: BAN[] = await bansResponse.json();

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
                return { ...ban, subscribers: [] };
              }
            })
          );

          setClientBANs(bansWithSubscribers);
        }
      }
      refetchClients();
      return true; // Éxito - permitir cerrar el modal
    } catch (error) {
      console.error("Error updating BAN:", error);
      notify('error', "Error al actualizar el BAN");
      return false; // No cerrar el modal
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




  // Loading check moved to end to prevent Hook Error #300


  // Calculate statistics - Usar datos del backend directamente para precisión
  const totalClients = clientItems.length;

  // Total BANs: Sumar ban_count del backend (conteo real por cliente)
  // PG devuelve counts como string cuando son BIGINT; forzamos a Number para evitar concatenaciones
  const toNum = (value: any) => Number(value || 0);

  const totalBans = clients ? clients.reduce((sum, client) => {
    return sum + toNum(client.ban_count);
  }, 0) : clientSummaries.reduce((sum, item) => sum + item.totalBans, 0);

  const activeBans = clients ? clients.reduce((sum, client) => sum + toNum(client.active_ban_count), 0) : 0;
  const cancelledBans = clients ? clients.reduce((sum, client) => sum + toNum(client.cancelled_ban_count), 0) : 0;

  // Total Suscriptores: Sumar subscriber_count del backend (conteo real por cliente)
  const totalSubscribers = clients ? clients.reduce((sum, client) => {
    return sum + toNum(client.subscriber_count);
  }, 0) : clientSummaries.reduce((sum, item) => sum + item.totalSubscribers, 0);

  const activeSubscribers = clients ? clients.reduce((sum, client) => sum + toNum(client.active_subscriber_count), 0) : 0;
  const cancelledSubscribers = clients ? clients.reduce((sum, client) => sum + toNum(client.cancelled_subscriber_count), 0) : 0;

  // Suscriptores en Oportunidad: Ya viene del backend
  const subscribersInOpportunity = clients ? clients.reduce((sum, client) => {
    return sum + (client.subscribers_in_opportunity || 0);
  }, 0) : 0;

  // DEBUG: Verificar conteo de BANs
  // IMPORTANTE: 1 BAN con 5 suscriptores = 1 BAN (no 5)
  // El backend ya cuenta BANs correctamente con COUNT(*) en la tabla bans
  console.log('📊 Estadísticas calculadas:', {
    totalClients,
    totalBans,
    totalSubscribers,
    subscribersInOpportunity,
    nota: '1 BAN con N suscriptores = 1 BAN (ban_count cuenta BANs, no suscriptores)'
  });

  const handleExport = (type: 'excel' | 'csv', scope: 'current' | 'all' = 'current') => {
    // FIX: Usar clientSummaries en lugar de clientItems para tener los campos calculados (isIncomplete, etc)
    const dataToProcess = scope === 'all' ? clientSummaries : clientsForTab;

    console.log(`📊 Exportando ${scope === 'all' ? 'TODO' : 'VISTA ACTUAL'} - Registros: ${dataToProcess.length}`);

    const dataToExport: any[] = [];

    dataToProcess.forEach(client => {
      // Si tiene detalles de suscriptores, generamos una fila por cada uno (EXPLOSIÓN)
      const details = client.subscribersDetail;
      if (details && details.length > 0) {
        details.forEach(sub => {
          dataToExport.push({
            'ID': client.clientId,
            'Nombre': client.contactPerson || client.clientName,
            'Empresa': client.businessName || client.clientName || 'Sin Nombre',
            'Tipo': client.banType || 'Indefinido',
            'Email': client.email || '',
            'Teléfono Principal': client.phone || '',
            'Dirección': client.address || '',
            'Ciudad': client.city || '',
            'Base': (client as any).base || 'BD propia',
            'Estado': sub.status || 'Activo', // Estado del suscriptor si existe, o general
            'Vendedor': client.vendorName || 'Sin asignar',
            'BAN': sub.ban_number, // BAN específico de este suscriptor
            'Suscriptor': sub.phone, // Teléfono de este suscriptor
            'Fecha Vencimiento': client.primaryContractEndDate ? new Date(client.primaryContractEndDate).toLocaleDateString() : '',
            'Notas': client.notes || ''
          });
        });
      } else {
        // Si no tiene suscriptores, generamos una fila única con la info general
        dataToExport.push({
          'ID': client.clientId,
          'Nombre': client.contactPerson || client.clientName,
          'Empresa': client.businessName || client.clientName || 'Sin Nombre',
          'Tipo': client.banType || 'Indefinido',
          'Email': client.email || '',
          'Teléfono Principal': client.phone || '',
          'Dirección': client.address || '',
          'Ciudad': client.city || '',
          'Base': (client as any).base || 'BD propia',
          'Estado': client.hasCancelledBans ? 'Cancelado' : 'Disponible',
          'Vendedor': client.vendorName || 'Sin asignar',
          'BAN': client.primaryBanNumber !== '-' ? client.primaryBanNumber : '',
          'Suscriptor': '',
          'Fecha Vencimiento': client.primaryContractEndDate ? new Date(client.primaryContractEndDate).toLocaleDateString() : '',
          'Notas': client.notes || ''
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");

    // Ajustar ancho de columnas
    const wscols = [
      { wch: 10 }, // ID
      { wch: 30 }, // Nombre
      { wch: 30 }, // Empresa
      { wch: 20 }, // Tipo
      { wch: 25 }, // Email
      { wch: 15 }, // Telefono Principal
      { wch: 15 }, // Movil Contacto
      { wch: 15 }, // Tel Secundario
      { wch: 30 }, // Direccion
      { wch: 15 }, // Ciudad
      { wch: 10 }, // CP
      { wch: 20 }, // Persona Contacto
      { wch: 15 }, // Base
      { wch: 10 }, // Estado
      { wch: 20 }, // Vendedor
      { wch: 15 }, // BAN
      { wch: 15 }, // Suscriptor
      { wch: 15 }, // Vencimiento
      { wch: 15 }, // Ultima Actividad
      { wch: 30 }  // Notas
    ];
    ws['!cols'] = wscols;

    const fileName = scope === 'all'
      ? `Clientes_TODOS_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'xlsx' : 'csv'}`
      : `Clientes_${activeTab}_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'xlsx' : 'csv'}`;

    if (type === 'excel') {
      XLSX.writeFile(wb, fileName);
    } else {
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
    }
    setShowExportMenu(false);
  };

  const handleExportForMailMerge = () => {
    console.log('📧 Exportando para Mail Merge (Correspondencia)');

    const dataToExport: any[] = [];
    
    // Función para validar formato de email
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    let validCount = 0;
    let invalidCount = 0;

    // Usar todos los clientes filtrados actualmente visibles
    clientsForTab.forEach(client => {
      const email = client.email?.trim() || '';
      const isValid = email !== '' && isValidEmail(email);
      
      if (isValid) validCount++;
      if (email !== '' && !isValid) invalidCount++;

      dataToExport.push({
        'Nombre': client.contactPerson || client.clientName || 'Sin Nombre',
        'Email': email || 'SIN EMAIL',
        'Email Válido': isValid ? 'SÍ' : 'NO',
        'Estado': client.hasCancelledBans ? 'Cancelado' : 'Activo'
      });
    });

    if (dataToExport.length === 0) {
      notify('error', 'No hay clientes en la vista actual');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Emails");

    // Ajustar ancho de columnas
    const wscols = [
      { wch: 40 }, // Nombre
      { wch: 35 }, // Email
      { wch: 14 }, // Email Válido
      { wch: 12 }  // Estado
    ];
    ws['!cols'] = wscols;

    const fileName = `Emails_Correspondencia_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    notify('success', `✅ ${validCount} válidos | ⚠️ ${invalidCount} inválidos | Total: ${dataToExport.length}`);
    setShowExportMenu(false);
  };

  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Clientes
            <span className="text-xs text-gray-500 ml-2 font-mono">
              {UNIQUE_BUILD_ID}
            </span>
          </h1>
          <p className="text-gray-400 mt-1">Información completa de todos los clientes ordenados por vencimiento de contrato</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setOfferGeneratorClientName('');
              setShowOfferGenerator(true);
            }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
          >
            <Sparkles className="w-5 h-5" />
            Generar Oferta IA
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700">
                  Vista Actual
                </div>
                <button
                  onClick={() => handleExport('excel', 'current')}
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport('csv', 'current')}
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  CSV
                </button>

                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-b border-gray-700 mt-1">
                  Base Completa
                </div>
                <button
                  onClick={() => handleExport('excel', 'all')}
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  Exportar TODO (Activos + Cancelados)
                </button>

                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-b border-gray-700 mt-1">
                  Mail Merge (Correspondencia)
                </div>
                <button
                  onClick={handleExportForMailMerge}
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <Mail className="w-4 h-4 text-indigo-500" />
                  Emails para Correspondencia
                </button>
              </div>
            )}
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
      </div>

      {/* Search and Filters */}
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

        <div className="w-full sm:w-auto min-w-[180px]">
          <select
            value={selectedBanType}
            onChange={(e) => setSelectedBanType(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          >
            <option value="">Todos los tipos</option>
            <option value="movil">Móvil</option>
            <option value="fijo">Fijo</option>
            <option value="convergente">Convergente</option>
          </select>
        </div>

        <div className="w-full sm:w-auto min-w-[180px]">
          <select
            value={expirationFilter}
            onChange={(e) => setExpirationFilter(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          >
            <option value="">Todos los vencimientos</option>
            <option value="expired">Vencidos</option>
            <option value="this_month">Vence este mes</option>
            <option value="next_month">Vence el próximo mes</option>
            <option value="next_3_months">Próximos 3 meses</option>
          </select>
        </div>

        <div className="w-full sm:w-auto min-w-[180px]">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          >
            <option value="">Orden por defecto</option>
            <option value="expiry_asc">Vencimiento: más antiguo</option>
            <option value="expiry_desc">Vencimiento: más reciente</option>
            <option value="name_asc">Nombre: A-Z</option>
            <option value="name_desc">Nombre: Z-A</option>
          </select>
        </div>

        <div className="w-full sm:w-auto min-w-[180px]">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          >
            <option value="">Todos los meses</option>
            <option value="2025-01">Enero 2025</option>
            <option value="2025-02">Febrero 2025</option>
            <option value="2025-03">Marzo 2025</option>
            <option value="2025-04">Abril 2025</option>
            <option value="2025-05">Mayo 2025</option>
            <option value="2025-06">Junio 2025</option>
            <option value="2025-07">Julio 2025</option>
            <option value="2025-08">Agosto 2025</option>
            <option value="2025-09">Septiembre 2025</option>
            <option value="2025-10">Octubre 2025</option>
            <option value="2025-11">Noviembre 2025</option>
            <option value="2025-12">Diciembre 2025</option>
            <option value="2024-01">Enero 2024</option>
            <option value="2024-02">Febrero 2024</option>
            <option value="2024-03">Marzo 2024</option>
            <option value="2024-04">Abril 2024</option>
            <option value="2024-05">Mayo 2024</option>
            <option value="2024-06">Junio 2024</option>
            <option value="2024-07">Julio 2024</option>
            <option value="2024-08">Agosto 2024</option>
            <option value="2024-09">Septiembre 2024</option>
            <option value="2024-10">Octubre 2024</option>
            <option value="2024-11">Noviembre 2024</option>
            <option value="2024-12">Diciembre 2024</option>
          </select>
        </div>
      </div>

      {notification && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm transition-colors ${notification.type === 'success'
            ? 'border-green-500/60 bg-green-900/40 text-green-100'
            : notification.type === 'info'
              ? 'border-blue-500/60 bg-blue-900/40 text-blue-100'
              : 'border-red-500/60 bg-red-900/40 text-red-100'
            }`}
        >
          {notification.text}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap border-b border-gray-700 pb-2">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'active'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          onClick={() => setActiveTab('active')}
        >
          Activos
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'active' ? 'bg-blue-700' : 'bg-gray-700'}`}>
            {activeClientsCount}
          </span>
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'cancelled'
            ? 'bg-red-600 text-white shadow-lg'
            : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelados
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'cancelled' ? 'bg-red-700' : 'bg-gray-700'}`}>
            {cancelledClientsCount}
          </span>
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'following'
            ? 'bg-green-600 text-white shadow-lg'
            : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          onClick={() => setActiveTab('following')}
          title="Clientes en seguimiento activo"
        >
          Seguimiento
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'following' ? 'bg-green-700' : 'bg-gray-700'}`}>
            {followingClientsCount}
          </span>
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'incomplete'
            ? 'bg-orange-600 text-white shadow-lg border-2 border-orange-400'
            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          onClick={() => setActiveTab('incomplete')}
        >
          Incompletos
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'incomplete' ? 'bg-orange-700' : 'bg-gray-700'}`}>
            {incompleteClientsCount}
          </span>
        </button>

        {/* Total para verificación */}
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-400">
          <span className="font-medium">Total:</span>
          <span className="px-3 py-1 rounded-full bg-gray-700 text-white font-bold">
            {totalAllClients}
          </span>
        </div>
      </div>

      {/* Paginación Superior */}
      {clientsForTab.length > 0 && (
        <div className="flex items-center justify-between mb-4 bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Mostrando {startIndex + 1} - {Math.min(endIndex, clientsForTab.length)} de {clientsForTab.length}
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
              <option value={200}>200 por página</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-400">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Celular</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Última Actividad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo BAN</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Base</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vendedor Asignado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Num BAN</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Suscriptor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {displayedClients.map((item, index) => {
                // Mostrar BANs en líneas separadas si hay más de uno
                const banDisplay = item.includesBan && item.banNumbers && item.banNumbers.length > 0
                  ? item.banNumbers
                  : null;
                const subscriberDisplay = item.includesBan
                  ? `${item.primarySubscriberPhone}${item.totalSubscribers > 1 ? ` (+${item.totalSubscribers - 1})` : ''}`
                  : 'N/A';
                const contractDisplay = item.primaryContractEndDate
                  ? new Date(item.primaryContractEndDate).toLocaleDateString()
                  : item.primarySubscriberCreatedAt
                    ? new Date(item.primarySubscriberCreatedAt).toLocaleDateString()
                    : '-';

                const lastActivityDisplay = item.lastActivity
                  ? new Date(item.lastActivity).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })
                  : '-';

                return (
                  <tr key={`${item.clientId}-${index}`} className="hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewClientDetail(item.clientId)}
                        className="text-left hover:text-blue-400 transition-colors"
                      >
                        <div className="text-sm font-medium text-blue-300 hover:text-blue-200 cursor-pointer underline">
                          {item.businessName || item.clientName || '(Sin Nombre)'}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-left">
                      <span className="text-sm text-gray-300 font-mono">
                        {item.mobile_phone || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-left">
                      <span className="text-sm text-gray-300">
                        {lastActivityDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-left">
                      <span className="text-sm text-gray-300">
                        {item.banType || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-left">
                      <span className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-200 border border-blue-500/30">
                        {(item as any).base || 'BD propia'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.hasCancelledBans
                        ? 'bg-red-900/40 text-red-100 border border-red-500/30'
                        : 'bg-emerald-900/40 text-emerald-100 border border-emerald-500/30'
                        }`}>
                        {item.hasCancelledBans ? 'Cancelado' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-left">
                      <span className="text-sm text-gray-300">
                        {item.vendorName || 'Sin asignar'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {banDisplay ? (
                        <div className="flex flex-col items-center gap-1">
                          {banDisplay.map((ban, idx) => (
                            <span key={idx} className="text-sm text-gray-300 font-mono">
                              {ban}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-300">{subscriberDisplay}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-gray-300">{contractDisplay}</span>
                        <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${item.status === 'expired' ? 'bg-red-900 text-red-200' :
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
                      {activeTab === 'incomplete' ? (
                        <button
                          onClick={() => handleCompleteClient(item.clientId)}
                          className="px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 mx-auto bg-green-600 hover:bg-green-700 text-white"
                          title="Completar información del cliente"
                        >
                          <Edit className="w-3 h-3" />
                          Completar
                        </button>
                      ) : activeTab === 'cancelled' ? (
                        <button
                          onClick={() => handleViewClientDetail(item.clientId, 'info')}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 mx-auto"
                          title="Editar datos del cliente"
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </button>
                      ) : isAdmin ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🟣 CLICK FUSIONAR - ID:', item.clientId);
                            setMergeSourceId(item.clientId);
                            setShowMergeModal(true);
                          }}
                          className="p-1 text-purple-400 hover:text-purple-300 transition-colors z-10 relative mx-auto flex items-center justify-center"
                          title="Fusionar Cliente"
                        >
                          <Merge size={16} />
                        </button>
                      ) : null}
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
                ? "No se encontraron clientes con ese criterio de búsqueda"
                : activeTab === 'unnamed'
                  ? "No hay clientes sin nombre"
                  : activeTab === 'active'
                    ? "No hay clientes activos disponibles"
                    : "No hay clientes cancelados"}
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
          onEditBAN={(ban) => {
            setEditingBAN(ban);
            setShowBANModal(true);
          }}
          onEditSubscriber={(subscriber, banId) => {
            setEditingSubscriber(subscriber);
            setSelectedBanId(banId);
            setShowSubscriberModal(true);
          }}
          banRequirementPending={pendingBanClientId !== null && ((editingClient?.id ?? null) === pendingBanClientId)}
        />
      )}

      {/* BAN Modal */}
      {showBANModal && (
        <BANModal
          ban={editingBAN ?? undefined}
          onSave={editingBAN ? handleUpdateBAN : handleCreateBAN}
          onClose={() => {
            setShowBANModal(false);
            setEditingBAN(null);
          }}
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
                ¿Estás seguro de que quieres dejar de seguir a {selectedFollowUpProspect?.clientName}?
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
                  placeholder="Ej: Cliente no está interesado en renovar contrato, Cliente cambió de proveedor, etc."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Esta nota se guardará en el historial del cliente
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
      {showClientDetailModal && (
        loadingClientDetail ? (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="text-white text-lg">Cargando detalles del cliente...</span>
              </div>
            </div>
          </div>
        ) : clientDetail ? (
          <ClientManagementModal
            client={clientDetail}
            onClose={() => {
              setShowClientDetailModal(false);
              setClientDetail(null);
              setLoadingClientDetail(false);
            }}
            onRefreshClient={async () => {
              // Refrescar lista completa de clientes primero
              await refetchClients();
              // Luego refrescar el detalle del cliente en el modal
              if (clientDetail) {
                await handleViewClientDetail(clientDetail.id);
                // Verificar si el cliente ahora tiene BANs cancelados y cambiar de pestaña
                const updatedClientResponse = await authFetch(`/api/clients/${clientDetail.id}`);
                if (updatedClientResponse.ok) {
                  const updatedClient = await updatedClientResponse.json();
                  if (updatedClient.has_cancelled_bans) {
                    setActiveTab('cancelled');
                  }
                }
              }
            }}
            onFollowUpUpdated={async () => {
              await refetchProspects();
              // Redirigir al módulo de Seguimiento
              navigate('/seguimiento');
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
            clientHasActiveFollowUp={clientHasActiveFollowUp}
            initialTab={clientDetailInitialTab}
          />
        ) : null
      )}

      {/* Offer Generator */}
      {showOfferGenerator && (
        <OfferGenerator
          clientName={offerGeneratorClientName || "Cliente Nuevo"}
          onClose={() => setShowOfferGenerator(false)}
        />
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 border border-purple-500 rounded-xl shadow-2xl w-full max-w-lg p-6 relative z-[10000]">
            <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
              <Merge size={24} />
              Fusionar Clientes
            </h2>
            <p className="text-gray-300 mb-4">
              Estás a punto de fusionar el cliente <span className="text-red-400 font-bold">Origen (Se eliminará)</span> con un cliente <span className="text-green-400 font-bold">Destino (Recibirá los datos)</span>.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Cliente Origen (ID: {mergeSourceId})</label>
              <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-red-200">
                {clients?.find(c => c.id === mergeSourceId)?.business_name || clients?.find(c => c.id === mergeSourceId)?.name || 'Desconocido'}
              </div>
            </div>

            <div className="mb-6 relative">
              <label className="block text-sm text-gray-400 mb-1">Buscar Cliente Destino</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email o BAN..."
                  value={mergeSearchTerm}
                  onChange={(e) => handleMergeSearch(e.target.value)}
                  onFocus={() => mergeSearchTerm.length >= 2 && setShowMergeSearchResults(true)}
                  className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                />
                {mergeSearchTerm && (
                  <button
                    onClick={() => {
                      setMergeSearchTerm('');
                      setMergeSearchResults([]);
                      setSelectedTargetClient(null);
                      setMergeTargetId(null);
                      setShowMergeSearchResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {showMergeSearchResults && mergeSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-50">
                  {mergeSearchResults.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectTargetClient(client)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-white">
                            {client.business_name || client.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            ID: {client.id} {client.email && `• ${client.email}`}
                          </div>
                          {client.ban_numbers && (
                            <div className="text-xs text-purple-400 mt-1">
                              BANs: {client.ban_numbers}
                            </div>
                          )}
                        </div>
                        {client.vendor_name && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-300 whitespace-nowrap">
                            {client.vendor_name}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showMergeSearchResults && mergeSearchResults.length === 0 && mergeSearchTerm.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-4 z-50">
                  <p className="text-gray-400 text-sm">No se encontraron clientes</p>
                </div>
              )}

              {selectedTargetClient && (
                <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-green-200">
                        ✓ Cliente destino seleccionado
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        {selectedTargetClient.business_name || selectedTargetClient.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        ID: {selectedTargetClient.id}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeSourceId(null);
                  setMergeTargetId(null);
                  setMergeSearchTerm('');
                  setMergeSearchResults([]);
                  setSelectedTargetClient(null);
                  setShowMergeSearchResults(false);
                }}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleMergeClients}
                disabled={!mergeTargetId || isMerging}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMerging ? 'Fusionando...' : 'Confirmar Fusión'}
              </button>
            </div>
          </div>
        </div>
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
  clientHasActiveFollowUp,
  initialTab = 'bans'
}: {
  client: ClientDetail;
  onClose: () => void;
  onEditSubscriber: (subscriber: Subscriber, banId: number) => void;
  onAddSubscriber?: (banId: number) => void;
  onRefreshClient?: () => Promise<void>;
  onFollowUpUpdated?: () => Promise<void> | void;
  clientHasActiveFollowUp: (clientId: number) => boolean;
  initialTab?: 'info' | 'bans' | 'history' | 'calls' | 'comparativas' | 'ventas';
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'bans' | 'history' | 'calls' | 'comparativas' | 'ventas'>(initialTab);
  const [showBANForm, setShowBANForm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showComparativaModal, setShowComparativaModal] = useState(false);
  const [editingBAN, setEditingBAN] = useState<BAN | null>(null);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSendingToFollowUp, setIsSendingToFollowUp] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [subscriberSubTabs, setSubscriberSubTabs] = useState<Record<string, 'activas' | 'canceladas'>>({});

  // === COMPARATIVAS STATE ===
  interface OfferRow {
    id: string;
    subId: string; // subscriber ID original (empty if extra row)
    ban: string;
    phone: string;
    plan: string;
    cost: string;
    notes: string;
  }

  // Editable copies of actual subscriber data (plan + cost + expiry)
  const [editingActual, setEditingActual] = useState<Record<string, { plan: string; cost: string; expiry: string }>>({});
  const [savingActualId, setSavingActualId] = useState<string | null>(null);
  const [savedActualId, setSavedActualId] = useState<string | null>(null);

  // Offer rows - initialized from client subs
  const [offerRows, setOfferRows] = useState<OfferRow[]>([]);
  const [offerInitialized, setOfferInitialized] = useState(false);
  const [comparativaTitle, setComparativaTitle] = useState('');
  const [savedComparativas, setSavedComparativas] = useState<{ id: string; title: string; created_at: string; data: any }[]>([]);

  // Initialize offer rows from client subscribers when tab opens
  useEffect(() => {
    if (activeTab === 'comparativas' && !offerInitialized && client.bans.length > 0) {
      const rows: OfferRow[] = client.bans.flatMap(ban =>
        (ban.subscribers || []).map(sub => ({
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
      setOfferInitialized(true);
    }
  }, [activeTab, offerInitialized, client.bans]);

  // Load saved comparativas
  useEffect(() => {
    if (activeTab === 'comparativas') {
      const key = `comparativas_${client.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try { setSavedComparativas(JSON.parse(saved)); } catch { setSavedComparativas([]); }
      }
    }
  }, [activeTab, client.id]);

  const getActualValue = (subId: string | number, field: 'plan' | 'cost' | 'expiry', original: any) => {
    const key = String(subId);
    if (editingActual[key]) return editingActual[key][field];
    if (field === 'plan') return (original as any).plan || '';
    if (field === 'expiry') return original.contract_end_date || '';
    return original.monthly_value != null ? String(Number(original.monthly_value).toFixed(2)) : '';
  };

  const setActualValue = (subId: string | number, field: 'plan' | 'cost' | 'expiry', value: string) => {
    const key = String(subId);
    setEditingActual(prev => {
      const sub = client.bans.flatMap(b => b.subscribers || []).find(s => String(s.id) === key);
      const current = prev[key] || {
        plan: (sub as any)?.plan || '',
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
        // Refresh client data
        if (onRefreshClient) await onRefreshClient();
        setEditingActual(prev => { const n = { ...prev }; delete n[subId]; return n; });
      } else {
        setFormMessage({ type: 'error', text: 'Error guardando suscriptor' });
      }
    } catch {
      setFormMessage({ type: 'error', text: 'Error de conexión' });
    }
    setSavingActualId(null);
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

  const handleSaveComparativa = () => {
    const title = comparativaTitle.trim() || `Comparativa ${new Date().toLocaleDateString()}`;
    const currentData = client.bans.flatMap(ban =>
      (ban.subscribers || []).map(s => ({
        ban: ban.ban_number,
        phone: s.phone,
        plan: getActualValue(s.id, 'plan', s),
        cost: getActualValue(s.id, 'cost', s),
        expiry: s.contract_end_date || '',
      }))
    );

    const newComparativa = {
      id: crypto.randomUUID(),
      title,
      created_at: new Date().toISOString(),
      data: {
        actual: currentData,
        oferta: offerRows.filter(r => r.ban || r.phone || r.plan || r.cost),
      }
    };

    const key = `comparativas_${client.id}`;
    const existing = [...savedComparativas, newComparativa];
    localStorage.setItem(key, JSON.stringify(existing));
    setSavedComparativas(existing);
    setComparativaTitle('');
    setFormMessage({ type: 'success', text: `Comparativa "${title}" guardada correctamente.` });
    setTimeout(() => setFormMessage(null), 3000);
  };

  const deleteComparativa = (id: string) => {
    const key = `comparativas_${client.id}`;
    const updated = savedComparativas.filter(c => c.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    setSavedComparativas(updated);
  };
  // === END COMPARATIVAS STATE ===
  const [vendorsList, setVendorsList] = useState<{id: string; name: string; role: string}[]>([]);
  const [editClientData, setEditClientData] = useState({
    name: client.name || '',
    business_name: client.business_name || '',
    contact_person: client.contact_person || '',
    email: client.email || '',
    phone: client.phone || '',
    secondary_phone: (client as any).secondary_phone || '',
    mobile_phone: (client as any).mobile_phone || '',
    address: client.address || '',
    city: (client as any).city || '',
    zip_code: (client as any).zip_code || '',
    tax_id: (client as any).tax_id || '',
    owner_name: (client as any).owner_name || '',
    cellular: (client as any).cellular || '',
    additional_phone: (client as any).additional_phone || '',
    salesperson_id: (client as any).salesperson_id || '',
  });

  // Cargar lista de vendedores para el dropdown
  useEffect(() => {
    const loadVendors = async () => {
      try {
        const res = await authFetch('/api/vendors');
        if (res.ok) {
          const data = await res.json();
          setVendorsList(data);
        }
      } catch (e) {
        console.error('Error loading vendors:', e);
      }
    };
    loadVendors();
  }, []);

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
    console.log('🟢 handleSendToFollowUpFromDetail EJECUTADO - client:', client?.name);
    try {
      if (clientHasActiveFollowUp(client.id)) {
        setFormMessage({ type: 'info', text: 'Este cliente ya está en seguimiento activo.' });
        return;
      }

      console.log('🟢 Enviando a seguimiento...');
      setIsSendingToFollowUp(true);

      // SIMPLIFICADO: Igual para todos
      const prospectData = {
        company_name: client.business_name || client.name,
        client_id: client.id,
        vendor_id: client.vendor_id || null,
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        notes: 'Cliente enviado desde gestión de clientes',
        fijo_ren: 0,
        fijo_new: 0,
        movil_nueva: 0,
        movil_renovacion: 0,
        claro_tv: 0,
        cloud: 0,
        mpls: 0
      };

      console.log('📤 [MODAL] Enviando prospecto:', prospectData);
      const response = await authFetch('/api/follow-up-prospects', {
        method: 'POST',
        json: prospectData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        console.error('❌ [MODAL] Error del servidor:', error);
        throw new Error(error?.error || 'No fue posible enviar a seguimiento.');
      }

      const clientName = client.business_name || client.name;
      console.log('✅ [MODAL] Cliente enviado a seguimiento exitosamente:', clientName);
      setFormMessage({ type: 'success', text: `✅ Cliente "${clientName}" enviado a seguimiento.` });

      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
      if (onRefreshClient) {
        await onRefreshClient();
      }

      // Cerrar el modal y mostrar mensaje después de un momento
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error sending client to follow-up:', error);
      setFormMessage({ type: 'error', text: error instanceof Error ? error.message : 'No fue posible enviar a seguimiento.' });
    } finally {
      setIsSendingToFollowUp(false);
    }
  };

  const handleSaveClientEdit = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('🟢 Guardando cambios cliente...', editClientData);
    try {
      const response = await authFetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        json: editClientData
      });

      if (!response.ok) {
        const error = await response.json();
        setFormMessage({ type: 'error', text: error.error || 'Error al actualizar el cliente' });
        return;
      }

      setFormMessage({ type: 'success', text: 'Cliente actualizado correctamente.' });
      setIsEditingClient(false);

      // Refrescar datos del cliente
      if (onRefreshClient) {
        await onRefreshClient();
      }
      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
    } catch (error) {
      console.error('Error updating client:', error);
      setFormMessage({ type: 'error', text: 'Error al actualizar el cliente.' });
    }
  };

  const handleUpdateBAN = async (banId: number, data: any) => {
    try {
      // Asegurar que se incluye el client_id del BAN que se está editando
      const updateData = {
        ...data,
        client_id: editingBAN?.client_id || client.id
      };

      console.log('🔄 Actualizando BAN:', banId, 'con datos:', updateData);
      const response = await authFetch(`/api/bans/${banId}`, {
        method: "PUT",
        json: updateData,
      });

      if (!response.ok) {
        const error = await response.json();
        setFormMessage({ type: 'error', text: error.error || "Error al actualizar el BAN" });
        throw new Error(error.error || "Error al actualizar el BAN");
      }

      setFormMessage({ type: 'success', text: `BAN ${data.ban_number} actualizado correctamente.` });
      setEditingBAN(null);

      // Recargar cliente
      if (onRefreshClient) {
        await onRefreshClient();
      }
    } catch (error) {
      console.error("Error updating BAN:", error);
      throw error;
    }
  };

  const handleCreateBAN = async (data: any) => {
    try {
      console.log('🔄 Creando BAN para cliente:', client.id, 'Datos:', data);

      if (!client || !client.id) {
        setFormMessage({ type: 'error', text: 'Error: No se pudo identificar el cliente.' });
        console.error('❌ Cliente no disponible:', client);
        return false;
      }

      const response = await authFetch("/api/bans", {
        method: "POST",
        json: { ...data, client_id: client.id },
      });

      // Intentar parsear la respuesta como JSON, pero manejar errores
      let responseData: any = {};
      try {
        const text = await response.text();
        if (text) {
          responseData = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('Error parseando respuesta:', parseError);
        responseData = { error: 'Error al procesar la respuesta del servidor' };
      }

      // El backend retorna 201 cuando se crea un BAN nuevo
      if (response.ok && response.status === 201) {
        console.log('✅ BAN creado exitosamente:', responseData);
        setFormMessage({ type: 'success', text: `BAN ${data.ban_number} creado correctamente.` });

        // Retornar true INMEDIATAMENTE para que el modal se cierre
        // El modal se cerrará automáticamente cuando reciba true

        // Refrescar los datos en segundo plano (sin bloquear el cierre del modal)
        setTimeout(async () => {
          // Cerrar el modal después de un pequeño delay
          setShowBANForm(false);

          // Refrescar los datos del cliente (esto recargará los BANs)
          if (onRefreshClient) {
            try {
              await onRefreshClient();
            } catch (error) {
              console.error('Error refreshing client:', error);
            }
          }

          // Refrescar seguimiento si es necesario
          if (onFollowUpUpdated) {
            try {
              const followUpResult = onFollowUpUpdated();
              if (followUpResult instanceof Promise) {
                await followUpResult;
              }
            } catch (error) {
              console.error('Error refreshing follow-up:', error);
            }
          }
        }, 50);

        return true;
      }

      // Manejar errores
      console.error('❌ Error del servidor:', response.status, responseData);
      let errorMessage = responseData?.error || responseData?.message || "Error desconocido al crear el BAN";

      if (response.status === 409) {
        // El backend ahora incluye información sobre qué cliente tiene el BAN
        const backendMessage = responseData?.error || responseData?.message || '';
        if (backendMessage.includes('ya existe y está asignado a este cliente')) {
          errorMessage = backendMessage;
        } else if (backendMessage.includes('ya existe y está asignado al cliente')) {
          errorMessage = backendMessage;
        } else if (backendMessage.includes('ya existe')) {
          errorMessage = backendMessage;
        } else {
          errorMessage = `El BAN ${data.ban_number} ya existe en el sistema. Por favor, verifica el número o edita el BAN existente.`;
        }
      } else if (response.status === 400) {
        errorMessage = responseData?.error || responseData?.message || "Datos inválidos. Verifica que el número BAN tenga 9 dígitos.";
      } else if (response.status === 404) {
        errorMessage = "Cliente no encontrado. Por favor, recarga la página e intenta nuevamente.";
      } else if (response.status === 401) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else {
        errorMessage = responseData?.error || responseData?.message || `Error del servidor (${response.status}). Intenta nuevamente.`;
      }

      console.error('❌ Mensaje de error final:', errorMessage);
      setFormMessage({ type: 'error', text: errorMessage });

      // Retornar el mensaje de error para que el BANModal lo muestre
      return { error: true, message: errorMessage } as any;
    } catch (error) {
      console.error("❌ Error creating BAN:", error);
      setFormMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al crear el BAN.' });
      return false;
    }
  };

  const handleDeleteBAN = async (banId: number) => {
    try {
      const ban = client.bans.find(b => b.id === banId);
      if (!ban) {
        setFormMessage({ type: 'error', text: 'BAN no encontrado.' });
        return;
      }

      if (!confirm(`¿Estás seguro de que quieres eliminar el BAN ${ban.ban_number}?\n\nEsta acción eliminará permanentemente el BAN y todos sus suscriptores asociados.`)) {
        return;
      }

      const response = await authFetch(`/api/bans/${banId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de conexión' }));
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

      if (!confirm(`¿Estás seguro de que quieres eliminar el suscriptor ${subscriber.phone}?\n\nEsta acción no se puede deshacer.`)) {
        return;
      }

      const response = await authFetch(`/api/subscribers/${subscriberId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de conexión' }));
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

  const handleCancelSubscriber = async (subscriberId: number, phone: string, banId: string) => {
    const reason = prompt(`¿Razón de cancelación para ${phone}? (opcional)`);
    if (reason === null) return; // user clicked Cancel on prompt
    
    try {
      const response = await authFetch(`/api/subscribers/${subscriberId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: reason || null }),
      });

      if (!response.ok) {
        setFormMessage({ type: 'error', text: 'Error al cancelar la línea.' });
        return;
      }

      setFormMessage({ type: 'success', text: `Línea ${phone} cancelada.` });
      // Switch to cancelled tab for this BAN
      setSubscriberSubTabs(prev => ({ ...prev, [banId]: 'canceladas' }));
      if (onRefreshClient) await onRefreshClient();
    } catch {
      setFormMessage({ type: 'error', text: 'Error de conexión al cancelar.' });
    }
  };

  const handleReactivateSubscriber = async (subscriberId: number, phone: string, banId: string) => {
    if (!confirm(`¿Reactivar la línea ${phone}?`)) return;
    
    try {
      const response = await authFetch(`/api/subscribers/${subscriberId}/reactivate`, {
        method: 'PUT',
      });

      if (!response.ok) {
        setFormMessage({ type: 'error', text: 'Error al reactivar la línea.' });
        return;
      }

      setFormMessage({ type: 'success', text: `Línea ${phone} reactivada.` });
      setSubscriberSubTabs(prev => ({ ...prev, [banId]: 'activas' }));
      if (onRefreshClient) await onRefreshClient();
    } catch {
      setFormMessage({ type: 'error', text: 'Error de conexión al reactivar.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">{client.business_name || client.name}</h2>
            <p className="text-gray-300 mt-1">Gestión completa del cliente</p>
          </div>
          <div className="flex items-center space-x-3">
            {(() => {
              const hasActiveFollowUp = clientHasActiveFollowUp(client.id);

              // No mostrar el botón si el cliente ya está en seguimiento
              if (hasActiveFollowUp) {
                return null;
              }

              return (
                <button
                  onClick={handleSendToFollowUpFromDetail}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${!isSendingToFollowUp
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  title="Enviar a seguimiento"
                  disabled={isSendingToFollowUp}
                >
                  <UserPlus className="w-4 h-4" />
                  {isSendingToFollowUp ? 'Enviando...' : 'Enviar a Seguimiento'}
                </button>
              );
            })()}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Form Message */}
        {formMessage && (
          <div
            className={`p-4 text-sm border-b ${formMessage.type === 'success'
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
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'info'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
          >
            Información del Cliente
          </button>
          <button
            onClick={() => setActiveTab('bans')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'bans'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
          >
            BANs y Suscriptores ({client.bans.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'history'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
          >
            Historial
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'calls'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
          >
            Llamadas y Fechas
          </button>
          <button
            onClick={() => setShowComparativaModal(true)}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'comparativas'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Comparativas
            {savedComparativas.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700">{savedComparativas.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ventas')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'ventas'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Ventas
          </button>
        </div>

        {/* Content */}
        <div className="p-6 h-[60vh] overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Información del Cliente</h3>
                <div className="flex items-center space-x-2">
                  {!isEditingClient ? (
                    <>
                      <button
                        onClick={() => setShowEmailModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                        title="Enviar correo"
                      >
                        <Mail className="w-4 h-4" />
                        Enviar Correo
                      </button>
                      <button
                        onClick={() => setIsEditingClient(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Editar Cliente
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const response = await authFetch('/api/pos/enviar-cliente', {
                              method: 'POST',
                              json: {
                                ...client,
                                salesperson_id: client.salesperson_id || client.vendor_id
                              }
                            });

                            if (!response.ok) {
                              const error = await response.json();
                              setFormMessage({ type: 'error', text: error.error || 'Error al enviar al POS' });
                              return;
                            }

                            const result = await response.json();
                            setFormMessage({ type: 'success', text: `✅ Cliente enviado al POS (ID: ${result.clientecreditoid})` });
                          } catch (error) {
                            console.error('Error enviando a POS:', error);
                            setFormMessage({ type: 'error', text: 'Error al enviar al POS' });
                          }
                        }}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all shadow-lg shadow-purple-500/25"
                        title="Enviar cliente al sistema POS"
                      >
                        <span>📤</span>
                        Enviar a POS
                      </button>
                      <button
                        onClick={async () => {
                          if (client.bans.length > 0) {
                            setFormMessage({ type: 'info', text: 'No se puede eliminar un cliente con BANs activos. Elimina los BANs primero.' });
                            return;
                          }

                          if (confirm(`¿Estás seguro de que quieres eliminar el cliente "${client.business_name || client.name}"?\n\nEsta acción no se puede deshacer.`)) {
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
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveClientEdit}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Guardar Cambios
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔴 Cancelando edición...');
                          setIsEditingClient(false);
                          setEditClientData({
                            name: client.name || '',
                            business_name: client.business_name || '',
                            contact_person: client.contact_person || '',
                            email: client.email || '',
                            phone: client.phone || '',
                            secondary_phone: (client as any).secondary_phone || '',
                            mobile_phone: (client as any).mobile_phone || '',
                            address: client.address || '',
                            city: (client as any).city || '',
                            zip_code: (client as any).zip_code || '',
                            tax_id: (client as any).tax_id || '',
                            owner_name: (client as any).owner_name || '',
                            cellular: (client as any).cellular || '',
                            additional_phone: (client as any).additional_phone || '',
                            salesperson_id: (client as any).salesperson_id || '',
                          });
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditingClient ? (
                // Formulario de edición inline - ORDEN PROFESIONAL POS
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-800/50 rounded-lg p-6">
                    {/* Empresa / Razón Social */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Empresa / Razón Social *</label>
                      <input
                        type="text"
                        value={editClientData.name}
                        onChange={(e) => setEditClientData({ ...editClientData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* RNC / Cédula */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">RNC / Cédula *</label>
                      <input
                        type="text"
                        value={(editClientData as any).tax_id || ''}
                        onChange={(e) => setEditClientData({ ...editClientData, tax_id: e.target.value } as any)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="RNC o Cédula fiscal"
                        required
                      />
                    </div>

                    {/* Nombre y Apellido Dueño */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nombre y Apellido Dueño</label>
                      <input
                        type="text"
                        value={(editClientData as any).owner_name || ''}
                        onChange={(e) => setEditClientData({ ...editClientData, owner_name: e.target.value } as any)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre completo del propietario"
                      />
                    </div>

                    {/* Persona de Contacto */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Persona de Contacto *</label>
                      <input
                        type="text"
                        value={editClientData.contact_person}
                        onChange={(e) => setEditClientData({ ...editClientData, contact_person: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                      <input
                        type="email"
                        value={editClientData.email}
                        onChange={(e) => setEditClientData({ ...editClientData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Teléfono Principal */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Teléfono Principal *</label>
                      <input
                        type="tel"
                        value={editClientData.phone}
                        onChange={(e) => setEditClientData({ ...editClientData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="+1 787 234 5678"
                        required
                      />
                    </div>

                    {/* Celular */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Celular *</label>
                      <input
                        type="tel"
                        value={(editClientData as any).cellular || editClientData.mobile_phone || ''}
                        onChange={(e) => setEditClientData({ ...editClientData, cellular: e.target.value, mobile_phone: e.target.value } as any)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="+1 787 999 8888"
                        required
                      />
                    </div>

                    {/* Teléfono Adicional */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Teléfono Adicional</label>
                      <input
                        type="tel"
                        value={(editClientData as any).additional_phone || editClientData.secondary_phone || ''}
                        onChange={(e) => setEditClientData({ ...editClientData, additional_phone: e.target.value, secondary_phone: e.target.value } as any)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Opcional"
                      />
                    </div>

                    {/* Dirección - Ancho completo */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Dirección *</label>
                      <textarea
                        value={editClientData.address}
                        onChange={(e) => setEditClientData({ ...editClientData, address: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Ciudad */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Ciudad *</label>
                      <input
                        type="text"
                        value={editClientData.city}
                        onChange={(e) => setEditClientData({ ...editClientData, city: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Código Postal */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Código Postal *</label>
                      <input
                        type="text"
                        value={editClientData.zip_code}
                        onChange={(e) => setEditClientData({ ...editClientData, zip_code: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Vendedor Asignado */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Vendedor Asignado</label>
                      <select
                        value={editClientData.salesperson_id}
                        onChange={(e) => setEditClientData({ ...editClientData, salesperson_id: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sin asignar</option>
                        {vendorsList.map((v: any) => (
                          <option key={v.id} value={v.id}>{v.name} ({v.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                // Vista de solo lectura (código existente)
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                      <h4 className="text-lg font-medium text-white mb-4">Datos de Contacto</h4>

                      {client.name && (
                        <div className="flex items-center space-x-3">
                          <Users className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-400">Nombre del Cliente</p>
                            <p className="text-white font-medium">{client.name}</p>
                          </div>
                        </div>
                      )}

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
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                      <h4 className="text-lg font-medium text-white mb-4">Teléfonos</h4>

                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">Teléfono Principal</p>
                          <p className="text-white font-medium">{client.phone || 'No registrado'}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">Teléfono Secundario</p>
                          <p className="text-white font-medium">{(client as any).secondary_phone || 'No registrado'}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">Teléfono Móvil</p>
                          <p className="text-white font-medium">{(client as any).mobile_phone || 'No registrado'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                      <h4 className="text-lg font-medium text-white mb-4">Ubicación</h4>

                      {client.address && (
                        <div className="flex items-start space-x-3">
                          <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-400">Dirección</p>
                            <p className="text-white font-medium">{client.address}</p>
                          </div>
                        </div>
                      )}

                      {(client as any).city && (
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-400">Ciudad</p>
                            <p className="text-white font-medium">{(client as any).city}</p>
                          </div>
                        </div>
                      )}

                      {(client as any).zip_code && (
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-400">Código Postal</p>
                            <p className="text-white font-medium">{(client as any).zip_code}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                      <h4 className="text-lg font-medium text-white mb-4">Información Comercial</h4>

                      {client.business_name && (
                        <div className="flex items-center space-x-3">
                          <Building className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-400">Empresa</p>
                            <p className="text-white font-medium">{client.business_name}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <Building className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400">Vendedor Asignado</p>
                          <p className="text-white font-medium">{client.vendor_name || 'Sin asignar'}</p>
                        </div>
                        {client.vendor_name ? (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`¿Desasignar vendedor "${client.vendor_name}" de este cliente?`)) return;
                              try {
                                const res = await authFetch(`/api/clients/${client.id}`, {
                                  method: 'PUT',
                                  json: { salesperson_id: null }
                                });
                                if (res.ok) {
                                  setFormMessage({ type: 'success', text: 'Vendedor desasignado.' });
                                  if (onRefreshClient) await onRefreshClient();
                                } else {
                                  setFormMessage({ type: 'error', text: 'Error al desasignar vendedor.' });
                                }
                              } catch (e) {
                                setFormMessage({ type: 'error', text: 'Error al desasignar vendedor.' });
                              }
                            }}
                            className="text-xs px-2 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded transition-colors"
                            title="Desasignar vendedor"
                          >
                            ✕ Desasignar
                          </button>
                        ) : !client.vendor_name ? (
                          <button
                            onClick={() => {
                              setIsEditingClient(true);
                            }}
                            className="text-xs px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded transition-colors"
                            title="Asignar vendedor"
                          >
                            + Asignar
                          </button>
                        ) : null}
                      </div>

                      <div className="flex items-center space-x-3">
                        <Building className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">Base de Datos</p>
                          <p className="text-white font-medium">{(client as any).base || 'BD propia'}</p>
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

                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                      <h4 className="text-lg font-medium text-white mb-4">Estadísticas</h4>

                      <div className="flex items-center space-x-3">
                        <Hash className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">Total de BANs</p>
                          <p className="text-white font-medium text-lg font-bold">{client.bans.length} {client.bans.length === 1 ? 'BAN' : 'BANs'}</p>
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
                    </div>
                  </div>
                </>
              )}
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
                            {ban.account_type && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-900/40 text-blue-200 border border-blue-500/30">
                                {ban.account_type}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(ban.status === 'C' || ban.status?.toLowerCase() === 'cancelado' || ban.status?.toLowerCase() === 'inactivo' || ban.status === 'cancelled') ? "bg-red-900/40 text-red-100 border border-red-500/30" : "bg-emerald-900/40 text-emerald-100 border border-emerald-500/30"}`}>
                              {(ban.status === 'C' || ban.status?.toLowerCase() === 'cancelado' || ban.status?.toLowerCase() === 'inactivo' || ban.status === 'cancelled') ? "Cancelado" : "Activo"}
                            </span>
                            {(ban.status === 'C' || ban.status?.toLowerCase() === 'cancelado' || ban.status?.toLowerCase() === 'inactivo' || ban.status === 'cancelled') && ban.cancel_reason && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-900/40 text-orange-100 border border-orange-500/30">
                                {ban.cancel_reason}
                              </span>
                            )}
                            {ban.description && (
                              <p className="text-xs text-gray-400">{ban.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingBAN(ban)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            title="Editar BAN"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteBAN(ban.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            title="Eliminar BAN"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {/* Subscribers Section */}
                      {ban.subscribers && ban.subscribers.length > 0 ? (
                        (() => {
                          const activeSubs = ban.subscribers.filter((s: Subscriber) => s.status !== 'cancelado' && s.status !== 'cancelled');
                          const cancelledSubs = ban.subscribers.filter((s: Subscriber) => s.status === 'cancelado' || s.status === 'cancelled');
                          const currentSubTab = subscriberSubTabs[ban.id] || 'activas';
                          const subsToShow = currentSubTab === 'activas' ? activeSubs : cancelledSubs;

                          return (
                            <div className="space-y-2">
                              {/* Sub-tabs: Activas / Canceladas */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSubscriberSubTabs(prev => ({ ...prev, [ban.id]: 'activas' }))}
                                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${currentSubTab === 'activas' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'}`}
                                >
                                  <Phone className="w-3 h-3" />
                                  Activas ({activeSubs.length})
                                </button>
                                <button
                                  onClick={() => setSubscriberSubTabs(prev => ({ ...prev, [ban.id]: 'canceladas' }))}
                                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${currentSubTab === 'canceladas' ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'}`}
                                >
                                  <X className="w-3 h-3" />
                                  Canceladas ({cancelledSubs.length})
                                </button>
                              </div>

                              {/* List */}
                              <div className="space-y-1">
                                {subsToShow.length > 0 ? subsToShow.map((subscriber: Subscriber) => (
                                  <div key={subscriber.id} className={`rounded p-2 ${currentSubTab === 'canceladas' ? 'bg-gray-800/60 border border-red-900/20' : 'bg-gray-700'}`}>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center space-x-3 text-xs flex-1">
                                        <div className="flex items-center space-x-1">
                                          <Phone className="w-3 h-3 text-gray-400" />
                                          <span className={`font-mono ${currentSubTab === 'canceladas' ? 'text-gray-400 line-through' : 'text-white'}`}>{subscriber.phone}</span>
                                        </div>

                                        {subscriber.plan && (
                                          <span className="text-gray-400 truncate max-w-[120px]" title={subscriber.plan}>{subscriber.plan}</span>
                                        )}

                                        {subscriber.monthly_value && (
                                          <div className={`font-semibold ${currentSubTab === 'canceladas' ? 'text-gray-500' : 'text-green-400'}`}>${subscriber.monthly_value}/mes</div>
                                        )}

                                        {/* Expiry badge - only for active */}
                                        {currentSubTab === 'activas' && (() => {
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

                                        {/* Cancel reason for cancelled */}
                                        {currentSubTab === 'canceladas' && subscriber.cancel_reason && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-900/40 text-orange-100 border border-orange-500/30">
                                            {subscriber.cancel_reason}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        {currentSubTab === 'activas' ? (
                                          <>
                                            <button
                                              onClick={() => handleEditSubscriber(subscriber, ban.id)}
                                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                                            >
                                              <Edit className="w-3 h-3" />
                                              Editar
                                            </button>
                                            <button
                                              onClick={() => handleCancelSubscriber(subscriber.id, subscriber.phone, String(ban.id))}
                                              className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                                            >
                                              <X className="w-3 h-3" />
                                              Cancelar
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => handleReactivateSubscriber(subscriber.id, subscriber.phone, String(ban.id))}
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                                            >
                                              <Check className="w-3 h-3" />
                                              Reactivar
                                            </button>
                                            <button
                                              onClick={() => handleDeleteSubscriber(subscriber.id, ban.id)}
                                              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              Eliminar
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )) : (
                                  <div className="text-center py-3 text-gray-500 text-xs">
                                    {currentSubTab === 'activas' ? 'No hay líneas activas' : 'No hay líneas canceladas'}
                                  </div>
                                )}
                              </div>
                              {currentSubTab === 'activas' && (
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
                              )}
                            </div>
                          );
                        })()
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
                Próximamente: Registro de llamadas, fechas importantes y seguimiento
              </p>
            </div>
          )}

          {/* ====== TAB COMPARATIVAS ====== */}
          {activeTab === 'comparativas' && (
            <div className="space-y-6">
              {/* SECCIÓN 1: PLAN ACTUAL (EDITABLE) */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  Plan Actual del Cliente
                  <span className="text-[10px] text-slate-500 font-normal ml-2">· Edita Plan y Costo, luego guarda</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/60">
                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[110px]">BAN</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[110px]">Teléfono</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-blue-400 uppercase w-[150px] bg-blue-500/5 border-l border-slate-700">Plan</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-green-400 uppercase text-right w-[110px] bg-green-500/5 border-l border-slate-700">Costo</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[100px] border-l border-slate-700">Vencimiento</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[70px]">Estado</th>
                        <th className="px-2 py-2.5 text-[10px] font-bold text-slate-400 uppercase w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {client.bans.length > 0 ? (
                        client.bans.flatMap(ban =>
                          (ban.subscribers || []).map(sub => {
                            const subKey = String(sub.id);
                            const { status, days } = computeSubscriberTiming(sub.contract_end_date);
                            const badge = getStatusBadge(status, days, sub.created_at);
                            const isEditing = editingActual[subKey] !== undefined;
                            return (
                              <tr key={sub.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-4 py-1.5 text-xs text-slate-300 font-mono">{ban.ban_number}</td>
                                <td className="px-3 py-1.5 text-xs text-slate-300 font-mono">{sub.phone}</td>
                                <td className="px-3 py-1 bg-blue-500/5 border-l border-slate-700">
                                  <input type="text"
                                    value={getActualValue(sub.id, 'plan', sub)}
                                    onChange={e => setActualValue(sub.id, 'plan', e.target.value)}
                                    className={`w-full bg-slate-800 border text-xs px-2 py-1.5 rounded outline-none font-semibold transition-all ${isEditing ? 'border-blue-500 ring-1 ring-blue-500/20 text-blue-300' : 'border-slate-700 text-blue-300 hover:border-blue-500/50'}`}
                                  />
                                </td>
                                <td className="px-3 py-1 bg-green-500/5 border-l border-slate-700">
                                  <input type="text"
                                    value={getActualValue(sub.id, 'cost', sub)}
                                    onChange={e => setActualValue(sub.id, 'cost', e.target.value)}
                                    className={`w-full bg-slate-800 border text-xs px-2 py-1.5 rounded outline-none text-right font-mono font-semibold transition-all ${isEditing ? 'border-green-500 ring-1 ring-green-500/20 text-green-400' : 'border-slate-700 text-green-400 hover:border-green-500/50'}`}
                                  />
                                </td>
                                <td className="px-3 py-1 border-l border-slate-700">
                                  <input type="date"
                                    value={getActualValue(sub.id, 'expiry', sub)}
                                    onChange={e => setActualValue(sub.id, 'expiry', e.target.value)}
                                    className={`w-full bg-slate-800 border text-xs px-2 py-1.5 rounded outline-none font-mono transition-all ${isEditing ? 'border-amber-500 ring-1 ring-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-300 hover:border-amber-500/50'}`}
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {isEditing && (
                                    <button
                                      onClick={() => handleSaveActualSubscriber(subKey)}
                                      disabled={savingActualId === subKey}
                                      className={`p-1.5 rounded-lg transition-all ${savedActualId === subKey
                                        ? 'bg-green-600 text-white'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40'
                                      }`}
                                      title="Guardar cambios"
                                    >
                                      {savingActualId === subKey ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                      ) : savedActualId === subKey ? (
                                        <Check className="w-3.5 h-3.5" />
                                      ) : (
                                        <Save className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                            No hay suscriptores registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {client.bans.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-800/40 border-t border-slate-700">
                          <td colSpan={3} className="px-4 py-2 text-xs font-bold text-slate-300 text-right">Total Actual:</td>
                          <td className="px-3 py-2 text-right text-sm text-green-400 font-bold font-mono bg-green-500/5 border-l border-slate-700">
                            ${client.bans.flatMap(b => b.subscribers || []).reduce((sum, s) => {
                              const edited = editingActual[String(s.id)];
                              const val = edited ? parseFloat(edited.cost) || 0 : Number(s.monthly_value) || 0;
                              return sum + val;
                            }, 0).toFixed(2)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* SEPARADOR */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-emerald-500/30"></div>
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                  OFERTA PROPUESTA
                </div>
                <div className="flex-1 border-t border-emerald-500/30"></div>
              </div>

              {/* SECCIÓN 2: OFERTA (EDITABLE, PRE-LLENADA CON BAN/PHONE) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Nueva Oferta
                    <span className="text-[10px] text-slate-500 font-normal ml-2">· Mismos BANs y líneas, completa el plan nuevo</span>
                  </h3>
                  <button
                    onClick={addOfferRow}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Agregar Línea
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-emerald-900/20 border border-emerald-500/20">
                        <th className="px-4 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[110px]">BAN</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[110px]">Teléfono</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[150px] bg-emerald-500/5 border-l border-emerald-900/30">Plan Nuevo</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase text-right w-[110px] bg-emerald-500/5 border-l border-emerald-900/30">Costo</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-emerald-400 uppercase w-[160px] border-l border-emerald-900/30">Notas</th>
                        <th className="px-2 py-2.5 w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-900/20">
                      {offerRows.map(row => (
                        <tr key={row.id} className="hover:bg-emerald-900/10 transition-colors">
                          <td className="px-4 py-1.5">
                            <input type="text" value={row.ban}
                              onChange={e => updateOfferRow(row.id, 'ban', e.target.value)}
                              placeholder="BAN"
                              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded outline-none focus:border-emerald-500 font-mono"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={row.phone}
                              onChange={e => updateOfferRow(row.id, 'phone', e.target.value)}
                              placeholder="Teléfono"
                              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded outline-none focus:border-emerald-500 font-mono"
                            />
                          </td>
                          <td className="px-3 py-1.5 bg-emerald-500/5 border-l border-emerald-900/30">
                            <input type="text" value={row.plan}
                              onChange={e => updateOfferRow(row.id, 'plan', e.target.value)}
                              placeholder="Plan nuevo"
                              className="w-full bg-slate-800 border border-slate-700 text-emerald-300 text-xs px-2 py-1.5 rounded outline-none focus:border-emerald-500 font-semibold"
                            />
                          </td>
                          <td className="px-3 py-1.5 bg-emerald-500/5 border-l border-emerald-900/30">
                            <input type="text" value={row.cost}
                              onChange={e => updateOfferRow(row.id, 'cost', e.target.value)}
                              placeholder="$0.00"
                              className="w-full bg-slate-800 border border-slate-700 text-green-400 text-xs px-2 py-1.5 rounded outline-none focus:border-emerald-500 text-right font-mono font-semibold"
                            />
                          </td>
                          <td className="px-3 py-1.5 border-l border-emerald-900/30">
                            <input type="text" value={row.notes}
                              onChange={e => updateOfferRow(row.id, 'notes', e.target.value)}
                              placeholder="Notas..."
                              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removeOfferRow(row.id)}
                              className="text-red-500 hover:text-red-400 transition-colors p-1"
                              title="Eliminar línea"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-900/20 border-t border-emerald-500/20">
                        <td colSpan={3} className="px-4 py-2 text-xs font-bold text-emerald-300 text-right">Total Oferta:</td>
                        <td className="px-3 py-2 text-right text-sm text-green-400 font-bold font-mono bg-emerald-500/5 border-l border-emerald-900/30">
                          ${offerRows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* DIFERENCIA */}
              {(() => {
                const totalActual = client.bans.flatMap(b => b.subscribers || []).reduce((sum, s) => {
                  const edited = editingActual[String(s.id)];
                  return sum + (edited ? parseFloat(edited.cost) || 0 : Number(s.monthly_value) || 0);
                }, 0);
                const totalOferta = offerRows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
                const diff = totalOferta - totalActual;
                return totalOferta > 0 ? (
                  <div className={`flex items-center justify-between p-4 rounded-lg border ${diff < 0 ? 'bg-green-900/20 border-green-500/30' : diff > 0 ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/40 border-slate-700'}`}>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-slate-400">Actual: <span className="text-white font-bold">${totalActual.toFixed(2)}</span></div>
                      <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                      <div className="text-xs text-slate-400">Oferta: <span className="text-emerald-400 font-bold">${totalOferta.toFixed(2)}</span></div>
                    </div>
                    <span className={`text-lg font-bold ${diff < 0 ? 'text-green-400' : diff > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {diff < 0 ? '-' : diff > 0 ? '+' : ''}${Math.abs(diff).toFixed(2)}
                      {diff < 0 && <span className="text-xs ml-2 text-green-500">(ahorro)</span>}
                      {diff > 0 && <span className="text-xs ml-2 text-amber-500">(incremento)</span>}
                    </span>
                  </div>
                ) : null;
              })()}

              {/* GUARDAR COMPARATIVA */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={comparativaTitle}
                  onChange={e => setComparativaTitle(e.target.value)}
                  placeholder="Nombre de la comparativa (ej: Migración Abril 2026)"
                  className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-lg outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSaveComparativa}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
                >
                  <Save className="w-4 h-4" />
                  Guardar Comparativa
                </button>
              </div>

              {/* COMPARATIVAS GUARDADAS */}
              {savedComparativas.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase">Comparativas Guardadas</h4>
                  <div className="space-y-2">
                    {savedComparativas.map(comp => (
                      <div key={comp.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700">
                        <div>
                          <span className="text-sm font-medium text-white">{comp.title}</span>
                          <span className="text-xs text-slate-500 ml-3">{new Date(comp.created_at).toLocaleDateString()}</span>
                          <span className="text-xs text-slate-500 ml-2">
                            · {comp.data.actual?.length || 0} actual, {comp.data.oferta?.length || 0} oferta
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (comp.data.oferta && comp.data.oferta.length > 0) {
                                setOfferRows(comp.data.oferta.map((r: any) => ({
                                  id: crypto.randomUUID(),
                                  subId: r.subId || '',
                                  ban: r.ban || '',
                                  phone: r.phone || '',
                                  plan: r.plan || '',
                                  cost: r.cost || '',
                                  notes: r.notes || '',
                                })));
                              }
                              setFormMessage({ type: 'info', text: `Comparativa "${comp.title}" cargada.` });
                              setTimeout(() => setFormMessage(null), 2000);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded transition-colors hover:bg-blue-900/30"
                          >
                            Cargar
                          </button>
                          <button
                            onClick={() => deleteComparativa(comp.id)}
                            className="text-red-500 hover:text-red-400 transition-colors p-1"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== TAB VENTAS ====== */}
          {activeTab === 'ventas' && (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-600" />
              <h3 className="mt-2 text-lg font-medium text-gray-300">Ventas del Cliente</h3>
              <p className="mt-1 text-sm text-gray-500">
                Próximamente: Ventas sincronizadas desde Tango para este cliente
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

      {/* Email Modal */}
      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipientEmail={client.email || ''}
        recipientName={client.contact_person || client.name}
      />

      {/* Comparativa Modal */}
      {showComparativaModal && (
        <ComparativaModal
          client={client}
          onClose={() => setShowComparativaModal(false)}
          onRefreshClient={onRefreshClient}
        />
      )}
    </div>
  );
}


