import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5174,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),
        resetPassword: resolve(__dirname, 'reset-password.html'),
        portal: resolve(__dirname, 'portal.html'),
        portalServices: resolve(__dirname, 'portal-services.html'),
        portalMessages: resolve(__dirname, 'portal-messages.html'),
        portalInvoices: resolve(__dirname, 'portal-invoices.html'),
        portalAccount: resolve(__dirname, 'portal-account.html'),
        portalRequestService: resolve(__dirname, 'portal-request-service.html'),
        portalRequestHistory: resolve(__dirname, 'portal-request-history.html')
      }
    }
  }
});
