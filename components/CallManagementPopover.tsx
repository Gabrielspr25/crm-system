import React, { useRef, useEffect } from 'react';
import { Client } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import ChatBubbleIcon from './icons/ChatBubbleIcon';

interface CallManagementPopoverProps {
    client: Client;
    onClose: () => void;
    crmData: CrmDataHook;
    onOpenNotes: () => void;
}

const CallManagementPopover: React.FC<CallManagementPopoverProps> = ({ client, onClose, crmData, onOpenNotes }) => {
    const { updateClient } = crmData;
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleMarkAsCalled = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        updateClient({ ...client, dateCalled: todayStr });
        onClose();
    };

    const handleReschedule = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            updateClient({ ...client, dateToCall: e.target.value });
        }
    };
    
    return (
        <div ref={popoverRef} className="absolute top-full right-0 mt-2 w-64 bg-tertiary border border-slate-600 rounded-lg shadow-2xl z-20 p-4 animate-fade-in-up">
            <h4 className="font-bold text-text-primary text-sm mb-3">Gestionar Llamada</h4>
            
            <button
                onClick={handleMarkAsCalled}
                className="w-full text-left bg-accent/20 text-accent font-semibold py-2 px-3 rounded-md text-sm hover:bg-accent/40 transition-colors mb-2"
            >
                Marcar como Llamada Realizada
            </button>

            <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Reprogramar para:</label>
                <input
                    type="date"
                    value={client.dateToCall || ''}
                    onChange={handleReschedule}
                    className="w-full bg-primary p-2 rounded-md text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
            </div>

            <button
                onClick={onOpenNotes}
                className="w-full flex items-center justify-center text-left text-text-secondary font-semibold py-2 px-3 rounded-md text-sm hover:bg-slate-700 transition-colors mt-2"
            >
                <ChatBubbleIcon />
                <span className="ml-2">Añadir/Ver Notas</span>
            </button>
             <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.2s ease-out forwards;
                }
             `}</style>
        </div>
    );
};

export default CallManagementPopover;