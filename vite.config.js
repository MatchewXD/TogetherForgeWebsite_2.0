import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        watch: {
            // Avoid EBUSY on Windows when large binaries are locked (e.g. open in Explorer/preview)
            ignored: [
                '**/.git/**',
                '**/node_modules/**',
                '**/.vs/**',
                '**/*.vsidx',
                '**/*.webp',
                '**/*.png',
                '**/*.jpg',
                '**/*.jpeg',
                '**/*.gif',
                '**/*.mp4',
                '**/public/images/**',
            ]
        }
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.js'],
        globals: true
    }
})