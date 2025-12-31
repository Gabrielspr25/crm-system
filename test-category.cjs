const http = require('http');

const data = JSON.stringify({
  code: 'TEST',
  name: 'Prueba',
  color: 'blue',
  display_order: 99
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/tarifas/categories',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
