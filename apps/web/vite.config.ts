import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { workspaceSourceAliases, workspaceSourceConditions } from '../../workspace-source-config.ts';

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: workspaceSourceAliases,
    conditions: workspaceSourceConditions,
  },
}));
