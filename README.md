# CAM System

Production-oriented CAM monorepo for a programmer-in-the-loop workflow focused on 2D and 2.5D milling.

The product direction now treats a **native Windows desktop workbench** as the primary professional CAM shell. The existing web app remains useful as a companion workflow for development, review, collaboration, and rapid iteration, but it is no longer the intended final primary shell for professional CAM programming.

## Initial Path Planning Layer v7

This milestone moves the repo from a geometry-aware operation-preview foundation into a first deterministic path-planning layer for imported 2D and foundational 2.5D milling work while staying explicit about what is still review-only, conservative, or not implemented yet.

### What is implemented now

- **2D geometry domain** in `@cam/geometry2d`
  - explicit `Geometry2DDocument`, `Geometry2DEntity`, `GeometryLayer`, `GeometryBounds`, `GeometryTransform`, `GeometryLoop`, `GeometryChain`, `GeometryProfile`, `GeometryRegion`, `GeometryNode`, `GeometryEdge`, `GeometryGraph`, `GeometryWarning`, `GeometryUnit`, and `GeometrySourceRef`
  - stable entity ids, explicit unit metadata, layer visibility metadata, document bounds, and a tolerance-aware graph builder for imported planar data
  - no fake B-Rep claims: this package stays 2D-focused and honest
- **Geometry/model foundation** in `@cam/model`
  - explicit imported geometry, extracted feature, operation-preview, and path-planning-aware modeling on top of the existing `ImportedModel` / `ModelEntity` / `ModelView` contracts
  - stable ids for source geometry, extracted features, plan features, and previews so mappings remain durable across import → plan → review
  - viewport fragments now distinguish raw imported geometry, extracted feature overlays, and deterministic path-planning overlays
- **Initial Path Planning Layer v7**
  - outside contour rough + finish generation where outer profile intent is clear
  - conservative inside contour, pocket, slot, and grouped-hole generation from extracted 2D geometry
  - generated/manual/edited operation source tracking with freeze-for-regeneration support
  - planning warnings, machining assumptions, tool-class selection reasons, linked preview metadata, foundational depth metadata, and deterministic path-plan candidates carried with operations
- **Deterministic path-planning foundation**
  - shared schemas now include `PathPlan`, `PathPlanSegment`, `LinearPathSegment`, `ArcPathSegment`, `RapidMove`, `FeedMove`, `PlungeMove`, `RetractMove`, `LeadInPlan`, `LeadOutPlan`, `EntryStrategy`, `ExitStrategy`, `ClearanceStrategy`, `PathOrderingHint`, `PathPlanWarning`, `PathPlanAssumption`, `OperationPathProfile`, and `PathPreviewMode`
  - contour, drill, pocket, and slot operations now carry first deterministic path-plan candidates with entry, exit, clearance, retract, ordering, and pass-depth metadata
  - generated path plans remain deterministic machining candidates only; they are still not verified cutter compensation, simulation, or production NC output
- **Setup / work-offset foundation**
  - setup definitions now carry practical planning metadata for orientation, work offset, machine coordinate reference, clearance reference, stock reference, and setup warnings
  - current scope remains a top-side 3-axis / indexed-2.5D planning foundation so future multi-setup work can extend the same contracts
- **Source-first workspace resolution for local work**
  - workspace libraries now expose a `source` condition for local app/test work while keeping `dist/` outputs for package builds and packaged consumers
  - the web app resolves `@cam/*` libraries to `src/index.ts` in Vite dev, Vitest, `tsc -b`, and `vite build`, so `npm run build --workspace @cam/web` works from a clean checkout
  - API `tsx` dev runtime uses Node `--conditions=source`, so sibling package `dist/` artifacts are no longer a hidden prerequisite
- **2.5D depth-aware planning**
  - shared schemas now include `SetupPlane`, `SetupReference`, `WorkOffset`, `ZReference`, `DepthRange`, `FeatureDepthModel`, `RegionDepthModel`, `HoleDepthModel`, `OperationDepthProfile`, `StockTop`, `StockBottom`, `TopReference`, `BottomReference`, `PassDepthHint`, `PassDepthPlan`, `SafeClearance`, `RetractPlane`, `DepthAssumption`, `DepthWarning`, and `UnknownDepthReason`
  - deterministic plans now keep depth state explicit as known / assumed / unknown and attach bottom-behavior, retract, and pass-plan hints without claiming final toolpath certainty
  - previews can expose depth annotations, layered pass hints, and preserved-override warnings, but they still do not claim verified tool motion or 3D toolpaths
- **Tool classes and deterministic tooling rules**
  - tool classes now distinguish `contour_end_mill`, `pocket_end_mill`, `small_slot_end_mill`, `drill`, `chamfer_tool`, and `engraving_tool` in addition to the foundational face mill
  - generated operations now record deterministic tool selection rule ids, reasons, and weak-match warnings for review
  - the foundational tool library now includes holder summaries and a small slot end mill for narrow-slot planning
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
- **Native Windows CAM workbench foundation**
  - new `apps/desktop-native` Qt Widgets shell with a professional docked CAM layout
  - main menu, toolbar, keyboard shortcut routing, status bar, recent files, visibility hooks, and local `.camproj.json` project shell storage
  - native consumption of `native-workbench-v1` bridge snapshots for model/features/operations/tools tree population and selection synchronization
  - concrete Open CASCADE / XDE STEP loading boundary that can load STEP document structure in OCCT-enabled Windows builds while still staying honest about unfinished viewport rendering
  - desktop bridge snapshot contracts in `@cam/model` plus `GET /projects/:projectId/native-workbench` for native-shell consumption
- **Viewport pipeline v4**
  - explicit scene builder layered into imported geometry, stock, extracted features, selection, and operation preview layers
  - stable entity ids across rebuilds
  - open-chain vs closed-loop distinction, top-view-friendly review, and selected-entity highlighting for imported 2D geometry
  - path-plan-aware overlays linked to extracted feature ids and operation ids, including rapid/feed/plunge/retract distinctions, drill ordering, and entry/exit hints
- **Manual programming improvements**
  - operation-to-feature relinking
  - persistent operation notes
  - per-operation warning badges
  - source geometry references in the feature inspector
  - manual reclassification for imported/inferred features (`contour`, `pocket`, `slot`, `hole group`, `ignore`, `unclassified`) with explicit draft warnings
  - regenerate generated operations from the whole plan or a selected feature while preserving manual operations and frozen edits
  - operation source badges (`generated`, `manual`, `edited`) and explicit regeneration protection for programmer-in-the-loop authoring
  - project-level unsaved summary and revision summary
  - manual path-planning overrides for entry, exit, clearance, retract, direction, and ordering hints with preservation during regeneration
- **AI advisory review context upgrade**
  - review context now includes DXF source metadata, extraction warnings, open/closed profile counts, unclassified geometry summary, manual reclassification context, path warnings, path ordering, setup/work-offset metadata, and manual path overrides

## What is still foundational or derived only

This repository still does **not** implement:

- TypeScript-side real STEP parsing or STEP-derived machining
- a B-Rep, solid-model, or CAD kernel
- verified toolpath generation or machining simulation
- true 2.5D feature depth extraction from solids or verified section data
- postprocessing or production G-code output
- feeds/speeds databases, holder assemblies, or collision checking

Important honesty boundary:

- The viewport is a **derived visualization from imported geometry, extracted feature overlays, structured JSON, and deterministic plan state**.
- Deterministic path plans are **machining-path candidates for review**, not a final toolpath, postprocessed program, or verified NC motion.
- Pass-depth plans, lead-in/lead-out hints, clearance/retract levels, and path ordering are **planning hints only**, not final calculated cutter passes or simulation.
- DXF support is **practical-subset only**, not full DXF support.
- STEP remains a **workflow-level placeholder** in the TypeScript importers, while the native app now adds a real OCCT/XDE loading path for local Windows builds that have OCCT installed.
- the native desktop app is a **real professional shell foundation** with bridge-driven tree/selection synchronization, not yet a finished STEP viewer or production CAM core
- AI review is **advisory only** and never overrides deterministic planning authority.

## Workspaces

- `apps/web`: React + Vite CAM workbench UI
- `apps/api`: HTTP API for imports, planning, persistence, review, and approval
- `apps/desktop-native`: Qt Widgets native Windows workbench foundation for future professional desktop CAM workflows
- `packages/shared`: shared domain types, Zod schemas, default catalog data
- `packages/geometry2d`: 2D geometry document + graph model and DXF subset parsing
- `packages/model`: geometry/model pipeline types and derived model helpers
- `packages/engine`: deterministic planning engine
- `packages/ai`: advisory OpenAI Responses API integration
- `packages/importers`: importer interfaces, registry, JSON importer, practical DXF subset importer, honest STEP placeholder
- `docs`: architecture and domain notes
- `examples`: sample part input

## Quick start

Use Node `>=20.19.0` and npm `>=10` from the repository root. The repo now records `packageManager: npm@11.9.0` and the lockfile is verified in CI with `npm ci` so clean-checkout installs stay reproducible.

```bash
npm install
npm run build
npm run test
```

One-command verification after dependencies are installed:

```bash
npm run verify
```

## Development

Local development and tests are now **source-first**:

- workspace libraries publish `dist/` by default for production-style builds
- the same libraries expose a `source` export condition pointing at `src/index.ts`
- shared `vitest.workspace.ts` aliases plus the web Vite config send local tests and web dev/build to source entries
- `apps/web/tsconfig.app.json` and `apps/web/tsconfig.node.json` set `customConditions: ["source"]`, so `tsc -b` follows the same workspace package resolution strategy as Vite
- API dev uses `NODE_OPTIONS=--conditions=source` so `tsx` resolves sibling libraries from source instead of built `dist/`

Package/library production builds still use dedicated `tsconfig.build.json` files and emitted `dist/` output. The web app bundles sibling workspace sources directly, while test files remain excluded from emitted build artifacts.

Run the API from a clean checkout:

```bash
npm run dev:api
```

Run the web workbench from a clean checkout:

```bash
npm run dev:web
```

Expose the web dev server on all interfaces when needed:

```bash
npm run dev:web -- --host 0.0.0.0
```

The web app defaults to `http://localhost:3001` for API requests.

The native desktop foundation lives under `apps/desktop-native`. It is intentionally outside the npm build because it uses a Windows-first C++ / Qt toolchain. See `apps/desktop-native/README.md` for the current scope, Windows build prerequisites, OCCT notes, and launch flow.

### Fresh-checkout reliability notes

- Install from the monorepo root with `npm install` for local development or `npm ci` for CI/repro checks.
- Runtime workspace dependencies must be declared in the owning workspace package, even when another workspace already brings in the same package transitively.
- Test-only imports such as `vitest` are declared in the workspace that owns the tests instead of relying on the root package to hoist them.
- Root scripts keep package build order explicit: shared libraries build first, then the API build consumes their published `dist/` exports while the web app remains source-first.
- `npm run verify` mirrors the CI guard after install by running the full root build plus workspace tests.

### Root workspace scripts

```bash
npm run build:packages   # build shared workspace libraries only
npm run build            # build libraries, then api and web; web build no longer depends on sibling dist artifacts
npm run verify           # build everything, then run workspace tests
npm run test             # run all workspace tests source-first without prebuilding sibling dist
npm run test:workspaces  # run workspace tests without any build pre-step
npm run dev:api          # start API source-first from a clean checkout
npm run dev:web          # start Vite web dev server source-first from a clean checkout
```

Resolution strategy summary:

- Package build/publish flow stays `dist`-first through package `main` / default `exports`.
- The web app is source-first in dev, test, `tsc -b`, and `vite build` by combining workspace `source` exports, Vite aliases/conditions, and TypeScript `customConditions`.
- API dev/test flows are source-first and do not require manual prebuilding of sibling workspace libraries.
- Vitest executes workspace tests from source entries; production builds still do not emit `*.test.*` artifacts.
- `npm run build --workspace @cam/web` is green from a clean checkout, while `npm run build` still refreshes package `dist/` outputs for packaged consumers.
- Vite and TypeScript cache folders such as `.vite`, `.vite-temp`, and `node_modules/.tmp` are transient and ignored from version control.

For production-style API deployment, set `CAM_WEB_ORIGIN` explicitly so the API only accepts the intended web origin.

## Import sessions, projects, and revisions

The API stores data in a file-based repository implementation (default: `/tmp/cam-system-drafts`).

### Import sessions

Current import routes:

- `POST /imports/json`
- `POST /imports/dxf`
- `POST /imports/step`
- `GET /imports/:id`
- `POST /operations/generate`
- `POST /operations/regenerate`

Current JSON import behavior:

- accepts sample JSON or pasted structured `PartInput` JSON
- validates against the shared schema
- derives a model/session record for viewport and planning handoff
- returns deterministic part input for the planning engine

Current DXF behavior:

- accepts pasted ASCII DXF text payloads
- supports `LINE`, `ARC`, `CIRCLE`, `POINT`, `TEXT` / `MTEXT` metadata, `LWPOLYLINE`, and `POLYLINE`
- builds a 2D geometry document, a tolerance-aware geometry graph, conservative contour hierarchy, grouped-hole candidates, and extracted feature candidates
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
- depth-aware feature and operation metadata
- tool-class selection reasons and weak-match warnings
- manual depth override state that can be preserved through regeneration

### Depth overrides and regeneration

- Manual edits to operation depth fields such as target depth, top reference, through/blind behavior, safe clearance, and retract plane are stored on the operation depth profile.
- Each editable depth field shows whether it is currently generated, assumed, or a manual override.
- Regeneration still rebuilds deterministic operations from current feature state, but matching generated operations keep programmer depth overrides when those fields were explicitly marked as manual overrides.
- When a preserved manual override conflicts with regenerated deterministic depth, the operation remains review-required and the conflict is surfaced as a warning instead of being silently discarded.

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

Current CAM Operations v6 planning subset:

- outside contour operations
- inside contour review contours
- conservative pocket operations
- conservative slot operations with a dedicated small-slot tool class for narrow slots
- grouped drilling operations from circles by diameter/pattern
- marking-only engraving operations from text entities
- depth-aware operation profiles with target depth, bottom behavior, pass-depth hints, safe clearance, retract plane, and review-required assumptions

How features become operations:

1. import practical-subset DXF or structured JSON
2. build 2D graph / chain / loop / region model
3. extract conservative machining-intent candidates with confidence + warnings
4. normalize approved feature classifications into deterministic operations
5. derive linked operation previews for workbench review
6. allow manual edits, reclassification, and regeneration before approval
