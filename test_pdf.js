import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    const pdfParse = require('pdf-parse');
    console.log('--- REQUIRE RESULT ---');
    console.log('Type:', typeof pdfParse);
    console.log('Is Function:', typeof pdfParse === 'function');
    console.log('Keys:', Object.keys(pdfParse));
    if (typeof pdfParse !== 'function') {
        console.log('Value:', pdfParse);
    }
} catch (e) {
    console.error('Require failed:', e.message);
}
