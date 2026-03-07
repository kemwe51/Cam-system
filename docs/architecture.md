# Architecture

## Monorepo layout

- `apps/web`: React + Vite PWA review console optimized for narrow screens first
- `apps/api`: minimal Node HTTP API exposing planning, review, and approval routes
- `packages/shared`: shared Zod schemas and TypeScript types for all request/response payloads
- `packages/engine`: deterministic planning logic for v1 JSON part input
- `packages/ai`: advisory OpenAI Responses API shell returning structured review output only
- `examples`: sample JSON part input used by the demo flow

## Responsibility split

The deterministic engine owns feature normalization, operation proposals, tool defaults, risk creation, checklist creation, cycle time estimation, and approval state initialization.

The AI package is advisory only. It reviews a deterministic draft plan and returns structured JSON. It does not create manufacturing authority, output toolpaths, or generate G-code.

## v1 boundaries

This repository does not implement:

- DXF or STEP ingestion
- a geometry kernel
- collision checking
- machine simulation
- feeds and speeds databases
- postprocessors or G-code output

Those gaps are explicit so the repository stays honest and reviewable.
