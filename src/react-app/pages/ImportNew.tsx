import React, { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "@/react-app/utils/auth";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  Database,
  RefreshCw,
  Eye,
} from "lucide-react";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type CRMTable = "Clientes" | "BANs" | "Suscriptores";

interface CRMField {
  table: CRMTable;
  field: string;
  label: string;
  required?: boolean;
}

interface MappingEntry {
  excelColumn: string;
  crmTable: CRMTable | "";
  crmField: string;
}

type Step = 1 | 2 | 3 | 4;

// ─── Campos CRM disponibles ──────────────────────────────────────────────────

const CRM_FIELDS: CRMField[] = [
  // Clientes
  { table: "Clientes", field: "name",             label: "Empresa / Nombre" },
  { table: "Clientes", field: "owner_name",        label: "Dueño / Titular" },
  { table: "Clientes", field: "contact_person",    label: "Persona de Contacto" },
  { table: "Clientes", field: "email",             label: "Email" },
  { table: "Clientes", field: "phone",             label: "Teléfono" },
  { table: "Clientes", field: "additional_phone",  label: "Teléfono Adicional" },
  { table: "Clientes", field: "cellular",          label: "Celular" },
  { table: "Clientes", field: "address",           label: "Dirección" },
  { table: "Clientes", field: "city",              label: "Ciudad" },
  { table: "Clientes", field: "zip_code",          label: "Código Postal" },
  { table: "Clientes", field: "tax_id",            label: "Tax ID / Seguro Social" },
  { table: "Clientes", field: "salesperson_id",    label: "Vendedor (nombre)" },
  // BANs
  { table: "BANs",     field: "ban_number",        label: "Número BAN", required: true },
  { table: "BANs",     field: "account_type",      label: "Tipo de Cuenta" },
  { table: "BANs",     field: "status",            label: "Estado (A/C)" },
  // Suscriptores
  { table: "Suscriptores", field: "phone",                    label: "Número Suscriptor", required: true },
  { table: "Suscriptores", field: "plan",                     label: "Plan / Price Plan" },
  { table: "Suscriptores", field: "monthly_value",            label: "Renta Mensual" },
  { table: "Suscriptores", field: "remaining_payments",       label: "Plazos Faltantes" },
  { table: "Suscriptores", field: "contract_term",            label: "Meses Contrato" },
  { table: "Suscriptores", field: "contract_end_date",        label: "Fecha Fin Contrato" },
  { table: "Suscriptores", field: "line_type",                label: "Tipo de Línea (NEW/REN)" },
  { table: "Suscriptores", field: "imei",                     label: "IMEI / Equipo" },
  { table: "Suscriptores", field: "init_activation_date",     label: "Fecha Activación Inicial" },
  { table: "Suscriptores", field: "effective_date",           label: "Fecha Efectiva" },
  { table: "Suscriptores", field: "activity_code",            label: "Código de Actividad" },
  { table: "Suscriptores", field: "subscriber_name_remote",   label: "Nombre Remoto" },
  { table: "Suscriptores", field: "price_code",               label: "Código de Precio" },
  { table: "Suscriptores", field: "sub_actv_location",        label: "Ubicación Activación" },
];

const TABLE_COLORS: Record<CRMTable, string> = {
  Clientes:     "bg-blue-500/20 text-blue-300 border-blue-500/40",
  BANs:         "bg-purple-500/20 text-purple-300 border-purple-500/40",
  Suscriptores: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

const TABLE_DOT: Record<CRMTable, string> = {
  Clientes:     "bg-blue-400",
  BANs:         "bg-purple-400",
  Suscriptores: "bg-emerald-400",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMappedRows(
  rawRows: Record<string, any>[],
  mapping: MappingEntry[]
): Record<string, any>[] {
  return rawRows.map((row) => {
    const result: Record<string, any> = {
      Clientes: {},
      BANs: {},
      Suscriptores: {},
    };
    for (const m of mapping) {
      if (!m.crmTable || !m.crmField) continue;
      result[m.crmTable][m.crmField] = row[m.excelColumn] ?? "";
    }
    return result;
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ImportNew() {
  // Pasos
  const [step, setStep] = useState<Step>(1);

  // Datos del Excel
  const [fileName, setFileName] = useState("");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<Record<string, any>[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mapeo
  const [mapping, setMapping] = useState<MappingEntry[]>([]);

  // Resultados
  const [isSimulating, setIsSimulating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Leer Excel en el navegador ────────────────────────────────────────────
  const readExcel = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });

        if (jsonData.length < 2) {
          setError("El archivo está vacío o no tiene datos.");
          return;
        }

        const headers = (jsonData[0] as string[]).map((h) => String(h).trim()).filter(Boolean);
        const rows = jsonData.slice(1).map((row: any[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] ?? "";
          });
          return obj;
        });

        setFileName(file.name);
        setExcelHeaders(headers);
        setExcelRows(rows);

        // Auto-mapeo inteligente
        const autoMap = autoDetectMapping(headers);
        setMapping(autoMap);

        setStep(2);
      } catch {
        setError("No se pudo leer el archivo. Verifica que sea un Excel válido (.xlsx / .xls).");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Auto-detección de columnas ────────────────────────────────────────────
  const autoDetectMapping = (headers: string[]): MappingEntry[] => {
    const patterns: { pattern: RegExp; table: CRMTable; field: string }[] = [
      { pattern: /^(ban|ban_number|ban no|ban#)/i,        table: "BANs",         field: "ban_number" },
      { pattern: /^(sub|subscriber|suscriptor|phone|cel|movil|numero)/i, table: "Suscriptores", field: "phone" },
      { pattern: /^(empresa|company|cliente|client|name|nombre empresa)/i, table: "Clientes",    field: "name" },
      { pattern: /^(plan|price plan|plan code|codigo)/i,  table: "Suscriptores", field: "plan" },
      { pattern: /^(renta|monthly|valor|monto)/i,         table: "Suscriptores", field: "monthly_value" },
      { pattern: /^(status|estado|sub_status)/i,          table: "BANs",         field: "status" },
      { pattern: /^(acc_type|account_type|tipo cuenta)/i, table: "BANs",         field: "account_type" },
      { pattern: /^(tax|seguro social|tax_id)/i,          table: "Clientes",     field: "tax_id" },
      { pattern: /^(email|correo)/i,                      table: "Clientes",     field: "email" },
      { pattern: /^(vendedor|vendor|salesperson)/i,       table: "Clientes",     field: "salesperson_id" },
      { pattern: /^(imei|equipo)/i,                       table: "Suscriptores", field: "imei" },
      { pattern: /^(vence|end_date|fecha fin|contract_end)/i, table: "Suscriptores", field: "contract_end_date" },
      { pattern: /^(type|line_type|tipo linea|tipo de linea)/i, table: "Suscriptores", field: "line_type" },
      { pattern: /^(plazos|remaining)/i,                  table: "Suscriptores", field: "remaining_payments" },
    ];

    return headers.map((col) => {
      const match = patterns.find((p) => p.pattern.test(col));
      return {
        excelColumn: col,
        crmTable: match ? match.table : "",
        crmField: match ? match.field : "",
      };
    });
  };

  // ── Handlers de archivo ───────────────────────────────────────────────────
  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) readExcel(file);
    },
    [readExcel]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readExcel(file);
  };

  // ── Actualizar mapeo ──────────────────────────────────────────────────────
  const updateMapping = (index: number, value: string) => {
    setMapping((prev) => {
      const next = [...prev];
      if (!value) {
        next[index] = { ...next[index], crmTable: "", crmField: "" };
      } else {
        const [table, field] = value.split("||") as [CRMTable, string];
        next[index] = { ...next[index], crmTable: table, crmField: field };
      }
      return next;
    });
  };

  // ── Validación de mapeo ───────────────────────────────────────────────────
  const requiredFields = CRM_FIELDS.filter((f) => f.required);
  const missingRequired = requiredFields.filter(
    (rf) =>
      !mapping.some(
        (m) => m.crmTable === rf.table && m.crmField === rf.field
      )
  );
  const isMappingValid = missingRequired.length === 0;

  // ── Simular importación ───────────────────────────────────────────────────
  const handleSimulate = async () => {
    setIsSimulating(true);
    setError(null);
    setSimulationResult(null);
    try {
      const mappedData = buildMappedRows(excelRows, mapping);
      const res = await authFetch("/api/importador/simulate", {
        method: "POST",
        json: { data: mappedData },
      });
      const result = await res.json();
      setSimulationResult(result?.report || result);
      setStep(3);
    } catch (err: any) {
      setError("Error al simular: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // ── Importar ──────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const mappedData = buildMappedRows(excelRows, mapping);
      const res = await authFetch("/api/importador/save", {
        method: "POST",
        json: { data: mappedData },
      });
      const result = await res.json();
      setImportResult(result?.details || result);
      setStep(4);
    } catch (err: any) {
      setError("Error al importar: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep(1);
    setFileName("");
    setExcelHeaders([]);
    setExcelRows([]);
    setMapping([]);
    setSimulationResult(null);
    setImportResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Preview de datos mapeados ─────────────────────────────────────────────
  const previewRows = buildMappedRows(excelRows.slice(0, 5), mapping);
  const mappedColumns = mapping.filter((m) => m.crmTable && m.crmField);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="text-blue-400" size={28} />
            Importador Nuevo
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Carga tu Excel, mapea las columnas y guarda los datos en el CRM
          </p>
        </div>
        {step > 1 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Reiniciar
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {(["Subir archivo", "Mapear columnas", "Vista previa", "Resultado"] as const).map(
          (label, i) => {
            const num = (i + 1) as Step;
            const active = step === num;
            const done = step > num;
            return (
              <React.Fragment key={num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                      done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : active
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-600 text-gray-500"
                    }`}
                  >
                    {done ? <Check size={12} /> : num}
                  </div>
                  <span
                    className={`text-sm hidden sm:block ${
                      active ? "text-white font-medium" : done ? "text-emerald-400" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className={`flex-1 h-px ${
                      done ? "bg-emerald-500/50" : "bg-gray-700"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          }
        )}
      </div>

      {/* Error global */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── PASO 1: Subir archivo ─────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all ${
                isDragging
                  ? "border-blue-400 bg-blue-500/10"
                  : "border-gray-700 bg-gray-900 hover:border-blue-500/50 hover:bg-gray-800/50"
              }`}
            >
              <FileSpreadsheet
                size={56}
                className={`mx-auto mb-4 ${isDragging ? "text-blue-400" : "text-gray-600"}`}
              />
              <p className="text-lg font-medium text-gray-300 mb-2">
                Arrastra tu Excel aquí
              </p>
              <p className="text-sm text-gray-500 mb-6">
                o haz clic para seleccionar un archivo
              </p>
              <span className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
                Seleccionar archivo
              </span>
              <p className="text-xs text-gray-600 mt-4">Formatos: .xlsx, .xls, .csv</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </motion.div>
        )}

        {/* ── PASO 2: Mapear columnas ───────────────────────────────────────── */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Info del archivo */}
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
              <FileSpreadsheet size={20} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{fileName}</p>
                <p className="text-xs text-gray-400">
                  {excelRows.length} filas · {excelHeaders.length} columnas
                </p>
              </div>
            </div>

            {/* Leyenda campos obligatorios */}
            <div className="mb-4 flex flex-wrap gap-3 items-center">
              <span className="text-xs text-gray-500">Campos obligatorios:</span>
              {requiredFields.map((rf) => (
                <span
                  key={rf.field}
                  className={`text-xs px-2 py-0.5 rounded border ${TABLE_COLORS[rf.table]}`}
                >
                  {rf.table} → {rf.label}
                </span>
              ))}
            </div>

            {/* Tabla de mapeo */}
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_40px_1fr] bg-gray-800/60 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>Columna del Excel</span>
                <span />
                <span>Campo del CRM</span>
              </div>
              <div className="divide-y divide-gray-800/60">
                {mapping.map((m, idx) => {
                  const isRequired = requiredFields.some(
                    (rf) => m.crmTable === rf.table && m.crmField === rf.field
                  );
                  const isMapped = !!m.crmTable && !!m.crmField;
                  return (
                    <div
                      key={m.excelColumn}
                      className={`grid grid-cols-[1fr_40px_1fr] items-center px-4 py-3 transition-colors ${
                        isRequired ? "bg-emerald-500/5" : "hover:bg-gray-900/40"
                      }`}
                    >
                      {/* Columna Excel */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200 font-mono truncate">
                          {m.excelColumn}
                        </span>
                        {/* Muestra valor de ejemplo */}
                        {excelRows[0]?.[m.excelColumn] !== undefined && (
                          <span className="text-xs text-gray-500 truncate max-w-[100px]">
                            ej: {String(excelRows[0][m.excelColumn]).slice(0, 20)}
                          </span>
                        )}
                      </div>

                      {/* Flecha */}
                      <div className="flex justify-center">
                        <ArrowRight
                          size={14}
                          className={isMapped ? "text-blue-400" : "text-gray-700"}
                        />
                      </div>

                      {/* Select campo CRM */}
                      <div className="relative">
                        <select
                          value={
                            m.crmTable && m.crmField
                              ? `${m.crmTable}||${m.crmField}`
                              : ""
                          }
                          onChange={(e) => updateMapping(idx, e.target.value)}
                          className={`w-full appearance-none rounded-lg px-3 py-1.5 pr-8 text-sm border transition-colors bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isRequired
                              ? "border-emerald-500/50 text-emerald-300"
                              : isMapped
                              ? "border-gray-600 text-gray-200"
                              : "border-gray-700 text-gray-500"
                          }`}
                        >
                          <option value="">— No mapear —</option>
                          <optgroup label="── Clientes ──">
                            {CRM_FIELDS.filter((f) => f.table === "Clientes").map((f) => (
                              <option key={f.field} value={`Clientes||${f.field}`}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="── BANs ──">
                            {CRM_FIELDS.filter((f) => f.table === "BANs").map((f) => (
                              <option key={f.field} value={`BANs||${f.field}`}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="── Suscriptores ──">
                            {CRM_FIELDS.filter((f) => f.table === "Suscriptores").map((f) => (
                              <option key={f.field} value={`Suscriptores||${f.field}`}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <ChevronDown
                          size={14}
                          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advertencia campos obligatorios faltantes */}
            {!isMappingValid && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  Faltan campos obligatorios:{" "}
                  {missingRequired.map((r) => `${r.table} → ${r.label}`).join(", ")}
                </span>
              </div>
            )}

            {/* Botones */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Eye size={14} />
                <span>
                  {mappedColumns.length} de {mapping.length} columnas mapeadas
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleSimulate}
                  disabled={!isMappingValid || isSimulating}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Simulando...
                    </>
                  ) : (
                    <>
                      <Eye size={15} />
                      Vista previa
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PASO 3: Vista previa / Simulación ────────────────────────────── */}
        {step === 3 && simulationResult && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Resumen de simulación */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Importables", value: simulationResult.disponibles ?? simulationResult.importables_count ?? "—", color: "text-emerald-400" },
                { label: "Incompletos", value: simulationResult.incompletos ?? "—",   color: "text-yellow-400" },
                { label: "Cancelados",  value: simulationResult.cancelados ?? "—",    color: "text-red-400" },
                { label: "Rechazados (status)", value: simulationResult.rechazados_status ?? 0, color: "text-orange-400" },
                { label: "Total filas", value: simulationResult.total ?? excelRows.length, color: "text-blue-400" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-gray-900 border border-gray-800 p-5 text-center"
                >
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Vista previa primeras 5 filas mapeadas */}
            {previewRows.length > 0 && mappedColumns.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Eye size={14} className="text-gray-500" />
                  Vista previa de datos mapeados (primeras {previewRows.length} filas)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-800/60">
                        {mappedColumns.map((m) => (
                          <th
                            key={`${m.crmTable}-${m.crmField}`}
                            className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap"
                          >
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] border mr-1 ${
                                TABLE_COLORS[m.crmTable as CRMTable]
                              }`}
                            >
                              {m.crmTable}
                            </span>
                            {CRM_FIELDS.find(
                              (f) => f.table === m.crmTable && f.field === m.crmField
                            )?.label ?? m.crmField}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-900/40">
                          {mappedColumns.map((m) => (
                            <td
                              key={`${m.crmTable}-${m.crmField}`}
                              className="px-3 py-2 text-gray-300 whitespace-nowrap"
                            >
                              {String(
                                (row as any)[m.crmTable]?.[m.crmField] ?? ""
                              ).slice(0, 30) || (
                                <span className="text-gray-600 italic">vacío</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Agrupaciones si las hay */}
            {simulationResult.grouped?.account_type?.length > 0 && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "account_type", label: "Por Tipo de Cuenta" },
                  { key: "line_type",    label: "Por Tipo de Línea" },
                  { key: "plan",         label: "Por Plan" },
                  { key: "vendor",       label: "Por Vendedor" },
                ].map(({ key, label }) => {
                  const items = simulationResult.grouped?.[key];
                  if (!items?.length) return null;
                  return (
                    <div key={key} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                      <p className="text-xs font-semibold text-gray-400 mb-3">{label}</p>
                      <div className="space-y-1.5">
                        {items.slice(0, 5).map((item: any) => (
                          <div key={item.key} className="flex justify-between text-xs">
                            <span className="text-gray-300 truncate max-w-[160px]">{item.key}</span>
                            <span className="text-gray-500 ml-2">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botones */}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors"
              >
                ← Editar mapeo
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Importando {excelRows.length} filas...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Importar {excelRows.length} filas
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PASO 4: Resultado ─────────────────────────────────────────────── */}
        {step === 4 && importResult && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 mb-6">
              <Check size={36} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Importación completada
            </h2>
            <p className="text-gray-400 mb-8 text-sm">
              Los datos fueron procesados exitosamente
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-left">
              {[
                { label: "Procesados", value: importResult.processed ?? "—",  color: "text-blue-400" },
                { label: "Creados",    value: importResult.created  ?? "—",   color: "text-emerald-400" },
                { label: "Actualizados", value: importResult.updated ?? "—",  color: "text-yellow-400" },
                { label: "Omitidos",   value: importResult.omitted  ?? "—",   color: "text-red-400" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-gray-900 border border-gray-800 p-5 text-center"
                >
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {importResult.omittedReasons?.length > 0 && (
              <div className="mb-6 rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4 text-left">
                <p className="text-xs font-semibold text-yellow-400 mb-2">
                  Razones de omisión (primeras {importResult.omittedReasons.length}):
                </p>
                <ul className="space-y-1">
                  {importResult.omittedReasons.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-yellow-300/70">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.errorList?.length > 0 && (
              <div className="mb-6 rounded-xl bg-red-500/5 border border-red-500/20 p-4 text-left">
                <p className="text-xs font-semibold text-red-400 mb-2">Errores:</p>
                <ul className="space-y-1">
                  {importResult.errorList.map((e: string, i: number) => (
                    <li key={i} className="text-xs text-red-300/70">
                      • {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleReset}
              className="px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              Nueva importación
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
