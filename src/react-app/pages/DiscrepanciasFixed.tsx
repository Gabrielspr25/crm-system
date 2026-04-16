// SOLUCIÓN DIRECTA: Crear un componente simplificado que funciona

import React, { useState } from "react";
import { Search, Globe, FileSpreadsheet, CheckCircle2, Loader2, Database, X, Save, ArrowRight, AlertCircle, Filter, FileDown } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";

interface AuditRow {
    index: number;
    source_sheet?: string;
    phone: string;
    ban: string;
    imei: string;
    plan: string;
    activation_date: string;
    imsi: string;
    tipo_celuseguro: string;  // SEGURO
    tipo_factura: string;     // PAPER
    nombre: string;
    price_plan: string;
    status: "pending" | "matching" | "mismatch" | "missing" | "error";
    differences?: any[];
    dbData?: any;
}

interface CorrectionReportRow {
    fecha_hora: string;
    telefono: string;
    ban: string;
    ventaid: string;
    nombre_editado: string;
    nombre_tango: string;
    apellido_tango: string;
    paper: string;
    seguro: string;
    price_code: string;
    price_plan: string;
    actualizado_venta: number;
    actualizado_cliente: number;
}

function excelDateToJSDate(serial: any): string {
    if (!serial) return "";
    // If it's already a date string (YYYY-MM-DD or similar), return it
    if (typeof serial === 'string' && serial.includes('-')) return serial;

    const serialNum = Number(serial);
    if (isNaN(serialNum)) return String(serial);

    // Excel base date (December 30, 1899)
    // 25569 is the offset between Excel (1900-01-01) and Unix (1970-01-01), but we must be careful with leap year bug 1900.
    // Adjust for timezone offset
    const d = new Date(0);
    d.setUTCSeconds((serialNum - 25569) * 86400);

    // Add the timezone offset minutes to keep it local/UTC correct visually.
    const userTimezoneOffset = d.getTimezoneOffset() * 60000;
    const finalDate = new Date(d.getTime() + userTimezoneOffset);

    return finalDate.toISOString().split('T')[0];
}

function normalizeComparableText(value: any): string {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\.\,\|\;\:\-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function normalizeNameComparable(value: any): string {
    return normalizeComparableText(value)
        .replace(/\b(MR|MRS|MS|MISS|DR|SR|SRA|SRTA|DRA)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function nameTokens(value: any): string[] {
    return normalizeNameComparable(value).split(" ").filter(Boolean);
}

function areNamesEquivalent(a: any, b: any): boolean {
    const ta = nameTokens(a);
    const tb = nameTokens(b);
    if (!ta.length || !tb.length) return true;
    if (ta.join(" ") === tb.join(" ")) return true;
    const shorter = ta.length <= tb.length ? ta : tb;
    const longer = ta.length <= tb.length ? tb : ta;
    return shorter.every((token) => longer.includes(token));
}

function normalizeYesNo(value: any, kind: "paper" | "seguro" | "generic" = "generic"): string {
    const normalized = normalizeComparableText(value);
    if (!normalized) return "";

    if (
        normalized === "NONE" ||
        normalized === "NULL" ||
        normalized === "N/A" ||
        normalized === "VACIO" ||
        normalized === "(VACIO)"
    ) {
        return kind === "seguro" ? "NO" : "";
    }

    if (kind === "paper") {
        if (
            normalized === "NO" ||
            normalized.includes("NO PAPER") ||
            normalized.includes("NOPAPER") ||
            normalized.includes("EBILL")
        ) {
            return "NO";
        }
        if (normalized === "SI" || normalized === "YES" || normalized.includes("PAPER")) {
            return "SI";
        }
        return normalized;
    }

    if (
        normalized === "NO" ||
        normalized === "FALSE" ||
        normalized === "0" ||
        normalized.includes("SIN SEGURO")
    ) {
        return "NO";
    }
    if (
        normalized === "SI" ||
        normalized === "YES" ||
        normalized === "TRUE" ||
        normalized === "1" ||
        normalized.includes("CON SEGURO")
    ) {
        return "SI";
    }
    return normalized;
}

function normalizePhone10(value: any): string {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
}

function areFieldValuesEquivalent(field: string, excelValue: string, dbValue: string): boolean {
    if (!dbValue || dbValue === "Cargando...") return true;

    switch (field) {
        case "activation_date":
            return excelDateToJSDate(excelValue) === excelDateToJSDate(dbValue);
        case "ban":
            return String(excelValue || "").replace(/\D/g, "") === String(dbValue || "").replace(/\D/g, "");
        case "phone":
            return normalizePhone10(excelValue) === normalizePhone10(dbValue);
        case "nombre":
            return areNamesEquivalent(excelValue, dbValue);
        case "tipo_factura":
            {
                const excelNorm = normalizeYesNo(excelValue, "paper");
                if (!excelNorm) return true;
                return excelNorm === normalizeYesNo(dbValue, "paper");
            }
        case "tipo_celuseguro":
            {
                const excelNorm = normalizeYesNo(excelValue, "seguro");
                if (!excelNorm) return true;
                return excelNorm === normalizeYesNo(dbValue, "seguro");
            }
        case "imsi":
        case "imei":
            return String(excelValue || "").replace(/\D/g, "") === String(dbValue || "").replace(/\D/g, "");
        case "plan":
        case "price_plan":
            return normalizeComparableText(excelValue) === normalizeComparableText(dbValue);
        default:
            return String(excelValue || "").trim() === String(dbValue || "").trim();
    }
}

export default function DiscrepanciasFixedPage() {
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const [savedCorrections, setSavedCorrections] = useState<CorrectionReportRow[]>([]);
    const [filterOnlyMismatches, setFilterOnlyMismatches] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        matching: 0,
        mismatch: 0,
        missing: 0
    });
    const [progressStr, setProgressStr] = useState("");

    const resetAudit = () => {
        setFile(null);
        setRows([]);
        setStats({ total: 0, matching: 0, mismatch: 0, missing: 0 });
        setSyncResult(null);
        setSavedCorrections([]);
        setProgressStr("");
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                if (!evt.target?.result) return;
                const dataArray = new Uint8Array(evt.target.result as ArrayBuffer);
                const workbook = XLSX.read(dataArray, { type: "array" });
                const allSheetNames = workbook.SheetNames || [];
                const normalizeSheetName = (name: string) =>
                    normalizeComparableText(name).replace(/\s+/g, " ").trim();
                const preferredSheets = allSheetNames.filter((name) => {
                    const normalized = normalizeSheetName(name);
                    return normalized.includes("NUEVA") || normalized.includes("NUEVO") || normalized.includes("RENOV");
                });
                const sheetsToRead =
                    preferredSheets.length > 0 ? preferredSheets : allSheetNames.slice(0, 1);

                const jsonData = sheetsToRead.flatMap((sheetName) => {
                    const sheet = workbook.Sheets[sheetName];
                    if (!sheet) return [];
                    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
                });

                if (jsonData.length === 0) {
                    alert("El archivo está vacío.");
                    setLoading(false);
                    return;
                }

                let headerRowIdx = jsonData.findIndex(row =>
                    row && row.some((cell: any) => {
                        const s = String(cell).toUpperCase();
                        return s.includes("CELULAR") || s.includes("TELEFONO") || s.includes("PHONE") || s.includes("BAN") || s.includes("SUBSCRIBER");
                    })
                );

                if (headerRowIdx === -1) headerRowIdx = 0;

                const headers = (jsonData[headerRowIdx] || []) as string[];

                // Prioritize finding specific keywords first (e.g. searching for "SUBSCRIBER_NAME" before "NAME")
                const findIdx = (keywords: string[]) => {
                    for (const k of keywords) {
                        const idx = headers.findIndex(h => String(h).toUpperCase().includes(k.toUpperCase()));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const idxPhone = findIdx(["SUBSCRIBER_NO", "CELULAR", "TELEFONO", "PHONE", "SUSCRIBER"]);
                const idxBan = findIdx(["BAN", "ACCT_NO"]);
                const idxImei = findIdx(["IMEI", "SERIE", "SERIAL", "EMAI"]);
                const idxPlan = findIdx([
                    "PRICE_CODE",
                    "PRICECODE",
                    "CODIGO PRODUCTO",
                    "CODIGO_PRODUCTO",
                    "CÓDIGO PRODUCTO",
                    "COD PRODUCTO",
                    "PLAN"
                ]);
                const idxDate = findIdx(["INIT_ACTIVATION_DATE", "FECHA"]);
                const idxImsi = findIdx(["IMSI", "SIMCARD"]);
                const idxTipoCeluSeguro = findIdx(["TIPO_CELUSEGURO", "SEGURO", "TIPO_CELU"]);
                const idxTipoFactura = findIdx(["TIPO_FACTURA", "PAPER", "FACTURA"]);
                const idxNombre = findIdx(["SUBSCRIBER_NAME", "NOMBRE", "NAME", "CUSTOMER"]);
                const idxPricePlan = findIdx(["PRICE_PLAN", "PRICE PLAN"]);


                // Columnas eliminadas: CODIGO VOZ y VALOR

                const dataRows = jsonData.slice(headerRowIdx + 1);

                const mappedRows: AuditRow[] = dataRows
                    .filter(row => {
                        const val = row[idxPhone !== -1 ? idxPhone : 0];
                        return val && String(val).replace(/[^0-9]/g, '').length >= 8;
                    })
                    .map((row, idx) => ({
                        index: idx + 1,
                        source_sheet: sheetsToRead.length > 1 ? "NUEVAS + RENOVACIONES" : (sheetsToRead[0] || ""),
                        phone: idxPhone !== -1 ? String(row[idxPhone]).trim() : "",
                        ban: idxBan !== -1 ? String(row[idxBan]).trim() : "",
                        imei: idxImei !== -1 ? String(row[idxImei]).trim() : "",
                        plan: idxPlan !== -1 ? String(row[idxPlan]).trim() : "",
                        activation_date: idxDate !== -1 ? String(row[idxDate]).trim() : "",
                        imsi: idxImsi !== -1 ? String(row[idxImsi]).trim() : "",
                        tipo_celuseguro: idxTipoCeluSeguro !== -1 ? String(row[idxTipoCeluSeguro]).trim() : "",
                        tipo_factura: idxTipoFactura !== -1 ? String(row[idxTipoFactura]).trim() : "",
                        nombre: idxNombre !== -1 ? String(row[idxNombre]).trim() : "",
                        price_plan: idxPricePlan !== -1 ? String(row[idxPricePlan]).trim() : "",
                        status: "pending" as const
                    }));

                if (mappedRows.length === 0) {
                    alert("No se encontraron registros válidos.");
                    setLoading(false);
                    return;
                }

                setProgressStr(`Hojas cargadas: ${sheetsToRead.join(" | ")} · Registros: ${mappedRows.length}`);
                setRows(mappedRows);
                setStats(s => ({ ...s, total: mappedRows.length }));

                // Limitar a 50 registros para evitar timeout -> SOLUCIONADO CON BATCHES
                // const limitedData = mappedRows.slice(0, 50);
                await runAudit(mappedRows);

            } catch (error) {
                console.error("Error parsing excel:", error);
                alert("Error procesando el archivo. Intente nuevamente.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const runAudit = async (dataToAudit: AuditRow[]) => {
        setLoading(true);
        try {
            const BATCH_SIZE = 50;
            const BATCH_TIMEOUT_MS = 20000;
            let updatedRowsMap = new Map<number, AuditRow>();
            let matches = 0;
            let mismatches = 0;
            let missing = 0;
            const norm10 = (v: any) => String(v || '').replace(/\D/g, '').slice(-10);

            // Initialize all rows as pending first (or keep existing status if we are re-running?)
            // We'll assume we are running on the passed data. 

            for (let i = 0; i < dataToAudit.length; i += BATCH_SIZE) {
                const batch = dataToAudit.slice(i, i + BATCH_SIZE);
                setProgressStr(`Analizando ${i + 1} a ${Math.min(i + BATCH_SIZE, dataToAudit.length)} de ${dataToAudit.length}...`);

                console.log(`🔍 [BATCH] Processing batch ${i / BATCH_SIZE + 1} (${batch.length} items)`);

                const payload = batch.map(r => ({
                    BANs: { ban_number: r.ban },
                    Suscriptores: {
                        phone: r.phone,
                        imei: r.imei,
                        price_code: r.plan,
                        init_activation_date: r.activation_date,
                        imsi: r.imsi,
                        tipo_celuseguro: r.tipo_celuseguro,
                        tipo_factura: r.tipo_factura,
                        nombre: r.nombre,
                        price_plan: r.price_plan
                    }
                }));

                try {
                    const controller = new AbortController();
                    const timeoutId = window.setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);

                    let response: Response;
                    try {
                        response = await authFetch("/api/discrepancias/compare-excel", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ data: payload, mode: 'remote' }),
                            signal: controller.signal
                        });
                    } finally {
                        window.clearTimeout(timeoutId);
                    }

                    if (response.ok) {
                        const result = await response.json();
                        const discrepancies = result.data?.discrepancies || [];

                        // Process batch results
                        batch.forEach(row => {
                            const disc = discrepancies.find((d: any) =>
                                norm10(d.phone) === norm10(row.phone)
                            );

                            let newRow = { ...row };
                            if (disc) {
                                if (disc.type === 'MISSING_IN_REMOTE') {
                                    missing++;
                                    newRow.status = 'missing';
                                    newRow.dbData = null;
                                } else if (disc.type === 'MATCH') {
                                    matches++;
                                    newRow.status = 'matching';
                                    newRow.dbData = disc.dbData;
                                } else {
                                    mismatches++;
                                    newRow.status = 'mismatch';
                                    newRow.differences = disc.differences;
                                    newRow.dbData = disc.dbData;
                                }
                            } else {
                                // Si no llega resultado para esta fila, tratarla como faltante para evitar "Cargando..." infinito
                                missing++;
                                newRow.status = 'missing';
                                newRow.dbData = null;
                            }
                            updatedRowsMap.set(row.index, newRow);
                        });
                    } else {
                        const errorText = await response.text();
                        console.error(`Batch failed ${response.status}: ${errorText}`);
                        batch.forEach(row => {
                            updatedRowsMap.set(row.index, { ...row, status: 'missing', dbData: null });
                        });
                        missing += batch.length;
                    }
                } catch (e) {
                    const isAbort = e instanceof DOMException && e.name === 'AbortError';
                    console.error('Batch error', e);
                    if (isAbort) {
                        console.error(`Batch timeout after ${BATCH_TIMEOUT_MS}ms`);
                    }
                    batch.forEach(row => {
                        updatedRowsMap.set(row.index, { ...row, status: 'missing', dbData: null });
                    });
                    missing += batch.length;
                }
            }

            // Reconstruct the full list preserving order
            const finalRows = dataToAudit.map(r => updatedRowsMap.get(r.index) || r);

            setRows(finalRows);
            setStats({ total: finalRows.length, matching: matches, mismatch: mismatches, missing: missing });
            console.log('🔍 [FIXED] Análisis completado:', { total: finalRows.length, matches, mismatches, missing });

        } catch (error) {
            console.error("🔍 [FIXED] Error in audit:", error);
            alert('Error al procesar el archivo. Revise la consola para más detalles.');
        } finally {
            setLoading(false);
            setProgressStr("");
        }
    };

    const handleSyncToProduction = async () => {
        setSyncing(true);
        setShowConfirmModal(false);
        try {
            const dataToSync = rows.filter(r => r.status !== 'matching' && r.status !== 'pending');

            const response = await authFetch("/api/discrepancias/sync-remote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ changes: dataToSync })
            });

            if (response.ok) {
                const result = await response.json();
                setSyncResult(result.data);
                await runAudit(rows);
            } else {
                const errorText = await response.text();
                alert(`Error sincronizando: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error("Error syncing to remote:", error);
            alert('Error al sincronizar con producción');
        } finally {
            setSyncing(false);
        }
    };

    const exportCorrectionsToExcel = () => {
        if (savedCorrections.length === 0) {
            alert("No hay correcciones guardadas para exportar.");
            return;
        }
        const ws = XLSX.utils.json_to_sheet(savedCorrections);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Correcciones");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        XLSX.writeFile(wb, `reporte-correcciones-discrepancias-${stamp}.xlsx`);
    };

    const filteredRows = rows.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            r.phone.toLowerCase().includes(term) ||
            r.ban.toLowerCase().includes(term) ||
            r.imei.toLowerCase().includes(term) ||
            String(r.source_sheet || "").toLowerCase().includes(term);
        if (filterOnlyMismatches) {
            return matchesSearch && (r.status === 'mismatch' || r.status === 'missing' || r.status === 'pending');
        }
        return matchesSearch;
    });

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 p-8 font-sans">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-800 pb-8">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20">
                        <Database className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight uppercase">Cognos <span className="text-green-500">Corregida</span></h1>
                        <p className="text-slate-500 font-bold text-xs tracking-widest flex items-center gap-2">
                            <Globe className="w-3 h-3 text-blue-500" /> 159.203.70.5 PROD (FIXED)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!file ? (
                        <label className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl cursor-pointer transition-all font-black text-sm shadow-lg shadow-green-900/20">
                            <FileSpreadsheet className="w-5 h-5" />
                            CARGAR EXCEL (NUEVAS + RENOVACIONES)
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                        </label>
                    ) : (
                        <>
                            <button
                                onClick={() => setFilterOnlyMismatches(!filterOnlyMismatches)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all border ${filterOnlyMismatches
                                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                            >
                                <Filter className="w-4 h-4" />
                                {filterOnlyMismatches ? "SOLO ERRORES" : "MOSTRAR TODO"}
                            </button>

                            <button
                                onClick={exportCorrectionsToExcel}
                                disabled={savedCorrections.length === 0}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all border bg-slate-800 border-slate-700 text-slate-300 disabled:opacity-30"
                            >
                                <FileDown className="w-4 h-4" />
                                {savedCorrections.length > 0 ? `REPORTE (${savedCorrections.length})` : "REPORTE"}
                            </button>

                            <button
                                onClick={() => setShowConfirmModal(true)}
                                disabled={loading || syncing || stats.mismatch + stats.missing === 0}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 disabled:opacity-30"
                            >
                                {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {syncing ? "SINCRONIZANDO..." : (loading ? (progressStr || "ANALIZANDO...") : `SINCRONIZAR (${stats.mismatch + stats.missing})`)}
                            </button>

                            <button onClick={resetAudit} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl">
                                <X className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </header>

            {file && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: 'Analizados', val: stats.total, color: 'text-white' },
                            { label: 'Correctos', val: stats.matching, color: 'text-emerald-400' },
                            { label: 'Diferencias', val: stats.mismatch, color: 'text-yellow-400' },
                            { label: 'No Existen', val: stats.missing, color: 'text-red-500' }
                        ].map((s, i) => (
                            <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</p>
                                <h3 className={`text-4xl font-black ${s.color} tabular-nums tracking-tighter`}>{s.val}</h3>
                            </div>
                        ))}
                    </div>

                    {/* Buscador */}
                    <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar teléfono..."
                            className="w-full bg-slate-900/50 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-green-600 outline-none transition-all text-sm font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Lista de Registros */}
                    <div className="grid grid-cols-1 gap-4">
                        {filteredRows.length === 0 && (
                            <div className="py-20 text-center text-slate-600 font-bold border-2 border-dashed border-slate-800 rounded-2xl">
                                <CheckCircle2 className="mx-auto w-10 h-10 mb-4 opacity-20" />
                                {filterOnlyMismatches ? "No hay diferencias detectadas." : "No se encontraron resultados."}
                            </div>
                        )}

                        {filteredRows.map((row, rIdx) => (
                            <motion.div
                                key={rIdx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all ${row.status === 'mismatch' ? 'border-yellow-500/20' :
                                    row.status === 'missing' ? 'border-red-500/20' : 'border-slate-800'
                                    }`}
                            >
                                <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <span className="text-slate-500 font-mono text-sm">#{row.index}</span>
                                        {row.source_sheet && (
                                            <span className="px-2 py-1 bg-slate-700 text-slate-200 text-[10px] font-black rounded-md uppercase">
                                                {row.source_sheet}
                                            </span>
                                        )}
                                        <h4 className="text-lg font-black text-white tracking-tight">Línea <span className="text-green-500">{row.phone}</span></h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {row.status === 'pending' && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
                                        {row.status === 'missing' && <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase">Missing en BD</span>}
                                        {row.status === 'mismatch' && <span className="px-3 py-1 bg-yellow-500 text-black text-[10px] font-black rounded-lg uppercase">Diferencia</span>}
                                        {row.status === 'matching' && <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-lg uppercase">Correcto</span>}
                                    </div>
                                </div>

                                <div className="p-6 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] text-slate-500 font-black uppercase tracking-widest border-b-2 border-slate-700">
                                                <th className="pb-3 pr-4 w-32">CAMPO</th>
                                                <th className="pb-3 pr-4">EXCEL (REFERENCIA)</th>
                                                <th className="pb-3 w-10"></th>
                                                <th className="pb-3">BASE DE DATOS (EDITABLE)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {[
                                                { label: 'FECHA', excelKey: 'activation_date', dbKey: 'fecha' },
                                                { label: 'BAN', excelKey: 'ban', dbKey: 'ban' },
                                                { label: 'SUSCRIBER', excelKey: 'phone', dbKey: 'suscriber' },
                                                { label: 'NOMBRE', excelKey: 'nombre', dbKey: 'nombre' },
                                                { label: 'SIMCARD', excelKey: 'imsi', dbKey: 'simcard' },
                                                { label: 'IMEI', excelKey: 'imei', dbKey: 'imei' },
                                                { label: 'PAPER', excelKey: 'tipo_factura', dbKey: 'paper' },
                                                { label: 'SEGURO', excelKey: 'tipo_celuseguro', dbKey: 'seguro' },
                                                { label: 'PRICE CODE', excelKey: 'plan', dbKey: 'price_code' },
                                                { label: 'PRICE PLAN', excelKey: 'price_plan', dbKey: 'price_plan' }
                                            ].map((field, fIdx) => {
                                                const excelVal = (row as any)[field.excelKey] || '';
                                                const dbValRaw = row.dbData ? row.dbData[field.dbKey] : null;
                                                let dbVal = dbValRaw ? String(dbValRaw).trim() : (row.status === 'missing' ? '' : 'Cargando...');

                                                // Date fix for DB values (already correct usually)
                                                if (field.excelKey === 'activation_date' && dbValRaw && !isNaN(Date.parse(dbValRaw))) {
                                                    dbVal = new Date(dbValRaw).toISOString().split('T')[0];
                                                }

                                                // Date fix for Excel values (Apply helper)
                                                if (field.excelKey === 'activation_date' && excelVal) {
                                                    // If it looks like a number, parse it
                                                    if (!isNaN(Number(excelVal)) && !String(excelVal).includes('-')) {
                                                        // Use helper (we'll call it inline or defined above)
                                                        // But we can't update 'excelVal' variable inside map easily without side effects if we want to show it.
                                                        // Better to transform it right here for comparison and display

                                                        // Wait, 'excelVal' is const. We need to create a displayVal
                                                    }
                                                }

                                                let displayExcelVal = excelVal;
                                                if (field.excelKey === 'activation_date' && excelVal) {
                                                    displayExcelVal = excelDateToJSDate(excelVal);
                                                }

                                                const hasDiff =
                                                    dbVal !== '' &&
                                                    dbVal !== 'Cargando...' &&
                                                    !areFieldValuesEquivalent(field.excelKey, String(displayExcelVal || ''), String(dbVal || ''));

                                                return (
                                                    <tr key={fIdx} className="group hover:bg-slate-800/20 transition-all">
                                                        <td className="py-3 pr-4 text-[10px] font-bold text-slate-400">{field.label}</td>
                                                        <td className="py-3 pr-4">
                                                            <div className="text-sm font-mono text-slate-400 font-semibold">
                                                                {displayExcelVal || '(vacío)'}
                                                            </div>
                                                        </td>
                                                        <td className="py-3">
                                                            <ArrowRight className={`w-3 h-3 ${hasDiff ? 'text-red-500' : 'text-slate-800'}`} />
                                                        </td>
                                                        <td className="py-3">
                                                            <input
                                                                value={dbVal}
                                                                onChange={(e) => {
                                                                    const updatedRows = [...rows];
                                                                    if (!updatedRows[row.index - 1].dbData) {
                                                                        updatedRows[row.index - 1].dbData = {};
                                                                    }
                                                                    updatedRows[row.index - 1].dbData[field.dbKey] = e.target.value;
                                                                    setRows(updatedRows);
                                                                }}
                                                                disabled={row.status === 'missing'}
                                                                className={`w-full bg-slate-800/50 border-2 px-3 py-2 font-mono text-sm outline-none transition-all rounded-lg ${hasDiff
                                                                    ? 'border-red-600 text-white font-black bg-red-900/20'
                                                                    : 'border-slate-700 text-emerald-400'
                                                                    } focus:border-blue-500 disabled:opacity-30 disabled:cursor-not-allowed`}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {row.status !== 'missing' && (
                                        <div className="mt-6 flex justify-end gap-3">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        // Normalizar valores de paper y seguro
                                                        const dbData = { ...row.dbData };
                                                        // PAPER / SEGURO normalizados para evitar invertir valores
                                                        const normalizedPaper = normalizeYesNo(dbData.paper, 'paper');
                                                        const normalizedSeguro = normalizeYesNo(dbData.seguro, 'seguro');
                                                        if (normalizedPaper) dbData.paper = normalizedPaper;
                                                        if (normalizedSeguro) dbData.seguro = normalizedSeguro;
                                                        const response = await authFetch('/api/discrepancias/update-row', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                phone: row.phone,
                                                                ban: row.ban,
                                                                ventaid: row.dbData?.ventaid,
                                                                data: dbData
                                                            })
                                                        });

                                                        const payload = await response.json().catch(() => null);

                                                        if (!response.ok) {
                                                            const errorText = payload?.error || payload?.message || `HTTP ${response.status}`;
                                                            alert(`Error: ${errorText}`);
                                                            return;
                                                        }

                                                        setSavedCorrections(prev => [
                                                            ...prev,
                                                            {
                                                                fecha_hora: new Date().toISOString(),
                                                                telefono: String(row.phone || ''),
                                                                ban: String(row.ban || ''),
                                                                ventaid: String(row.dbData?.ventaid || ''),
                                                                nombre_editado: String(dbData.nombre || ''),
                                                                nombre_tango: String(payload?.details?.nombre_part || ''),
                                                                apellido_tango: String(payload?.details?.apellido_part || ''),
                                                                paper: String(dbData.paper || ''),
                                                                seguro: String(dbData.seguro || ''),
                                                                price_code: String(dbData.price_code || ''),
                                                                price_plan: String(dbData.price_plan || ''),
                                                                actualizado_venta: Number(payload?.details?.ventaRowsAffected || 0),
                                                                actualizado_cliente: Number(payload?.details?.clienteRowsAffected || 0)
                                                            }
                                                        ]);

                                                        alert('Registro actualizado y agregado al reporte.');
                                                    } catch (error) {
                                                        console.error('Error:', error);
                                                        alert('❌ Error al guardar');
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all"
                                            >
                                                <Save className="w-4 h-4" />
                                                GUARDAR CAMBIOS
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {!file && (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-900 border-2 border-dashed border-slate-800 rounded-3xl">
                    <FileSpreadsheet className="w-12 h-12 text-slate-700 mb-4" />
                    <h2 className="text-xl font-black text-white mb-1 uppercase tracking-tight">Analizador Cognos - CORREGIDO</h2>
                    <p className="text-slate-500 text-sm font-bold">Versión optimizada con límite de 50 filas para evitar timeouts</p>
                    <p className="text-slate-600 text-xs font-bold mt-2">Conectado a 159.203.70.5:5432 (PostgreSQL 9.3.24)</p>
                </div>
            )}

            {/* Modal de confirmación */}
            <AnimatePresence>
                {showConfirmModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-sm w-full p-8 text-center"
                        >
                            <AlertCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                            <h2 className="text-xl font-black text-white mb-2 uppercase">Confirmar Sincronización</h2>
                            <p className="text-slate-400 text-sm font-bold mb-8">
                                Se actualizarán <span className="text-green-500 font-black">{stats.mismatch + stats.missing}</span> líneas en el servidor legacy.
                            </p>
                            <div className="flex gap-4">
                                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs">CANCELAR</button>
                                <button onClick={handleSyncToProduction} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black text-xs shadow-lg shadow-green-900/30">SINCRONIZAR</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
