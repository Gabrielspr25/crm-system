import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import { useApi } from "../hooks/useApi";

interface Client {
  id: number;
  name: string;
  ban_count: number;
  vendor_name: string | null;
}

interface Subscriber {
  id: number;
  monthly_value: number | null;
  service_type: string | null;
}

export default function Reports() {
  const { data: clients } = useApi<Client[]>("/api/clients");
  const { data: subscribers } = useApi<Subscriber[]>("/api/subscribers");

  // Calculate statistics
  const totalClients = clients?.length || 0;
  const totalSubscribers = subscribers?.length || 0;
  const clientsWithBans = clients?.filter(client => client.ban_count > 0).length || 0;
  
  const totalRevenue = subscribers?.reduce((sum, subscriber) => {
    return sum + (subscriber.monthly_value || 0);
  }, 0) || 0;

  const serviceTypeStats = subscribers?.reduce((acc, subscriber) => {
    const serviceType = subscriber.service_type || "No especificado";
    acc[serviceType] = (acc[serviceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const vendorStats = clients?.reduce((acc, client) => {
    const vendorName = client.vendor_name || "Sin vendedor";
    acc[vendorName] = (acc[vendorName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const stats = [
    {
      name: "Total Clientes",
      value: totalClients,
      icon: Users,
      color: "bg-blue-500",
      change: "+12%",
      changeType: "increase" as const,
    },
    {
      name: "Suscriptores",
      value: totalSubscribers,
      icon: BarChart3,
      color: "bg-green-500",
      change: "+8%",
      changeType: "increase" as const,
    },
    {
      name: "Clientes con BAN",
      value: clientsWithBans,
      icon: TrendingUp,
      color: "bg-purple-500",
      change: "+15%",
      changeType: "increase" as const,
    },
    {
      name: "Ingresos Mensuales",
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-yellow-500",
      change: "+20%",
      changeType: "increase" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-600 mt-1">Analiza el rendimiento de tu negocio</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-gray-100 rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-200"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-green-600 font-medium">{stat.change}</span>
                <span className="text-gray-600 ml-1">vs. mes anterior</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Types Chart */}
        <div className="bg-gray-100 rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipos de Servicio</h3>
          <div className="space-y-3">
            {Object.entries(serviceTypeStats).map(([serviceType, count]) => (
              <div key={serviceType} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{serviceType}</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(count / totalSubscribers) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vendors Chart */}
        <div className="bg-gray-100 rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Clientes por Vendedor</h3>
          <div className="space-y-3">
            {Object.entries(vendorStats).map(([vendorName, count]) => (
              <div key={vendorName} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{vendorName}</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{
                        width: `${(count / totalClients) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-100 rounded-xl shadow-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{((clientsWithBans / totalClients) * 100).toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Clientes con BAN</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">${(totalRevenue / totalSubscribers || 0).toFixed(0)}</div>
            <div className="text-sm text-gray-600">Ingreso promedio por suscriptor</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{(totalSubscribers / clientsWithBans || 0).toFixed(1)}</div>
            <div className="text-sm text-gray-600">Suscriptores promedio por cliente</div>
          </div>
        </div>
      </div>
    </div>
  );
}
