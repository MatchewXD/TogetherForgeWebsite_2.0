import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        watch: {
            ignored: [
                '**/.git/**',
                '**/node_modules/**',
                '**/.vs/**',
                '**/*.vsidx'
            ]
        }
    }
})