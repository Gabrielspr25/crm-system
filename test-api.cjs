const http = require('http');
const data = JSON.stringify({username:'gabriel',password:'admin123'});
const opt = {hostname:'localhost',port:3001,path:'/api/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(opt, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log('Login response:', b.substring(0, 100));
    const parsed = JSON.parse(b);
    if (!parsed.accessToken) { console.log('Login failed:', b); process.exit(1); }
    const t = parsed.accessToken;
    const r = http.request({hostname:'localhost',port:3001,path:'/api/clients?tab=active',headers:{Authorization:'Bearer '+t}}, r2 => {
      let b2 = '';
      r2.on('data', c => b2 += c);
      r2.on('end', () => {
        const d = JSON.parse(b2);
        if (d.clients) {
          const c = d.clients[0];
          console.log('total:', d.clients.length);
          console.log('keys:', Object.keys(c).sort().join(', '));
          console.log('cellular:', c.cellular);
          console.log('vendor_name:', c.vendor_name);
          console.log('primary_contract_end_date:', c.primary_contract_end_date);
          console.log('primary_subscriber_phone:', c.primary_subscriber_phone);
        } else {
          console.log('ERROR:', JSON.stringify(d));
        }
      });
    });
    r.end();
  });
});
req.write(data);
req.end();
