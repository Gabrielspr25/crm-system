import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/vigia/**/*.{test,spec}.js'],
        reporters: ['verbose'], // Para ver detalles en consola
    },
});
