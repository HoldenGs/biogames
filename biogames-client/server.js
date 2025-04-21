import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

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
  console.log(`Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});
