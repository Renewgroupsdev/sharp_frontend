export const environment = {
  production: false,
  envName: 'local',
  /** Front-end prototype: data lives in browser localStorage; no API base URL is needed yet. */
  /** SHARP backend REST API (backend/api) - the same one the Super Admin dashboard and the mobile app use. */
  apiBaseUrl: 'http://192.168.0.210:8000/api/web',
  storagePrefix: 'sharp_ng_',
  /** Live chat: the Laravel Reverb WebSocket server (php artisan reverb:start). Values match REVERB_* in the API .env. */
  realtime: { key: '31d41adc06f51168bcb4', host: '192.168.0.210', port: 8080, secure: false, authEndpoint: 'http://192.168.0.210:8000/broadcasting/auth' },
};
