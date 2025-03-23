import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 80;
const sslPort = process.env.SSL_PORT || 443;


app.use(express.static(path.join(__dirname, 'build')));
// Serve static files from the 'build' directory
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Create HTTP server
const httpServer = http.createServer(app);

// Start the servers
httpServer.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});
