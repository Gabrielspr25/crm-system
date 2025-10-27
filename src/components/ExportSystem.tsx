import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ExportSystemProps {
  metas: any[];
  incomes: any[];
  salespeople: any[];
  currentUser: any;
  metasWithProgress: any[];
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const ExportSystem: React.FC<ExportSystemProps> = ({
  metas,
  incomes,
  salespeople,
  currentUser,
  metasWithProgress
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [exportType, setExportType] = useState<'summary' | 'detailed' | 'analysis'>('summary');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [loading, setLoading] = useState(false);

  // Filtrar datos según selección
  const filteredData = useMemo(() => {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    const filteredMetas = metasWithProgress.filter(meta => {
      const metaDate = new Date(meta.year, meta.month - 1);
      const vendorMatch = selectedVendors.length === 0 || selectedVendors.includes(meta.vendedorId);
      const dateMatch = metaDate >= startDate && metaDate <= endDate;
      return vendorMatch && dateMatch;
    });

    return {
      metas: filteredMetas,
      salespeople: selectedVendors.length > 0 
        ? salespeople.filter(s => selectedVendors.includes(s.id))
        : salespeople
    };
  }, [metasWithProgress, salespeople, dateRange, selectedVendors]);

  // Calcular estadísticas para el reporte
  const reportStats = useMemo(() => {
    const { metas } = filteredData;
    
    const totalMetas = metas.length;
    const completedMetas = metas.filter(m => m.status === 'completada').length;
    const totalMetaValue = metas.reduce((sum, m) => sum + m.metaValor, 0);
    const totalSalesValue = metas.reduce((sum, m) => sum + m.totalSales, 0);
    const avgProgress = totalMetas > 0 ? metas.reduce((sum, m) => sum + m.progressPercent, 0) / totalMetas : 0;
    const completionRate = totalMetas > 0 ? (completedMetas / totalMetas) * 100 : 0;

    // Estadísticas por vendedor
    const vendorStats = filteredData.salespeople.map(vendor => {
      const vendorMetas = metas.filter(m => m.vendedorId === vendor.id);
      const vendorCompleted = vendorMetas.filter(m => m.status === 'completada').length;
      const vendorTotal = vendorMetas.length;
      const vendorMetaValue = vendorMetas.reduce((sum, m) => sum + m.metaValor, 0);
      const vendorSalesValue = vendorMetas.reduce((sum, m) => sum + m.totalSales, 0);
      const vendorAvgProgress = vendorTotal > 0 
        ? vendorMetas.reduce((sum, m) => sum + m.progressPercent, 0) / vendorTotal 
        : 0;
      
      return {
        name: vendor.name,
        totalMetas: vendorTotal,
        completedMetas: vendorCompleted,
        completionRate: vendorTotal > 0 ? (vendorCompleted / vendorTotal) * 100 : 0,
        metaValue: vendorMetaValue,
        salesValue: vendorSalesValue,
        avgProgress: vendorAvgProgress
      };
    });

    // Estadísticas por tipo de meta
    const typeStats = metas.reduce((acc, meta) => {
      const type = meta.tipoMeta;
      if (!acc[type]) {
        acc[type] = { total: 0, completed: 0, metaValue: 0, salesValue: 0 };
      }
      acc[type].total++;
      if (meta.status === 'completada') acc[type].completed++;
      acc[type].metaValue += meta.metaValor;
      acc[type].salesValue += meta.totalSales;
      return acc;
    }, {} as Record<string, any>);

    return {
      general: {
        totalMetas,
        completedMetas,
        totalMetaValue,
        totalSalesValue,
        avgProgress,
        completionRate
      },
      byVendor: vendorStats,
      byType: Object.entries(typeStats).map(([type, stats]) => ({
        type,
        ...stats,
        completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
      }))
    };
  }, [filteredData]);

  // Exportar a PDF
  const exportToPDF = async () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    
    // Configurar fuente
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    
    // Título
    pdf.text('Reporte de Metas', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    
    // Información del reporte
    const reportInfo = [
      `Período: ${new Date(dateRange.startDate).toLocaleDateString('es-ES')} - ${new Date(dateRange.endDate).toLocaleDateString('es-ES')}`,
      `Generado: ${new Date().toLocaleDateString('es-ES')} por ${currentUser.name}`,
      `Vendedores: ${selectedVendors.length === 0 ? 'Todos' : selectedVendors.length + ' seleccionados'}`
    ];
    
    let yPosition = 35;
    reportInfo.forEach(info => {
      pdf.text(info, 20, yPosition);
      yPosition += 7;
    });
    
    yPosition += 10;
    
    // Estadísticas generales
    if (exportType === 'summary' || exportType === 'analysis') {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Resumen General', 20, yPosition);
      yPosition += 10;
      
      const generalStats = [
        ['Métrica', 'Valor'],
        ['Total de Metas', reportStats.general.totalMetas.toString()],
        ['Metas Completadas', reportStats.general.completedMetas.toString()],
        ['Tasa de Cumplimiento', `${reportStats.general.completionRate.toFixed(1)}%`],
        ['Valor Total Metas', `$${reportStats.general.totalMetaValue.toLocaleString()}`],
        ['Ventas Reales', `$${reportStats.general.totalSalesValue.toLocaleString()}`],
        ['Progreso Promedio', `${reportStats.general.avgProgress.toFixed(1)}%`]
      ];
      
      pdf.autoTable({
        startY: yPosition,
        head: [generalStats[0]],
        body: generalStats.slice(1),
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [70, 130, 180] }
      });
      
      yPosition = (pdf as any).lastAutoTable.finalY + 15;
    }
    
    // Estadísticas por vendedor
    if (exportType === 'detailed' || exportType === 'analysis') {
      if (yPosition > 200) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Estadísticas por Vendedor', 20, yPosition);
      yPosition += 10;
      
      const vendorTableData = [
        ['Vendedor', 'Total Metas', 'Completadas', 'Tasa (%)', 'Valor Meta', 'Ventas', 'Progreso (%)']
      ];
      
      reportStats.byVendor.forEach(vendor => {
        vendorTableData.push([
          vendor.name,
          vendor.totalMetas.toString(),
          vendor.completedMetas.toString(),
          vendor.completionRate.toFixed(1),
          `$${vendor.metaValue.toLocaleString()}`,
          `$${vendor.salesValue.toLocaleString()}`,
          vendor.avgProgress.toFixed(1)
        ]);
      });
      
      pdf.autoTable({
        startY: yPosition,
        head: [vendorTableData[0]],
        body: vendorTableData.slice(1),
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 139, 34] }
      });
    }
    
    // Guardar PDF
    pdf.save(`reporte-metas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Exportar a Excel
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Hoja de resumen
    if (exportType === 'summary' || exportType === 'analysis') {
      const summaryData = [
        ['REPORTE DE METAS - RESUMEN'],
        [''],
        ['Período:', `${dateRange.startDate} - ${dateRange.endDate}`],
        ['Generado:', new Date().toISOString().split('T')[0]],
        ['Por:', currentUser.name],
        [''],
        ['ESTADÍSTICAS GENERALES'],
        ['Total de Metas', reportStats.general.totalMetas],
        ['Metas Completadas', reportStats.general.completedMetas],
        ['Tasa de Cumplimiento (%)', reportStats.general.completionRate.toFixed(1)],
        ['Valor Total Metas ($)', reportStats.general.totalMetaValue],
        ['Ventas Reales ($)', reportStats.general.totalSalesValue],
        ['Progreso Promedio (%)', reportStats.general.avgProgress.toFixed(1)]
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    }
    
    // Hoja de datos por vendedor
    if (exportType === 'detailed' || exportType === 'analysis') {
      const vendorData = [
        ['Vendedor', 'Total Metas', 'Completadas', 'Tasa Cumplimiento (%)', 'Valor Meta ($)', 'Ventas ($)', 'Progreso Promedio (%)']
      ];
      
      reportStats.byVendor.forEach(vendor => {
        vendorData.push([
          vendor.name,
          vendor.totalMetas,
          vendor.completedMetas,
          vendor.completionRate.toFixed(1),
          vendor.metaValue,
          vendor.salesValue,
          vendor.avgProgress.toFixed(1)
        ]);
      });
      
      const vendorSheet = XLSX.utils.aoa_to_sheet(vendorData);
      XLSX.utils.book_append_sheet(workbook, vendorSheet, 'Por Vendedor');
    }
    
    // Hoja de metas detalladas
    if (exportType === 'detailed') {
      const detailData = [
        ['Vendedor', 'Tipo Meta', 'Categoría', 'Valor Meta', 'Ventas Actuales', 'Progreso (%)', 'Estado', 'Mes', 'Año']
      ];
      
      filteredData.metas.forEach(meta => {
        const vendorName = salespeople.find(s => s.id === meta.vendedorId)?.name || 'N/A';
        detailData.push([
          vendorName,
          meta.tipoMeta,
          meta.categoria || '-',
          meta.metaValor,
          meta.totalSales,
          meta.progressPercent.toFixed(1),
          meta.status,
          meta.month,
          meta.year
        ]);
      });
      
      const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Metas');
    }
    
    // Guardar archivo
    XLSX.writeFile(workbook, `reporte-metas-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar a CSV
  const exportToCSV = () => {
    let csvContent = '';
    
    // Encabezados
    const headers = [
      'Vendedor',
      'Tipo Meta',
      'Categoría',
      'Valor Meta',
      'Ventas Actuales',
      'Progreso (%)',
      'Estado',
      'Mes',
      'Año'
    ];
    
    csvContent += headers.join(',') + '\n';
    
    // Datos
    filteredData.metas.forEach(meta => {
      const vendorName = salespeople.find(s => s.id === meta.vendedorId)?.name || 'N/A';
      const row = [
        `"${vendorName}"`,
        `"${meta.tipoMeta}"`,
        `"${meta.categoria || '-'}"`,
        meta.metaValor,
        meta.totalSales,
        meta.progressPercent.toFixed(1),
        `"${meta.status}"`,
        meta.month,
        meta.year
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte-metas-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    
    try {
      switch (exportFormat) {
        case 'pdf':
          await exportToPDF();
          break;
        case 'excel':
          exportToExcel();
          break;
        case 'csv':
          exportToCSV();
          break;
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al generar el reporte. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  return (
    <>
      {/* Botón de exportar */}
      <button
        onClick={() => setShowExportModal(true)}
        className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        title="Exportar reportes"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Exportar
      </button>

      {/* Modal de exportación */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-secondary rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-text-primary">📊 Exportar Reporte</h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-text-secondary hover:text-text-primary text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Formato de exportación */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-3">
                    Formato de archivo
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'pdf', label: 'PDF', icon: '📄', desc: 'Documento formateado' },
                      { value: 'excel', label: 'Excel', icon: '📊', desc: 'Hoja de cálculo' },
                      { value: 'csv', label: 'CSV', icon: '📋', desc: 'Datos separados por comas' }
                    ].map(format => (
                      <button
                        key={format.value}
                        onClick={() => setExportFormat(format.value as any)}
                        className={`p-4 rounded-lg border-2 transition-colors text-center ${
                          exportFormat === format.value
                            ? 'border-accent bg-accent/20 text-accent'
                            : 'border-border bg-tertiary text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{format.icon}</div>
                        <div className="font-medium">{format.label}</div>
                        <div className="text-xs mt-1">{format.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de reporte */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-3">
                    Tipo de reporte
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'summary', label: 'Resumen Ejecutivo', desc: 'Estadísticas generales y KPIs principales' },
                      { value: 'detailed', label: 'Reporte Detallado', desc: 'Datos completos por vendedor y meta' },
                      { value: 'analysis', label: 'Análisis Completo', desc: 'Incluye tendencias y comparativas' }
                    ].map(type => (
                      <button
                        key={type.value}
                        onClick={() => setExportType(type.value as any)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          exportType === type.value
                            ? 'border-accent bg-accent/10 text-text-primary'
                            : 'border-border bg-tertiary text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs mt-1">{type.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rango de fechas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Fecha de inicio
                    </label>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Fecha de fin
                    </label>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Selección de vendedores */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-3">
                    Vendedores (dejar vacío para incluir todos)
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
                    {salespeople.map(vendor => (
                      <label key={vendor.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(vendor.id)}
                          onChange={() => handleVendorSelection(vendor.id)}
                          className="mr-2 text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text-primary">{vendor.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Preview de datos */}
                <div className="bg-tertiary rounded-lg p-4">
                  <h4 className="font-medium text-text-primary mb-2">Vista previa del reporte</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-secondary">Metas incluidas:</span>
                      <span className="ml-2 font-medium text-text-primary">{filteredData.metas.length}</span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Vendedores:</span>
                      <span className="ml-2 font-medium text-text-primary">{filteredData.salespeople.length}</span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Tasa de cumplimiento:</span>
                      <span className="ml-2 font-medium text-accent">{reportStats.general.completionRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Valor total:</span>
                      <span className="ml-2 font-medium text-green-400">${reportStats.general.totalMetaValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 bg-tertiary text-text-secondary py-3 px-4 rounded-lg hover:bg-border transition-colors"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex-1 bg-accent text-primary font-medium py-3 px-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generando...
                      </>
                    ) : (
                      `Exportar ${exportFormat.toUpperCase()}`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExportSystem;