import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, 'src', 'version.ts');

try {
    let content = fs.readFileSync(versionFilePath, 'utf8');

    // Regex to find the version string: export const APP_VERSION = 'v5.1.68-NO-REFERIDO';
    const versionRegex = /export const APP_VERSION = ["']v(\d+)\.(\d+)\.(\d+)(.*)["'];/;
    const match = content.match(versionRegex);

    if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        let patch = parseInt(match[3]);
        const suffix = match[4];

        // Increment patch
        patch++;

        const newVersion = `v${major}.${minor}.${patch}${suffix}`;
        // Detect used quote
        const quote = content.match(versionRegex)[0].includes("'") ? "'" : '"';
        const newContent = content.replace(versionRegex, `export const APP_VERSION = ${quote}${newVersion}${quote};`);

        fs.writeFileSync(versionFilePath, newContent, 'utf8');
        console.log(`✅ Versión actualizada en src/version.ts: ${match[0]} -> ${newVersion}`);

        // Actualizar package.json también
        const packageJsonPath = path.join(__dirname, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            pkg.version = `${major}.${minor}.${patch}${suffix}`;
            fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');
            console.log(`✅ Versión actualizada en package.json: -> ${pkg.version}`);
        }

    } else {
        console.error('❌ No se pudo encontrar el patrón de versión en src/version.ts');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Error actualizando la versión:', error);
    process.exit(1);
}
