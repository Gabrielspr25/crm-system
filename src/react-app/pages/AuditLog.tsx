import { useState, useEffect } from "react";
import { Clock, User, FileText, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "../hooks/useApi";

interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_name: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  'MOVER_A_SEGUIMIENTO': 'Movió a Seguimiento',
  'DEVOLVER': 'Devolvió al Pool',
  'COMPLETAR_VENTA': 'Completó Venta',
  'CREAR': 'Creó',
  'EDITAR': 'Editó',
  'ELIMINAR': 'Eliminó',
};

const actionColors: Record<string, string> = {
  'MOVER_A_SEGUIMIENTO': 'bg-blue-900/40 text-blue-200 border-blue-500/30',
  'DEVOLVER': 'bg-orange-900/40 text-orange-200 border-orange-500/30',
  'COMPLETAR_VENTA': 'bg-green-900/40 text-green-200 border-green-500/30',
  'CREAR': 'bg-purple-900/40 text-purple-200 border-purple-500/30',
  'EDITAR': 'bg-yellow-900/40 text-yellow-200 border-yellow-500/30',
  'ELIMINAR': 'bg-red-900/40 text-red-200 border-red-500/30',
};

export default function AuditLog() {
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, loading, refetch } = useApi<{
    logs: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/audit-log?limit=${limit}&offset=${(page - 1) * limit}${filterAction ? `&action=${filterAction}` : ''}${filterUser ? `&username=${filterUser}` : ''}`);

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    refetch();
  }, [page, filterAction, filterUser]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-400" />
          Historial de Auditoría
        </h1>
        <p className="text-gray-400 mt-2">
          Registro completo de todas las acciones realizadas en el sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Acción</label>
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas las acciones</option>
              <option value="MOVER_A_SEGUIMIENTO">Mover a Seguimiento</option>
              <option value="DEVOLVER">Devolver</option>
              <option value="COMPLETAR_VENTA">Completar Venta</option>
              <option value="CREAR">Crear</option>
              <option value="EDITAR">Editar</option>
              <option value="ELIMINAR">Eliminar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
            <input
              type="text"
              value={filterUser}
              onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
              placeholder="Filtrar por usuario..."
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <p className="text-gray-300">
          Mostrando <span className="font-semibold text-white">{logs.length}</span> de{' '}
          <span className="font-semibold text-white">{total}</span> registros
        </p>
      </div>

      {/* Tabla */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-600" />
            <h3 className="mt-2 text-sm font-medium text-gray-300">No hay registros</h3>
            <p className="mt-1 text-sm text-gray-500">No se encontraron registros de auditoría con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Fecha/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Entidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Detalles
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Clock className="w-4 h-4 text-gray-500" />
                        {formatDate(log.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-white">{log.username || 'Sistema'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${actionColors[log.action] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {log.entity_name && (
                          <div className="font-medium text-white">{log.entity_name}</div>
                        )}
                        {log.entity_type && (
                          <div className="text-xs text-gray-500">
                            {log.entity_type} #{log.entity_id}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-400 max-w-md truncate">
                        {log.details || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-500">
                        {log.ip_address || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-gray-800 rounded-lg border border-gray-700 px-4 py-3">
          <div className="text-sm text-gray-400">
            Página {page} de {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
