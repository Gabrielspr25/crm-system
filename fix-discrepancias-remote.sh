#!/bin/bash

echo "🔧 APLICANDO CORRECCIONES AL SERVIDOR REMOTO..."

echo "1. Creando archivo de respuestas faltante..."
cat > src/backend/utils/responses.js << 'EOF'
export const success = (res, data = null, message = 'Operación exitosa') => {
    res.status(200).json({
        success: true,
        message,
        data
    });
};

export const badRequest = (res, message = 'Solicitud incorrecta') => {
    res.status(400).json({
        success: false,
        message
    });
};

export const unauthorized = (res, message = 'No autorizado') => {
    res.status(401).json({
        success: false,
        message
    });
};

export const forbidden = (res, message = 'Prohibido') => {
    res.status(403).json({
        success: false,
        message
    });
};

export const notFound = (res, message = 'Recurso no encontrado') => {
    res.status(404).json({
        success: false,
        message
    });
};

export const serverError = (res, error, message = 'Error interno del servidor') => {
    console.error('Server Error:', error);
    res.status(500).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};
EOF

echo "2. Creando página corregida de discrepancias..."
cat > src/react-app/pages/DiscrepanciasFixed.tsx << 'EOF'
import React, { useState } from "react";
import { Search, Globe, FileSpreadsheet, CheckCircle2, Loader2, Database, X, Save, AlertCircle, Filter } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";

interface AuditRow {
    index: number;
    phone: string;
    ban: string;
    imei: string;
    plan: string;
    activation_date: string;
    imsi: string;
    product_type: string;
    nombre: string;
    codigo_voz: string;
    valor: string;
    status: "pending" | "matching" | "mismatch" | "missing" | "error";
    differences?: any[];
    dbData?: any;
}

export default function DiscrepanciasFixedPage() {
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const [filterOnlyMismatches, setFilterOnlyMismatches] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        matching: 0,
        mismatch: 0,
        missing: 0
    });

    const resetAudit = () => {
        setFile(null);
        setRows([]);
        setStats({ total: 0, matching: 0, mismatch: 0, missing: 0 });
        setSyncResult(null);
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
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];

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

                const findIdx = (keywords: string[]) => headers.findIndex(h => {
                    const s = String(h).toUpperCase();
                    return keywords.some(k => s.includes(k.toUpperCase()));
                });

                const idxPhone = findIdx(["SUBSCRIBER_NO", "CELULAR", "TELEFONO", "PHONE", "SUSCRIBER"]);
                const idxBan = findIdx(["BAN", "ACCT_NO"]);
                const idxImei = findIdx(["IMEI", "SERIAL", "EMAI"]);
                const idxPlan = findIdx(["PRICE_CODE", "PLAN"]);
                const idxDate = findIdx(["INIT_ACTIVATION_DATE", "FECHA"]);
                const idxImsi = findIdx(["IMSI", "SIMCARD"]);
                const idxSeguro = findIdx(["PRODUCT_TYPE", "SEGURO", "TIPO_CELU", "SEG"]);
                const idxNombre = findIdx(["NOMBRE", "NAME", "CUSTOMER"]);
                const idxCodigoVoz = findIdx(["CODIGO_VOZ", "CODIGOVOZ", "CODIGO VOZ"]);
                const idxValor = findIdx(["VALOR", "RENTA", "MONTHLY", "PRICE"]);

                const dataRows = jsonData.slice(headerRowIdx + 1);

                const mappedRows: AuditRow[] = dataRows
                    .filter(row => {
                        const val = row[idxPhone !== -1 ? idxPhone : 0];
                        return val && String(val).replace(/[^0-9]/g, '').length >= 8;
                    })
                    .map((row, idx) => ({
                        index: idx + 1,
                        phone: idxPhone !== -1 ? String(row[idxPhone]).trim() : "",
                        ban: idxBan !== -1 ? String(row[idxBan]).trim() : "",
                        imei: idxImei !== -1 ? String(row[idxImei]).trim() : "",
                        plan: idxPlan !== -1 ? String(row[idxPlan]).trim() : "",
                        activation_date: idxDate !== -1 ? String(row[idxDate]).trim() : "",
                        imsi: idxImsi !== -1 ? String(row[idxImsi]).trim() : "",
                        product_type: idxSeguro !== -1 ? String(row[idxSeguro]).trim() : "",
                        nombre: idxNombre !== -1 ? String(row[idxNombre]).trim() : "",
                        codigo_voz: idxCodigoVoz !== -1 ? String(row[idxCodigoVoz]).trim() : "",
                        valor: idxValor !== -1 ? String(row[idxValor]).trim() : "",
                        status: "pending" as const
                    }));

                if (mappedRows.length === 0) {
                    alert("No se encontraron registros válidos.");
                    setLoading(false);
                    return;
                }

                setRows([]);
                setStats({ total: 0, matching: 0, mismatch: 0, missing: 0 });
                
                // Procesar por lotes de 50 para evitar timeout
                const BATCH_SIZE = 50;
                for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
                    const batch = mappedRows.slice(i, i + BATCH_SIZE);
                    await runAudit(batch);
                }

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
            console.log('🔍 [FIXED] Enviando datos a comparar:', dataToAudit.length, 'registros');
            
            const payload = dataToAudit.map(r => ({
                BANs: { ban_number: r.ban },
                Suscriptores: {
                    phone: r.phone,
                    imei: r.imei,
                    price_code: r.plan,
                    init_activation_date: r.activation_date,
                    imsi: r.imsi,
                    product_type: r.product_type
                }
            }));

            const response = await authFetch("/api/discrepancias/compare-excel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: payload, mode: 'remote' })
            });

            console.log('🔍 [FIXED] Response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('🔍 [FIXED] Response data:', result);
                const discrepancies = result.data?.discrepancies || [];

                let matches = 0;
                let mismatches = 0;
                let missing = 0;

                const updatedRows = dataToAudit.map(row => {
                    const disc = discrepancies.find((d: any) => 
                        String(d.phone).slice(-10) === String(row.phone).slice(-10)
                    );

                    if (disc) {
                        if (disc.type === 'MISSING_IN_REMOTE') {
                            missing++;
                            return { ...row, status: 'missing' as const, dbData: null };
                        } else if (disc.type === 'MATCH') {
                            matches++;
                            return { ...row, status: 'matching' as const, dbData: disc.dbData };
                        } else {
                            mismatches++;
                            return { ...row, status: 'mismatch' as const, differences: disc.differences, dbData: disc.dbData };
                        }
                    } else {
                        matches++;
                        return { ...row, status: 'matching' as const, dbData: null };
                    }
                });

                setRows(prev => [...prev, ...updatedRows]);
                setStats(prev => ({ 
                    total: prev.total + updatedRows.length, 
                    matching: prev.matching + matches, 
                    mismatch: prev.mismatch + mismatches, 
                    missing: prev.missing + missing 
                }));
                console.log('🔍 [FIXED] Análisis completado:', { total: updatedRows.length, matches, mismatches, missing });
            } else {
                const errorText = await response.text();
                console.error('🔍 [FIXED] Error response:', errorText);
                alert(`Error del servidor: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error("🔍 [FIXED] Error in audit:", error);
            alert('Error al procesar el archivo. Revise la consola para más detalles.');
        } finally {
            setLoading(false);
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

    const filteredRows = rows.filter(r => {
        const matchesSearch = r.phone.includes(searchTerm) || r.ban.includes(searchTerm) || r.imei.includes(searchTerm);
        if (filterOnlyMismatches) {
            return matchesSearch && (r.status === 'mismatch' || r.status === 'missing' || r.status === 'pending');
        }
        return matchesSearch;
    });

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 p-8 font-sans">
            <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-800 pb-8">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20">
                        <Database className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight uppercase">Auditoria <span className="text-green-500">Corregida</span></h1>
                        <p className="text-slate-500 font-bold text-xs tracking-widest flex items-center gap-2">
                            <Globe className="w-3 h-3 text-blue-500" /> {window.location.hostname} (FIXED)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!file ? (
                        <label className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl cursor-pointer transition-all font-black text-sm shadow-lg shadow-green-900/20">
                            <FileSpreadsheet className="w-5 h-5" />
                            CARGAR EXCEL (MAX 50 FILAS)
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
                                onClick={() => setShowConfirmModal(true)}
                                disabled={loading || syncing || stats.mismatch + stats.missing === 0}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 disabled:opacity-30"
                            >
                                {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                SINCRONIZAR ({stats.mismatch + stats.missing})
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
                                className={`bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all ${
                                    row.status === 'mismatch' ? 'border-yellow-500/20' :
                                    row.status === 'missing' ? 'border-red-500/20' : 'border-slate-800'
                                }`}
                            >
                                <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <span className="text-slate-500 font-mono text-sm">#{row.index}</span>
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
                                    <div className="text-sm text-slate-400">
                                        <p><strong>Estado:</strong> {row.status}</p>
                                        <p><strong>BAN:</strong> {row.ban || 'N/A'}</p>
                                        <p><strong>Plan:</strong> {row.plan || 'N/A'}</p>
                                        <p><strong>IMEI:</strong> {row.imei || 'N/A'}</p>
                                        {row.differences && (
                                            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                                <p className="text-yellow-400 font-black text-xs mb-2">DIFERENCIAS:</p>
                                                {row.differences.map((diff: any, idx: number) => (
                                                    <p key={idx} className="text-xs text-slate-300">
                                                        {diff.field}: "{diff.db}" → "{diff.excel}"
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {!file && (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-900 border-2 border-dashed border-slate-800 rounded-3xl">
                    <FileSpreadsheet className="w-12 h-12 text-slate-700 mb-4" />
                    <h2 className="text-xl font-black text-white mb-1 uppercase tracking-tight">Analizador de Discrepancias - CORREGIDO</h2>
                    <p className="text-slate-500 text-sm font-bold">Versión optimizada con límite de 50 filas para evitar timeouts</p>
                    <p className="text-slate-600 text-xs font-bold mt-2">Conectado a 159.203.70.5:5432 (PostgreSQL 9.3.24)</p>
                </div>
            )}

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
EOF

echo "3. Actualizando App.tsx para usar la página corregida..."
# Reemplazar la importación en App.tsx
sed -i 's/import DiscrepanciasPage from "@\/react-app\/pages\/Discrepancias";/import DiscrepanciasFixedPage from "@\/react-app\/pages\/DiscrepanciasFixed";/' src/react-app/App.tsx
sed -i 's/<DiscrepanciasPage \/>/<DiscrepanciasFixedPage \/>/' src/react-app/App.tsx

echo "4. Actualizando server-FINAL.js con las rutas de discrepancias..."
# Añadir importación de discrepanciasRoutes
if ! grep -q "import discrepanciasRoutes" server-FINAL.js; then
    sed -i '/import posIntegrationRoutes from .\/src\/backend\/routes\/posIntegrationRoutes.js;/a import discrepanciasRoutes from '\''./src/backend/routes/discrepanciasRoutes.js'\'';' server-FINAL.js
fi

# Añadir montaje de ruta
if ! grep -q "app.use('\''\/api\/discrepancias'\''" server-FINAL.js; then
    sed -i '/app.use('\''\/api\/pos'\'', posIntegrationRoutes);/a app.use('\''\/api\/discrepancias'\'', discrepanciasRoutes);' server-FINAL.js
fi

echo "5. Actualizando versión..."
echo 'export const APP_VERSION = "2026-258";' > src/version.ts
echo 'export const BUILD_LABEL = "v2026-258 - Fixed discrepancias on remote server";' >> src/version.ts

echo "6. Reconstruyendo y reiniciando..."
npm run build
pm2 restart crm-pro  # o systemctl restart tu-servicio

echo "✅ CAMBIOS APLICADOS EN SERVIDOR REMOTO"
echo "🔄 El módulo de discrepancias ya debe funcionar"
echo "🌐 Abre tu aplicación en el navegador"