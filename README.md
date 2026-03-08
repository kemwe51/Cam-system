# CAM System

Production-oriented TypeScript monorepo foundation for a programmer-in-the-loop CAM workflow focused on 2D and 2.5D milling.

## What is implemented now

- **CAM Workbench v2** desktop-serious layout with:
  - top application bar for project, plan/review/save/approve actions, view controls, and dirty state
  - left dock tabs for model tree, features, operations, and tools
  - center derived 3D viewport with stock, feature, selection, and operation overlays
  - right inspector for selected feature/operation/tool data
  - bottom panel tabs for risks, checklist, AI review, console, and project metadata
- **Deterministic planning engine** for structured JSON part input
- **Manual programming workflow** with draft-local editing, inline rename, notes/setup/tool/strategy edits, duplicate, delete-manual-operation, reorder, enable/disable, grouping, and filtering
- **Project persistence v2** with API-backed project list/load/save and revision-aware metadata
- **Tooling foundation** with explicit machine profile, setup, and tool library schemas plus default catalog data
- **Importer architecture** with a real JSON importer and honest DXF/STEP placeholders
- **Structured AI advisory review** with deterministic context, manual override awareness, and safe fallback behavior

## What is still foundational or derived only

This repository still does **not** implement:

- real STEP machining
- real DXF machining
- a B-Rep or solid-model kernel
- real toolpath generation or machining simulation
- postprocessing or production G-code output
- feeds/speeds databases, holder assemblies, or collision checking

Important honesty boundary:

- The viewport is a **derived visualization from structured JSON and draft state**.
- DXF and STEP adapters are **architecture placeholders only**.
- AI review is **advisory only** and never overrides deterministic planning authority.

## Workspaces

- `apps/web`: React + Vite CAM workbench UI
- `apps/api`: HTTP API for planning, persistence, review, and approval
- `packages/shared`: shared domain types, Zod schemas, default catalog data
- `packages/engine`: deterministic planning engine
- `packages/ai`: advisory OpenAI Responses API integration
- `packages/importers`: importer interfaces, JSON importer, honest DXF/STEP placeholders
- `docs`: architecture and domain notes
- `examples`: sample part input

## Quick start

```bash
npm install
npm run build
npm run test
```

## Development

Run the API:

```bash
npm run dev:api
```

Run the web workbench:

```bash
npm run dev:web
```

The web app defaults to `http://localhost:3001` for API requests.

For production-style API deployment, set `CAM_WEB_ORIGIN` explicitly so the API only accepts the intended web origin.

## Project persistence v2

Projects are stored by the API in the current file-based repository implementation (default: `/tmp/cam-system-drafts`).

Current API endpoints:

- `GET /projects` - list saved projects
- `GET /projects/:projectId` - load a project
- `PUT /projects/:projectId` - save a project
- `GET /drafts/:projectId` - backwards-compatible load path
- `PUT /drafts/:projectId` - backwards-compatible save path

Saved project metadata includes:

- project id
- part id
- part name
- revision
- updated at
- approval state

## Workbench layout

- **Top bar**: project/session controls, plan/review/save/approve, view presets, view modes, dirty state
- **Left dock**: model tree, features, operations, tools
- **Center**: derived 3D workpiece view
- **Right dock**: inspector for selected workbench item
- **Bottom panel**: risks, checklist, AI review, console, metadata

## Future STEP/DXF integration path

`packages/importers` defines the interface boundary for future import adapters.

- `JsonPartImporter` converts the current structured schema into a valid part input.
- `dxfPartImporter` and `stepPartImporter` currently return explicit `not_implemented` results.
- Future real adapters should translate external geometry into deterministic part/feature structures before planning.

That boundary is intentional so the system stays honest while preparing for future geometry ingestion.
