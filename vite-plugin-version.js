import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function injectVersion() {
    return {
        name: 'inject-version',
        transformIndexHtml(html) {
            // Read version from package.json
            const packageJson = JSON.parse(
                readFileSync(resolve(__dirname, './package.json'), 'utf-8')
            );
            const version = `v${packageJson.version}`;

            // Replace all version placeholders
            return html
                .replace(/<!-- BUILD_VERSION: v[\d\.]+-?[\w-]* -->/g, `<!-- BUILD_VERSION: ${version} -->`)
                .replace(/VentasPro CRM - v[\d\.]+-?[\w-]* PRODUCTION/g, `VentasPro CRM - ${version} PRODUCTION`)
                .replace(/const CURRENT_VERSION = 'v[\d\.]+-?[\w-]*';/g, `const CURRENT_VERSION = '${version}';`);
        }
    };
}
