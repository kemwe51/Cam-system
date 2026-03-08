# Architecture

## Monorepo layout

- `apps/web`: React + Vite companion workbench for rapid iteration, review, collaboration, and support workflows
- `apps/api`: minimal Node HTTP API exposing import, planning, persistence, review, and approval routes
- `apps/desktop-native`: Qt Widgets native Windows CAM workbench foundation with future Open CASCADE integration points
- `packages/shared`: shared Zod schemas, deterministic planning contracts, machine/setup/tool catalog foundations
- `packages/geometry2d`: practical 2D geometry document + graph domain and DXF subset parser
- `packages/model`: geometry/model pipeline contracts shared by importers, API, viewport, and review context
- `packages/engine`: deterministic planning logic for structured JSON part input
- `packages/ai`: advisory OpenAI Responses API shell returning structured review output only
- `packages/importers`: importer interfaces, registry, JSON importer, practical DXF subset importer, and honest STEP workflow placeholder
- `examples`: sample JSON part input used by the demo flow

## Native desktop direction

The professional CAM workbench is now intended to move toward a **native Windows desktop application** rather than treating the browser app as the final primary shell.

Reason for the shift:

- professional CAM authoring needs long-session desktop stability
- large-model usability and future STEP/B-Rep viewing are better served by a native shell
- Windows desktop conventions, keyboard-driven programming flow, and docked workbench ergonomics matter for serious CAM usage
- future CAM-core expansion should not be constrained by a browser-first shell

Current role split:

- **native desktop app** = primary professional CAM workbench direction
- **web app** = companion/support shell for development, review, collaboration, and rapid prototyping
- **TypeScript domain + engine + API** = current authoritative planning, import, persistence, and review backbone

## Responsibility split

The deterministic engine owns:

- feature normalization
- operation proposals
- tool and setup references
- depth-aware operation profiles, pass-depth planning hints, deterministic path-plan candidates, and deterministic preservation of manual depth/path overrides
- first deterministic toolpath-kernel candidates derived from operations, path plans, and source geometry links
- risk creation
- checklist creation
- cycle time estimation
- approval state initialization

The model/import pipeline owns:

- source file metadata
- derived model/session contracts
- source/model/view entity ids
- feature-to-geometry links
- operation preview contracts and path-plan-aware viewport derivation
- native-workbench snapshot nodes, selection links, toolpath-candidate links, and unresolved topology mapping warnings
- project/import/revision persistence records

The AI package is advisory only. It reviews a deterministic draft plan plus source/model/manual-override context and returns structured JSON. It does not create manufacturing authority, output final toolpaths, or generate G-code.

The native desktop shell is responsible for:

- professional Windows workbench UX
- command routing, recent files, local project storage, and dock orchestration
- native STEP/XDE session browsing, topology-backed selection metadata, and future Open CASCADE viewport hosting
- future large-model handling, inspection ergonomics, and desktop interaction quality

The current TypeScript stack remains responsible for:

- deterministic planning authority
- import normalization
- extracted feature and operation models
- deterministic toolpath-candidate generation and bridge payloads
- advisory AI review payload generation
- project/import persistence contracts

## Native STEP CAM Workbench & Toolpath Kernel v9

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
- `OperationPathProfile`
- `PathPlan`
- `PathPlanSegment`
- `ToolpathCandidate`
- `ToolpathDepthLayer`
- `ToolpathPass`
- `ToolpathPrimitive`
- `PreviewPath`
- `ViewPreset`
- `ViewMode`

Important boundary:

- this is **not** a CAD kernel
- this is **not** a B-Rep
- current geometry is either structured-source metadata or parsed planar DXF source
- DXF support is limited to a practical 2D subset
- STEP remains a placeholder workflow session until real parsing exists

The new native workbench foundation consumes a `native-workbench-v1` bridge snapshot from `@cam/model` / `apps/api` so that the desktop shell can reuse stable ids for:

- imported source records
- model entities
- extracted manufacturing features
- generated operations
- generated toolpath candidates
- operation previews
- selection synchronization between tree/feature/operation/tool/toolpath/viewport surfaces

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
- setup/work-offset metadata
- operation path profiles and path-plan warnings/assumptions
- manual path-planning overrides preserved across regeneration

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
- edit review-safe operation depth fields such as target depth, top reference, bottom behavior, safe clearance, and retract plane
- enable/disable
- duplicate manual operations
- delete manual operations
- reorder operations
- relink operation to a different feature
- freeze edited/manual operations before regeneration
- edit review-safe path-planning fields such as entry, exit, clearance, retract, direction, and ordering hints
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
- operation preview / path-planning layer

Operation previews and path-planning overlays are intentionally honest:

- contour/profile → deterministic contour path candidates with lead-in/lead-out and rapid/feed/retract distinctions
- pocket/face/slot → region overlays plus lane/centerline path candidates where available
- drill → grouped hole ordering markers plus rapid/plunge/retract path candidates
- chamfer → edge markers
- engrave → text markers
- unlinked/manual cases → generic preview badge
- depth labels, pass hints, clearance/retract levels, and ordering hints → review-only annotations, not final cutter path motion

These are **not** final toolpaths. Imported geometry remains 2D interpretation only, optional stock thickness is derived planning context only, and any simple extrusion/context rendering is advisory rather than a solid model.

Initial Path Planning Layer v7 generated subset:

- outside contour rough + finish operations
- conservative inside contour operations
- conservative pocket rough + finish operations
- conservative slot operations, including a small-slot tool class for narrow slots
- grouped drilling operations from inferred circle patterns
- marking-only engraving operations
- depth-aware target depth, bottom behavior, retract, and pass-plan hints for generated operations
- first deterministic contour / drill / pocket / slot path candidates with setup, work-offset, clearance, retract, and ordering metadata

## Current boundaries

This repository does not yet implement:

- real STEP parsing
- Open CASCADE XDE document loading
- persistent face/edge/solid selection ids from STEP topology
- a geometry kernel or B-Rep modeler
- machine simulation
- collision checking
- true cutter-engagement-aware toolpath planning
- postprocessors or G-code output
- production-grade tool assemblies and cutting data

Native desktop honesty boundary:

- `apps/desktop-native` is a real Qt Widgets shell foundation
- the viewport is currently a viewer integration boundary, not a finished OCCT scene
- STEP import in the TypeScript importers remains metadata-only placeholder behavior
- the native shell does not claim Mastercam parity, finished STEP machining, or production NC output

Those gaps remain explicit so the repository stays honest, auditable, and manufacturing-oriented.
