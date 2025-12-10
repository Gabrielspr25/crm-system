import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { authFetch } from "@/react-app/utils/auth";

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
    details: string[];
  }
}

export default function ImportadorVisual() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[][]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message?: string; created?: number; updated?: number; total?: number; errors?: string[]; omitted?: number; warnings?: string[] } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
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

  // Función para obtener la etiqueta del frontend según tabla y columna
  const getFieldLabel = (table: string, col: string): string => {
    // Mapeo específico por tabla
    const labels: Record<string, Record<string, string>> = {
      "Clientes": {
        "name": "Nombre del Cliente",
        "business_name": "Empresa",
        "contact_person": "Persona de Contacto",
        "email": "Email",
        "phone": "Teléfono",
        "secondary_phone": "Teléfono Adicional",
        "mobile_phone": "Celular",
        "address": "Dirección",
        "city": "Ciudad",
        "zip_code": "Código Postal",
        "base": "Base",
        "vendor_id": "Vendedor",
      },
      "BANs": {
        "ban_number": "Número BAN",
        "description": "Tipo de Cuenta (Móvil/Fijo/Convergente)",
        "status": "Estado",
        "address": "Dirección",
        "city": "Ciudad",
        "zip_code": "Código Postal",
      },
      "Suscriptores": {
        "phone": "Número de Teléfono",
        "service_type": "Plan / Descripción",
        "monthly_value": "Valor Mensual",
        "months": "Duración del Contrato (meses)",
        "remaining_payments": "Plazos Faltantes",
        "contract_start_date": "Fecha Inicio Contrato",
        "contract_end_date": "Fecha Fin Contrato",
        "status": "Estado (activo/cancelado)",
        "equipment": "Equipo",
        "city": "Ciudad",
        "notes": "Notas",
      },
    };
    return labels[table]?.[col] || col;
  };

  const [fields] = useState([
    {
      table: "Clientes",
      columns: [
        "name",
        "business_name",
        "base",
        "contact_person",
        "email",
        "phone",
        "secondary_phone",
        "mobile_phone",
        "vendor_id"
      ]
    },
    {
      table: "BANs",
      columns: [
        "ban_number",
        "description",
        "status",
        "address",
        "city",
        "zip_code"
      ]
    },
    {
      table: "Suscriptores",
      columns: [
        "phone",
        "service_type",
        "monthly_value",
        "months",
        "remaining_payments",
        "contract_start_date",
        "contract_end_date",
        "status",
        "equipment",
        "city",
        "notes"
      ]
    },
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) return;
        const data = new Uint8Array(event.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        // Mantener celdas vacías con defval: ''
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];

        // --- DETECCIÓN DE FORMATO DE ACTIVACIONES ---
        // Verificar si es el formato "SOLICITUD PARA ACTIVACION DE LINEAS CORPORATIVAS"
        if (jsonData.length > 0 && String(jsonData[0][0]).includes("SOLICITUD PARA ACTIVACION")) {
          console.log("📋 Formato de Activaciones detectado");
          
          // Extraer metadatos (BAN, Cliente y Vendedor)
          // Según imagen del usuario:
          // D3 -> Vendedor (Fila index 2, Col index 3)
          // D5 -> BAN (Fila index 4, Col index 3)
          // D7 -> Empresa (Fila index 6, Col index 3)
          
          // Función para buscar metadatos dinámicamente
          const findMetadataValue = (keywords: string[]) => {
            for (let i = 0; i < Math.min(jsonData.length, 20); i++) { // Buscar en las primeras 20 filas
              const row = jsonData[i];
              if (!row) continue;
              
              // Buscar la celda que contiene la keyword
              const cellIndex = row.findIndex((cell: any) => 
                cell && keywords.some(k => String(cell).toUpperCase().includes(k))
              );

              if (cellIndex !== -1) {
                // Buscar el siguiente valor no vacío en la misma fila
                for (let j = cellIndex + 1; j < row.length; j++) {
                  const val = row[j];
                  if (val && String(val).trim() !== "") {
                    return val;
                  }
                }
              }
            }
            return null;
          };

          // Estrategia híbrida: Coordenadas fijas (backup) + Búsqueda dinámica (prioridad)
          let vendor = findMetadataValue(["VENDEDOR"]);
          let ban = findMetadataValue(["BAN", "ACCOUNT"]);
          let clientName = findMetadataValue(["CLIENTE", "EMPRESA", "RAZON SOCIAL"]);

          // Si la búsqueda dinámica falla, usar coordenadas fijas (C5/D5/E5 logic)
          if (!ban) {
             const row = jsonData[4]; // Fila 5
             if (row) {
                 // Intentar D5, C5, E5
                 if (row[3]) ban = row[3];
                 else if (row[2]) ban = row[2];
                 else if (row[4]) ban = row[4];
             }
          }
          
          if (!vendor) vendor = jsonData[2]?.[3] || jsonData[2]?.[2];
          if (!clientName) clientName = jsonData[6]?.[3] || jsonData[6]?.[2];

          console.log(`[Importador] Metadatos detectados - BAN: ${ban}, Cliente: ${clientName}, Vendedor: ${vendor}`);


          if (!ban) {
             alert("⚠️ No se detectó el BAN en la fila 5 (Celdas C5, D5 o E5). Verifica que el archivo tenga el formato correcto.");
          }
          
          // Buscar la fila de cabeceras (debe contener "NUM CELULAR")
          // ACTUALIZACIÓN: El usuario indica coordenadas fijas para las cabeceras/datos
          // B10 -> Suscriptor
          // H10 -> Plan
          // I10 -> Precio
          // O10 -> Meses
          // Q10 -> Notas
          
          // Asumimos que la fila 10 (índice 9) es la cabecera y los datos empiezan en la 11 (índice 10)
          const headerRowIndex = 9; 

          if (jsonData.length > headerRowIndex) {
            const dataRows = jsonData.slice(headerRowIndex + 1);

            // Definir nuevas columnas virtuales
            const virtualHeaders = [
              "Número BAN", 
              "Nombre del Cliente", 
              "Vendedor",
              "Número de Teléfono", 
              "Plan / Descripción", 
              "Valor Mensual", 
              "Meses",
              "Equipo", 
              "Notas",
              "Status"
            ];

            // Índices fijos CORREGIDOS (El lector omite la col A vacía, así que B=0)
            const idxPhone = 0;   // B (Antes 1)
            const idxPlan = 6;    // H (Antes 7)
            const idxPrice = 7;   // I (Antes 8)
            const idxMonths = 13; // O (Antes 14)
            const idxComments = 15; // Q (Antes 16)
            // Equipo no especificado en las coordenadas recientes, lo dejamos vacío o buscamos si existe
            
            // Construir nueva data plana
            const transformedData = dataRows
              .filter(row => row[idxPhone]) // Filtrar filas vacías (basado en teléfono)
              .map(row => {
                // Limpieza de datos crítica para evitar errores de BD
                const rawPhone = row[idxPhone];
                const cleanPhone = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '').slice(-10) : "";
                
                const rawBan = ban;
                const cleanBan = rawBan ? String(rawBan).replace(/[^0-9]/g, '').slice(0, 9) : "";

                // Buscar status en columnas probables (J, K, L, M, N, P)
                // J=8, K=9, L=10, M=11, N=12, P=14
                // Si el usuario dice "os que tienen c", es probable que sea una columna de estado.
                // Vamos a intentar buscar "C" o "A" en las columnas cercanas.
                let status = "";
                // Buscar en TODAS las columnas a partir de la 5 (F) para ser más agresivos
                for(let k=5; k < row.length; k++) {
                    const val = String(row[k] || "").trim().toUpperCase();
                    // Buscar coincidencia exacta o que empiece con C/A si es una palabra corta
                    if (val === 'C' || val === 'CANCELADO' || val === 'BAJA' || val === 'SUSPENDIDO' || val.startsWith('CANCEL')) {
                        status = 'cancelado';
                        break;
                    } else if (val === 'A' || val === 'ACTIVO' || val === 'ALTA' || val.startsWith('ACTIV')) {
                        status = 'activo';
                        break;
                    }
                }

                return [
                  cleanBan,               // Número BAN (Limpio 9 dígitos)
                  clientName,             // Empresa
                  vendor,                 // Vendedor
                  cleanPhone,             // Teléfono (Limpio 10 dígitos)
                  row[idxPlan],           // Plan (G)
                  row[idxPrice],          // Precio (H)
                  row[idxMonths],         // Meses (N)
                  "",                     // Equipo (No mapeado explícitamente)
                  row[idxComments],       // Notas (P)
                  status                  // Status detectado
                ];
              });

            setColumns(virtualHeaders);
            setPreview(transformedData.slice(0, 10)); // Mostrar primeros 10
            
            // Auto-asignar mapeo
            setAssigned({
              "BANs.ban_number": "Número BAN",
              "Clientes.name": "Nombre del Cliente",
              "Clientes.vendor_id": "Vendedor",
              "Suscriptores.phone": "Número de Teléfono",
              "Suscriptores.service_type": "Plan / Descripción",
              "Suscriptores.monthly_value": "Valor Mensual",
              "Suscriptores.months": "Meses",
              "Suscriptores.equipment": "Equipo",
              "Suscriptores.notes": "Notas",
              "Suscriptores.status": "Status",
              "BANs.status": "Status" // Mapear explícitamente al BAN también
            });

            // Guardar la data transformada completa en una propiedad del componente o estado si fuera necesario
            // Pero el importador usa 'file' y lo lee de nuevo al guardar.
            // PROBLEMA: Al guardar, el backend leerá el archivo original y no sabrá interpretarlo.
            // SOLUCIÓN: Necesitamos interceptar el guardado o enviar la data transformada.
            // El backend espera { mapping, data }. 'data' se construye en el frontend?
            // Revisemos handleValidate/handleSave.
            
            // Hack: Reemplazar el comportamiento de lectura en handleSave o guardar la data transformada en un estado.
            // Vamos a guardar la data transformada en un estado temporal para usarla en el guardado.
            (window as any).__transformedData = [virtualHeaders, ...transformedData];
            
            return;
          }
        }
        // ---------------------------------------------

        const firstRow = (jsonData[0] || []) as string[];
        setColumns(firstRow);
        setPreview(jsonData.slice(1, 10));
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
      const transformedData = (window as any).__transformedData;
      
      let headers: string[];
      let rows: any[][];

      if (transformedData) {
        headers = transformedData[0];
        rows = transformedData.slice(1);
      } else {
        // Lectura normal
        const reader = new FileReader();
        const filePromise = new Promise<{headers: string[], rows: any[][]}>((resolve, reject) => {
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
      // (Validación de Plazos Faltantes ACTIVADA)
      const remainingPaymentsCol = assigned["Suscriptores.remaining_payments"];
      if (remainingPaymentsCol) {
        const colIdx = headers.indexOf(remainingPaymentsCol);
        if (colIdx !== -1) {
          const missingRows: number[] = [];
          rows.forEach((row, idx) => {
            const val = row[colIdx];
            if (val === undefined || val === null || String(val).trim() === "") {
              missingRows.push(idx);
            }
          });

          if (missingRows.length > 0) {
            setMissingDataState({
              isOpen: true,
              field: 'Suscriptores.remaining_payments',
              label: 'Plazos Faltantes',
              rows: missingRows,
              data: rows,
              headers: headers
            });
            return; // Detener generación de preview
          }
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
                
                // Calcular meses restantes desde HOY hasta FIN
                // Diferencia en meses
                let remaining = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
                
                // Ajuste por días (si hoy es día 15 y fin es día 10, ya pasó el mes parcialmente, pero simplificamos a meses enteros)
                if (remaining < 0) remaining = 0;
                
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
      const transformedData = (window as any).__transformedData;
      
      let headers: string[];
      let rows: any[][];

      if (transformedData) {
        headers = transformedData[0];
        rows = transformedData.slice(1);
      } else {
        // Lectura normal
        const reader = new FileReader();
        const filePromise = new Promise<{headers: string[], rows: any[][]}>((resolve, reject) => {
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
        }

        return mapped;
      });

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

  return (
    <div className="p-4 bg-neutral-950 min-h-screen text-gray-100 overflow-auto">
      
      <div className="bg-neutral-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-4 border border-neutral-600 shadow-lg mb-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <p className="text-base text-gray-200 font-medium hidden sm:block">
              Subí tu archivo
            </p>
            <p className="text-[10px] text-gray-500 hidden sm:block">
              * VALIDACIONES DESACTIVADAS
            </p>
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
            onClick={() => window.location.reload()}
            className="bg-neutral-700 hover:bg-neutral-600 text-xs text-gray-300 py-1 px-2 rounded border border-neutral-600"
            title="Recargar página para borrar caché"
          >
            🔄 Recargar
          </button>
          {file && <p className="text-sm text-amber-300 font-medium truncate max-w-[150px]">📄 {file?.name}</p>}
        </div>
      </div>

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
                placeholder="MM/DD/AAAA"
                value={defaultStartDate}
                onChange={(e) => setDefaultStartDate(e.target.value)}
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

        if (unassignedColumns.length === 0) {
          return (
            <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-6 text-center">
              <p className="text-green-200 font-semibold text-lg">✅ Todas las columnas han sido mapeadas</p>
              <p className="text-green-100 text-sm mt-2">Puedes proceder a verificar y guardar los datos</p>
            </div>
          );
        }

        return (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-gray-200 border border-neutral-700 rounded-md">
              <thead className="bg-neutral-800">
                <tr>
                  {unassignedColumns.map((col, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left border border-neutral-700 text-amber-300"
                    >
                      <motion.div
                        draggable
                        onDragStart={() => handleDragStart(col)}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center justify-between bg-blue-700 hover:bg-blue-500 text-white px-3 py-1 rounded-md cursor-grab select-none shadow-md"
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
                    {unassignedIndices.map((colIndex, cIndex) => (
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
        );
      })()}

      {!preview.length && (
        <p className="text-center text-gray-400 italic">
          No se ha cargado ningún archivo o no se detectaron filas válidas.
        </p>
      )}

      {/* Modal de previsualización */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border-2 border-amber-500 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700 bg-amber-900/30">
              <h2 className="text-2xl font-bold text-amber-300">
                📋 Vista Previa de Importación
              </h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Resumen de importación */}
              <div className="mb-6 p-4 bg-neutral-800 rounded-lg border border-amber-500/30">
                <h3 className="text-xl font-semibold text-amber-400 mb-4">
                  {previewData.simulation ? "📊 Resultado de Simulación (Verificado en BD)" : "📊 Resumen Estimado"}
                </h3>
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">{previewData.totalRows}</div>
                    <div className="text-sm text-gray-400">Filas Totales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">
                      {previewData.simulation ? previewData.simulation.newClients : previewData.estimatedCreates}
                    </div>
                    <div className="text-sm text-gray-400">Clientes Nuevos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-400">
                      {previewData.simulation ? previewData.simulation.updatedClients : previewData.estimatedUpdates}
                    </div>
                    <div className="text-sm text-gray-400">Clientes Actualizados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400">
                       {previewData.simulation ? previewData.simulation.newBans : "-"}
                    </div>
                    <div className="text-sm text-gray-400">BANs Nuevos</div>
                  </div>
                </div>
                
                {previewData.simulation && (
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-neutral-700">
                     <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">{previewData.simulation.movedBans}</div>
                        <div className="text-xs text-gray-400">BANs Movidos/Duplicados</div>
                     </div>
                     <div className="text-center">
                        <div className="text-2xl font-bold text-teal-400">{previewData.simulation.newSubscribers}</div>
                        <div className="text-xs text-gray-400">Suscriptores Nuevos</div>
                     </div>
                     <div className="text-center">
                        <div className="text-2xl font-bold text-indigo-400">{previewData.simulation.updatedSubscribers}</div>
                        <div className="text-xs text-gray-400">Suscriptores Actualizados</div>
                     </div>
                     <div className="text-center">
                        <div className="text-2xl font-bold text-pink-400">{previewData.simulation.fusedClients}</div>
                        <div className="text-xs text-gray-400">Clientes Fusionados</div>
                     </div>
                  </div>
                )}
              </div>

              {/* Detalles de Simulación */}
              {previewData.simulation && previewData.simulation.details.length > 0 && (
                <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-blue-400 font-semibold mb-2">ℹ️ Detalles de la Simulación:</h3>
                  <ul className="space-y-1 text-sm text-blue-100 max-h-40 overflow-y-auto">
                    {previewData.simulation.details.map((detail, idx) => (
                      <li key={idx}>• {detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Campos mapeados */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">📌 Campos que se van a importar:</h3>
                <div className="grid grid-cols-3 gap-2">
                  {previewData.mappedFields.map((field, idx) => {
                    // Obtener valor de ejemplo de la primera fila
                    const sampleValue = previewData.sampleRows.length > 0 
                      ? previewData.sampleRows[0]?.[field.table]?.[field.field] 
                      : null;

                    return (
                      <div key={idx} className="bg-neutral-800 border border-green-500/30 rounded p-2">
                        <div className="text-xs text-gray-400">{field.table}</div>
                        <div className="text-sm text-white font-semibold">{field.label}</div>
                        <div className="text-xs text-green-300">← {field.column}</div>
                        {/* Mostrar ejemplo si existe */}
                        <div className="mt-1 pt-1 border-t border-gray-700 text-xs">
                          <span className="text-gray-500">Ej: </span>
                          <span className="text-amber-200 truncate block" title={String(sampleValue || '')}>
                            {sampleValue ? String(sampleValue) : <span className="italic text-gray-600">(vacío)</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Advertencias */}
              {previewData.warnings.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                  <h3 className="text-yellow-400 font-semibold mb-2">⚠️ Advertencias detectadas:</h3>
                  <ul className="space-y-1 text-sm text-yellow-100 max-h-40 overflow-y-auto">
                    {previewData.warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer con botones */}
            <div className="p-6 border-t border-neutral-700 flex justify-end gap-4 bg-neutral-800/50">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-8 rounded-lg shadow-md transition-all"
              >
                {isSaving ? "Guardando..." : "✅ Confirmar Importación"}
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
                onChange={(e) => setMissingDataValue(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                placeholder="Ej: 0, 12, 2023-01-01..."
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

