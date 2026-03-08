import { defineConfig } from 'vitest/config';
import { workspaceSourceAliases, workspaceSourceConditions } from './workspace-source-config.ts';

export default defineConfig({
  resolve: {
    alias: workspaceSourceAliases,
    conditions: workspaceSourceConditions,
  },
});
