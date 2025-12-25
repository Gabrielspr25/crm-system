import React from 'react';
import { Mail } from 'lucide-react';
import OutlookConnector from "@/react-app/components/OutlookConnector";

export default function CorreosPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Correos</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Redacta y envía correos electrónicos</p>
            </div>
          </div>
        </div>

        {/* Outlook Connector */}
        <div className="max-w-2xl mx-auto">
          <OutlookConnector />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Outlook de Escritorio</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Abre tu aplicación Outlook instalada en tu computadora para redactar correos.
            </p>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-300 mb-2">Outlook Web</h3>
            <p className="text-sm text-slate-700 dark:text-slate-400">
              Abre Outlook en tu navegador web para acceder desde cualquier lugar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
