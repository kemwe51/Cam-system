# Architecture

## Monorepo layout

- `apps/web`: React + Vite CAM workbench optimized for mobile usability but arranged for desktop-class CAM authoring
- `apps/api`: minimal Node HTTP API exposing import, planning, persistence, review, and approval routes
- `packages/shared`: shared Zod schemas, deterministic planning contracts, machine/setup/tool catalog foundations
- `packages/geometry2d`: practical 2D geometry document + graph domain and DXF subset parser
- `packages/model`: geometry/model pipeline contracts shared by importers, API, viewport, and review context
- `packages/engine`: deterministic planning logic for structured JSON part input
- `packages/ai`: advisory OpenAI Responses API shell returning structured review output only
- `packages/importers`: importer interfaces, registry, JSON importer, practical DXF subset importer, and honest STEP workflow placeholder
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

The model/import pipeline owns:

- source file metadata
- derived model/session contracts
- source/model/view entity ids
- feature-to-geometry links
- operation preview contracts
- project/import/revision persistence records

The AI package is advisory only. It reviews a deterministic draft plan plus source/model/manual-override context and returns structured JSON. It does not create manufacturing authority, output toolpaths, or generate G-code.

## CAM Operations v5

`@cam/geometry2d` is now the internal contract boundary for imported planar source data.

Current geometry vocabulary includes:

- `Geometry2DDocument`
- `Geometry2DEntity`
- `GeometryLayer`
- `GeometryBounds`
- `GeometryTransform`
- `GeometryLoop`
- `GeometryChain`
- `GeometryProfile`
- `GeometryRegion`
- `GeometryNode`
- `GeometryEdge`
- `GeometryGraph`
- `GeometryWarning`
- `GeometryUnit`
- `GeometrySourceRef`

`@cam/model` remains the bridge between importers, planning, persistence, and the viewport.

Current model vocabulary includes:

- `ModelSource`
- `ImportedModel`
- `ModelEntity`
- `ModelView`
- `ModelBounds`
- `ModelLayer`
- `ModelSelection`
- `DerivedGeometryFragment`
- `FeatureGeometryLink`
- `OperationPreview`
- `PreviewPath`
- `ViewPreset`
- `ViewMode`

Important boundary:

- this is **not** a CAD kernel
- this is **not** a B-Rep
- current geometry is either structured-source metadata or parsed planar DXF source
- DXF support is limited to a practical 2D subset
- STEP remains a placeholder workflow session until real parsing exists

## Import workflow

The API now distinguishes:

- **imported source**: file type/name/media metadata
- **derived 2D geometry**: parsed DXF source document + graph when available
- **extracted features**: deterministic feature candidates with explicit source geometry references, confidence, inference method, and warnings
- **derived model**: source/model/view entities and derived geometry fragments
- **draft project**: current mutable workbench state and metadata
- **deterministic plan**: authoritative engine output and manual overrides under review

Current routes:

- `POST /imports/json`
- `POST /imports/dxf`
- `POST /imports/step`
- `GET /imports/:id`
- `GET /projects`
- `GET /projects/:projectId`
- `PUT /projects/:projectId`
- legacy `GET /drafts/:projectId`
- `POST /plan`
- `POST /operations/generate`
- `POST /operations/regenerate`
- `POST /review`
- `POST /approve`

## Persistence v3

The file-backed API repository now stores:

- `ImportSessionRecord`
- `ProjectRecord`
- `ProjectRevisionRecord`

Saved projects now track:

- project id
- revision counter
- source import id
- source type
- source filename
- derived model metadata
- plan metadata
- approval state
- updated at
- warnings
- lightweight revision history

This is still intentionally simple. The repo does not yet implement multi-user locking, branch/merge semantics, or immutable artifact promotion.

## Workbench UI structure

The web app now uses a persistent CAM-style layout with an explicit import-first workflow:

- **Top application bar** for import/project identity, derive plan/review/save/approve actions, undo/redo, and view controls
- **Left dock** with model/import tree, features, operations, and tools
- **Center viewport** showing source/model, stock, feature, selection, and operation preview layers
- **Right inspector** for the selected feature, operation, or tool
- **Bottom panel** for risks, checklist, AI review, console, and metadata/revision summary

Manual programming still remains practical and reducer-driven:

- rename/edit strategy/notes/setup/tool
- enable/disable
- duplicate manual operations
- delete manual operations
- reorder operations
- relink operation to a different feature
- freeze edited/manual operations before regeneration
- regenerate generated operations from the full draft or a selected feature
- local undo/redo

## DXF subset and viewport pipeline

Current practical DXF subset:

- `LINE`
- `ARC`
- `CIRCLE`
- `POINT`
- `TEXT` / `MTEXT` as metadata-only marking candidates
- `LWPOLYLINE`
- `POLYLINE`

Unsupported DXF content is preserved as warnings rather than silently ignored. This milestone still does not claim support for splines, hatches, blocks, dimensions, ellipses, or 3D DXF entities.

The viewport scene builder now consumes `@cam/model` types and separates:

- imported geometry layer
- stock layer
- extracted feature layer
- selection layer
- operation preview layer

Operation previews are intentionally honest overlays only:

- contour/profile → contour path markers
- pocket/face/slot → region overlays
- drill → point/cylinder markers
- chamfer → edge markers
- engrave → text markers
- unlinked/manual cases → generic preview badge

These are **not** toolpaths. Imported geometry remains 2D interpretation only, optional stock thickness is derived planning context only, and any simple extrusion/context rendering is advisory rather than a solid model.

CAM Operations v5 generated subset:

- outside contour rough + finish operations
- conservative inside contour operations
- conservative pocket rough + finish operations
- conservative slot operations
- grouped drilling operations from inferred circle patterns
- marking-only engraving operations

## Current boundaries

This repository does not yet implement:

- real STEP parsing
- a geometry kernel or B-Rep modeler
- machine simulation
- collision checking
- true toolpath planning
- postprocessors or G-code output
- production-grade tool assemblies and cutting data

Those gaps remain explicit so the repository stays honest, auditable, and manufacturing-oriented.
