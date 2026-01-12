import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { authFetch } from "@/react-app/utils/auth";

import { FileSpreadsheet, BarChart3, Database, AlertTriangle, Check, X, Loader2 } from "lucide-react";

interface PreviewData {
  totalRows: number;
  sampleRows: any[];
  mappedFields: { table: string; field: string; column: string; label: string }[];
  estimatedCreates: number;
  estimatedUpdates: number;
  warnings: string[];
  simulation?: {
    newClients: number;
    updatedClients: number;
    newBans: number;
    updatedBans: number;
    movedBans: number;
    newSubscribers: number;
    updatedSubscribers: number;
    movedSubscribers: number;
    reactivatedSubscribers: number;
    fusedClients: number;
    disponibles?: number;
    incompletos?: number;
    cancelados?: number;
    details: any[]; // Changed from string[] to any[] to support object details
  }
}

export default function ImportadorVisual() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[][]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [excelColumnsInfo, setExcelColumnsInfo] = useState<{ columns: string[]; totalColumns: number; fileName: string; sampleRows?: any[]; totalRows?: number } | null>(null);
  const [isLoadingExcelColumns, setIsLoadingExcelColumns] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message?: string; created?: number; updated?: number; total?: number; errors?: string[]; omitted?: number; warnings?: string[] } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // --- MODO ACTIVACIONES STATE ---
  const [showActivacionesModal, setShowActivacionesModal] = useState(false);
  const [activacionesMetadata, setActivacionesMetadata] = useState({ ban: "", vendor: "", business_name: "", saleDate: new Date().toISOString().split('T')[0] });
  const [activacionesRows, setActivacionesRows] = useState<any[]>([]);
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());

  // Autocomplete State
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [activacionesErrors, setActivacionesErrors] = useState<string[]>([]);

  const dragRef = useRef<string | null>(null);

  // Estado para el modal de datos faltantes
  const [missingDataState, setMissingDataState] = useState<{
    isOpen: boolean;
    field: string; // 'remaining_payments' | 'contract_start_date'
    label: string;
    rows: number[]; // Indices de las filas con datos faltantes
    data: any[][]; // La data completa actual
    headers: string[]; // Las cabeceras actuales
  }>({ isOpen: false, field: '', label: '', rows: [], data: [], headers: [] });

  const [missingDataValue, setMissingDataValue] = useState("");
  const [missingDataApplyAll, setMissingDataApplyAll] = useState(true);
  const [defaultStartDate, setDefaultStartDate] = useState("");

  // Estado para edición en el modal de vista previa
  const [editableData, setEditableData] = useState<any[][]>([]);
  const [virtualHeaders, setVirtualHeaders] = useState<string[]>([]);
  const [isActivacionesMode, setIsActivacionesMode] = useState(false);

  // --- ENRIQUECIMIENTO DE CLIENTES NUEVOS ---
  const [newClientsToEnrich, setNewClientsToEnrich] = useState<any[]>([]);
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [currentEnrichIndex, setCurrentEnrichIndex] = useState(0);
  const [enrichFormData, setEnrichFormData] = useState({
    email: '',
    address: '',
    city: '',
    phone: ''
  });

  // --- VENDORS STATE ---
  const [vendors, setVendors] = useState<any[]>([]);

  useEffect(() => {
    // Cargar vendedores al inicio
    authFetch('/api/vendors')
      .then(res => res.json())
      .then(data => setVendors(data))
      .catch(err => console.error("Error cargando vendedores:", err));
  }, []);

  useEffect(() => {
    if (!excelColumnsInfo) return;
    const assignedColumns = Object.values(assigned);
    const unmapped = excelColumnsInfo.columns.filter((col) => !assignedColumns.includes(col));
    setUnmappedColumns(unmapped);
  }, [assigned, excelColumnsInfo]);

  // Función para obtener la etiqueta del frontend según tabla y columna
  const getFieldLabel = (table: string, col: string): string => {
    // Mapeo específico por tabla
    const labels: Record<string, Record<string, string>> = {
      "Clientes": {
        "owner_name": "Nombre y Apellido Dueño",
        "name": "Empresa",
        "contact_person": "Persona de Contacto",
        "email": "Email",
        "phone": "Teléfono",
        "additional_phone": "Teléfono Adicional",
        "cellular": "Celular",
        "address": "Dirección",
        "city": "Ciudad",
        "zip_code": "Código Postal",
      },
      "BANs": {
        "ban_number": "Número BAN",
        "account_type": "Tipo de Cuenta",
        "status": "Estado",
      },
      "Suscriptores": {
        "phone": "Número de Teléfono",
        "plan": "Plan",
        "monthly_value": "Valor Mensual",
        "remaining_payments": "Plazos Faltantes",
        "contract_term": "Meses Vendidos",
        "contract_end_date": "Fecha Fin Contrato",
      },
    };
    return labels[table]?.[col] || col;
  };

  const [fields] = useState([
    {
      table: "Clientes",
      columns: [
        "owner_name",
        "name",
        "contact_person",
        "email",
        "phone",
        "additional_phone",
        "cellular",
        "address",
        "city",
        "zip_code"
      ]
    },
    {
      table: "BANs",
      columns: [
        "ban_number",
        "account_type",
        "status"
      ]
    },
    {
      table: "Suscriptores",
      columns: [
        "phone",
        "plan",
        "monthly_value",
        "remaining_payments",
        "contract_term",
        "contract_end_date"
      ]
    },
  ]);

  // Función para verificar existencia de suscriptores
  const checkSubscribersExistence = async (_phones: string[]) => {
    try {
      // Obtener todos los suscriptores (optimización: filtrar en cliente)
      const res = await authFetch('/api/subscribers');
      if (!res.ok) throw new Error("Error consultando suscriptores");
      const allSubscribers = await res.json();

      const existing = new Set<string>();
      allSubscribers.forEach((sub: any) => {
        if (sub.subscriber_number) {
          // Normalizar: quitar no numéricos y tomar últimos 10
          const clean = String(sub.subscriber_number).replace(/[^0-9]/g, '').slice(-10);
          existing.add(clean);
        }
      });

      setExistingPhones(existing);
      return existing;
    } catch (error) {
      console.error("Error verificando suscriptores:", error);
      return new Set<string>();
    }
  };

  const loadExcelColumns = async () => {
    setIsLoadingExcelColumns(true);
    try {
      const res = await authFetch('/api/importador/excel-columns');
      const data = await res.json();
      if (res.ok) {
        setExcelColumnsInfo(data);
        const assignedColumns = Object.values(assigned);
        const unmapped = (data.columns || []).filter((col: string) => !assignedColumns.includes(col));
        setUnmappedColumns(unmapped);
      } else {
        alert(`Error: ${data.error || 'No se pudo cargar el archivo Excel'}`);
      }
    } catch (error: any) {
      console.error('Error cargando columnas del Excel:', error);
      alert(`Error: ${error?.message || 'Error al cargar el archivo Excel'}`);
    } finally {
      setIsLoadingExcelColumns(false);
    }
  };

  // Search Clients Function
  const searchClients = async (term: string) => {
    if (!term || term.length < 2) {
      setClientSuggestions([]);
      setShowClientSuggestions(false);
      return;
    }

    setIsSearchingClients(true);
    // Mostrar sugerencias vacías mientras busca o si no hay resultados
    setShowClientSuggestions(true);

    try {
      const res = await authFetch(`/api/clients/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setClientSuggestions(data);
      } else {
        setClientSuggestions([]);
      }
    } catch (error) {
      console.error("Error searching clients:", error);
      setClientSuggestions([]);
    } finally {
      setIsSearchingClients(false);
    }
  };

  // Debounce effect for client search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isActivacionesMode && activacionesMetadata.business_name) {
        searchClients(activacionesMetadata.business_name);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [activacionesMetadata.business_name, isActivacionesMode]);

  const handleSelectClient = (client: any) => {
    setActivacionesMetadata(prev => ({
      ...prev,
      business_name: client.business_name,
      // Si el cliente tiene un BAN asociado y estamos buscando por BAN, podríamos querer autocompletarlo también
      // Pero cuidado de no sobrescribir si el usuario ya puso uno diferente.
      // Por ahora solo nombre.
    }));
    setShowClientSuggestions(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setActivacionesErrors([]);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) return;
        const data = new Uint8Array(event.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        // Mantener celdas vacías con defval: ''
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];

        // --- MODO ACTIVACIONES (MANUAL) ---
        if (isActivacionesMode) {
          console.log("📋 Procesando en Modo Activaciones (Estricto)...");

          // 1. Metadatos (Posiciones Fijas)
          // Vendedor: Fila 3 (idx 2), Col D (idx 3) o C (idx 2)
          const vendor = jsonData[2] ? (jsonData[2][3] || jsonData[2][2] || "") : "";
          // BAN: Fila 5 (idx 4), Col D (idx 3) o C (idx 2)
          const ban = jsonData[4] ? (jsonData[4][3] || jsonData[4][2] || "") : "";
          // Cliente (Empresa): Fila 7 (idx 6), Col D (idx 3) o C (idx 2)
          const businessName = jsonData[6] ? (jsonData[6][3] || jsonData[6][2] || "") : "";

          // 2. Tabla de Datos (Desde Fila 11 - idx 10)
          // const dataRows = jsonData.slice(10); // Fila 11 en adelante (COMENTADO PORQUE SE REDEFINE ABAJO)

          // --- BÚSQUEDA INTELIGENTE DE COLUMNAS ---
          // Buscamos la fila de cabecera (donde dice "NUM CELULAR" o similar)
          let headerRowIdx = 9; // Por defecto fila 10
          let headers = (jsonData[9] || []) as string[];

          // Si no encontramos "CELULAR" o "TELEFONO" en la fila 10, buscamos en todo el archivo
          if (!headers.some(h => String(h).toUpperCase().includes("CELULAR") || String(h).toUpperCase().includes("TELEFONO") || String(h).toUpperCase().includes("PHONE"))) {
            headerRowIdx = jsonData.findIndex(row => row && row.some((cell: any) => String(cell).toUpperCase().includes("CELULAR") || String(cell).toUpperCase().includes("TELEFONO") || String(cell).toUpperCase().includes("PHONE")));
            if (headerRowIdx !== -1) {
              headers = jsonData[headerRowIdx] as string[];
              console.log(`Cabecera encontrada en fila ${headerRowIdx + 1}`);
            }
          }

          // Mapeo dinámico de índices basado en nombres
          const idxPhone = headers.findIndex(h => {
            const s = String(h).toUpperCase();
            return s.includes("CELULAR") || s.includes("TELEFONO") || s.includes("PHONE");
          });

          const idxPlan = headers.findIndex(h => {
            const s = String(h).toUpperCase();
            // Buscamos "PLAN" pero evitamos "PLAN DE DATA" o "PRECIO PLAN"
            return s === "PLAN" || (s.includes("PLAN") && !s.includes("DATA") && !s.includes("PRECIO"));
          });

          const idxValue = headers.findIndex(h => {
            const s = String(h).toUpperCase();
            // Buscamos "PRECIO PLAN" (sin data) o "VALOR" o "RENTA"
            // EXCLUIMOS explícitamente "PRECIO DE VENTA" porque eso es el costo del equipo, no la renta mensual
            if (s.includes("PRECIO DE VENTA")) return false;

            return (s.includes("PRECIO") && s.includes("PLAN") && !s.includes("DATA")) || s.includes("VALOR") || s.includes("RENTA");
          });

          const idxMonths = headers.findIndex(h => String(h).toUpperCase().includes("MESES"));

          const idxNotes = headers.findIndex(h => String(h).toUpperCase().includes("COMENTARIOS") || String(h).toUpperCase().includes("NOTAS"));

          // Fallbacks (si no encuentra columna, usa los índices fijos que vimos antes)
          const finalIdxPhone = idxPhone !== -1 ? idxPhone : 0;
          const finalIdxPlan = idxPlan !== -1 ? idxPlan : 6;
          const finalIdxValue = idxValue !== -1 ? idxValue : 7; // Ajustado a 7 (Precio Plan)
          const finalIdxMonths = idxMonths !== -1 ? idxMonths : 13;
          const finalIdxNotes = idxNotes !== -1 ? idxNotes : 15;

          console.log("Indices detectados:", { finalIdxPhone, finalIdxPlan, finalIdxValue, finalIdxMonths, finalIdxNotes });

          // 2. Tabla de Datos (Desde Fila siguiente al header)
          const dataRows = jsonData.slice(headerRowIdx + 1);

          const extractedRows = dataRows
            .filter(row => {
              const phone = row[finalIdxPhone];
              // Filtrar filas vacías o sin teléfono válido (mínimo 8 dígitos)
              return phone && String(phone).replace(/[^0-9]/g, '').length >= 8;
            })
            .map(row => {
              const cleanPhone = String(row[finalIdxPhone] || "").replace(/[^0-9]/g, '').slice(-10);

              // Cálculo de Fechas
              let contractEndDate = "";
              const months = parseInt(String(row[finalIdxMonths] || "0").replace(/[^0-9]/g, ''), 10);

              if (months > 0) {
                const startDate = new Date(); // Asumimos hoy como inicio si no hay columna fecha
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + months);
                contractEndDate = endDate.toISOString().split('T')[0];
              }

              return {
                phone: cleanPhone,
                plan: row[finalIdxPlan] || "",
                monthly_value: String(row[finalIdxValue] || "").replace(',', '.'),
                months: row[finalIdxMonths] || "",
                notes: row[finalIdxNotes] || "",
                contract_end_date: contractEndDate,
                line_type: 'NEW' // Valor por defecto
              };
            });

          // 3. Verificar Existencia en BD
          const phonesToCheck = extractedRows.map(r => r.phone);
          checkSubscribersExistence(phonesToCheck).then(() => {
            const initialSaleDate = new Date().toISOString().split('T')[0];
            setActivacionesMetadata({
              ban: String(ban),
              vendor: String(vendor),
              business_name: String(businessName),
              saleDate: initialSaleDate
            });
            setActivacionesRows(extractedRows);
            setShowActivacionesModal(true);
          });

          return; // Detener flujo normal
        }
        // -------------------------------------

        const firstRow = (jsonData[0] || []) as string[];
        setColumns(firstRow);
        setPreview(jsonData.slice(1, 10));

        // Inicializar datos editables para archivos normales también
        setEditableData(jsonData.slice(1));
        setVirtualHeaders(firstRow);

        // Limpiar data transformada si es un archivo normal
        (window as any).__transformedData = null;
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      console.error("Error leyendo archivo:", error);
      alert("Error al procesar el archivo. Asegúrate de que sea un CSV o Excel válido.");
    }
  };

  const handleDrop = (targetField: string) => {
    const draggedCol = dragRef.current;
    if (!draggedCol) return;

    const currentCols = [...columns];
    const colIndex = currentCols.indexOf(draggedCol);
    if (colIndex === -1) return;

    // Solo asignar el mapeo, NO eliminar columnas del preview
    setAssigned((prev) => ({ ...prev, [targetField]: draggedCol }));
    dragRef.current = null;
  };

  const handleDragStart = (col: string) => {
    dragRef.current = col;
  };

  const handleValidate = async () => {
    if (!file) {
      alert("Primero debes cargar un archivo.");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    const validationErrors: string[] = [];

    // Validar campos requeridos
    // TEMPORALMENTE DESHABILITADO PARA DEPURACIÓN DE CACHÉ
    /*
    const requiredFields = [
      "Clientes.name",
      "BANs.ban_number",
      "Suscriptores.phone",
    ];

    for (const field of requiredFields) {
      if (!assigned[field]) {
        const [table, col] = field.split(".");
        validationErrors.push(`Campo requerido no mapeado: ${getFieldLabel(table, col)}`);
      }
    }
    */
    console.log("Validación de campos requeridos omitida en v5.0");

    if (validationErrors.length > 0) {
      setValidationResult({ valid: false, errors: validationErrors });
      setIsValidating(false);
      return;
    }

    // Validar que hay datos en el preview
    if (preview.length === 0) {
      setValidationResult({ valid: false, errors: ["No hay datos para validar en el archivo."] });
      setIsValidating(false);
      return;
    }

    setValidationResult({ valid: true, errors: [] });
    setIsValidating(false);

    // Generar previsualización
    await generatePreview();
  };

  const generatePreview = async () => {
    if (!file) return;

    try {
      // Usar data transformada si existe (para formato de Activaciones)
      let transformedData = null;

      // Priorizar datos editados si existen
      if (editableData.length > 0) {
        const headersToUse = virtualHeaders.length > 0 ? virtualHeaders : columns;
        if (headersToUse.length > 0) {
          transformedData = [headersToUse, ...editableData];
        }
      }

      let headers: string[];
      let rows: any[][];

      if (transformedData) {
        headers = transformedData[0];
        rows = transformedData.slice(1);
      } else {
        // Lectura normal
        const reader = new FileReader();
        const filePromise = new Promise<{ headers: string[], rows: any[][] }>((resolve, reject) => {
          reader.onload = (event) => {
            if (!event.target?.result) return reject("No result");
            const data = new Uint8Array(event.target.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
            const h = (jsonData[0] || []) as string[];
            const r = jsonData.slice(1).filter(row => row.some(cell => cell !== "" && cell !== null));
            resolve({ headers: h, rows: r });
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const result = await filePromise;
        headers = result.headers;
        rows = result.rows;
      }

      // --- VALIDACIÓN DE DATOS FALTANTES ---
      // (Validación de Plazos Faltantes DESACTIVADA - Se asigna automáticamente 0)
      const remainingPaymentsCol = assigned["Suscriptores.remaining_payments"];
      if (remainingPaymentsCol) {
        const colIdx = headers.indexOf(remainingPaymentsCol);
        if (colIdx !== -1) {
          // Auto-asignar 0 a campos vacíos sin mostrar modal
          rows.forEach((row, _idx) => {
            const val = row[colIdx];
            if (val === undefined || val === null || String(val).trim() === "") {
              row[colIdx] = 0;
            }
          });
        }
      }

      // Verificar Fecha Inicio Contrato
      const startDateCol = assigned["Suscriptores.contract_start_date"];
      if (startDateCol) {
        const colIdx = headers.indexOf(startDateCol);
        if (colIdx !== -1) {
          const missingRows: number[] = [];
          rows.forEach((row, idx) => {
            const val = row[colIdx];
            if (val === undefined || val === null || String(val).trim() === "") {
              // Si NO hay fecha por defecto, lo marcamos como faltante
              if (!defaultStartDate) {
                missingRows.push(idx);
              }
            }
          });

          if (missingRows.length > 0) {
            setMissingDataState({
              isOpen: true,
              field: 'Suscriptores.contract_start_date',
              label: 'Fecha Inicio Contrato',
              rows: missingRows,
              data: rows,
              headers: headers
            });
            return; // Detener generación de preview
          }
        }
      }
      // -------------------------------------

      // Obtener campos mapeados
      const mappedFields = Object.entries(assigned).map(([field, columnName]) => {
        const [table, col] = field.split(".");
        return {
          table,
          field: col,
          column: columnName,
          label: getFieldLabel(table, col)
        };
      });

      // Mapear datos completos para simulación
      const mappedData = rows.map((row) => {
        const mapped: Record<string, any> = {};

        // Variables para cálculo de plazos faltantes
        let calcStartDate: string | null = null;
        let calcMonths: number | null = null;

        for (const [field, columnName] of Object.entries(assigned)) {
          const colIndex = headers.indexOf(columnName);
          if (colIndex !== -1) {
            const [table, col] = field.split(".");
            if (!mapped[table]) mapped[table] = {};

            let val = row[colIndex];
            // Inyectar fecha por defecto si falta y está mapeado
            if (field === "Suscriptores.contract_start_date" && (!val || String(val).trim() === "") && defaultStartDate) {
              const parts = defaultStartDate.split('/');
              if (parts.length === 3) {
                val = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              } else {
                val = defaultStartDate;
              }
            }

            // CORRECCIÓN DECIMALES: Reemplazar coma por punto en monthly_value
            if (field === "Suscriptores.monthly_value" && val && typeof val === 'string') {
              val = val.replace(',', '.');
            }

            mapped[table][col] = val || null;

            // Capturar valores para cálculo
            if (field === "Suscriptores.contract_start_date") calcStartDate = val;
            if (field === "Suscriptores.months") calcMonths = parseInt(val, 10);
          }
        }

        // Si NO está asignado pero tenemos defaultStartDate, inyectarlo
        if (!assigned["Suscriptores.contract_start_date"] && defaultStartDate) {
          if (!mapped["Suscriptores"]) mapped["Suscriptores"] = {};
          const parts = defaultStartDate.split('/');
          let finalDate = defaultStartDate;
          if (parts.length === 3) {
            finalDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }
          mapped["Suscriptores"]["contract_start_date"] = finalDate;
          calcStartDate = finalDate;
        }

        // CÁLCULO AUTOMÁTICO DE PLAZOS FALTANTES (remaining_payments)
        // Si tenemos Fecha Inicio y Duración (Meses), calculamos la diferencia contra HOY
        if (calcStartDate && calcMonths && !isNaN(calcMonths)) {
          try {
            const start = new Date(calcStartDate);
            const today = new Date();

            // Calcular fecha fin teórica
            const end = new Date(start);
            end.setMonth(end.getMonth() + calcMonths);

            // Calcular meses restantes con precisión de días
            let remaining = 0;

            // Si ya venció, remaining = 0
            if (end > today) {
              // Calcular diferencia en meses
              const yearDiff = end.getFullYear() - today.getFullYear();
              const monthDiff = end.getMonth() - today.getMonth();
              remaining = yearDiff * 12 + monthDiff;

              // Ajuste por días: si el día de hoy es mayor al día de fin, 
              // significa que ya pasó parte del último mes
              if (today.getDate() > end.getDate()) {
                remaining = Math.max(0, remaining - 1);
              }

              // Asegurar que no sea negativo
              remaining = Math.max(0, remaining);
            }

            // Inyectar en mappedData si no existe o sobrescribir si se desea lógica automática
            if (!mapped["Suscriptores"]) mapped["Suscriptores"] = {};

            // Solo asignamos si no viene explícitamente del Excel (o si el usuario prefiere el cálculo)
            // Asumimos que el cálculo tiene prioridad si se usa la fecha por defecto
            mapped["Suscriptores"]["remaining_payments"] = remaining;

            // También podemos inyectar contract_end_date si el backend lo usa
            mapped["Suscriptores"]["contract_end_date"] = end.toISOString().split('T')[0];

          } catch (e) {
            console.warn("Error calculando plazos faltantes", e);
          }
        }

        return mapped;
      });        // Mapear algunas filas de ejemplo
      const sampleRows = mappedData.slice(0, 5);

      // Validaciones y advertencias locales
      const warnings: string[] = [];
      let rowsWithBAN = 0;
      let rowsWithoutBAN = 0;

      rows.forEach((row, index) => {
        const banIndex = headers.indexOf(assigned["BANs.ban_number"] || "");
        const businessNameIndex = headers.indexOf(assigned["Clientes.business_name"] || "");

        const ban = row[banIndex];
        const businessName = row[businessNameIndex];

        if (ban && ban.toString().trim() !== "") {
          rowsWithBAN++;
        } else {
          rowsWithoutBAN++;
          if (!businessName || businessName.toString().trim() === "") {
            if (warnings.length < 10) {
              warnings.push(`Fila ${index + 2}: Sin BAN ni empresa - será omitida`);
            }
          }
        }
      });

      if (warnings.length >= 10) {
        warnings.push(`... y ${rows.length - 10} filas más con posibles advertencias`);
      }

      // LLAMADA A SIMULACIÓN
      let simulation = undefined;
      try {
        // Procesar en lotes para simulación si es muy grande, pero por ahora enviamos todo
        // Si es muy grande (>1000), podríamos enviar solo una muestra o hacerlo en backend
        const response = await authFetch("/api/importador/simulate", {
          method: "POST",
          json: {
            mapping: assigned,
            data: mappedData,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.report) {
            simulation = result.report;
          }
        }
      } catch (simError) {
        console.error("Error en simulación:", simError);
        warnings.push("No se pudo conectar con el servidor para verificar duplicados (Simulación fallida).");
      }

      setPreviewData({
        totalRows: rows.length,
        sampleRows,
        mappedFields,
        estimatedCreates: simulation ? simulation.newClients : 0,
        estimatedUpdates: simulation ? simulation.updatedClients : 0,
        warnings,
        simulation
      });

      setShowPreviewModal(true);

    } catch (error) {
      console.error("Error generando preview:", error);
      alert("Error al generar la vista previa");
    }
  };

  const handleApplyMissingData = (value: string, applyToAll: boolean) => {
    if (!missingDataState.isOpen) return;

    const { field, rows: targetRows, data, headers } = missingDataState;
    const colName = assigned[field];
    if (!colName) return;

    const colIdx = headers.indexOf(colName);
    if (colIdx === -1) return;

    let currentData = (window as any).__transformedData;
    if (!currentData) {
      // Reconstruir formato hoja de cálculo: [headers, ...rows]
      currentData = [headers, ...data];
    }

    const rowsToUpdate = applyToAll ? targetRows : [targetRows[0]];

    rowsToUpdate.forEach(rowIndex => {
      // currentData[0] son headers. currentData[rowIndex + 1] es la fila.
      if (currentData[rowIndex + 1]) {
        currentData[rowIndex + 1][colIdx] = value;
      }
    });

    // Guardar de nuevo
    (window as any).__transformedData = currentData;

    // Cerrar modal y reintentar generatePreview
    setMissingDataState(prev => ({ ...prev, isOpen: false }));

    setTimeout(() => {
      generatePreview();
    }, 100);
  };

  const handleSave = async (confirmed = false) => {
    if (!file) {
      alert("Primero debes cargar un archivo.");
      return;
    }

    // Validar antes de guardar
    // TEMPORALMENTE DESHABILITADO PARA DEPURACIÓN DE CACHÉ
    /*
    const requiredFields = [
      "Clientes.name",
      "BANs.ban_number",
      "Suscriptores.phone",
    ];

    const missingFields = requiredFields.filter(field => !assigned[field]);
    if (missingFields.length > 0) {
      alert("Por favor, verifica los errores antes de guardar. Faltan campos requeridos.");
      return;
    }
    */
    console.log("Validación de guardado omitida en v5.0");

    // Si no está confirmado, mostrar modal de previsualización
    if (!confirmed) {
      await generatePreview();
      return;
    }

    // Cerrar modal de preview
    setShowPreviewModal(false);
    setIsSaving(true);

    try {
      // Usar data transformada si existe (para formato de Activaciones)
      // Priorizar editableData si existe y tiene datos
      let transformedData = (window as any).__transformedData;

      if (editableData.length > 0) {
        const headersToUse = virtualHeaders.length > 0 ? virtualHeaders : columns;
        if (headersToUse.length > 0) {
          transformedData = [headersToUse, ...editableData];
        }
      }

      let headers: string[];
      let rows: any[][];

      if (transformedData) {
        headers = transformedData[0];
        rows = transformedData.slice(1);
      } else {
        // Lectura normal
        const reader = new FileReader();
        const filePromise = new Promise<{ headers: string[], rows: any[][] }>((resolve, reject) => {
          reader.onload = (event) => {
            if (!event.target?.result) return reject("No result");
            const data = new Uint8Array(event.target.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
            const h = (jsonData[0] || []) as string[];
            const r = jsonData.slice(1);
            resolve({ headers: h, rows: r });
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const result = await filePromise;
        headers = result.headers;
        rows = result.rows;
      }

      // Mapear los datos según el mapeo asignado
      const mappedData = rows.map((row) => {
        const mapped: Record<string, any> = {};
        let calcStartDate: string | null = null;
        let calcMonths: number | null = null;

        for (const [field, columnName] of Object.entries(assigned)) {
          const colIndex = headers.indexOf(columnName);
          if (colIndex !== -1) {
            const [table, col] = field.split(".");
            if (!mapped[table]) mapped[table] = {};

            let val = row[colIndex];
            // Inyectar fecha por defecto si falta y está mapeado
            if (field === "Suscriptores.contract_start_date" && (!val || String(val).trim() === "") && defaultStartDate) {
              const parts = defaultStartDate.split('/');
              if (parts.length === 3) {
                val = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              } else {
                val = defaultStartDate;
              }
            }

            mapped[table][col] = val || null;

            // Capturar para cálculo
            if (field === "Suscriptores.contract_start_date") calcStartDate = val;
            if (field === "Suscriptores.months") calcMonths = parseInt(val, 10);
          }
        }

        // Si NO está asignado pero tenemos defaultStartDate, inyectarlo
        if (!assigned["Suscriptores.contract_start_date"] && defaultStartDate) {
          if (!mapped["Suscriptores"]) mapped["Suscriptores"] = {};
          const parts = defaultStartDate.split('/');
          let finalDate = defaultStartDate;
          if (parts.length === 3) {
            finalDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }
          mapped["Suscriptores"]["contract_start_date"] = finalDate;
          calcStartDate = finalDate;
        }

        // Calcular Fecha Fin
        if (calcMonths && calcMonths > 0 && calcStartDate) {
          try {
            const startDate = new Date(calcStartDate);
            if (!isNaN(startDate.getTime())) {
              const endDate = new Date(startDate);
              endDate.setMonth(endDate.getMonth() + calcMonths);
              const endStr = endDate.toISOString().split('T')[0];
              if (!mapped["Suscriptores"]) mapped["Suscriptores"] = {};
              mapped["Suscriptores"]["contract_end_date"] = endStr;
            }
          } catch (e) { console.warn("Error fecha fin", e); }
        }

        return mapped;
      });

      if (mappedData.length === 0) {
        alert("⚠️ No hay datos válidos para guardar. Verifica que el archivo no esté vacío y que las columnas estén mapeadas correctamente.");
        setIsSaving(false);
        return;
      }

      // Procesar en lotes pequeños para evitar Timeouts (504)
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(mappedData.length / BATCH_SIZE);

      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors: string[] = [];
      let totalWarnings: string[] = [];

      // Variable para mostrar progreso en UI (podrías agregar un estado para esto)
      console.log(`Iniciando importación de ${mappedData.length} filas en ${totalBatches} lotes...`);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, mappedData.length);
        const batch = mappedData.slice(start, end);

        // Actualizar mensaje de estado si tuvieras uno
        // setStatusMessage(`Procesando lote ${i + 1} de ${totalBatches}...`);

        try {
          const response = await authFetch("/api/importador/save", {
            method: "POST",
            json: {
              mapping: assigned,
              data: batch,
            },
          });

          if (!response.ok) {
            // Si falla un lote, registrar error pero intentar continuar o abortar según gravedad
            console.error(`Error en lote ${i + 1}: ${response.statusText}`);
            totalErrors.push(`Error crítico en lote ${i + 1}: ${response.statusText}`);
            continue;
          }

          const result = await response.json();

          // Acumular resultados
          totalCreated += (result.created || 0);
          totalUpdated += (result.updated || 0);

          if (result.errors && Array.isArray(result.errors)) {
            result.errors.forEach((msg: string) => {
              if (msg.includes("ya existe") || msg.includes("ℹ️")) {
                totalWarnings.push(msg);
              } else {
                totalErrors.push(msg);
              }
            });
          }

        } catch (batchError: any) {
          console.error(`Excepción en lote ${i + 1}:`, batchError);
          totalErrors.push(`Error de red en lote ${i + 1}: ${batchError.message}`);
        }
      }

      // Construir resultado final agregado
      const totalProcessed = totalCreated + totalUpdated;
      const omitted = mappedData.length - totalProcessed;

      // Mostrar resultado en modal personalizado
      setSaveResult({
        success: totalErrors.length === 0,
        message: `Proceso completado. Procesadas ${mappedData.length} filas.`,
        created: totalCreated,
        updated: totalUpdated,
        total: mappedData.length,
        omitted: omitted,
        errors: totalErrors,
        warnings: totalWarnings
      });

      // Disparar evento para refrescar clientes en otras páginas
      if (totalCreated > 0 || totalUpdated > 0) {
        window.dispatchEvent(new CustomEvent('refreshClients'));
        window.dispatchEvent(new CustomEvent('clients-updated'));
      }

      // Limpiar estado solo si no hay errores críticos masivos
      if (totalErrors.length > 0 && totalCreated === 0 && totalUpdated === 0) {
        // No limpiar si falló todo
      } else {
        setFile(null);
        setColumns([]);
        setPreview([]);
        setAssigned({});
        setValidationResult(null);
      }

    } catch (error: any) {
      console.error("Error procesando archivo:", error);
      alert(`Error: ${error.message || "Error desconocido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivacionRowChange = (index: number, field: string, value: string) => {
    const newRows = [...activacionesRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setActivacionesRows(newRows);
  };

  const handleSaleDateChange = (newDate: string) => {
    setActivacionesMetadata(prev => ({ ...prev, saleDate: newDate }));

    // Recalcular fechas de fin de contrato
    const newRows = activacionesRows.map(row => {
      let contractEndDate = row.contract_end_date;
      const months = parseInt(String(row.months || "0").replace(/[^0-9]/g, ''), 10);

      if (months > 0 && newDate) {
        const startDate = new Date(newDate);
        // Ajustar zona horaria para evitar desfases
        const userTimezoneOffset = startDate.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(startDate.getTime() + userTimezoneOffset);

        const endDate = new Date(adjustedDate);
        endDate.setMonth(endDate.getMonth() + months);
        contractEndDate = endDate.toISOString().split('T')[0];
      }
      return { ...row, contract_end_date: contractEndDate };
    });
    setActivacionesRows(newRows);
  };

  const saveActivaciones = async () => {
    if (!activacionesRows.length) return;
    const validationErrors: string[] = [];

    if (!activacionesMetadata.saleDate) validationErrors.push("La fecha de venta es obligatoria.");
    if (!activacionesMetadata.ban.trim()) validationErrors.push("Número BAN requerido.");
    if (!activacionesMetadata.business_name.trim()) validationErrors.push("Empresa/cliente es obligatorio.");
    if (!activacionesMetadata.vendor.trim()) validationErrors.push("Selecciona un vendedor.");

    if (activacionesMetadata.vendor && !vendors.some(v => v.id.toString() === activacionesMetadata.vendor)) {
      validationErrors.push("El vendedor seleccionado no existe en el catálogo.");
    }

    activacionesRows.forEach((row, idx) => {
      const cleanPhone = String(row.phone || '').replace(/[^0-9]/g, '');
      if (!cleanPhone || cleanPhone.length < 8) validationErrors.push(`Fila ${idx + 1}: teléfono inválido (mínimo 8 dígitos).`);
      if (!row.plan || !String(row.plan).trim()) validationErrors.push(`Fila ${idx + 1}: plan requerido.`);
      if (row.monthly_value === undefined || row.monthly_value === null || String(row.monthly_value).toString().trim() === "") {
        validationErrors.push(`Fila ${idx + 1}: valor mensual requerido.`);
      }
    });

    if (validationErrors.length > 0) {
      setActivacionesErrors(validationErrors);
      return;
    }

    setActivacionesErrors([]);
    setIsSaving(true);
    try {
      // Construir payload compatible con el backend
      const payload = activacionesRows.map(row => ({
        "BANs": {
          "ban_number": activacionesMetadata.ban,
          "status": "activo"
        },
        "Clientes": {
          "business_name": activacionesMetadata.business_name, // Mapeado a Empresa
          "vendor_id": parseInt(activacionesMetadata.vendor), // ID del vendedor (INTEGER)
          "name": activacionesMetadata.business_name // Fallback
        },
        "Suscriptores": {
          "phone": row.phone,
          "service_type": row.plan,
          "monthly_value": row.monthly_value,
          "months": row.months,
          "notes": row.notes,
          "contract_start_date": activacionesMetadata.saleDate,
          "contract_end_date": row.contract_end_date,
          "line_type": row.line_type || 'NEW',
          "status": "activo"
        }
      }));

      // Enviar en lotes
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(payload.length / BATCH_SIZE);
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors: string[] = [];
      let allCreatedClients: any[] = [];

      for (let i = 0; i < totalBatches; i++) {
        const batch = payload.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const res = await authFetch('/api/importador/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: batch })
        });

        if (!res.ok) {
          const err = await res.json();
          totalErrors.push(`Lote ${i + 1}: ${err.error || "Error desconocido"}`);
        } else {
          const json = await res.json();
          totalCreated += json.created || 0;
          totalUpdated += json.updated || 0;
          if (json.errors) totalErrors.push(...json.errors);
          if (json.details && json.details.createdClients) {
            allCreatedClients.push(...json.details.createdClients);
          }
        }
      }

      // Filtrar clientes únicos creados
      const uniqueCreatedClients = Array.from(new Map(allCreatedClients.map(item => [item.id, item])).values());

      if (uniqueCreatedClients.length > 0) {
        setNewClientsToEnrich(uniqueCreatedClients);
        setCurrentEnrichIndex(0);
        setEnrichFormData({ email: '', address: '', city: '', phone: '' });
        setEnrichModalOpen(true);
        setShowActivacionesModal(false); // Cerrar modal de activaciones pero mantener el flujo
        return; // Detener aquí para procesar enriquecimiento
      }

      setSaveResult({
        success: totalErrors.length === 0,
        created: totalCreated,
        updated: totalUpdated,
        errors: totalErrors,
        total: payload.length
      });
      setShowActivacionesModal(false);

    } catch (error: any) {
      console.error("Error guardando activaciones:", error);
      alert("Error guardando: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrichSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentClient = newClientsToEnrich[currentEnrichIndex];

    try {
      // 1. Verificar que el cliente existe antes de actualizar
      const checkRes = await authFetch(`/api/clients/${currentClient.id}`);
      if (!checkRes.ok) {
        console.warn(`⚠️ Cliente ${currentClient.id} no existe. Saltando enriquecimiento.`);
        // Siguiente o Finalizar sin actualizar
        if (currentEnrichIndex < newClientsToEnrich.length - 1) {
          setCurrentEnrichIndex(prev => prev + 1);
          setEnrichFormData({ email: '', address: '', city: '', phone: '' });
          return;
        } else {
          setEnrichModalOpen(false);
          setSaveResult({
            success: true,
            message: "Importación completada (algunos clientes no pudieron enriquecerse).",
            created: newClientsToEnrich.length,
            updated: 0,
            total: newClientsToEnrich.length
          });
          window.dispatchEvent(new CustomEvent('refreshClients'));
          return;
        }
      }

      // 2. Actualizar Cliente
      const resClient = await authFetch(`/api/clients/${currentClient.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          email: enrichFormData.email,
          address: enrichFormData.address,
          city: enrichFormData.city,
          phone: enrichFormData.phone
        })
      });

      if (!resClient.ok) {
        const err = await resClient.json();
        throw new Error(`Error actualizando cliente: ${err.error || resClient.statusText}`);
      }

      // NOTA: Se eliminó la creación automática de Referido/Venta por solicitud del usuario.
      // Solo se actualizan los datos del cliente en el CRM.

      // Siguiente o Finalizar
      if (currentEnrichIndex < newClientsToEnrich.length - 1) {
        setCurrentEnrichIndex(prev => prev + 1);
        setEnrichFormData({ email: '', address: '', city: '', phone: '' });
      } else {
        setEnrichModalOpen(false);
        setSaveResult({
          success: true,
          message: "Importación y enriquecimiento completados exitosamente.",
          created: newClientsToEnrich.length,
          updated: 0,
          total: newClientsToEnrich.length
        });
        // Disparar eventos de actualización
        window.dispatchEvent(new CustomEvent('refreshClients'));
      }

    } catch (error) {
      console.error("Error enriqueciendo cliente:", error);
      alert("Error al guardar datos adicionales. Intenta de nuevo.");
    }
  };

  return (
    <div className="p-4 bg-neutral-950 min-h-screen text-gray-100 overflow-auto">

      {/* MODAL DE ENRIQUECIMIENTO */}
      {enrichModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 shadow-2xl w-full max-w-md p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Completar Datos del Cliente</h2>
              <p className="text-sm text-gray-400">
                Cliente {currentEnrichIndex + 1} de {newClientsToEnrich.length}: <span className="text-amber-400 font-bold">{newClientsToEnrich[currentEnrichIndex]?.name || newClientsToEnrich[currentEnrichIndex]?.business_name}</span>
              </p>
            </div>

            <form onSubmit={handleEnrichSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={enrichFormData.email}
                  onChange={e => setEnrichFormData({ ...enrichFormData, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Teléfono Contacto</label>
                <input
                  type="text"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={enrichFormData.phone}
                  onChange={e => setEnrichFormData({ ...enrichFormData, phone: e.target.value })}
                  placeholder="Ej. 3001234567"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Dirección</label>
                  <input
                    type="text"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={enrichFormData.address}
                    onChange={e => setEnrichFormData({ ...enrichFormData, address: e.target.value })}
                    placeholder="Calle 123..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Ciudad</label>
                  <input
                    type="text"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={enrichFormData.city}
                    onChange={e => setEnrichFormData({ ...enrichFormData, city: e.target.value })}
                    placeholder="Bogotá..."
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {currentEnrichIndex < newClientsToEnrich.length - 1 ? 'Guardar y Siguiente' : 'Finalizar Importación'}
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-neutral-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-4 border border-neutral-600 shadow-lg mb-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <p className="text-base text-gray-200 font-medium hidden sm:block">
              Subí tu archivo <span className="text-xs text-amber-400 ml-2 font-bold">v5.1.68-NO-REFERIDO</span>
            </p>
            <p className="text-[10px] text-gray-500 hidden sm:block">
              * VALIDACIONES DESACTIVADAS
            </p>
            <button
              onClick={() => {
                if (!isActivacionesMode) {
                  if (window.confirm("¿Estás seguro de activar el MODO ACTIVACIONES?\n\nEste modo usa un formato estricto para archivos de activaciones.\nAsegúrate de que el archivo cumple con la estructura esperada.")) {
                    setIsActivacionesMode(true);
                  }
                } else {
                  setIsActivacionesMode(false);
                }
              }}
              className={`text-[10px] px-2 py-0.5 rounded border mt-1 transition-colors ${isActivacionesMode
                  ? "bg-blue-900 text-blue-200 border-blue-700 hover:bg-blue-800"
                  : "bg-neutral-700 text-gray-400 border-neutral-600 hover:bg-neutral-600"
                }`}
            >
              {isActivacionesMode ? "📋 Modo Activaciones: ON" : "📄 Modo Activaciones: OFF"}
            </button>
          </div>
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="bg-amber-500 hover:bg-amber-400 text-black font-semibold py-1.5 px-4 text-sm rounded-lg shadow-md transition-all">
              Seleccionar Archivo
            </span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadExcelColumns}
            disabled={isLoadingExcelColumns}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-xs text-white py-1 px-2 rounded border border-purple-500"
            title="Cargar columnas desde el Excel base"
          >
            {isLoadingExcelColumns ? "⏳ Cargando..." : "📊 Ver Columnas Excel"}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-neutral-700 hover:bg-neutral-600 text-xs text-gray-300 py-1 px-2 rounded border border-neutral-600"
            title="Recargar página para borrar caché"
          >
            🔄 Recargar
          </button>
          {file && <p className="text-sm text-amber-300 font-medium truncate max-w-[150px]">📄 {file?.name}</p>}
        </div>
      </div>

      {excelColumnsInfo && unmappedColumns && unmappedColumns.length > 0 && (
        <div className="bg-red-950/60 border-4 border-red-600 rounded-lg p-6 mb-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-black text-red-300 flex items-center gap-2">
              ⚠️ {unmappedColumns.length} COLUMNAS NO MAPEADAS
            </h3>
            <button
              onClick={() => setExcelColumnsInfo(null)}
              className="text-red-400 hover:text-red-200 text-sm font-bold bg-red-900/50 px-3 py-1 rounded border border-red-600"
            >
              ✕ Cerrar
            </button>
          </div>
          <p className="text-red-200 text-sm mb-4">
            Archivo: <span className="font-bold">{excelColumnsInfo.fileName}</span> |
            Total columnas: <span className="font-bold">{excelColumnsInfo.totalColumns}</span> |
            Mapeadas: <span className="font-bold text-green-400">{excelColumnsInfo.totalColumns - unmappedColumns.length}</span> |
            Sin mapear: <span className="font-bold text-red-400">{unmappedColumns.length}</span>
          </p>
          <div className="mb-4">
            <h4 className="text-red-300 font-bold mb-3 text-lg">📋 Arrastra estas columnas a los campos de la derecha:</h4>
            <div className="flex flex-wrap gap-2">
              {unmappedColumns.map((col, idx) => (
                <motion.span
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(col)}
                  whileHover={{ scale: 1.1 }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-red-800 text-red-100 border-2 border-red-500 cursor-grab active:cursor-grabbing hover:bg-red-700 shadow-lg"
                >
                  {col}
                </motion.span>
              ))}
            </div>
          </div>
          {excelColumnsInfo.sampleRows && excelColumnsInfo.sampleRows.length > 0 && (
            <div className="mt-4">
              <h4 className="text-red-300 font-semibold mb-2">📊 Vista previa de datos (primeras 5 filas):</h4>
              <div className="overflow-x-auto border-2 border-red-600 rounded-lg">
                <table className="min-w-full text-sm text-gray-200 border-collapse">
                  <thead className="bg-red-900">
                    <tr>
                      {unmappedColumns.map((col, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-left border border-red-700 text-red-100 font-bold"
                        >
                          <motion.div
                            draggable
                            onDragStart={() => handleDragStart(col)}
                            whileHover={{ scale: 1.05 }}
                            className="flex items-center justify-between cursor-grab active:cursor-grabbing"
                          >
                            {col}
                            <span className="text-xs bg-red-700 px-2 py-1 rounded ml-2">⇅ Arrastrar</span>
                          </motion.div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelColumnsInfo.sampleRows.map((row: any, rowIdx: number) => (
                      <tr key={rowIdx} className="hover:bg-red-900/30 border-b border-red-800">
                        {unmappedColumns.map((col, colIdx) => (
                          <td key={colIdx} className="px-4 py-2 border border-red-800 text-gray-100">
                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {excelColumnsInfo && unmappedColumns && unmappedColumns.length === 0 && (
        <div className="bg-green-900/60 border-4 border-green-500 rounded-lg p-6 mb-6 text-center">
          <p className="text-green-200 font-bold text-xl">✅ Todas las columnas están mapeadas</p>
          <p className="text-green-100 text-sm mt-2">Puedes proceder a verificar y guardar los datos</p>
          <button
            onClick={() => setExcelColumnsInfo(null)}
            className="mt-4 text-green-400 hover:text-green-200 text-sm font-bold bg-green-800/50 px-3 py-1 rounded border border-green-600"
          >
            ✕ Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        {fields.map((table) => (
          <div
            key={table.table}
            className="bg-neutral-800 border border-amber-500 rounded-lg shadow-md p-3"
          >
            <h2 className="text-lg font-semibold text-amber-400 mb-2 border-b border-amber-500 pb-1">
              {table.table}
            </h2>
            <ul className="space-y-1">
              {table.columns.map((col) => (
                <li
                  key={col}
                  className={`text-xs border rounded-md p-1.5 text-center transition-all cursor-pointer select-none ${assigned[`${table.table}.${col}`]
                    ? "bg-green-600 border-green-400 text-white"
                    : "bg-neutral-900 border-neutral-700 hover:bg-amber-500/20 text-white"
                    }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(`${table.table}.${col}`)}
                >
                  {getFieldLabel(table.table, col)}
                  {assigned[`${table.table}.${col}`] && (
                    <span className="block text-[10px] mt-0.5 text-amber-300 truncate">
                      ← {assigned[`${table.table}.${col}`] || ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Configuración de Fechas */}
      {file && (
        <div className="bg-neutral-800 rounded-lg p-4 mb-6 border border-neutral-600">
          <h3 className="text-lg font-semibold text-white mb-3">📅 Configuración de Fechas (Opcional)</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <label className="block text-sm text-gray-400 mb-1">
                Fecha Inicio Contrato por defecto
              </label>
              <input
                type="text"
                placeholder="MM/DD/AAAA (Auto)"
                value={defaultStartDate}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                  if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5);
                  if (val.length > 10) val = val.slice(0, 10);
                  setDefaultStartDate(val);
                }}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato: MM/DD/AAAA (Mes/Día/Año). Ej: 12/31/2025. Se usará si falta la fecha.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      {file && (
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={handleValidate}
            disabled={isValidating || isSaving || preview.length === 0}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all"
          >
            {isValidating ? "Verificando..." : "🔍 Verificar Errores"}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || isValidating || preview.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all"
          >
            {isSaving ? "Guardando..." : "💾 Guardar Datos"}
          </button>
        </div>
      )}

      {/* Mostrar errores de validación */}
      {validationResult && !validationResult.valid && validationResult.errors.length > 0 && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-4 mb-6">
          <h3 className="text-red-200 font-semibold mb-2">❌ Errores encontrados:</h3>
          <ul className="list-disc list-inside text-red-100 text-sm space-y-1">
            {validationResult.errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mostrar éxito de validación */}
      {validationResult && validationResult.valid && (
        <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-4 mb-6">
          <p className="text-green-200 font-semibold">✅ Validación exitosa. Puedes proceder a guardar los datos.</p>
        </div>
      )}

      {preview.length > 0 && (() => {
        // Obtener todas las columnas asignadas
        const assignedColumns = Object.values(assigned);
        // Filtrar columnas que NO están asignadas
        const unassignedColumns = columns.filter(col => !assignedColumns.includes(col));
        // Obtener índices de las columnas no asignadas
        const unassignedIndices = columns.map((col, idx) => assignedColumns.includes(col) ? -1 : idx).filter(idx => idx !== -1);

        return (
          <div className="space-y-4">
            {unassignedColumns.length === 0 && (
              <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-6 text-center">
                <p className="text-green-200 font-semibold text-lg">✅ Todas las columnas han sido mapeadas</p>
                <p className="text-green-100 text-sm mt-2">Puedes proceder a verificar y guardar los datos</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Vista Previa de Datos ({unassignedColumns.length === 0 ? "Todas las columnas mapeadas" : "Columnas sin mapear"}):
              </h3>
              <table className="min-w-full text-sm text-gray-200 border border-neutral-700 rounded-md">
                <thead className="bg-neutral-800">
                  <tr>
                    {/* Mostrar TODAS las columnas si todo está mapeado, o solo las no asignadas si faltan */}
                    {(unassignedColumns.length === 0 ? columns : unassignedColumns).map((col, i) => (
                      <th
                        key={i}
                        className="px-3 py-2 text-left border border-neutral-700 text-amber-300"
                      >
                        <motion.div
                          draggable
                          onDragStart={() => handleDragStart(col)}
                          whileHover={{ scale: 1.05 }}
                          className={`flex items-center justify-between px-3 py-1 rounded-md cursor-grab select-none shadow-md ${assignedColumns.includes(col)
                              ? "bg-green-700 hover:bg-green-600 text-white"
                              : "bg-blue-700 hover:bg-blue-500 text-white"
                            }`}
                        >
                          {col}
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md ml-2">
                            ⇅ Arrastrar
                          </span>
                        </motion.div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, rIndex) => (
                    <tr key={rIndex} className="hover:bg-neutral-700/30">
                      {(unassignedColumns.length === 0 ? columns.map((_, idx) => idx) : unassignedIndices).map((colIndex, cIndex) => (
                        <td
                          key={cIndex}
                          className="px-3 py-2 border border-neutral-700 text-gray-100"
                        >
                          {row[colIndex] !== undefined ? row[colIndex] : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {!preview.length && (
        <p className="text-center text-gray-400 italic">
          No se ha cargado ningún archivo o no se detectaron filas válidas.
        </p>
      )}

      {/* Modal de Vista Previa */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-white">Vista Previa de Importación</h2>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Resumen de Simulación */}
              <div className="bg-neutral-800/50 rounded-xl border border-neutral-700 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Resumen Estimado (Simulación)</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-800 text-center">
                    <div className="text-3xl font-bold text-blue-400 mb-1">{previewData.totalRows}</div>
                    <div className="text-sm text-gray-400 font-medium">Filas Totales</div>
                  </div>

                  <div className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-800 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{previewData.simulation?.disponibles || 0}</div>
                    <div className="text-sm text-gray-400 font-medium">Disponibles (con empresa)</div>
                  </div>

                  <div className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-800 text-center">
                    <div className="text-2xl font-bold text-amber-400 mb-1">{previewData.simulation?.incompletos || 0}</div>
                    <div className="text-sm text-gray-400 font-medium">Incompletos (sin empresa)</div>
                  </div>

                  <div className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-800 text-center">
                    <div className="text-2xl font-bold text-red-400 mb-1">{previewData.simulation?.cancelados || 0}</div>
                    <div className="text-sm text-gray-400 font-medium">Cancelados (STATUS=C)</div>
                  </div>
                </div>
              </div>

              {/* Tabla Detallada */}
              {editableData.length > 0 && (
                <div className="bg-neutral-800/50 rounded-xl border border-neutral-700 overflow-hidden">
                  <div className="p-4 border-b border-neutral-700 bg-neutral-800">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-400" />
                      Detalle de Registros a Importar (Editable)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-neutral-900/50">
                        <tr>
                          {/* Renderizado dinámico de cabeceras */}
                          {(virtualHeaders.length > 0 ? virtualHeaders : columns).map((header, i) => (
                            <th key={i} className="px-4 py-3 whitespace-nowrap">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-700">
                        {editableData.slice(0, 100).map((row: any[], idx: number) => {
                          const handleEdit = (colIndex: number, value: string) => {
                            const newData = [...editableData];
                            newData[idx] = [...newData[idx]];
                            newData[idx][colIndex] = value;
                            setEditableData(newData);
                          };

                          // Renderizado genérico para archivos normales
                          return (
                            <tr key={idx} className="hover:bg-neutral-700/30 transition-colors">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-4 py-2 border-r border-neutral-800 last:border-0">
                                  <input
                                    type="text"
                                    value={cell || ''}
                                    onChange={(e) => handleEdit(cellIdx, e.target.value)}
                                    className="bg-transparent border-b border-transparent hover:border-gray-500 focus:border-blue-500 outline-none w-full min-w-[100px]"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {editableData.length > 100 && (
                      <div className="p-3 text-center text-xs text-gray-500 bg-neutral-900/30">
                        Mostrando primeros 100 registros de {editableData.length}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Advertencias */}
              {previewData.warnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
                  <h3 className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Advertencias ({previewData.warnings.length})
                  </h3>
                  <ul className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {previewData.warnings.map((warning, idx) => (
                      <li key={idx} className="text-yellow-200/80 text-sm flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500/50 shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex justify-end gap-3">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-6 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-neutral-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmar Importación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Datos Faltantes */}
      {missingDataState.isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border-2 border-yellow-500 rounded-lg shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">
              ⚠️ Datos Faltantes Detectados
            </h2>
            <p className="text-white mb-4">
              Se detectaron <strong>{missingDataState.rows.length}</strong> filas sin valor en el campo:
              <br />
              <span className="text-blue-400 font-mono">{missingDataState.label}</span>
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Valor para asignar:
              </label>
              <input
                type="text"
                value={missingDataValue}
                onChange={(e) => {
                  let val = e.target.value;
                  // Auto-formato fecha si el campo es de fecha
                  if (missingDataState.field.includes('date')) {
                    val = val.replace(/[^0-9]/g, '');
                    if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                    if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5);
                    if (val.length > 10) val = val.slice(0, 10);
                  }
                  setMissingDataValue(val);
                }}
                className="w-full bg-neutral-800 border border-neutral-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                placeholder={missingDataState.field.includes('date') ? "MM/DD/AAAA" : "Ej: 0, 12..."}
              />
            </div>

            <div className="mb-6 flex items-center">
              <input
                type="checkbox"
                id="applyAll"
                checked={missingDataApplyAll}
                onChange={(e) => setMissingDataApplyAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-600 ring-offset-gray-800"
              />
              <label htmlFor="applyAll" className="ml-2 text-sm text-gray-300">
                Aplicar a todos los vacíos ({missingDataState.rows.length})
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMissingDataState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleApplyMissingData(missingDataValue, missingDataApplyAll)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded shadow-md transition-colors"
              >
                Aplicar Corrección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resultados */}
      {/* MODAL DE ACTIVACIONES (NUEVO) */}
      {showActivacionesModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-blue-500 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">

            {/* Header Modal */}
            <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                  📋 Importación de Activaciones
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Verifica los datos antes de importar. <span className="text-green-400">Verde = Nuevo</span>, <span className="text-blue-400">Azul = Actualización</span>
                </p>
              </div>
              <button onClick={() => setShowActivacionesModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {activacionesErrors.length > 0 && (
                <div className="bg-red-900/40 border border-red-600 text-red-100 rounded-lg p-4">
                  <p className="font-semibold text-red-200">Corrige antes de guardar:</p>
                  <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                    {activacionesErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 1. Metadatos Editables */}
              <div className="grid grid-cols-4 gap-4 bg-neutral-800 p-4 rounded-lg border border-neutral-700">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fecha de Venta (Inicio)</label>
                  <input
                    type="date"
                    min="2020-01-01"
                    max="2030-12-31"
                    value={activacionesMetadata.saleDate}
                    onChange={e => handleSaleDateChange(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Número BAN</label>
                  <input
                    value={activacionesMetadata.ban}
                    onChange={e => setActivacionesMetadata({ ...activacionesMetadata, ban: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs text-gray-400 mb-1">Empresa (Cliente)</label>
                  <input
                    value={activacionesMetadata.business_name}
                    onChange={e => setActivacionesMetadata({ ...activacionesMetadata, business_name: e.target.value })}
                    onFocus={() => {
                      if (clientSuggestions.length > 0) setShowClientSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay hiding to allow click on suggestion
                      setTimeout(() => setShowClientSuggestions(false), 200);
                    }}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Buscar por Nombre o BAN..."
                  />
                  {isSearchingClients && (
                    <div className="absolute right-2 top-8">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    </div>
                  )}
                  {showClientSuggestions && (
                    <div className="absolute z-[100] w-full bg-neutral-800 border border-neutral-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                      {clientSuggestions.length === 0 && !isSearchingClients && activacionesMetadata.business_name.length >= 2 && (
                        <div className="px-3 py-2 text-sm text-gray-400 italic">No se encontraron resultados</div>
                      )}
                      {clientSuggestions.map((client) => (
                        <div
                          key={client.id}
                          className="px-3 py-2 hover:bg-neutral-700 cursor-pointer text-sm text-gray-200 border-b border-neutral-700 last:border-0"
                          onClick={() => handleSelectClient(client)}
                        >
                          <div className="font-medium text-amber-400">{client.business_name}</div>
                          {client.ban_number && <div className="text-xs text-blue-300">BAN: {client.ban_number}</div>}
                          {client.name && client.name !== client.business_name && <div className="text-xs text-gray-500">{client.name}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vendedor</label>
                  <select
                    value={activacionesMetadata.vendor}
                    onChange={e => setActivacionesMetadata({ ...activacionesMetadata, vendor: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Seleccionar Vendedor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Tabla de Datos */}
              <div className="border border-neutral-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-800 text-gray-300 font-medium">
                    <tr>
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Teléfono</th>
                      <th className="px-4 py-2">Plan</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Meses</th>
                      <th className="px-4 py-2">Fin Contrato</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Estado BD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {activacionesRows.map((row, idx) => {
                      const exists = existingPhones.has(row.phone);
                      const rowClass = exists
                        ? "bg-blue-900/20 text-blue-200 hover:bg-blue-900/30"
                        : "bg-green-900/20 text-green-200 hover:bg-green-900/30";

                      return (
                        <tr key={idx} className={rowClass}>
                          <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <input
                              value={row.phone}
                              onChange={(e) => handleActivacionRowChange(idx, 'phone', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-500 focus:border-white outline-none w-full font-mono font-bold"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.plan}
                              onChange={(e) => handleActivacionRowChange(idx, 'plan', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-500 focus:border-white outline-none w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.monthly_value}
                              onChange={(e) => handleActivacionRowChange(idx, 'monthly_value', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-500 focus:border-white outline-none w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.months}
                              onChange={(e) => handleActivacionRowChange(idx, 'months', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-500 focus:border-white outline-none w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.contract_end_date}
                              onChange={(e) => handleActivacionRowChange(idx, 'contract_end_date', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-500 focus:border-white outline-none w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.line_type || 'NEW'}
                              onChange={(e) => handleActivacionRowChange(idx, 'line_type', e.target.value)}
                              className="bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm focus:border-white outline-none w-full"
                            >
                              <option value="NEW">Nueva</option>
                              <option value="REN">Renovación</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            {exists
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-900 text-blue-300 text-xs border border-blue-700">Actualizar</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-900 text-green-300 text-xs border border-green-700">Nuevo</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex justify-end gap-3">
              <button
                onClick={() => setShowActivacionesModal(false)}
                className="px-4 py-2 rounded-lg border border-neutral-600 text-gray-300 hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveActivaciones}
                disabled={isSaving}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                Confirmar e Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {saveResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border-2 border-blue-500 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700">
              <h2 className="text-2xl font-bold text-white">
                {saveResult.success ? "✅ Resultado del Guardado" : "⚠️ Errores al Guardar"}
              </h2>
              <button
                onClick={() => setSaveResult(null)}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Resumen */}
              <div className="mb-6 p-4 bg-neutral-800 rounded-lg border border-neutral-700">
                <p className="text-white text-lg mb-2">{saveResult.message}</p>
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">{saveResult.total || 0}</div>
                    <div className="text-sm text-gray-400">Total Procesadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{saveResult.created || 0}</div>
                    <div className="text-sm text-gray-400">Nuevos Creados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-400">{saveResult.updated || 0}</div>
                    <div className="text-sm text-gray-400">Actualizados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-400">{saveResult.omitted || 0}</div>
                    <div className="text-sm text-gray-400">Filas Omitidas</div>
                  </div>
                </div>

                {/* Botón de Exportar Errores */}
                {((saveResult.errors && saveResult.errors.length > 0) || (saveResult.warnings && saveResult.warnings.length > 0)) && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => {
                        const errorRows = (saveResult.errors || []).map(e => ({ Tipo: 'ERROR', Mensaje: e }));
                        const warningRows = (saveResult.warnings || []).map(w => ({ Tipo: 'ADVERTENCIA', Mensaje: w }));
                        const allRows = [...errorRows, ...warningRows];

                        const ws = XLSX.utils.json_to_sheet(allRows);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Errores_Importacion");
                        XLSX.writeFile(wb, `Errores_Importacion_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition-colors"
                    >
                      📥 Descargar Reporte de Errores y Advertencias
                    </button>
                  </div>
                )}
              </div>

              {/* Explicación de filas omitidas */}
              {saveResult.omitted && saveResult.omitted > 0 && (
                <div className="mb-6 p-4 bg-orange-900/30 border border-orange-500/50 rounded-lg">
                  <h3 className="text-orange-400 font-semibold mb-2">📝 Filas Omitidas ({saveResult.omitted}):</h3>
                  <p className="text-orange-100 text-sm mb-2">Las siguientes filas no se importaron por:</p>
                  <ul className="text-orange-100 text-sm space-y-1 list-disc list-inside">
                    <li>Falta BAN y falta nombre de empresa</li>
                    <li>BAN inválido (no numérico o vacío)</li>
                    <li>Falta teléfono del suscriptor cuando hay BAN</li>
                    <li>Filas vacías o con datos incompletos</li>
                  </ul>
                </div>
              )}

              {/* Advertencias */}
              {saveResult.warnings && saveResult.warnings.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-3">
                    ℹ️ Advertencias informativas ({saveResult.warnings.length}):
                  </h3>
                  <div className="bg-neutral-800 rounded-lg border border-yellow-500/30 p-4 max-h-60 overflow-y-auto">
                    <ul className="space-y-1 text-sm">
                      {saveResult.warnings.slice(0, 20).map((warning, index) => (
                        <li key={index} className="text-yellow-200 p-1 border-b border-neutral-700 last:border-0">
                          {warning}
                        </li>
                      ))}
                      {saveResult.warnings.length > 20 && (
                        <li className="text-yellow-300 font-semibold mt-2">
                          ... y {saveResult.warnings.length - 20} advertencias más
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Errores críticos */}
              {saveResult.errors && saveResult.errors.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold text-red-400 mb-4">
                    ❌ Errores críticos ({saveResult.errors.length}):
                  </h3>
                  <div className="bg-neutral-800 rounded-lg border border-red-500/30 p-4 max-h-96 overflow-y-auto">
                    <ul className="space-y-2">
                      {saveResult.errors.map((error, index) => (
                        <li key={index} className="text-red-200 text-sm font-mono p-2 bg-red-900/20 rounded border border-red-500/20">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-neutral-700 flex justify-end">
              <button
                onClick={() => {
                  setSaveResult(null);
                  if (saveResult.created && saveResult.created > 0) {
                    setFile(null);
                    setColumns([]);
                    setPreview([]);
                    setAssigned({});
                    setValidationResult(null);
                  }
                }}
                className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

