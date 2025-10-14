import React, { useState } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';
import { PipelineStatus } from '../types';
import TrashIcon from './icons/TrashIcon';

interface PipelineStatusManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  crmData: CrmDataHook;
}

const PipelineStatusManagerModal: React.FC<PipelineStatusManagerModalProps> = ({ isOpen, onClose, crmData }) => {
  const { pipelineStatuses, addPipelineStatus, updatePipelineStatus, deletePipelineStatus } = crmData;

  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#a1a1aa');

  if (!isOpen) return null;

  const handleUpdate = (status: PipelineStatus, field: 'name' | 'color', value: string) => {
    updatePipelineStatus({ ...status, [field]: value });
  };
  
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatusName.trim()) {
      addPipelineStatus({ name: newStatusName.trim(), color: newStatusColor });
      setNewStatusName('');
      setNewStatusColor('#a1a1aa');
    }
  };

  const handleDelete = (statusId: string) => {
    if (window.confirm('¿Está seguro? Los clientes con este estado quedarán sin asignar.')) {
        deletePipelineStatus(statusId);
    }
  }

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[80vh] flex flex-col transform transition-all">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Gestionar Estados del Pipeline</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-tertiary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
            {pipelineStatuses.map(status => (
                <div key={status.id} className="flex items-center space-x-3 p-2 bg-tertiary rounded-md">
                    <input
                        type="color"
                        value={status.color}
                        onChange={(e) => handleUpdate(status, 'color', e.target.value)}
                        className="w-8 h-8 bg-transparent border-none cursor-pointer rounded"
                        style={{'--color': status.color} as any}
                    />
                    <input
                        type="text"
                        value={status.name}
                        onChange={(e) => handleUpdate(status, 'name', e.target.value)}
                        className="flex-grow bg-primary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button onClick={() => handleDelete(status.id)} className="text-red-500 hover:text-red-400 p-2"><TrashIcon/></button>
                </div>
            ))}
        </div>
        
        <form onSubmit={handleAdd} className="mt-6 pt-6 border-t border-tertiary flex items-center space-x-3">
             <input
                type="color"
                value={newStatusColor}
                onChange={(e) => setNewStatusColor(e.target.value)}
                className="w-8 h-8 bg-transparent border-none cursor-pointer rounded"
            />
            <input
                type="text"
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder="Añadir nuevo estado..."
                className="flex-grow bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="submit" className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors">Añadir</button>
        </form>
      </div>
      <style>{`
        input[type="color"] {
          -webkit-appearance: none;
          appearance: none;
          border: none;
          background: none;
        }
        input[type="color"]::-webkit-color-swatch-wrapper {
          padding: 0;
        }
        input[type="color"]::-webkit-color-swatch {
          border: 2px solid #334155;
          border-radius: 0.375rem;
          background-color: var(--color);
        }
      `}</style>
    </div>
  );
};

export default PipelineStatusManagerModal;