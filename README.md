# CAM System

Production-oriented TypeScript monorepo foundation for a programmer-in-the-loop CAM workflow focused on 2D and 2.5D milling.

## DXF & 2D Geometry Pipeline v4

This milestone moves the repo from a structured-plan workbench into a more geometry-aware authoring foundation while staying explicit about what is still derived, foundational, or not implemented yet.

### What is implemented now

- **2D geometry domain** in `@cam/geometry2d`
  - explicit `Geometry2DDocument`, `Geometry2DEntity`, `GeometryLayer`, `GeometryBounds`, `GeometryTransform`, `GeometryLoop`, `GeometryChain`, `GeometryProfile`, `GeometryRegion`, `GeometryNode`, `GeometryEdge`, `GeometryGraph`, `GeometryWarning`, `GeometryUnit`, and `GeometrySourceRef`
  - stable entity ids, explicit unit metadata, layer visibility metadata, document bounds, and a tolerance-aware graph builder for imported planar data
  - no fake B-Rep claims: this package stays 2D-focused and honest
- **Geometry/model foundation** in `@cam/model`
  - explicit imported geometry, extracted feature, and operation-preview modeling on top of the existing `ImportedModel` / `ModelEntity` / `ModelView` contracts
  - stable ids for source geometry, extracted features, plan features, and previews so mappings remain durable across import → plan → review
  - viewport fragments now distinguish raw imported geometry, extracted feature overlays, and operation preview overlays
- **Importer workflow v4**
  - real JSON importer returning structured source metadata, warnings, imported model data, and deterministic part input when available
  - real DXF importer for a practical planar subset with explicit unsupported-entity warnings
  - STEP remains an honest placeholder session only
  - importer registry for choosing adapters by file type
- **First deterministic DXF-derived feature extraction**
  - outside contour candidates from outer closed profiles
  - internal pocket / slot / inside-contour candidates from closed internal geometry using explicit heuristics
  - hole candidates from circles
  - text promoted to marking-only engraving candidates when clearly present
  - unclassified geometry is preserved as unclassified instead of being silently invented into a machining feature
- **API import workflow + persistence v4**
  - `POST /imports/json`, `POST /imports/dxf`, `POST /imports/step`, `GET /imports/:id`
  - project persistence upgraded from a simple draft blob toward explicit `ImportSessionRecord`, `ProjectRecord`, and lightweight `ProjectRevisionRecord`
  - saved projects now track source import id/type/filename, derived model metadata, warnings, approval state, and revision history
- **Workbench v4 flow**
  - import source → derive model → derive plan → manually edit → review → save/approve
  - project/import start flow for sample JSON, pasted JSON, pasted DXF text, and honest STEP placeholders
  - imported geometry panel with layers, entity counts, open/closed profile counts, and warnings
  - top-bar metadata for source type, model status, warnings, and unsaved state
  - local undo/redo for workbench edits
- **Viewport pipeline v4**
  - explicit scene builder layered into imported geometry, stock, extracted features, selection, and operation preview layers
  - stable entity ids across rebuilds
  - open-chain vs closed-loop distinction, top-view-friendly review, and selected-entity highlighting for imported 2D geometry
  - operation preview overlays linked to extracted feature ids and operation ids
- **Manual programming improvements**
  - operation-to-feature relinking
  - persistent operation notes
  - per-operation warning badges
  - source geometry references in the feature inspector
  - manual reclassification for imported/inferred features (`contour`, `pocket`, `slot`, `hole group`, `ignore`, `unclassified`) with explicit draft warnings
  - project-level unsaved summary and revision summary
- **AI advisory review context upgrade**
  - review context now includes DXF source metadata, extraction warnings, open/closed profile counts, unclassified geometry summary, and manual reclassification context

## What is still foundational or derived only

This repository still does **not** implement:

- real STEP parsing or STEP-derived machining
- a B-Rep, solid-model, or CAD kernel
- verified toolpath generation or machining simulation
- postprocessing or production G-code output
- feeds/speeds databases, holder assemblies, or collision checking

Important honesty boundary:

- The viewport is a **derived visualization from imported geometry, extracted feature overlays, structured JSON, and deterministic plan state**.
- Operation preview is an **operation preview**, not a toolpath.
- DXF support is **practical-subset only**, not full DXF support.
- STEP remains a **workflow-level placeholder only**.
- AI review is **advisory only** and never overrides deterministic planning authority.

## Workspaces

- `apps/web`: React + Vite CAM workbench UI
- `apps/api`: HTTP API for imports, planning, persistence, review, and approval
- `packages/shared`: shared domain types, Zod schemas, default catalog data
- `packages/geometry2d`: 2D geometry document + graph model and DXF subset parsing
- `packages/model`: geometry/model pipeline types and derived model helpers
- `packages/engine`: deterministic planning engine
- `packages/ai`: advisory OpenAI Responses API integration
- `packages/importers`: importer interfaces, registry, JSON importer, practical DXF subset importer, honest STEP placeholder
- `docs`: architecture and domain notes
- `examples`: sample part input

## Quick start

```bash
npm install
npm run build
npm run test
```

## Development

Workspace packages resolve through their built `dist/` entries for runtime usage. The stable developer workflow is:

1. install dependencies once with `npm install`
2. build workspace libraries with `npm run build:packages`
3. run the API or web app from the root scripts so they always start from freshly built package output

Production builds use dedicated `tsconfig.build.json` files so test files are excluded from emitted `dist/` output. The regular `tsconfig.json` files stay available for editor/test/dev type checking.

Run the API:

```bash
npm run dev:api
```

Run the web workbench:

```bash
npm run dev:web
```

The web app defaults to `http://localhost:3001` for API requests.

### Root workspace scripts

```bash
npm run build:packages   # build shared workspace libraries only
npm run build            # build libraries, then api and web
npm run test             # rebuild libraries, then run all workspace tests
npm run test:workspaces  # run workspace tests without rebuilding first
npm run dev:api          # start API from a clean checkout after building libraries
npm run dev:web          # start Vite web dev server after building libraries
```

Contributor caveat:

- Runtime resolution stays intentionally honest: package `main` / `exports` point at built `dist/` files.
- If you change code inside `packages/*` while `npm run dev:api` or `npm run dev:web` is already running, rebuild the libraries with `npm run build:packages` so the apps pick up the new package output.
- Vitest continues to execute tests from source files; production builds no longer emit `*.test.*` artifacts.

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

Current DXF behavior:

- accepts pasted ASCII DXF text payloads
- supports `LINE`, `ARC`, `CIRCLE`, `POINT`, `TEXT` / `MTEXT` metadata, `LWPOLYLINE`, and `POLYLINE`
- builds a 2D geometry document, a tolerance-aware geometry graph, and first-pass extracted feature candidates
- returns deterministic part input only with explicit planning-default assumptions for stock thickness and feature depths
- preserves unsupported entities as warnings instead of silently discarding them

Current STEP behavior:

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

## DXF subset and viewport meaning

Current practical DXF subset:

- `LINE`
- `ARC`
- `CIRCLE`
- `POINT`
- `TEXT` / `MTEXT` as metadata-only marking input
- `LWPOLYLINE`
- `POLYLINE`

Intentionally unsupported in this milestone:

- `SPLINE`
- `ELLIPSE`
- blocks / inserts
- hatches
- dimensions
- true 3D DXF entities
- full annotation semantics

Imported geometry becomes extracted features through:

1. DXF subset parsing into `Geometry2DDocument`
2. tolerance-aware graph / chain / loop / region building in `@cam/geometry2d`
3. deterministic feature inference in `@cam/engine`
4. imported-model + viewport mapping in `@cam/model`
5. manual review / reclassification in the workbench before approval

The viewport now separates:

- imported geometry layer
- stock layer
- extracted feature layer
- selection layer
- operation preview layer

These are all derived from imported 2D geometry, structured source metadata, and deterministic planning data. They are intentionally labeled as imported geometry, extracted features, and operation preview only.
