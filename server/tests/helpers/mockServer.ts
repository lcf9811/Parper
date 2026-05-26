/**
 * Mock HTTP Server for testing httpApi tool
 * Simulates SCADA API responses
 */
import http from 'http';

const PORT = 9999;

const server = http.createServer((req, res) => {
  const url = new URL(req.url!, `http://127.0.0.1:${PORT}`);

  // Log request for debugging
  console.log(`[MockServer] ${req.method} ${url.pathname}`);

  if (url.pathname === '/api/v1/sensor/realtime') {
    const stationId = url.searchParams.get('station_id') || 'UNKNOWN';
    const params = url.searchParams.get('params') || 'ph,do,cod,tn,tp';

    // Simulate different stations
    const mockData: Record<string, any> = {
      INLET_POOL_01: {
        ph: 7.2,
        do: 3.5,
        cod: 45,
        tn: 25,
        tp: 3.2,
        timestamp: new Date().toISOString(),
      },
      OUTLET_01: {
        ph: 6.8,
        do: 5.2,
        cod: 30,
        tn: 12,
        tp: 0.5,
        timestamp: new Date().toISOString(),
      },
    };

    const data = mockData[stationId] || {
      error: `Station '${stationId}' not found`,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === '/api/v1/sensor/error') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return;
  }

  if (url.pathname === '/api/v1/sensor/slow') {
    // Simulate slow response (10 seconds)
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: 'slow response' }));
    }, 10000);
    return;
  }

  if (url.pathname === '/api/v1/sensor/large') {
    // Simulate large response (2MB)
    const largeData = 'x'.repeat(2_000_000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: largeData }));
    return;
  }

  // Echo endpoint for testing POST
  if (url.pathname === '/api/v1/echo') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : null,
      }));
    });
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Removed: ES module doesn't support require.main
// Server is started by runTests.ts instead


export { server, PORT };
