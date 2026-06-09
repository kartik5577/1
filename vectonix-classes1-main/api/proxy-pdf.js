export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  let pdfUrl = req.query.url;
  
  if (!pdfUrl) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    console.log(`[Proxy] Vercel serverless request for PDF URL: ${pdfUrl}`);
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

    const fetchHeaders = {
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

    console.log(`[Proxy] Serverless fetching PDF from remote source: ${normalizedUrl}`);
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
    
    // Set headers to serve as a PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes
    
    // Allow CORS so the frontend can read it
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    res.send(buffer);
  } catch (error) {
    console.error('PDF Proxy Error:', error);
    res.status(500).json({ error: 'Failed to proxy PDF', details: error?.message || String(error) });
  }
}
