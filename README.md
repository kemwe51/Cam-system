# CAM System

Production-oriented TypeScript monorepo foundation for a programmer-in-the-loop CAM workflow focused on 2D and 2.5D milling.

## Workspaces

- `apps/web`: mobile-first PWA review console
- `apps/api`: HTTP API for planning, review, and approval
- `packages/shared`: shared domain types and Zod schemas
- `packages/engine`: deterministic planning engine
- `packages/ai`: advisory OpenAI Responses API integration shell
- `docs`: architecture and domain documentation
- `examples`: sample part input

## Quick start

```bash
npm install
npm run build
npm run test
node apps/api/dist/server.js
```

Then run the web app with:

```bash
npm run dev:web
```

The default API URL for the web app is `http://localhost:3001`.

For production-style API deployment, set `CAM_WEB_ORIGIN` explicitly so the API only accepts the intended web origin.
