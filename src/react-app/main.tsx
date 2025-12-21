import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import { APP_VERSION } from "@/version";

// Initialize dark mode
const initializeTheme = () => {
  const saved = localStorage.getItem('theme');
  const isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
};

initializeTheme();

console.log(`%c VERSION ACTUAL: ${APP_VERSION} `, 'background: #222; color: #bada55; font-size: 20px');

// 🚨 FUERZA BRUTA: Desregistrar cualquier Service Worker antiguo que pueda estar bloqueando la actualización
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
      console.log('🚨 Eliminando Service Worker zombie:', registration);
      registration.unregister();
    }
    // Eliminamos el reload automático para evitar bucles infinitos, como sugirió el profesor.
    // El SW se eliminará y en la próxima visita estará limpio.
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
