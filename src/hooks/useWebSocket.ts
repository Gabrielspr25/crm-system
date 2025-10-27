import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketUpdate {
  type: string;
  action: 'created' | 'updated' | 'deleted';
  data: any;
  timestamp: string;
}

interface UseWebSocketProps {
  onUpdate?: (update: WebSocketUpdate) => void;
  enabled?: boolean;
}

export const useWebSocket = ({ onUpdate, enabled = true }: UseWebSocketProps) => {
  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    console.log('🔗 Conectando a WebSocket...');
    
    // Conectar al servidor WebSocket - URL relativa para producción
    const socketUrl = ''; // URL relativa, usar el mismo dominio
    socket.current = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const currentSocket = socket.current;

    // Event handlers
    currentSocket.on('connect', () => {
      console.log('✅ Conectado a WebSocket:', currentSocket.id);
      currentSocket.emit('join-room', { room: 'crm-updates' });
    });

    currentSocket.on('disconnect', () => {
      console.log('🔌 Desconectado de WebSocket');
    });

    currentSocket.on('data-update', (update: WebSocketUpdate) => {
      console.log(`📡 Actualización recibida: ${update.action} ${update.type}`, update.data);
      
      if (onUpdate) {
        onUpdate(update);
      }
    });

    currentSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error);
    });

    currentSocket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconectado a WebSocket (intento ${attemptNumber})`);
    });

    return () => {
      console.log('🔌 Desconectando WebSocket...');
      currentSocket.disconnect();
    };
  }, [enabled, onUpdate]);

  return {
    socket: socket.current,
    isConnected: socket.current?.connected || false
  };
};