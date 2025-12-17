import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    const isBuild = command === 'build';
    
    const plugins: any[] = [react()];
    
    // CRITICAL: vite-plugin-api is DEV-ONLY
    // NEVER load during build - causes esbuild resolution errors  
    // Vercel production uses api/v1/[...path].ts Serverless Function instead
    // Only load when command === 'serve' (dev server), not 'build'
    if (!isBuild && mode === 'development') {
      try {
        // Use dynamic import with .ts extension - Vite/tsx will handle it
        // Try .js first (compiled), then .ts (source)
        let pluginModule;
        try {
          pluginModule = await import('./vite-plugin-api.js');
        } catch {
          // Fallback to .ts if .js doesn't exist
          pluginModule = await import('./vite-plugin-api.ts');
        }
        plugins.push(pluginModule.vitePluginApi());
        console.log('✅ vite-plugin-api loaded successfully');
      } catch (err: any) {
        console.error('❌ vite-plugin-api could not be loaded:', err.message);
        console.error('   Full error:', err);
        console.warn('   API routes will not work - make sure vite-plugin-api.ts exists');
        // Don't throw - allow dev server to continue without API plugin
      }
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Proxy for production or if vite-plugin-api is not available
        proxy: env.VITE_API_URL ? {
          '/api/v1': {
            target: env.VITE_API_URL,
            changeOrigin: true,
          },
        } : undefined,
      },
      plugins: plugins,
      // SECURITY: Do NOT embed API keys in frontend bundle
      // All Gemini API calls should go through backend API
      // define: {
      //   'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      //   'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      // },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Optimize esbuild configuration to avoid conflicts
      optimizeDeps: {
        esbuildOptions: {
          target: 'es2022',
        },
      },
      build: {
        // Increase chunk size warning limit
        chunkSizeWarningLimit: 1000,
        // Use esbuild for minification (faster)
        minify: 'esbuild',
        rollupOptions: {
          output: {
            manualChunks: undefined,
          },
        },
      }
    };
});
