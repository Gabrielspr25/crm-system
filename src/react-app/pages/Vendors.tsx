import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Building, Mail, Key, User, Shield, CheckCircle } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface Preset {
  id: number;
  name: string;
  effects: Record<string, string>;
}

interface Vendor {
  id: number;
  name: string;
  email: string | null;
  commission_percentage: number;
  salesperson_id?: string | null;
  salesperson_role?: "admin" | "supervisor" | "vendedor" | null;
  permission_preset_id?: number | null;
  permission_preset_name?: string | null;
  is_active: number;
  created_at: string;
}

export default function Vendors() {
  const currentUser = getCurrentUser();
  const role = String(currentUser?.role || "").toLowerCase();
  const canViewVendorsFinancials = role === "admin" || role === "supervisor";
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    commission_percentage: "50.00",
    role: "vendedor" as "admin" | "supervisor" | "vendedor",
    username: "",
    password: "",
  });

  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [presetApplied, setPresetApplied] = useState(false);

  const { data: vendors, loading: vendorsLoading, refetch: refetchVendors } = useApi<Vendor[]>("/api/vendors");

  useEffect(() => {
    authFetch("/api/permissions/presets")
      .then((r) => r.json())
      .then((data) => setPresets(Array.isArray(data) ? data : []))
      .catch(() => setPresets([]));
  }, []);

  const filteredVendors = (vendors || []).filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingVendor) {
        await authFetch(`/api/vendors/${editingVendor.id}`, {
          method: "PUT",
          json: {
            ...formData,
            salesperson_id: editingVendor.salesperson_id || null,
          },
        });
      } else {
        await authFetch("/api/vendors", {
          method: "POST",
          json: formData,
        });
      }

      setShowModal(false);
      setEditingVendor(null);
      resetForm();
      refetchVendors();
    } catch (error) {
      console.error("Error saving vendor:", error);
      alert("Error al guardar vendedor");
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || "",
      commission_percentage: vendor.commission_percentage?.toString() || "50.00",
      role: vendor.salesperson_role || "vendedor",
      username: "",
      password: "",
    });
    setSelectedPresetId(vendor.permission_preset_id ? String(vendor.permission_preset_id) : "");
    setPresetApplied(false);
    setShowModal(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`¿Está seguro de eliminar el vendedor "${vendor.name}"?`)) return;

    try {
      const response = await authFetch(`/api/vendors/${vendor.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Error al eliminar el vendedor");
        return;
      }

      refetchVendors();
    } catch (error) {
      console.error("Error deleting vendor:", error);
      alert("Error al eliminar el vendedor");
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPresetId || !editingVendor?.salesperson_id) {
      alert("Selecciona un perfil y asegúrate de que el vendedor tenga una cuenta vinculada");
      return;
    }

    setApplyingPreset(true);
    try {
      const response = await authFetch(
        `/api/permissions/presets/${selectedPresetId}/apply-salesperson/${editingVendor.salesperson_id}`,
        { method: "POST" }
      );

      if (!response.ok) {
        const err = await response.json();
        alert(err.error || "Error aplicando perfil");
        return;
      }

      setPresetApplied(true);
      refetchVendors();
    } catch (error) {
      console.error("Error applying preset:", error);
      alert("Error al aplicar el perfil de acceso");
    } finally {
      setApplyingPreset(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      commission_percentage: "50.00",
      role: "vendedor",
      username: "",
      password: "",
    });
    setSelectedPresetId("");
    setPresetApplied(false);
  };

  useEffect(() => {
    if (formData.name && !editingVendor) {
      const firstName = formData.name.split(' ')[0].toLowerCase();
      const autoUsername = firstName.replace(/[^a-z0-9]/g, '');
      const autoPassword = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}2025!`;

      setFormData(prev => ({
        ...prev,
        username: autoUsername,
        password: autoPassword,
      }));
    }
  }, [formData.name, editingVendor]);

  if (!canViewVendorsFinancials) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-slate-300">
        No tienes acceso a la configuracion de vendedores.
      </div>
    );
  }

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600 dark:text-gray-300">Cargando vendedores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tu equipo de ventas</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingVendor(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Vendedor
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar vendedores..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-300"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVendors.map((vendor) => (
          <div key={vendor.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 hover:shadow-xl transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{vendor.name}</h3>
                    {vendor.email && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <Mail className="w-3 h-3 mr-1" />
                        {vendor.email}
                      </div>
                    )}
                    <div className="mt-2 inline-flex items-center px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                        % Comisión: {vendor.commission_percentage || 50}%
                      </span>
                    </div>
                    <div className="mt-1 inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Shield className="w-3 h-3 mr-1 text-blue-700 dark:text-blue-300" />
                      <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Perfil: {vendor.salesperson_role || "vendedor"}
                      </span>
                    </div>
                    {vendor.permission_preset_name && (
                      <div className="mt-1 inline-flex items-center px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <Key className="w-3 h-3 mr-1 text-purple-700 dark:text-purple-300" />
                        <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                          Acceso: {vendor.permission_preset_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vendor)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Creado: {new Date(vendor.created_at).toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay vendedores</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? "No se encontraron vendedores con ese criterio" : "Comienza agregando un nuevo vendedor"}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingVendor ? "Editar Vendedor" : "Nuevo Vendedor"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Perfil *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "supervisor" | "vendedor" })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  % Comisión *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="50.00"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Porcentaje de comisión sobre la ganancia de la empresa
                </p>
              </div>

              {!editingVendor && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <User className="w-4 h-4 inline mr-1" />
                      Usuario de Login *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="usuario"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Key className="w-4 h-4 inline mr-1" />
                      Contraseña Inicial *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Esta contraseña se usará para el primer login
                    </p>
                  </div>
                </>
              )}

              {/* Perfil de acceso — solo al editar un vendedor con cuenta */}
              {editingVendor && (
                <div className="border-t border-gray-200 dark:border-slate-600 pt-4 mt-2">
                  <div className="flex items-center mb-2">
                    <Shield className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Perfil de acceso</span>
                  </div>

                  {!editingVendor.salesperson_id ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                      Este vendedor no tiene una cuenta de login vinculada. Crea la cuenta primero para asignar un perfil de acceso.
                    </p>
                  ) : presets.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg">
                      No hay perfiles de acceso configurados. Créalos desde la sección Usuarios y Permisos.
                    </p>
                  ) : (
                    <>
                      {editingVendor.permission_preset_name && !presetApplied && (
                        <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                          Perfil actual: <strong>{editingVendor.permission_preset_name}</strong>
                        </p>
                      )}
                      {presetApplied && (
                        <div className="flex items-center text-xs text-green-700 dark:text-green-400 mb-2">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Perfil aplicado correctamente
                        </div>
                      )}
                      <div className="flex gap-2">
                        <select
                          value={selectedPresetId}
                          onChange={(e) => { setSelectedPresetId(e.target.value); setPresetApplied(false); }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white"
                        >
                          <option value="">— Seleccionar perfil —</option>
                          {presets.map((p) => (
                            <option key={p.id} value={String(p.id)}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleApplyPreset}
                          disabled={!selectedPresetId || applyingPreset}
                          className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          {applyingPreset ? "Aplicando..." : "Aplicar"}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Aplica el perfil seleccionado sin cerrar el formulario
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingVendor(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  {editingVendor ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
