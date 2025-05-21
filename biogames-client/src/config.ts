// Use Vite environment variable in production, with fallbacks for development
/*export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || // From .env.production
  (typeof window !== 'undefined' && (window as any).OVERRIDE_API_BASE_URL) || // From index.html global
  '/proxy-api'; // Default fallback*/

// Previous approaches (commented out for reference):
// Check for a global override first (set in index.html)
// export const API_BASE_URL = typeof window !== 'undefined' && (window as any).OVERRIDE_API_BASE_URL 
//   ? (window as any).OVERRIDE_API_BASE_URL 
//   : '/proxy-api';

// Original, commented out for reference:
//export const API_BASE_URL = '/proxy-api'; // TODO: Make sure your reverse proxy is configured for /proxy-api/
 export const API_BASE_URL = 'http://164.67.195.107:3001'; // OLD VALUE 