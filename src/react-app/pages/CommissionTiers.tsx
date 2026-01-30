import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import { authFetch } from '@/react-app/utils/auth';

interface Product {
  id: string;
  name: string;
}

interface Tier {
  id: string;
  product_id: string;
  range_min: number;
  range_max: number | null;
  commission_amount: number;
  product_name?: string;
}

export default function CommissionTiers() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [formData, setFormData] = useState({
    product_id: '',
    range_min: '',
    range_max: '',
    commission_amount: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tiersRes, productsRes] = await Promise.all([
        authFetch('/api/products/tiers'),
        authFetch('/api/products')
      ]);

      if (tiersRes.ok) {
        const tiersData = await tiersRes.json();
        setTiers(tiersData);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      product_id: formData.product_id,
      range_min: parseFloat(formData.range_min),
      range_max: formData.range_max ? parseFloat(formData.range_max) : null,
      commission_amount: parseFloat(formData.commission_amount)
    };

    try {
      const url = editingTier
        ? `/api/products/tiers/${editingTier.id}`
        : '/api/products/tiers';
      
      const response = await authFetch(url, {
        method: editingTier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await loadData();
        closeModal();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error guardando tier:', error);
      alert('Error al guardar tier');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este tier de comisión?')) return;

    try {
      const response = await authFetch(`/api/products/tiers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Error eliminando tier');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openModal = (tier?: Tier) => {
    if (tier) {
      setEditingTier(tier);
      setFormData({
        product_id: tier.product_id,
        range_min: tier.range_min.toString(),
        range_max: tier.range_max?.toString() || '',
        commission_amount: tier.commission_amount.toString()
      });
    } else {
      setEditingTier(null);
      setFormData({
        product_id: '',
        range_min: '',
        range_max: '',
        commission_amount: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTier(null);
    setFormData({
      product_id: '',
      range_min: '',
      range_max: '',
      commission_amount: ''
    });
  };

  const groupedTiers = products.reduce((acc, product) => {
    acc[product.id] = {
      product,
      tiers: tiers.filter(t => t.product_id === product.id).sort((a, b) => a.range_min - b.range_min)
    };
    return acc;
  }, {} as Record<string, { product: Product; tiers: Tier[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando tiers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tiers de Comisiones</h1>
            <p className="text-sm text-gray-500">Gestionar comisiones por rangos de cantidad</p>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Tier
        </button>
      </div>

      {/* Tiers por Producto */}
      <div className="grid gap-6">
        {Object.values(groupedTiers).map(({ product, tiers: productTiers }) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white">{product.name}</h2>
              <p className="text-green-100 text-sm">{productTiers.length} tiers configurados</p>
            </div>

            {productTiers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No hay tiers configurados para este producto</p>
                <button
                  onClick={() => openModal({ product_id: product.id } as Tier)}
                  className="mt-4 text-green-600 hover:text-green-700 font-medium"
                >
                  + Agregar primer tier
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rango Mínimo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rango Máximo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión ($)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {productTiers.map((tier) => (
                      <tr key={tier.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{tier.range_min}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {tier.range_max ? tier.range_max : '∞'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            ${tier.commission_amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openModal(tier)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(tier.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {editingTier ? 'Editar Tier' : 'Nuevo Tier'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Producto *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  disabled={!!editingTier}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Seleccionar producto</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rango Mínimo (cantidad) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.range_min}
                  onChange={(e) => setFormData({ ...formData, range_min: e.target.value })}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: 0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rango Máximo (cantidad)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.range_max}
                  onChange={(e) => setFormData({ ...formData, range_max: e.target.value })}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Dejar vacío para sin límite (∞)"
                />
                <p className="mt-1 text-xs text-gray-500">Dejar vacío para "infinito"</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comisión ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.commission_amount}
                  onChange={(e) => setFormData({ ...formData, commission_amount: e.target.value })}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: 25.00"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingTier ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
