import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (url: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Crear conexión Socket.IO
    socketRef.current = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔗 Conectado al servidor Socket.IO');
      // Unirse a la sala de actualizaciones
      socket.emit('join-room', { room: 'crm-updates' });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Desconectado del servidor Socket.IO');
    });

    return () => {
      socket.close();
    };
  }, [url]);

  return socketRef.current;
};