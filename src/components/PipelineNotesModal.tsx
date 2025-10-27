import React, { useState, useMemo } from 'react';
import { Client } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface PipelineNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  currentUser: string;
  crmData: CrmDataHook;
}

const PipelineNotesModal: React.FC<PipelineNotesModalProps> = ({ isOpen, onClose, client, currentUser, crmData }) => {
  const { pipelineNotes, salespeople, addPipelineNote } = crmData;
  const [newNoteText, setNewNoteText] = useState('');

  const clientNotes = useMemo(() => {
    return pipelineNotes
      .filter(note => note.clientId === client.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pipelineNotes, client.id]);

  const salespeopleMap = useMemo(() => 
    salespeople.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {} as Record<string, typeof salespeople[0]>), [salespeople]
  );
  
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !currentUser) {
      alert('La nota no puede estar vacía y debe seleccionar un usuario.');
      return;
    }
    addPipelineNote({
      clientId: client.id,
      authorId: currentUser,
      text: newNoteText.trim(),
    });
    setNewNoteText('');
  };

  const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
      });
  }

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[80vh] flex flex-col transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Notas del Pipeline</h2>
            <p className="text-text-secondary text-sm">para {client.company}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-tertiary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {clientNotes.length > 0 ? clientNotes.map(note => {
            const author = salespeopleMap[note.authorId];
            return (
              <div key={note.id} className="p-3 bg-tertiary rounded-md">
                <p className="text-text-primary whitespace-pre-wrap">{note.text}</p>
                <div className="text-xs text-text-secondary mt-2 flex justify-between items-center">
                   <div className="flex items-center">
                     {author && (
                        <>
                           <img src={author.avatar} alt={author.name} className="w-5 h-5 rounded-full mr-2" />
                           <span>{author.name}</span>
                        </>
                     )}
                   </div>
                   <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            )
          }) : <p className="text-center text-text-secondary italic">No hay notas para este cliente.</p>}
        </div>
        
        <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-tertiary">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Añadir una nueva nota..."
            className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent h-20"
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <button type="submit" className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors">
              Añadir Nota
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PipelineNotesModal;