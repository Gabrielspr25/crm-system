import React, { useState, useMemo } from 'react';
import { Meta } from '../types';

interface Comment {
  id: string;
  metaId: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  timestamp: Date;
  type: 'comment' | 'feedback' | 'support' | 'milestone';
  isPrivate?: boolean;
  mentions?: string[];
}

interface MentorshipRelation {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  status: 'active' | 'paused' | 'completed';
  startDate: Date;
  nextMeeting?: Date;
  notes?: string;
}

interface Meeting {
  id: string;
  title: string;
  description: string;
  participantIds: string[];
  scheduledDate: Date;
  duration: number; // minutes
  type: 'one-on-one' | 'team' | 'review' | 'training';
  status: 'scheduled' | 'completed' | 'cancelled';
  metaIds?: string[];
  notes?: string;
  actionItems?: ActionItem[];
}

interface ActionItem {
  id: string;
  description: string;
  assignedTo: string;
  dueDate: Date;
  status: 'pending' | 'in-progress' | 'completed';
}

interface CollaborationSystemProps {
  metas: any[];
  incomes: any[];
  salespeople: any[];
  currentUser: any;
  metasWithProgress: any[];
}

const CollaborationSystem: React.FC<CollaborationSystemProps> = ({
  metas,
  incomes,
  salespeople,
  currentUser,
  metasWithProgress
}) => {
  const [activeView, setActiveView] = useState<'comments' | 'mentorship' | 'meetings'>('comments');
  const [selectedMetaId, setSelectedMetaId] = useState<string>('');
  const [newComment, setNewComment] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  // Los comentarios vendrán de tu API - por ahora vacío
  const [comments] = useState<Comment[]>([]);

  const [mentorships] = useState<MentorshipRelation[]>([]);

  const [meetings] = useState<Meeting[]>([]);

  // Filtrar comentarios por meta seleccionada
  const filteredComments = useMemo(() => {
    if (!selectedMetaId) return comments;
    return comments.filter(comment => comment.metaId === selectedMetaId);
  }, [comments, selectedMetaId]);

  // Obtener métricas de colaboración
  const collaborationMetrics = useMemo(() => {
    const totalComments = comments.length;
    const recentComments = comments.filter(c => 
      new Date().getTime() - c.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    ).length;
    
    const activeMentorships = mentorships.filter(m => m.status === 'active').length;
    const upcomingMeetings = meetings.filter(m => 
      m.status === 'scheduled' && m.scheduledDate > new Date()
    ).length;

    return {
      totalComments,
      recentComments,
      activeMentorships,
      upcomingMeetings
    };
  }, [comments, mentorships, meetings]);

  const getCommentIcon = (type: string) => {
    switch (type) {
      case 'feedback': return '💬';
      case 'support': return '🆘';
      case 'milestone': return '🏆';
      default: return '💭';
    }
  };

  const getCommentTypeColor = (type: string) => {
    switch (type) {
      case 'feedback': return 'border-l-blue-500 bg-blue-500/10';
      case 'support': return 'border-l-orange-500 bg-orange-500/10';
      case 'milestone': return 'border-l-green-500 bg-green-500/10';
      default: return 'border-l-gray-500 bg-gray-500/10';
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedMetaId) return;
    
    // Aquí iría la llamada a tu API
    console.log('Nuevo comentario:', {
      metaId: selectedMetaId,
      content: newComment,
      userId: currentUser.id,
      type: 'comment'
    });
    
    setNewComment('');
  };

  return (
    <div className="space-y-6">
      {/* Header con métricas */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary">🤝 Sistema de Colaboración</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCommentModal(true)}
              className="bg-accent text-primary px-3 py-2 rounded-lg hover:bg-opacity-90 transition-colors text-sm"
            >
              💭 Comentar
            </button>
            <button
              onClick={() => setShowMeetingModal(true)}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              📅 Programar Reunión
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{collaborationMetrics.totalComments}</div>
            <div className="text-sm text-text-secondary">Comentarios Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{collaborationMetrics.recentComments}</div>
            <div className="text-sm text-text-secondary">Esta Semana</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{collaborationMetrics.activeMentorships}</div>
            <div className="text-sm text-text-secondary">Mentorías Activas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{collaborationMetrics.upcomingMeetings}</div>
            <div className="text-sm text-text-secondary">Reuniones Próximas</div>
          </div>
        </div>
      </div>

      {/* Navegación de vistas */}
      <div className="flex space-x-4">
        {[
          { key: 'comments', label: '💬 Comentarios', desc: 'Feedback y discusiones' },
          { key: 'mentorship', label: '👨‍🏫 Mentorías', desc: 'Relaciones mentor-alumno' },
          { key: 'meetings', label: '📅 Reuniones', desc: 'Sesiones programadas' }
        ].map(view => (
          <button
            key={view.key}
            onClick={() => setActiveView(view.key as any)}
            className={`p-4 rounded-lg border-2 transition-colors text-left flex-1 ${
              activeView === view.key
                ? 'border-accent bg-accent/20 text-accent'
                : 'border-border bg-tertiary text-text-secondary hover:border-accent/50'
            }`}
          >
            <div className="font-medium">{view.label}</div>
            <div className="text-xs mt-1">{view.desc}</div>
          </button>
        ))}
      </div>

      {/* Contenido según vista activa */}
      {activeView === 'comments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selector de meta y nuevo comentario */}
          <div className="bg-secondary rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Comentar en Meta</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Seleccionar Meta
                </label>
                <select
                  value={selectedMetaId}
                  onChange={(e) => setSelectedMetaId(e.target.value)}
                  className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                >
                  <option value="">Seleccionar una meta...</option>
                  {metasWithProgress.map(meta => {
                    const vendorName = salespeople.find(s => s.id === meta.vendedorId)?.name || 'N/A';
                    return (
                      <option key={meta.id} value={meta.id}>
                        {vendorName} - {meta.tipoMeta} ({meta.progressPercent.toFixed(1)}%)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Nuevo Comentario
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                  className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                  placeholder="Escribe tu comentario, feedback o pregunta..."
                  disabled={!selectedMetaId}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || !selectedMetaId}
                  className="flex-1 bg-accent text-primary py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💭 Comentar
                </button>
                <button className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                  🆘 Pedir Ayuda
                </button>
              </div>
            </div>
          </div>

          {/* Lista de comentarios */}
          <div className="lg:col-span-2 bg-secondary rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Comentarios {selectedMetaId ? 'de la Meta' : 'Recientes'}
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredComments.length > 0 ? (
                filteredComments.map(comment => (
                  <div
                    key={comment.id}
                    className={`border-l-4 pl-4 py-3 rounded-r-lg ${getCommentTypeColor(comment.type)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getCommentIcon(comment.type)}</span>
                        <span className="font-medium text-text-primary">{comment.userName}</span>
                        <span className="text-xs bg-tertiary text-text-secondary px-2 py-1 rounded-full">
                          {comment.userRole}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {comment.timestamp.toLocaleDateString('es-ES')} {comment.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <p className="text-text-primary text-sm leading-relaxed">{comment.content}</p>
                    
                    {comment.mentions && (
                      <div className="mt-2 flex items-center space-x-1">
                        <span className="text-xs text-text-secondary">Menciones:</span>
                        {comment.mentions.map(mention => (
                          <span key={mention} className="text-xs bg-accent text-primary px-2 py-1 rounded-full">
                            @{mention}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">💬</div>
                  <p className="text-text-secondary">
                    {selectedMetaId ? 'No hay comentarios en esta meta' : 'Selecciona una meta para ver comentarios'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'mentorship' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mentorías activas */}
          <div className="bg-secondary rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">👨‍🏫 Mentorías Activas</h3>
            
            <div className="space-y-4">
              {mentorships.filter(m => m.status === 'active').map(mentorship => (
                <div key={mentorship.id} className="bg-tertiary rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-text-primary">
                        {mentorship.mentorName} → {mentorship.menteeName}
                      </h4>
                      <p className="text-sm text-text-secondary">
                        Desde {mentorship.startDate.toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      Activa
                    </span>
                  </div>
                  
                  {mentorship.nextMeeting && (
                    <div className="text-sm text-text-secondary mb-2">
                      📅 Próxima reunión: {mentorship.nextMeeting.toLocaleDateString('es-ES')}
                    </div>
                  )}
                  
                  {mentorship.notes && (
                    <p className="text-sm text-text-primary bg-secondary rounded p-2">
                      {mentorship.notes}
                    </p>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    <button className="bg-accent text-primary text-xs px-3 py-1 rounded hover:bg-opacity-90">
                      📝 Notas
                    </button>
                    <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700">
                      📅 Programar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sugerencias de mentoría */}
          <div className="bg-secondary rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">💡 Sugerencias de Mentoría</h3>
            
            <div className="space-y-4">
              {salespeople
                .filter(person => person.id !== currentUser.id)
                .slice(0, 3)
                .map(person => {
                  const personMetas = metasWithProgress.filter(m => m.vendedorId === person.id);
                  const avgProgress = personMetas.length > 0 
                    ? personMetas.reduce((sum, m) => sum + m.progressPercent, 0) / personMetas.length 
                    : 0;
                  
                  return (
                    <div key={person.id} className="bg-tertiary rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-text-primary">{person.name}</h4>
                          <p className="text-sm text-text-secondary">
                            Progreso promedio: {avgProgress.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-right">
                          {avgProgress < 70 ? (
                            <div>
                              <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full">
                                Necesita apoyo
                              </span>
                              <button className="block mt-2 bg-accent text-primary text-xs px-3 py-1 rounded hover:bg-opacity-90">
                                Ofrecer Mentoría
                              </button>
                            </div>
                          ) : avgProgress > 90 ? (
                            <div>
                              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                                Top Performer
                              </span>
                              <button className="block mt-2 bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700">
                                Solicitar Mentoría
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded-full">
                              Buen rendimiento
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {activeView === 'meetings' && (
        <div className="bg-secondary rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">📅 Reuniones Programadas</h3>
          
          <div className="space-y-4">
            {meetings
              .filter(meeting => meeting.status === 'scheduled')
              .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
              .map(meeting => (
                <div key={meeting.id} className="bg-tertiary rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-text-primary">{meeting.title}</h4>
                      <p className="text-sm text-text-secondary mb-2">{meeting.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-text-secondary">
                        <span>📅 {meeting.scheduledDate.toLocaleDateString('es-ES')}</span>
                        <span>🕒 {meeting.scheduledDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>⏱️ {meeting.duration} min</span>
                        <span>👥 {meeting.participantIds.length} participantes</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      meeting.type === 'one-on-one' ? 'bg-blue-500 text-white' :
                      meeting.type === 'team' ? 'bg-green-500 text-white' :
                      meeting.type === 'review' ? 'bg-orange-500 text-white' :
                      'bg-purple-500 text-white'
                    }`}>
                      {meeting.type}
                    </span>
                  </div>
                  
                  {meeting.actionItems && meeting.actionItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <h5 className="text-sm font-medium text-text-primary mb-2">📋 Tareas pendientes:</h5>
                      <div className="space-y-1">
                        {meeting.actionItems.map(action => (
                          <div key={action.id} className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">{action.description}</span>
                            <span className={`px-2 py-1 rounded-full ${
                              action.status === 'completed' ? 'bg-green-500 text-white' :
                              action.status === 'in-progress' ? 'bg-yellow-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {action.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    <button className="bg-accent text-primary text-xs px-3 py-1 rounded hover:bg-opacity-90">
                      ✏️ Editar
                    </button>
                    <button className="bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700">
                      ✅ Marcar Completada
                    </button>
                    <button className="bg-red-600 text-white text-xs px-3 py-1 rounded hover:bg-red-700">
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationSystem;