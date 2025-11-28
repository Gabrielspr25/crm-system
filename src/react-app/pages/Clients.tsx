// VERSION: 2025-01-15-T7-FINAL-FIX (statusPriority indentado - Error #300 RESUELTO DEFINITIVAMENTE)
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Edit, Users, Building, Phone, Mail, MapPin, Hash, Calendar, Trash2, UserPlus, Download, FileSpreadsheet, FileText, Check, X, Package } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";
import ClientModal from "../components/ClientModal";
import BANModal from "../components/BANModal";
import SubscriberModal from "../components/SubscriberModal";
import SalesHistoryTab from "../components/SalesHistoryTab";
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
  subscribers_in_opportunity?: number;
  base: string | null;
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
  remaining_payments: number | null;
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
  lastActivity?: string | null;
  banType?: string | null;
  followUpProspectId?: number;
  banNumbers: string[];
  subscriberPhones: string[];
  includesBan: boolean;
  hasCancelledBans?: boolean;
  isIncomplete?: boolean;
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

// V3.4 FINAL FIX - 2025-01-15 - statusPriority indentación corregida
export default function Clients() {
  console.log("✅✅✅ Clients V3.4 FINAL - statusPriority FIXED - Error #300 RESUELTO ✅✅✅");
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showClientModal, setShowClientModal] = useState(false);
  const [showBANModal, setShowBANModal] = useState(false);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [showClientDetailModal, setShowClientDetailModal] = useState(false);
  const [loadingClientDetail, setLoadingClientDetail] = useState(false);
  const [clientDetailInitialTab, setClientDetailInitialTab] = useState<'info' | 'bans' | 'history' | 'calls'>('bans');
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
  const [activeTab, setActiveTab] = useState<'available' | 'following' | 'completed' | 'cancelled' | 'incomplete'>('available');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pendingBanClientId, setPendingBanClientId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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
          const activeProspect = clientProspects.find((p) => Boolean(p.is_active ?? true) && !Boolean(p.is_completed));
          const completedProspectExists = !activeProspect && clientProspects.some((p) => Boolean(p.is_completed));

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
            includesBan: client.has_bans || false
          });
        }
        
        // Sort by client name
        clientData.sort((a, b) => a.clientName.localeCompare(b.clientName));
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
        const hasCancelledBans = Boolean(client.has_cancelled_bans);
        
        // Detectar clientes incompletos:
        // Un cliente está COMPLETO solo si tiene:
        // 1. business_name (cualquiera, incluso auto-generado)
        // 2. Al menos un BAN (has_bans = true)
        // 3. Al menos un suscriptor (subscriber_count > 0)
        //
        // CAMPOS OPCIONALES (NO requeridos para estar completo):
        // - email, phone, address, contact_person, city, zip_code
        // - secondary_phone, mobile_phone
        
        // NUEVA LÓGICA: Por defecto TODO cliente va a "Incompletos"
        // Para pasar a "Disponibles" necesita: BAN + Suscriptor + (Nombre O Empresa)
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
        
        // Verificar BAN - puede venir como has_bans (boolean) o ban_count (número)
        const hasBAN = Boolean(client.has_bans || (client.ban_count && client.ban_count > 0));
        
        // Verificar Suscriptor - puede venir como subscriber_count (número)
        const hasSubscriber = Boolean((client.subscriber_count || 0) > 0);
        
        // Un cliente está COMPLETO solo si tiene: BAN + Suscriptor + (Nombre O Empresa)
        // Si NO cumple → es INCOMPLETO (va a pestaña Incompletos)
        const isComplete = hasBAN && hasSubscriber && hasNameOrBusiness;
        const isIncomplete = !isComplete;
        
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
        subscriberPhones: Array.from(subscriberPhones),
        lastActivity: metadata.lastActivity,
        banType: metadata.banType,
        hasCancelledBans: metadata.hasCancelledBans,
        isIncomplete: metadata.isIncomplete,
      };
    });
  }, [clientItems, clients]);

  const filteredClients = clientSummaries.filter(item => {
    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        item.clientName.toLowerCase().includes(term) ||
        (item.businessName && item.businessName.toLowerCase().includes(term)) ||
        item.banNumbers.some(ban => ban.toLowerCase().includes(term)) ||
        item.subscriberPhones.some(phone => phone.includes(term))
      );
      if (!matchesSearch) return false;
    }
    
    return true;
  });

  const incompleteClients = filteredClients.filter(item => item.isIncomplete && !item.hasCancelledBans);
  const availableClients = filteredClients.filter(item => !item.isBeingFollowed && !item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete);
  const followingClients = filteredClients.filter(item => item.isBeingFollowed && !item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete);
  const completedClients = filteredClients.filter(item => item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete);
  const cancelledClients = filteredClients.filter(item => item.hasCancelledBans);
  
  // Debug: mostrar conteo y verificar lógica
  const totalIncompletos = filteredClients.filter(item => item.isIncomplete).length;
  const totalDisponibles = filteredClients.filter(item => !item.isBeingFollowed && !item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete).length;
  const totalCompletos = filteredClients.filter(item => item.wasCompleted && !item.hasCancelledBans && !item.isIncomplete).length;
  
  console.log('🔍 ===== ESTADÍSTICAS CLIENTES =====');
  console.log('📊 Total filteredClients:', filteredClients.length);
  console.log('📊 Clientes INCOMPLETOS:', totalIncompletos);
  console.log('📊 Clientes DISPONIBLES (según nueva lógica):', totalDisponibles);
  console.log('📊 Clientes COMPLETOS:', totalCompletos);
  console.log('📊 Clientes en Disponibles (pestaña):', availableClients.length);
  console.log('🔍 ===== FIN ESTADÍSTICAS =====');
  
  const clientsForTab = activeTab === 'incomplete'
    ? incompleteClients
    : activeTab === 'available'
    ? availableClients
    : activeTab === 'following'
    ? followingClients
    : activeTab === 'completed'
    ? completedClients
    : cancelledClients;
  
  // Paginación
  const totalPages = Math.ceil(clientsForTab.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedClients = clientsForTab.slice(startIndex, endIndex);
  
  // Reset página cuando cambien filtros o pestañas
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const handleSendToFollowUp = async (clientId: number) => {
    try {
      const clientResponse = await authFetch(`/api/clients/${clientId}`);
      if (!clientResponse.ok) {
        throw new Error('No fue posible cargar el cliente.');
      }

      const client = await clientResponse.json();

      // Verificar si tiene seguimiento activo (no completado)
      if (clientHasActiveFollowUp(clientId)) {
        notify('info', 'Este cliente ya está en seguimiento activo.');
        return;
      }

      // Verificar si tiene prospecto completado
      const completedProspect = (prospects || []).find(
        (p) => p.client_id === clientId && Boolean(p.is_completed)
      );

      if (completedProspect) {
        // Si existe un prospecto completado, navegar a FollowUp para editarlo automáticamente
        notify('info', 'Este cliente fue completado. Abriendo en seguimiento...');
        navigate(`/follow-up?edit=${completedProspect.id}&completed=true`);
        return;
      }

      // Los vendedores pueden enviar clientes a seguimiento incluso sin vendor_id
      // El backend asignará automáticamente el vendor_id del vendedor
      const prospectData = {
        company_name: client.business_name || client.name,
        client_id: clientId,
        vendor_id: client.vendor_id || null, // Permitir null, el backend lo asignará si es vendedor
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        notes: 'Cliente enviado automáticamente desde gestión de clientes',
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
      
      // Cambiar a la pestaña de "Seguimiento" automáticamente
      setActiveTab('following');
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

  const handleViewClientDetail = async (clientId: number, initialTab: 'info' | 'bans' | 'history' | 'calls' = 'bans') => {
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
      
      // Load client's BANs with subscribers (en paralelo para mejor rendimiento)
      const [bansResponse] = await Promise.all([
        authFetch(`/api/bans?client_id=${clientId}`)
      ]);
      
      let bans: BAN[] = [];
      
      if (bansResponse.ok) {
        const clientBans: BAN[] = await bansResponse.json();
        
        // Load subscribers for each BAN (en paralelo)
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
      setShowClientModal(false);
      setEditingClient(null);
      setSelectedClientId(null);
      setClientBANs([]);
      await refetchClients();
      
      // Si estaba incompleto y ahora está completo, mover a la pestaña Disponibles
      if (wasIncomplete && isNowComplete) {
        setActiveTab('available');
        notify('success', `Cliente ${data.business_name || data.name} completado y movido a Disponibles.`);
      } else {
        notify('success', `Cliente ${data.business_name || data.name} actualizado correctamente.`);
      }
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
  const totalBans = clients ? clients.reduce((sum, client) => {
    return sum + (client.ban_count || 0);
  }, 0) : clientSummaries.reduce((sum, item) => sum + item.totalBans, 0);
  
  // Total Suscriptores: Sumar subscriber_count del backend (conteo real por cliente)
  const totalSubscribers = clients ? clients.reduce((sum, client) => {
    return sum + (client.subscriber_count || 0);
  }, 0) : clientSummaries.reduce((sum, item) => sum + item.totalSubscribers, 0);
  
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

  const handleExport = (type: 'excel' | 'csv') => {
    const dataToExport = clientsForTab.map(client => ({
      'ID': client.clientId,
      'Nombre': client.clientName || '',
      'Empresa': client.businessName || '',
      'Tipo': client.banType || '',
      'Base': (client as any).base || 'BD propia',
      'Estado': client.hasCancelledBans ? 'Cancelado' : 'Activo',
      'Vendedor': client.vendorName || 'Sin asignar',
      'BANs': client.banNumbers ? client.banNumbers.join(', ') : '',
      'Teléfono Principal': client.primarySubscriberPhone || '',
      'Total Suscriptores': client.totalSubscribers || 0,
      'Fecha Vencimiento': client.primaryContractEndDate ? new Date(client.primaryContractEndDate).toLocaleDateString() : '',
      'Última Actividad': client.lastActivity ? new Date(client.lastActivity).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");

    // Ajustar ancho de columnas
    const wscols = [
      {wch: 10}, // ID
      {wch: 30}, // Nombre
      {wch: 30}, // Empresa
      {wch: 15}, // Tipo
      {wch: 15}, // Base
      {wch: 10}, // Estado
      {wch: 20}, // Vendedor
      {wch: 20}, // BANs
      {wch: 15}, // Telefono
      {wch: 10}, // Total Subs
      {wch: 15}, // Vencimiento
      {wch: 15}  // Ultima Actividad
    ];
    ws['!cols'] = wscols;

    const fileName = `Clientes_${activeTab}_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'xlsx' : 'csv'}`;
    
    if (type === 'excel') {
      XLSX.writeFile(wb, fileName);
    } else {
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
    }
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
          <h1 className="text-3xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 mt-1">Información completa de todos los clientes ordenados por vencimiento de contrato</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 first:rounded-t-lg"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 last:rounded-b-lg"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  CSV
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
      </div>

      {/* Statistics - V2.0 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-lg shadow-sm border-2 border-blue-500/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Cantidad de Clientes</p>
              <p className="text-2xl font-bold text-white">{totalClients}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-sm border-2 border-green-500/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Cantidad de BAN</p>
              <p className="text-2xl font-bold text-green-400">{totalBans}</p>
            </div>
            <Hash className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-sm border-2 border-blue-500/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Cant de Suscriptores</p>
              <p className="text-2xl font-bold text-blue-400">{totalSubscribers}</p>
            </div>
            <Phone className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-sm border-2 border-yellow-500/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Suscriptores en Oportunidad</p>
              <p className="text-2xl font-bold text-yellow-400">{subscribersInOpportunity}</p>
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

      {/* Tabs - V2.0 con Incompletos */}
      <div className="flex items-center gap-2 mb-4 flex-wrap border-b border-gray-700 pb-2">
        {(() => {
          const currentUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
          const isVendor = currentUser?.role?.toLowerCase() === 'vendedor';
          
          // Mostrar pestaña Incompletos solo para administradores
          if (!isVendor) {
            return (
              <button
                key="incomplete-tab"
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  activeTab === 'incomplete'
                    ? 'bg-orange-600 text-white shadow-lg border-2 border-orange-400'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                onClick={() => {
                  console.log('🔘 Click en pestaña Incompletos - V2.0');
                  setActiveTab('incomplete');
                }}
              >
                ⚠️ Incompletos ({incompleteClients.length})
              </button>
            );
          }
          return null;
        })()}
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
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'cancelled'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelados ({cancelledClients.length})
        </button>
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
                          {item.businessName || item.clientName}
                        </div>
                      </button>
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.hasCancelledBans
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
                      {activeTab === 'incomplete' ? (
                        <button
                          onClick={() => handleCompleteClient(item.clientId)}
                          className="px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 mx-auto bg-green-600 hover:bg-green-700 text-white"
                          title="Completar información del cliente"
                        >
                          <Edit className="w-3 h-3" />
                          Completar
                        </button>
                      ) : item.wasCompleted ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-900/60 text-purple-200 text-xs font-medium">
                          âœ" Completado
                        </span>
                      ) : item.isBeingFollowed ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-900/60 text-green-200 text-xs font-medium">
                            <UserPlus className="w-3 h-3" /> Siguiendo
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/seguimiento?client_id=${item.clientId}`)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors flex items-center gap-1"
                              title="Ir a gestión de seguimiento"
                            >
                              <Package className="w-3 h-3" />
                              Productos
                            </button>
                            <button
                              onClick={() => handleViewClientDetail(item.clientId, 'info')}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors flex items-center gap-1"
                              title="Editar datos del cliente"
                            >
                              <Edit className="w-3 h-3" />
                              Datos
                            </button>
                            <button
                              onClick={() => handleStopFollowing(item.followUpProspectId!, item.businessName || item.clientName)}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs transition-colors"
                              title="Devolver al pool de clientes"
                            >
                              Devolver
                            </button>
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const currentUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
                          const isVendor = currentUser?.role?.toLowerCase() === 'vendedor';
                          if (isVendor) {
                            return (
                              <span className="text-xs text-gray-500">No disponible</span>
                            );
                          }
                          return (
                            <button
                              onClick={() => handleSendToFollowUp(item.clientId)}
                              className="px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 mx-auto bg-blue-600 hover:bg-blue-700 text-white"
                              title="Enviar a seguimiento"
                            >
                              <UserPlus className="w-3 h-3" />
                              A Seguimiento
                            </button>
                          );
                        })()
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
                ? "No se encontraron clientes con ese criterio de búsqueda"
                : activeTab === 'incomplete'
                  ? "No hay clientes incompletos"
                  : activeTab === 'available'
                    ? "No hay clientes disponibles en el pool"
                    : activeTab === 'following'
                      ? "No hay clientes actualmente en seguimiento"
                      : activeTab === 'completed'
                        ? "No hay clientes completados"
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
              // Cambiar a la pestaña de "Seguimiento" automáticamente
              setActiveTab('following');
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
  initialTab?: 'info' | 'bans' | 'history' | 'calls';
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'bans' | 'history' | 'calls'>(initialTab);
  const [showBANForm, setShowBANForm] = useState(false);
  const [editingBAN, setEditingBAN] = useState<BAN | null>(null);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSendingToFollowUp, setIsSendingToFollowUp] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
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
  });

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
      if (clientHasActiveFollowUp(client.id)) {
        setFormMessage({ type: 'info', text: 'Este cliente ya está en seguimiento activo.' });
        return;
      }

      setIsSendingToFollowUp(true);

      // Los vendedores pueden enviar clientes a seguimiento incluso sin vendor_id
      // El backend asignará automáticamente el vendor_id del vendedor
      const prospectData = {
        company_name: client.business_name || client.name,
        client_id: client.id,
        vendor_id: client.vendor_id || null, // Permitir null, el backend lo asignará si es vendedor
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        notes: `Cliente enviado automáticamente desde gestión de clientes`,
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

  const handleSaveClientEdit = async () => {
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
        console.error('❌ Error en respuesta:', error);
        setFormMessage({ type: 'error', text: error.error || "Error al actualizar el BAN" });
        return;
      }

      const updatedBan = await response.json();
      console.log('✅ BAN actualizado:', updatedBan);
      
      // Determinar si el BAN fue cancelado
      const wasCancelled = (data.status === 'cancelled' || data.status === 'cancelado');
      
      setFormMessage({ type: 'success', text: `BAN ${data.ban_number} actualizado correctamente.` });
      setEditingBAN(null);
      
      // Refrescar datos del cliente en el modal
      if (onRefreshClient) {
        await onRefreshClient();
      }
      if (onFollowUpUpdated) {
        await onFollowUpUpdated();
      }
      
      // Si el BAN fue cancelado, cerrar el modal después de un momento para que el usuario vea el cambio
      if (wasCancelled) {
        setTimeout(() => {
          onClose();
        }, 1500); // Esperar 1.5 segundos para que el usuario vea el mensaje de éxito
      }
    } catch (error) {
      console.error("Error updating BAN:", error);
      setFormMessage({ type: 'error', text: 'Error al actualizar el BAN.' });
    }
  };

  const handleCreateBAN = async (data: any): Promise<boolean> => {
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
              const currentUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
              const isVendor = currentUser?.role?.toLowerCase() === 'vendedor';
              const hasActiveFollowUp = clientHasActiveFollowUp(client.id);
              
              // No mostrar el botón si es vendedor o si el cliente ya está en seguimiento
              if (isVendor || hasActiveFollowUp) {
                return null;
              }
              
              return (
                <button
                  onClick={handleSendToFollowUpFromDetail}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    !isSendingToFollowUp
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
            Información del Cliente
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
                <h3 className="text-xl font-semibold text-white">Información del Cliente</h3>
                <div className="flex items-center space-x-2">
                  {!isEditingClient ? (
                    <>
                      <button
                        onClick={() => setIsEditingClient(true)}
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
                        onClick={handleSaveClientEdit}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Guardar Cambios
                      </button>
                      <button
                        onClick={() => {
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
                // Formulario de edición inline
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                    <h4 className="text-lg font-medium text-white mb-4">Información Básica</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Nombre del Cliente</label>
                      <input
                        type="text"
                        value={editClientData.name}
                        onChange={(e) => setEditClientData({...editClientData, name: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Nombre de Empresa</label>
                      <input
                        type="text"
                        value={editClientData.business_name}
                        onChange={(e) => setEditClientData({...editClientData, business_name: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Persona de Contacto</label>
                      <input
                        type="text"
                        value={editClientData.contact_person}
                        onChange={(e) => setEditClientData({...editClientData, contact_person: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                      <input
                        type="email"
                        value={editClientData.email}
                        onChange={(e) => setEditClientData({...editClientData, email: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                    <h4 className="text-lg font-medium text-white mb-4">Teléfonos</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Teléfono Principal</label>
                      <input
                        type="text"
                        value={editClientData.phone}
                        onChange={(e) => setEditClientData({...editClientData, phone: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Teléfono Secundario</label>
                      <input
                        type="text"
                        value={editClientData.secondary_phone}
                        onChange={(e) => setEditClientData({...editClientData, secondary_phone: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Teléfono Móvil</label>
                      <input
                        type="text"
                        value={editClientData.mobile_phone}
                        onChange={(e) => setEditClientData({...editClientData, mobile_phone: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                    <h4 className="text-lg font-medium text-white mb-4">Ubicación</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Dirección</label>
                      <input
                        type="text"
                        value={editClientData.address}
                        onChange={(e) => setEditClientData({...editClientData, address: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Ciudad</label>
                      <input
                        type="text"
                        value={editClientData.city}
                        onChange={(e) => setEditClientData({...editClientData, city: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Código Postal</label>
                      <input
                        type="text"
                        value={editClientData.zip_code}
                        onChange={(e) => setEditClientData({...editClientData, zip_code: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
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
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(ban.status === "cancelled" || ban.status === "cancelado") ? "bg-red-900/40 text-red-100 border border-red-500/30" : "bg-emerald-900/40 text-emerald-100 border border-emerald-500/30"}`}>
                              {(ban.status === "cancelled" || ban.status === "cancelado") ? "Cancelado" : "Activo"}
                            </span>
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
                Próximamente: Registro de llamadas, fechas importantes y seguimiento
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


