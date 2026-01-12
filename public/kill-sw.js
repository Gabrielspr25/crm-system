// SCRIPT DE EMERGENCIA: Mata todos los Service Workers
(function() {
  const SW_KILLED = 'sw_killed_v49';
  
  // Si ya lo hicimos, no hacer nada
  if (sessionStorage.getItem(SW_KILLED)) {
    return;
  }
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      if (registrations.length > 0) {
        for (let registration of registrations) {
          registration.unregister();
          console.log('Service Worker killed:', registration.scope);
        }
        // Marcar como hecho
        sessionStorage.setItem(SW_KILLED, 'true');
        // Recargar UNA sola vez
        window.location.reload(true);
      }
    });
  }
  
  // Limpiar caches viejos
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        if (name.includes('crm-pro') || name.includes('workbox')) {
          caches.delete(name);
          console.log('Cache deleted:', name);
        }
      }
    });
  }
})();
