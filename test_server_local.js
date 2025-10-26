import fetch from 'node-fetch';

async function test() {
  try {
    console.log('Probando servidor local...');
    const res = await fetch('http://localhost:3001/api/health');
    const data = await res.json();
    console.log('✅ Servidor funciona:', data);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

test();


