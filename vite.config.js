import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devSecurityHeaders, securityHeaders } from './security-headers.mjs'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        // Dev: security headers with HMR-friendly CSP
        headers: devSecurityHeaders,
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
    preview: {
        // Production-like headers when running `vite preview`
        headers: securityHeaders,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.js'],
        globals: true
    }
})