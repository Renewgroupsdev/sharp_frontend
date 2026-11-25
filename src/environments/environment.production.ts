export const environment = {
  production: true,
  envName: 'production',
  /** SHARP backend REST API (backend/api), same origin when deployed alongside the portal. */
  apiBaseUrl: '/sharp/backend/api',
  storagePrefix: 'sharp_ng_',
  /** Live chat: set key / host / port to the production Reverb server (behind HTTPS, port 443 with secure: true). */
  realtime: { key: '', host: '', port: 443, secure: true, authEndpoint: '/sharp/backend/broadcasting/auth' },
};
