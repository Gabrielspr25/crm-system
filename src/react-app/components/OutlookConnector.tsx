import React from 'react';
import { Mail, ExternalLink, Monitor } from 'lucide-react';

export default function OutlookConnector() {
    // Integración simplificada sin Login (usa mailto y deeplinks)

    const openOutlookWeb = () => {
        const subject = encodeURIComponent("Prueba desde CRM");
        const body = encodeURIComponent("Hola,\n\nEste es un correo generado desde el CRM.");
        const url = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
        window.open(url, '_blank');
    };

    const openDesktopMail = () => {
        const subject = encodeURIComponent("Prueba desde CRM");
        const body = encodeURIComponent("Hola,\n\nEste es un correo generado desde el CRM.");
        // Usar un enlace oculto es más compatible que window.location.href para mailto
        const link = document.createElement('a');
        link.href = `mailto:?subject=${subject}&body=${body}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Redactar Correo</h3>
                    <p className="text-xs text-slate-500">Elige tu método preferido</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <button 
                    onClick={openDesktopMail}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                    <Monitor className="w-4 h-4" />
                    Usar Outlook de Escritorio
                </button>
                
                <button 
                    onClick={openOutlookWeb}
                    className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                    <ExternalLink className="w-4 h-4" />
                    Usar Outlook Web
                </button>
            </div>
            
            <p className="mt-3 text-xs text-slate-400 text-center">
                Se usará la cuenta que tengas activa en tu PC o navegador.
            </p>
        </div>
    );
}
