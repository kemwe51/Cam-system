# Architecture

## Monorepo layout

- `apps/web`: React + Vite CAM workbench optimized for mobile usability but arranged for desktop-class CAM authoring
- `apps/api`: minimal Node HTTP API exposing planning, persistence, review, and approval routes
- `packages/shared`: shared Zod schemas, project metadata, machine/setup/tool catalog foundations
- `packages/engine`: deterministic planning logic for structured JSON part input
- `packages/ai`: advisory OpenAI Responses API shell returning structured review output only
- `packages/importers`: importer interfaces plus JSON importer and honest DXF/STEP placeholders
- `examples`: sample JSON part input used by the demo flow

## Responsibility split

The deterministic engine owns:

- feature normalization
- operation proposals
- tool and setup references
- risk creation
- checklist creation
- cycle time estimation
- approval state initialization

The AI package is advisory only. It reviews a deterministic draft plan plus manual override context and returns structured JSON. It does not create manufacturing authority, output toolpaths, or generate G-code.

## Workbench v2 UI structure

The web app now uses a persistent CAM-style layout:

- **Top application bar** for session identity, plan/review/save/approve actions, view presets, and dirty state
- **Left dock** with tabs for model tree, features, operations, and tools
- **Center viewport** showing derived stock, feature, selection, and operation overlays
- **Right inspector** for the selected feature, operation, or tool
- **Bottom panel** for risks, checklist, AI review, console, and project metadata

## Derived viewport pipeline

The viewport scene is still derived from structured input and draft state. The current pipeline separates:

- stock body
- derived feature bodies
- selection overlay
- operation overlays
- section-ready clipping-plane boundary

This is explicit derived visualization only. It is **not** a CAD kernel, **not** verified solid geometry, and **not** a toolpath preview.

## Persistence v2

The API now exposes an explicit project repository interface with a file-based implementation. Saved projects include metadata for:

- project id
- part id
- part name
- revision
- updated at
- approval state

Current routes:

- `GET /projects`
- `GET /projects/:projectId`
- `PUT /projects/:projectId`
- legacy `drafts/:projectId` compatibility routes

## Import adapter boundary

`packages/importers` defines the boundary for future real file ingestion.

Current state:

- JSON import works against the existing structured schema
- DXF importer returns `not_implemented`
- STEP importer returns `not_implemented`

Future real import work should map external geometry into deterministic part/feature structures before any planning step claims machining readiness.

## Current boundaries

This repository does not yet implement:

- DXF machining
- STEP machining
- a geometry kernel or B-Rep modeler
- machine simulation
- collision checking
- real toolpath generation
- postprocessors or G-code output
- production-grade tool assemblies and cutting data

Those gaps remain explicit so the repository stays honest, auditable, and manufacturing-oriented.
