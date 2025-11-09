import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Package, User, Calendar } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

interface SalesRecord {
  id: number;
  client_id: number;
  prospect_id: number | null;
  company_name: string;
  vendor_id: number | null;
  vendor_name: string | null;
  total_amount: number;
  fijo_ren: number;
  fijo_new: number;
  movil_nueva: number;
  movil_renovacion: number;
  claro_tv: number;
  cloud: number;
  mpls: number;
  sale_date: string;
  notes: string | null;
  created_at: string;
}

interface SalesHistoryTabProps {
  clientId: number;
}

export default function SalesHistoryTab({ clientId }: SalesHistoryTabProps) {
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSalesHistory = async () => {
      try {
        setLoading(true);
        const response = await authFetch(`/api/sales-history?client_id=${clientId}`);
        if (response.ok) {
          const data = await response.json();
          setSalesHistory(data);
        }
      } catch (error) {
        console.error('Error fetching sales history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesHistory();
  }, [clientId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getProductBreakdown = (sale: SalesRecord) => {
    const products = [
      { name: 'Fijo Renovación', value: sale.fijo_ren, color: 'bg-blue-500' },
      { name: 'Fijo Nuevo', value: sale.fijo_new, color: 'bg-green-500' },
      { name: 'Móvil Nueva', value: sale.movil_nueva, color: 'bg-purple-500' },
      { name: 'Móvil Renovación', value: sale.movil_renovacion, color: 'bg-pink-500' },
      { name: 'ClaroTV', value: sale.claro_tv, color: 'bg-yellow-500' },
      { name: 'Cloud', value: sale.cloud, color: 'bg-indigo-500' },
      { name: 'MPLS', value: sale.mpls, color: 'bg-red-500' }
    ].filter(product => product.value > 0);

    return products;
  };

  const calculateTotals = () => {
    return salesHistory.reduce(
      (totals, sale) => ({
        totalAmount: totals.totalAmount + sale.total_amount,
        totalSales: totals.totalSales + 1,
      }),
      { totalAmount: 0, totalSales: 0 }
    );
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Cargando historial de ventas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Historial de Ventas</h3>
        <div className="flex items-center space-x-4">
          <div className="bg-gray-800 rounded-lg px-4 py-2">
            <div className="text-sm text-gray-400">Total Ventas</div>
            <div className="text-lg font-bold text-green-400">{totals.totalSales}</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-4 py-2">
            <div className="text-sm text-gray-400">Valor Total</div>
            <div className="text-lg font-bold text-green-400">{formatCurrency(totals.totalAmount)}</div>
          </div>
        </div>
      </div>

      {salesHistory.length > 0 ? (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {salesHistory.map((sale) => {
            const products = getProductBreakdown(sale);
            
            return (
              <div key={sale.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{sale.company_name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(sale.sale_date)}</span>
                        </div>
                        {sale.vendor_name && (
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>{sale.vendor_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      {formatCurrency(sale.total_amount)}
                    </div>
                    <div className="text-sm text-gray-400">Total de la venta</div>
                  </div>
                </div>

                {/* Product Breakdown */}
                {products.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Desglose de Productos
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {products.map((product, index) => (
                        <div key={index} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className={`w-3 h-3 rounded-full ${product.color}`}></div>
                            <span className="text-xs text-gray-300 font-medium">{product.name}</span>
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {formatCurrency(product.value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {products.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                      <span>Composición de la venta</span>
                      <span>{formatCurrency(sale.total_amount)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="flex h-full">
                        {products.map((product, index) => {
                          const percentage = (product.value / sale.total_amount) * 100;
                          return (
                            <div
                              key={index}
                              className={product.color.replace('bg-', 'bg-')}
                              style={{ width: `${percentage}%` }}
                              title={`${product.name}: ${formatCurrency(product.value)} (${percentage.toFixed(1)}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {sale.notes && (
                  <div className="bg-gray-700/50 rounded-lg p-3 border-l-4 border-blue-500">
                    <h6 className="text-sm font-medium text-gray-300 mb-1">Notas de la venta</h6>
                    <p className="text-sm text-gray-400">{sale.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600">
          <TrendingUp className="mx-auto h-12 w-12 text-gray-600 mb-3" />
          <h3 className="text-base font-medium text-gray-300 mb-2">Sin historial de ventas</h3>
          <p className="text-gray-500 text-sm mb-4">
            Este cliente aún no tiene ventas registradas desde el sistema de seguimiento
          </p>
          <p className="text-gray-500 text-xs">
            Las ventas aparecerán aquí cuando se marquen como completadas en la página de seguimiento
          </p>
        </div>
      )}
    </div>
  );
}
