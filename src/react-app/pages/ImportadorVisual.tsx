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
      },
      "BANs": {
        "ban_number": "Número BAN",
        "description": "Descripción",
        "status": "Estado",
        "address": "Dirección",
        "city": "Ciudad",
        "zip_code": "Código Postal",
      },
      "Suscriptores": {
        "phone": "Número de Teléfono",
        "service_type": "Plan del Cliente",
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
        "mobile_phone"
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
        const firstRow = (jsonData[0] || []) as string[];
        setColumns(firstRow);
        setPreview(jsonData.slice(1, 10));
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
    const requiredFields = [
      "Clientes.name",
      "Clientes.business_name",
      "Clientes.email",
      "BANs.ban_number",
      "Suscriptores.phone",
    ];

    for (const field of requiredFields) {
      if (!assigned[field]) {
        const [table, col] = field.split(".");
        validationErrors.push(`Campo requerido no mapeado: ${getFieldLabel(table, col)}`);
      }
    }

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
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) return;

        const data = new Uint8Array(event.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
        const headers = (jsonData[0] || []) as string[];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== "" && cell !== null));

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

        // Mapear algunas filas de ejemplo
        const sampleRows = rows.slice(0, 5).map((row) => {
          const mapped: Record<string, any> = {};
          for (const [field, columnName] of Object.entries(assigned)) {
            const colIndex = headers.indexOf(columnName);
            if (colIndex !== -1) {
              const [table, col] = field.split(".");
              if (!mapped[table]) mapped[table] = {};
              mapped[table][col] = row[colIndex] || null;
            }
          }
          return mapped;
        });

        // Validaciones y advertencias
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

        setPreviewData({
          totalRows: rows.length,
          sampleRows,
          mappedFields,
          estimatedCreates: Math.floor(rows.length * 0.1), // Estimación
          estimatedUpdates: Math.floor(rows.length * 0.9), // Estimación
          warnings
        });

        setShowPreviewModal(true);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error generando preview:", error);
      alert("Error al generar la vista previa");
    }
  };

  const handleSave = async (confirmed = false) => {
    if (!file) {
      alert("Primero debes cargar un archivo.");
      return;
    }

    // Validar antes de guardar
    const requiredFields = [
      "Clientes.name",
      "Clientes.business_name",
      "Clientes.email",
      "BANs.ban_number",
      "Suscriptores.phone",
    ];

    const missingFields = requiredFields.filter(field => !assigned[field]);
    if (missingFields.length > 0) {
      alert("Por favor, verifica los errores antes de guardar. Faltan campos requeridos.");
      return;
    }

    // Si no está confirmado, mostrar modal de previsualización
    if (!confirmed) {
      await generatePreview();
      return;
    }

    // Cerrar modal de preview
    setShowPreviewModal(false);
    setIsSaving(true);

    try {
      // Leer el archivo completo
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) {
          setIsSaving(false);
          return;
        }

        try {
          const data = new Uint8Array(event.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
          const headers = (jsonData[0] || []) as string[];
          const rows = jsonData.slice(1);

          // Mapear los datos según el mapeo asignado
          const mappedData = rows.map((row) => {
            const mapped: Record<string, any> = {};
            for (const [field, columnName] of Object.entries(assigned)) {
              const colIndex = headers.indexOf(columnName);
              if (colIndex !== -1) {
                const [table, col] = field.split(".");
                if (!mapped[table]) mapped[table] = {};
                mapped[table][col] = row[colIndex] || null;
              }
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
          console.error("Error guardando:", error);
          alert(`Error al guardar: ${error.message || "Error desconocido"}`);
        } finally {
          setIsSaving(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error("Error procesando archivo:", error);
      alert(`Error: ${error.message || "Error desconocido"}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 bg-neutral-950 min-h-screen text-gray-100 overflow-auto">
      <h1 className="text-3xl font-bold text-center mb-6 text-amber-400 drop-shadow-md">
        Importador de Datos v3 (Columnas Ajustadas)
      </h1>

      <div className="grid grid-cols-3 gap-4 mb-10">
        {fields.map((table) => (
          <div
            key={table.table}
            className="bg-neutral-800 border border-amber-500 rounded-lg shadow-md p-4"
          >
            <h2 className="text-xl font-semibold text-amber-400 mb-3 border-b border-amber-500 pb-1">
              {table.table}
            </h2>
            <ul className="space-y-2">
              {table.columns.map((col) => (
                <li
                  key={col}
                  className={`text-sm border rounded-md p-2 text-center transition-all cursor-pointer select-none ${assigned[`${table.table}.${col}`]
                    ? "bg-green-600 border-green-400 text-white"
                    : "bg-neutral-900 border-neutral-700 hover:bg-amber-500/20 text-white"
                    }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(`${table.table}.${col}`)}
                >
                  {getFieldLabel(table.table, col)}
                  {assigned[`${table.table}.${col}`] && (
                    <span className="block text-xs mt-1 text-amber-300">
                      ← {assigned[`${table.table}.${col}`] || ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-neutral-800 rounded-lg p-6 text-center border border-neutral-600 shadow-lg mb-8">
        <p className="text-lg mb-4 text-gray-200 font-medium">
          Subí tu archivo CSV o Excel
        </p>
        <label className="inline-block cursor-pointer">
          <input
            type="file"
            accept=".csv,.xls,.xlsx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 px-4 rounded-lg shadow-md transition-all">
            Seleccionar Archivo
          </span>
        </label>
        {file && <p className="mt-3 text-sm text-amber-300">Archivo cargado: {file?.name || 'Archivo'}</p>}
      </div>

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
            disabled={isSaving || isValidating || preview.length === 0 || (validationResult !== null && !validationResult.valid)}
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
                <h3 className="text-xl font-semibold text-amber-400 mb-4">📊 Resumen de lo que se va a importar:</h3>
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">{previewData.totalRows}</div>
                    <div className="text-sm text-gray-400">Filas Totales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{previewData.estimatedCreates}</div>
                    <div className="text-sm text-gray-400">Est. Nuevos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-400">{previewData.estimatedUpdates}</div>
                    <div className="text-sm text-gray-400">Est. Actualizaciones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400">{previewData.mappedFields.length}</div>
                    <div className="text-sm text-gray-400">Campos Mapeados</div>
                  </div>
                </div>
              </div>

              {/* Campos mapeados */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">📌 Campos que se van a importar:</h3>
                <div className="grid grid-cols-3 gap-2">
                  {previewData.mappedFields.map((field, idx) => (
                    <div key={idx} className="bg-neutral-800 border border-green-500/30 rounded p-2">
                      <div className="text-xs text-gray-400">{field.table}</div>
                      <div className="text-sm text-white font-semibold">{field.label}</div>
                      <div className="text-xs text-green-300">← {field.column}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Muestra de filas */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">👁️ Muestra de las primeras {previewData.sampleRows.length} filas:</h3>
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4 max-h-64 overflow-y-auto">
                  {previewData.sampleRows.map((row, idx) => (
                    <div key={idx} className="mb-4 pb-4 border-b border-neutral-700 last:border-0">
                      <div className="text-xs text-gray-500 mb-2">Fila {idx + 2}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {row.Clientes && (
                          <>
                            <div><span className="text-gray-400">Empresa:</span> <span className="text-white">{row.Clientes.business_name || '-'}</span></div>
                            <div><span className="text-gray-400">Email:</span> <span className="text-white">{row.Clientes.email || '-'}</span></div>
                          </>
                        )}
                        {row.BANs && (
                          <div><span className="text-gray-400">BAN:</span> <span className="text-amber-300">{row.BANs.ban_number || '-'}</span></div>
                        )}
                        {row.Suscriptores && (
                          <div><span className="text-gray-400">Teléfono:</span> <span className="text-white">{row.Suscriptores.phone || '-'}</span></div>
                        )}
                      </div>
                    </div>
                  ))}
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

