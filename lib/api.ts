// In production the frontend is served by the same Express process as the API,
// so same-origin ('') is correct. Override with VITE_SERVER_URL if you split them.
export const API_URL =
  import.meta.env?.VITE_SERVER_URL || (import.meta.env?.DEV ? 'http://localhost:3001' : '');
