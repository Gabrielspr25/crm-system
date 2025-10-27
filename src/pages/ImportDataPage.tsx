import React, { useState } from 'react';

const ImportDataPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<string>('');
  const [downloadLinks, setDownloadLinks] = useState<{omitidos: string, clientes: string, bans: string, suscriptores: string} | null>(null);

  const parseCSVLine = (line: string): string[] => {
    const cleanLine = line.replace(/,$/, '').trim();
    const values = cleanLine.split(',');
    while (values.length < 13) {
      values.push('');
    }
    return values.map(v => v.trim());
  };

  const mapToStandardFields = (rawData: string[], index: number) => {
    return {
      CLIENTE_nombre: rawData[0] || '',
      BAN: rawData[1] || '',
      SUSCRIBER: rawData[2] || '',
      STATUS: rawData[3] || 'A',
      PLAN: rawData[4] || '',
      CREDIT_CLASS: rawData[5] || '',
      venc_fijo: rawData[6] || '',
      pagos_hechos: rawData[7] || '0',
      meses_vendidos: rawData[8] || '0',
      equipo: rawData[9] || '',
      ITEM_LDESC: rawData[10] || '',
      EMAIL: rawData[11] || '',
      CONTACTO: rawData[12] || ''
    };
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/[^a-zA-Z0-9,.\-@\s]/g, '') // Solo ASCII básico
      .replace(/\s+/g, ' ')               // Normalizar espacios
      .trim();                            // Quitar espacios extra
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processPreview(selectedFile);
      setDownloadLinks(null);
    }
  };

  const processPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('Archivo invalido');
        return;
      }

      const previewData = lines.slice(1, 11).map((line, index) => {
        const rawValues = parseCSVLine(line);
        return mapToStandardFields(rawValues, index + 1);
      });

      setPreview(previewData);
      setResults(`Archivo cargado: ${lines.length - 1} registros`);
    };
    reader.readAsText(file);
  };

  const createCSVDownload = (data: string[], filename: string): string => {
    const csvContent = data.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    return url;
  };

  const calculateContractEndDate = (row: any): string => {
    const isFixedProduct = row.PLAN?.toLowerCase().includes('fijo') || 
                         row.PLAN?.toLowerCase().includes('mpls');
    
    if (!isFixedProduct && row.venc_fijo) {
      return row.venc_fijo;
    } else if (!isFixedProduct) {
      const monthsSold = parseInt(row.meses_vendidos) || 0;
      const paymentsMade = parseInt(row.pagos_hechos) || 0;
      const remainingMonths = monthsSold - paymentsMade;
      
      if (remainingMonths > 0) {
        const startDate = new Date(2025, 7, 1); // Agosto 2025
        startDate.setMonth(startDate.getMonth() + remainingMonths);
        return startDate.toISOString().split('T')[0];
      }
    }
    return '';
  };

  const handleProcess = async () => {
    if (!file || !preview.length) return;
    
    setIsProcessing(true);
    setResults('Procesando archivo completo...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      let valid = 0;
      let skipped = 0;
      
      // Headers para cada archivo con columna de número ordenado
      const omitidosCSV: string[] = ['Num,Linea,Compania,BAN,SUSCRIBER,STATUS,PLAN,CREDIT_CLASS,venc_fijo,pagos_hechos,meses_vendidos,equipo,ITEM_LDESC,EMAIL,CONTACTO,MOTIVO'];
      const clientesCSV: string[] = ['Num,ID,company,name,email,phone,address,city,notes'];
      const bansCSV: string[] = ['Num,ID,clientId,number,status'];
      const suscriptoresCSV: string[] = ['Num,ID,banId,phoneNumber,productId,status,contractEndDate,paymentsMade,monthsSold,equipment,city'];
      
      const processedSubscribers = new Set<string>();
      const processedEmails = new Map<string, string>(); // email -> clientId
      const processedBans = new Map<string, string>();   // banNumber -> banId
      
      let clientIdCounter = 1;
      let banIdCounter = 1;
      let subscriberIdCounter = 1;

      for (let i = 1; i < lines.length; i++) {
        const rawValues = parseCSVLine(lines[i]);
        const row = mapToStandardFields(rawValues, i);
        const originalLine = lines[i];

        // Validar datos básicos
        if (!row.BAN || !row.SUSCRIBER) {
          skipped++;
          const motivo = !row.BAN && !row.SUSCRIBER ? 'BAN y SUSCRIBER vacios' : 
                        !row.BAN ? 'BAN vacio' : 'SUSCRIBER vacio';
          omitidosCSV.push(`${skipped},${i},${cleanText(originalLine)},${motivo}`);
          continue;
        }

        // Validar duplicados de suscriptor
        if (processedSubscribers.has(row.SUSCRIBER)) {
          skipped++;
          omitidosCSV.push(`${skipped},${i},${cleanText(originalLine)},Suscriptor duplicado`);
          continue;
        }

        processedSubscribers.add(row.SUSCRIBER);
        valid++;

        // 1. PROCESAR CLIENTE
        const emailKey = row.EMAIL || `sin-email-${i}`;
        let clientId = processedEmails.get(emailKey);
        
        if (!clientId) {
          clientId = `CLIENT_${clientIdCounter++}`;
          processedEmails.set(emailKey, clientId);
          
          // Agregar cliente al CSV con número ordenado
          clientesCSV.push([
            processedEmails.size, // Número ordenado
            clientId,
            cleanText(row.CLIENTE_nombre || ''),
            cleanText(row.CONTACTO || '-'),
            cleanText(row.EMAIL || '-'),
            '',
            '',
            '',
            cleanText(row.ITEM_LDESC || '')
          ].join(','));
        }

        // 2. PROCESAR BAN
        let banId = processedBans.get(row.BAN);
        
        if (!banId) {
          banId = `BAN_${banIdCounter++}`;
          processedBans.set(row.BAN, banId);
          
          // Agregar BAN al CSV con número ordenado
          bansCSV.push([
            processedBans.size, // Número ordenado
            banId,
            clientId,
            cleanText(row.BAN),
            'active'
          ].join(','));
        }

        // 3. PROCESAR SUSCRIPTOR
        const subscriberId = `SUB_${subscriberIdCounter++}`;
        const contractEndDate = calculateContractEndDate(row);
        
        suscriptoresCSV.push([
          valid, // Número ordenado
          subscriberId,
          banId,
          cleanText(row.SUSCRIBER),
          cleanText(row.PLAN || ''),
          cleanText(row.STATUS),
          contractEndDate,
          row.pagos_hechos || '0',
          row.meses_vendidos || '0',
          cleanText(row.equipo || '-'),
          ''
        ].join(','));
      }

      // Generar archivos de descarga
      const fecha = new Date().toISOString().split('T')[0];
      const omitidosUrl = createCSVDownload(omitidosCSV, `omitidos-${fecha}.csv`);
      const clientesUrl = createCSVDownload(clientesCSV, `clientes-${fecha}.csv`);
      const bansUrl = createCSVDownload(bansCSV, `bans-${fecha}.csv`);
      const suscriptoresUrl = createCSVDownload(suscriptoresCSV, `suscriptores-${fecha}.csv`);
      
      setDownloadLinks({
        omitidos: omitidosUrl,
        clientes: clientesUrl,
        bans: bansUrl,
        suscriptores: suscriptoresUrl
      });

      setResults(`PROCESAMIENTO COMPLETO TERMINADO

Registros validos: ${valid}
Registros omitidos: ${skipped}
Total procesado: ${valid + skipped} de ${lines.length - 1}

ARCHIVOS GENERADOS:
- CLIENTES: ${processedEmails.size} clientes unicos
- BANS: ${processedBans.size} BANs unicos  
- SUSCRIPTORES: ${valid} suscriptores
- OMITIDOS: ${skipped} registros con problemas

ESTRUCTURA COMPLETA:
Cada cliente tiene sus BANs
Cada BAN tiene sus suscriptores
Fechas de vencimiento calculadas

IMPORTAR EN ORDEN:
1. Primero CLIENTES
2. Después BANS  
3. Finalmente SUSCRIPTORES
4. Revisar OMITIDOS si es necesario`);
      
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h1 className="text-3xl font-bold text-white mb-3">IMPORTACION COMPLETA - Clientes + BANs + Suscriptores</h1>
          <p className="text-gray-300 text-lg">
            Genera estructura completa lista para importar en orden
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Seleccionar Archivo</h2>
          
          <div className="mb-6">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer file:mr-4 file:py-3 file:px-6 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
          </div>

          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-blue-300 mb-2">ESTRUCTURA COMPLETA</h3>
            <div className="text-sm text-blue-200 space-y-1">
              <p>• Genera 4 archivos CSV separados</p>
              <p>• CLIENTES: Con IDs unicos por email</p>
              <p>• BANS: Relacionados a clientes</p>
              <p>• SUSCRIPTORES: Con fechas de vencimiento calculadas</p>
              <p>• OMITIDOS: Registros con problemas</p>
              <p>• Importar en orden: Clientes → BANs → Suscriptores</p>
            </div>
          </div>

          {downloadLinks && (
            <div className="bg-indigo-900 border border-indigo-700 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-indigo-300 mb-3">ARCHIVOS GENERADOS - IMPORTAR EN ORDEN</h3>
              <div className="grid grid-cols-2 gap-4">
                <a
                  href={downloadLinks.clientes}
                  download="1-clientes.csv"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors text-center"
                >
                  1. CLIENTES
                </a>
                <a
                  href={downloadLinks.bans}
                  download="2-bans.csv"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors text-center"
                >
                  2. BANS
                </a>
                <a
                  href={downloadLinks.suscriptores}
                  download="3-suscriptores.csv"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-center"
                >
                  3. SUSCRIPTORES
                </a>
                <a
                  href={downloadLinks.omitidos}
                  download="4-omitidos.csv"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors text-center"
                >
                  4. OMITIDOS
                </a>
              </div>
            </div>
          )}

          {results && (
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <pre className="text-sm text-blue-200 whitespace-pre-wrap">{results}</pre>
            </div>
          )}
        </div>

        {preview.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Vista Previa</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 px-3 py-2 text-left text-gray-300">Empresa</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-gray-300">BAN</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-gray-300">Suscriptor</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-gray-300">Email</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-gray-300">Plan</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-gray-300">Venc.</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                      <td className="border border-gray-600 px-3 py-2 text-gray-200">
                        {row.CLIENTE_nombre || <span className="text-gray-500 italic">empresa vacia</span>}
                      </td>
                      <td className="border border-gray-600 px-3 py-2 text-gray-200 font-mono">{row.BAN}</td>
                      <td className="border border-gray-600 px-3 py-2 text-gray-200 font-mono">{row.SUSCRIBER}</td>
                      <td className="border border-gray-600 px-3 py-2 text-gray-200">{row.EMAIL}</td>
                      <td className="border border-gray-600 px-3 py-2 text-gray-200">{row.PLAN}</td>
                      <td className="border border-gray-600 px-3 py-2 text-gray-200">{calculateContractEndDate(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setPreview([])}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcess}
                disabled={isProcessing}
                className={`px-8 py-3 rounded-lg transition-colors ${
                  isProcessing 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                {isProcessing ? 'PROCESANDO...' : 'GENERAR ESTRUCTURA COMPLETA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportDataPage;
