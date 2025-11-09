import { useState } from "react";
import { Plus, Search, Edit, Trash2, Building, Mail } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Vendor {
  id: number;
  name: string;
  email: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export default function Vendors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  const { data: vendors, loading: vendorsLoading, refetch: refetchVendors } = useApi<Vendor[]>("/api/vendors");

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
          json: formData,
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
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || "",
    });
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

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
    });
  };

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando vendedores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-gray-600 mt-1">Gestiona tu equipo de ventas</p>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar vendedores..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
        />
      </div>

      {/* Vendors Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVendors.map((vendor) => (
          <div key={vendor.id} className="bg-gray-100 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
                    {vendor.email && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Mail className="w-3 h-3 mr-1" />
                        {vendor.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vendor)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Creado: {new Date(vendor.created_at).toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay vendedores</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? "No se encontraron vendedores con ese criterio" : "Comienza agregando un nuevo vendedor"}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-100 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingVendor ? "Editar Vendedor" : "Nuevo Vendedor"}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingVendor(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
