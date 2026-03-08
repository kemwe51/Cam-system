import { fileURLToPath } from 'node:url';

export const workspaceSourceConditions = ['source'];

export const workspaceSourceAliases = [
  { find: '@cam/shared', replacement: fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)) },
  { find: '@cam/geometry2d', replacement: fileURLToPath(new URL('./packages/geometry2d/src/index.ts', import.meta.url)) },
  { find: '@cam/model', replacement: fileURLToPath(new URL('./packages/model/src/index.ts', import.meta.url)) },
  { find: '@cam/engine', replacement: fileURLToPath(new URL('./packages/engine/src/index.ts', import.meta.url)) },
  { find: '@cam/importers', replacement: fileURLToPath(new URL('./packages/importers/src/index.ts', import.meta.url)) },
  { find: '@cam/ai', replacement: fileURLToPath(new URL('./packages/ai/src/index.ts', import.meta.url)) },
];
