import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { workspaceSourceAliases, workspaceSourceConditions } from '../../workspace-source-config.ts';

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  ...(command === 'serve' || mode === 'test'
    ? {
        resolve: {
          alias: workspaceSourceAliases,
          conditions: workspaceSourceConditions,
        },
      }
    : {}),
}));
