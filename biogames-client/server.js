import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
// Temporarily comment out the rate limiter import to completely disable it
// import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Trust first proxy, more secure than 'true' but still works with XFF header
app.set('trust proxy', 1);

// Port configuration - 3000 for local development
const PORT = process.env.PORT || 3000;

// Security headers with helmet (configured for proper asset loading)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for development, enable and configure properly for production
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// Compress responses
app.use(compression());

// API Proxy Middleware - Must be before rate limiter for API routes
// Client API_BASE_URL is '/proxy-api'
// Backend API is at http://164.67.195.107:3001
// Backend expects paths like /api/endpoint or /leaderboard
app.use('/proxy-api', createProxyMiddleware({
  target: 'http://164.67.195.107:3001',
  changeOrigin: true, // Recommended for virtual hosted sites & to change host header to target
  pathRewrite: {
    '^/proxy-api': '', // Remove /proxy-api from the start of the path
                     // e.g., /proxy-api/api/preview_core_id -> /api/preview_core_id
                     // e.g., /proxy-api/leaderboard -> /leaderboard
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] Forwarding: ${req.method} ${req.originalUrl} -> ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy] Error:', err);
    // Send a generic error response to the client
    // Ensure headers are not already sent before writing to response
    if (res && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' }); // 502 Bad Gateway
        res.end('Proxy error: Could not connect to API service.');
    } else if (res && res.headersSent && !res.writableEnded) {
        // If headers are sent but stream is still open, just end it.
        res.end();
    }
  }
}));

// Rate limiting - TEMPORARILY DISABLED
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   standardHeaders: true,
//   legacyHeaders: false,
//   // Ignore rate limiting for proxied API requests that we've already processed
//   skip: (req) => req.originalUrl.startsWith('/proxy-api')
// });
// app.use(limiter);

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d', // Cache control
  etag: true
}));

// Handle all routes by serving index.html (single-page application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Create HTTP server
const httpServer = http.createServer(app);

// Start the HTTP server
httpServer.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`API proxy active at /proxy-api -> http://164.67.195.107:3001`);
  console.log(`Rate limiting DISABLED for debugging`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});
