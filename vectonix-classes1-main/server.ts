import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const root = process.cwd();
  // Use a variable to track if we're in production
  const isProduction = process.env.NODE_ENV === "production";

  // Automatically copy PDF worker from node_modules to public/ if available
  try {
    const sourceWorkerPath = path.resolve(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    const destWorkerFolder = path.resolve(root, 'public');
    const destWorkerPath = path.resolve(destWorkerFolder, 'pdf.worker.min.mjs');

    if (!fs.existsSync(destWorkerFolder)) {
      fs.mkdirSync(destWorkerFolder, { recursive: true });
    }
    if (fs.existsSync(sourceWorkerPath)) {
      fs.copyFileSync(sourceWorkerPath, destWorkerPath);
      console.log('[Worker Sync] Local pdf.worker.min.mjs is now cached and ready in public/');
    } else {
      console.warn('[Worker Sync] Source worker path not found, skipping sync.');
    }
  } catch (err) {
    console.error('[Worker Sync] Failed to sync PDFJS worker locally:', err);
  }

  app.use(express.json());

  // API Logging middleware
  app.use('/api', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Razorpay initialization
  console.log('Initializing Razorpay with Key ID:', process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder');
  
  let razorpay: any;
  try {
    // @ts-ignore
    razorpay = new (Razorpay.default || Razorpay)({
      key_id: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
    });
    console.log('Razorpay initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Razorpay:', err);
  }

  // API Routes
  app.get('/api/proxy-pdf', async (req, res) => {
    let pdfUrl = req.query.url as string;
    if (!pdfUrl) {
      console.error('[Proxy] Missing URL parameter in request');
      return res.status(400).json({ error: 'Missing URL parameter' });
    }
    try {
      console.log(`[Proxy] Incoming request for PDF URL: ${pdfUrl}`);
      let decoded = pdfUrl;
      
      // Only decode if we have double-encoding (e.g. %25 which is the encoded %)
      if (pdfUrl.includes('%25')) {
        try {
          decoded = decodeURIComponent(pdfUrl);
          console.log(`[Proxy] Decoded double-encoded URL to: ${decoded}`);
        } catch (e) {
          console.warn('[Proxy] Failed to decode double-encoded URL query:', e);
        }
      }
      
      let normalizedUrl = decoded;
      
      // To be extremely robust, if it is a Firebase Storage URL, make sure the portion after /o/ is correctly formatted
      if (decoded.includes('firebasestorage.googleapis.com')) {
        try {
          const oIndex = decoded.indexOf('/o/');
          if (oIndex !== -1) {
            const prefix = decoded.substring(0, oIndex + 3); // up to "/o/"
            const pathAndQuery = decoded.substring(oIndex + 3);
            const qIndex = pathAndQuery.indexOf('?');
            const pathPart = qIndex !== -1 ? pathAndQuery.substring(0, qIndex) : pathAndQuery;
            const queryPart = qIndex !== -1 ? pathAndQuery.substring(qIndex) : '';
            
            // Decode completely first, then re-encode the entire path with encodeURIComponent
            const fullyDecodedPath = decodeURIComponent(pathPart);
            const correctedPath = encodeURIComponent(fullyDecodedPath);
            
            normalizedUrl = `${prefix}${correctedPath}${queryPart}`;
            console.log(`[Proxy] Normalized Firebase Storage URL: ${normalizedUrl}`);
          }
        } catch (err) {
          console.error('[Proxy] Error normalizing Firebase Storage URL:', err);
        }
      } else {
        try {
          const parsedUrl = new URL(decoded);
          normalizedUrl = parsedUrl.toString();
        } catch (e) {
          // Fallback to original
        }
      }
      
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf, */*'
      };

      // Ensure authorization headers are forwarded to correctly authorize Firebase storage request on behalf of the user
      const clientAuthHeader = req.headers.authorization;
      if (clientAuthHeader) {
        fetchHeaders['Authorization'] = clientAuthHeader;
        console.log('[Proxy] Forwarding client credentials / ID token to Firebase backend');
      } else {
        console.warn('[Proxy] Warning: No client credentials / Authorization header provided by client');
      }
      
      console.log(`[Proxy] Fetching PDF from remote source: ${normalizedUrl}`);
      const response = await fetch(normalizedUrl, {
        headers: fetchHeaders
      });
      
      if (!response.ok) {
        console.error(`[Proxy] PDF fetch failed. HTTP Status: ${response.status} ${response.statusText}`);
        return res.status(response.status).json({ 
          error: `Remote server returned error context: ${response.statusText}`, 
          statusCode: response.status 
        });
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.send(buffer);
      console.log(`[Proxy] PDF served successfully (${buffer.length} bytes)`);
    } catch (error: any) {
      console.error('[Proxy] PDF Proxy Critical Error:', error);
      res.status(500).json({ 
        error: 'Failed to proxy PDF', 
        details: error?.message || String(error)
      });
    }
  });

  app.options('/api/proxy-pdf', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.status(200).end();
  });

  app.post('/api/create-order', async (req, res) => {
    const { amount, currency = 'INR', receipt } = req.body;
    console.log('Received order request:', { amount, currency, receipt });
    
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      console.error('Invalid amount received:', amount);
      return res.status(400).json({ error: 'Invalid amount', details: 'Amount must be greater than 0' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const checkDemoMode = !keyId || 
                          keyId === 'rzp_test_placeholder' || 
                          !keySecret || 
                          keySecret === 'placeholder_secret';

    if (checkDemoMode) {
      console.log('[Razorpay] Using Demo Sandbox mode. Mocking order response.');
      return res.json({
        id: 'order_demo_' + Math.random().toString(36).substring(2, 11),
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt: String(receipt),
        status: 'created',
        key_id: 'rzp_test_placeholder',
        isDemo: true
      });
    }

    try {
      if (!razorpay) {
        throw new Error('Razorpay client not initialized. Check your API keys.');
      }

      const orderOptions = {
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt: String(receipt),
      };
      
      console.log('[Razorpay] Creating order with options:', orderOptions);
      const order = await razorpay.orders.create(orderOptions);
      console.log('[Razorpay] Order created:', order.id);
      res.json({
        ...order,
        key_id: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        isDemo: false
      });
    } catch (error: any) {
      console.error('[Razorpay] Error during order creation:', error);
      console.log('[Razorpay] Falling back to Demo order token simulation due to API error');
      res.json({
        id: 'order_demo_' + Math.random().toString(36).substring(2, 11),
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt: String(receipt),
        status: 'created',
        key_id: 'rzp_test_placeholder',
        isDemo: true,
        fallbackMessage: error.description || error.message || 'Sandbox fallback triggered'
      });
    }
  });

  // Error handling middleware for API
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 404 handler for API - MUST STAY BEFORE SPA FALLBACK
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found` });
  });

  // Serve static files from public folder with optimized caching headers (1-day cache with validation recheck)
  app.use(express.static(path.resolve(root, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
      }
    }
  }));

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(root, 'dist');
    
    // Serve static files from dist with highly optimized edge & browser caching
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
          // Absolute zero-caching for HTML entry points so updates are picked up instantly
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        } else if (filepath.includes('/assets/') || filepath.match(/\.[a-f0-9]{8,16}\.(js|css|png|jpg|jpeg|gif|woff2?|svg)$/)) {
          // Extreme 1 year immutable hashing cache for static build chunks produced by Vite
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          // Fallback static files (icons, configs): 1-day dynamic recheck
          res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
        }
      }
    }));
    
    // Fallback for production (routing all non-file requests to index.html to prevent 404s on refresh)
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
