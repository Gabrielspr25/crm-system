import { Configuration, PopupRequest } from "@azure/msal-browser";

// Configuración de MSAL (Microsoft Authentication Library)
export const msalConfig: Configuration = {
    auth: {
        // ESTE ES EL VALOR QUE NECESITAMOS OBTENER DE AZURE
        // Por ahora usaremos un placeholder. El usuario debe reemplazarlo.
        clientId: "TU_CLIENT_ID_AQUI", 
        authority: "https://login.microsoftonline.com/common", // "common" permite cuentas personales y de trabajo
        redirectUri: window.location.origin, // http://localhost:5173 o https://crmp.ss-group.cloud
    },
    cache: {
        cacheLocation: "sessionStorage", // Esto ayuda a no perder la sesión al recargar
        storeAuthStateInCookie: false,
    },
};

// Permisos que solicitaremos al usuario
export const loginRequest: PopupRequest = {
    scopes: ["User.Read", "Mail.Send"] // Permiso para leer perfil y ENVIAR CORREOS
};
