# CAM System

Production-oriented TypeScript monorepo foundation for a programmer-in-the-loop CAM workflow focused on 2D and 2.5D milling.

## Geometry & Import Pipeline v3

This milestone moves the repo from a structured-plan workbench into a more geometry-aware authoring foundation while staying explicit about what is still derived, foundational, or not implemented yet.

### What is implemented now

- **Geometry/model foundation** in `@cam/model`
  - explicit `ModelSource`, `ImportedModel`, `ModelEntity`, `ModelView`, `ModelBounds`, `ModelLayer`, `ModelSelection`, `DerivedGeometryFragment`, `FeatureGeometryLink`, `OperationPreview`, `ViewPreset`, and `ViewMode`
  - stable ids for source/model/feature/preview entities so saved UI selection and future mappings have durable anchors
  - derived geometry + source metadata modeling without pretending to be a CAD kernel or B-Rep
- **Importer workflow v3**
  - real JSON importer returning structured source metadata, warnings, imported model data, and deterministic part input when available
  - DXF and STEP routes now participate honestly in the workflow with explicit placeholder import sessions and actionable warnings
  - importer registry for choosing adapters by file type
- **API import workflow + persistence v3**
  - `POST /imports/json`, `POST /imports/dxf`, `POST /imports/step`, `GET /imports/:id`
  - project persistence upgraded from a simple draft blob toward explicit `ImportSessionRecord`, `ProjectRecord`, and lightweight `ProjectRevisionRecord`
  - saved projects now track source import id/type/filename, derived model metadata, warnings, approval state, and revision history
- **Workbench v3 flow**
  - import source → derive model → derive plan → manually edit → review → save/approve
  - project/import start flow for sample JSON, pasted JSON, and DXF/STEP placeholder sessions
  - top-bar metadata for source type, model status, warnings, and unsaved state
  - local undo/redo for workbench edits
- **Viewport pipeline v3**
  - explicit scene builder layered into source/model, stock, feature, selection, and operation preview layers
  - stable entity ids across rebuilds
  - operation preview overlays linked to feature ids and operation ids
- **Manual programming improvements**
  - operation-to-feature relinking
  - persistent operation notes
  - per-operation warning badges
  - project-level unsaved summary and revision summary
- **AI advisory review context upgrade**
  - review context now includes source/model metadata, revision metadata, source/model warnings, planning warnings, and manual override notes

## What is still foundational or derived only

This repository still does **not** implement:

- real STEP parsing or STEP-derived machining
- real DXF parsing or DXF-derived machining
- a B-Rep, solid-model, or CAD kernel
- verified toolpath generation or machining simulation
- postprocessing or production G-code output
- feeds/speeds databases, holder assemblies, or collision checking

Important honesty boundary:

- The viewport is a **derived visualization from import metadata, structured JSON, and deterministic plan state**.
- Operation preview is an **operation preview**, not a toolpath.
- DXF and STEP adapters are **workflow-level placeholders only**.
- AI review is **advisory only** and never overrides deterministic planning authority.

## Workspaces

- `apps/web`: React + Vite CAM workbench UI
- `apps/api`: HTTP API for imports, planning, persistence, review, and approval
- `packages/shared`: shared domain types, Zod schemas, default catalog data
- `packages/model`: geometry/model pipeline types and derived model helpers
- `packages/engine`: deterministic planning engine
- `packages/ai`: advisory OpenAI Responses API integration
- `packages/importers`: importer interfaces, registry, JSON importer, honest DXF/STEP placeholders
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

## Import sessions, projects, and revisions

The API stores data in a file-based repository implementation (default: `/tmp/cam-system-drafts`).

### Import sessions

Current import routes:

- `POST /imports/json`
- `POST /imports/dxf`
- `POST /imports/step`
- `GET /imports/:id`

Current JSON import behavior:

- accepts sample JSON or pasted structured `PartInput` JSON
- validates against the shared schema
- derives a model/session record for viewport and planning handoff
- returns deterministic part input for the planning engine

Current DXF/STEP behavior:

- records source file metadata and creates a placeholder import session
- returns actionable warnings
- does **not** parse geometry, derive machinable features, or claim machining support

### Projects and revisions

Current project routes:

- `GET /projects`
- `GET /projects/:projectId`
- `PUT /projects/:projectId`
- legacy `GET /drafts/:projectId`

Saved project records now include:

- project id
- project revision counter
- source import id
- source type
- source filename
- derived model metadata
- plan metadata
- approval state
- updated at
- warnings
- lightweight revision history

## Workbench layout

- **Top bar**: import/project state, plan/review/save/approve, undo/redo, source/model status, view presets/modes
- **Left dock**: model/import tree, features, operations, tools
- **Center**: derived model + operation preview viewport
- **Right dock**: inspector for selected workbench item
- **Bottom panel**: risks, checklist, AI review, console, metadata/revision summary

## Viewport meaning

The viewport now separates:

- source/model layer
- stock layer
- feature layer
- selection layer
- operation preview layer

These are all derived from structured source metadata and deterministic planning data. They are intentionally labeled as derived model and operation preview only.
