# Native Windows CAM Workbench Foundation

## Why the architecture is shifting

The repository already has useful web-based CAM foundations: DXF import, extracted features, deterministic operations, 2.5D planning metadata, previews, review state, and AI-assisted review.

That remains valuable, but the professional product target is now higher. A serious CAM programming workbench needs:

- native desktop interaction quality for long authoring sessions
- Windows-first workflow ergonomics
- room for a real STEP / B-Rep visualization stack
- better future handling for large models and richer selection semantics
- cleaner evolution toward a larger deterministic CAM core

For that reason, the main professional shell is now moving toward a **native Windows desktop application**.

## What is real in this milestone

### Native shell foundation

The repo now includes `apps/desktop-native`, a Qt Widgets desktop shell foundation with:

- a real `QMainWindow` bootstrap
- professional docked workbench layout
- main menu + toolbar + keyboard shortcuts + status bar
- local open/save project shell flow using `.camproj.json`
- recent-file tracking with `QSettings`
- import entry points for STEP and DXF file selection
- future multi-document/tabbed center workspace via `QTabWidget`

### Professional CAM-style layout

The desktop shell now has explicit workbench regions for:

- **top command surface**: File/View commands and frequent toolbar actions
- **left dock tabs**: Model tree, Features, Operations, Tools
- **center viewport area**: STEP/OCCT viewer foundation widget inside a document tab area
- **right dock**: Inspector / properties
- **bottom tabs**: Warnings, Checklist, AI review, Logs / console, Project metadata

This is not a toy single-pane demo. It is a real desktop shell structure intended to grow into a serious CAM workbench.

A static layout reference is included at `docs/assets/native-desktop-workbench-layout.svg` for environments where Qt is not installed and the native shell cannot be launched yet.

### STEP viewer integration foundation

This milestone still does **not** fake finished STEP viewing, but it does add a more concrete and honest native STEP path.

What exists now:

- a Windows-native viewport host area
- an explicit optional Open CASCADE detection point in CMake
- a dedicated viewport foundation widget that now reports:
  - bridge snapshot status
  - visibility/display-layer status
  - current STEP/XDE integration state
- a native shell flow to attach a `native-workbench-v1` snapshot and populate:
  - model tree
  - features
  - operations
  - tools
  - inspector/checklist/warnings metadata
- an Open CASCADE / XDE loading boundary that can:
  - accept a STEP file path
  - load an XDE document with `STEPCAFControl_Reader` in OCCT-enabled builds
  - extract a native STEP model tree with persistent OCCT label ids
  - surface unresolved topology-link warnings without claiming finished geometry display
- display-layer and link-mapping data in the bridge snapshot so the native shell can keep model geometry, operations, and future path-plan overlays separated in a professional desktop workbench

What does **not** exist yet:

- final AIS/V3d display-object lifecycle wiring in the viewport
- finished face/edge/solid viewport visualization and highlight behavior
- true STEP-to-feature automatic linking from OCCT topology into deterministic feature extraction
- true selection/highlight on STEP topology inside the viewport

## Bridge to the current TypeScript CAM stack

This milestone preserves the current deterministic planning pipeline instead of discarding it.

### Reused authority

The current TypeScript stack remains authoritative for:

- import normalization
- deterministic feature and operation planning
- review/checklist/risk state
- AI advisory review payloads
- project/import persistence contracts

### New bridge contract

`@cam/model` now exposes a `native-workbench-v1` snapshot contract plus `buildNativeWorkbenchSnapshot(project)`.

The snapshot includes:

- stable ids for project, source, model entities, features, operations, tools, and previews
- node collections that map cleanly onto native workbench panels
- selection-link records for model tree ⇄ features ⇄ operations ⇄ tools ⇄ viewport ⇄ inspector synchronization
- explicit link mappings with `resolved` / `partial` / `unresolved` status
- display-layer metadata for model geometry, feature overlays, operation overlays, future path plans, and inspection state
- topology-reference placeholders that stay honest when only source-geometry linkage exists

`apps/api` now exposes:

- `GET /projects/:projectId/native-workbench`

That gives the native shell a real way to consume the existing project/import/feature/operation state without inventing a separate source of truth.

## File and project workflow foundation

Current native project-shell storage intentionally stays modest and explicit:

- `.camproj.json` stores local shell metadata
- project files can reference:
  - bridge snapshot path
  - imported STEP path
  - imported DXF path
  - local metadata/notes
- future revisions can add richer local workspace state, viewport preferences, panel layouts, and approval context caching

This is a shell/project foundation, not yet a full native persistence rewrite.

## Responsibility split going forward

### Native desktop responsibilities

- Windows workbench UX
- docking/layout persistence
- keyboard-heavy programming workflows
- future OCCT viewer hosting
- future large-model navigation and selection behaviors
- future native inspection and path visualization surfaces

### Existing TypeScript/web responsibilities that remain useful

- deterministic planning engine
- importer registry and practical DXF interpretation
- shared schemas and project contracts
- API persistence and review flow
- web companion UI for review, support tooling, experimentation, and collaboration

### Likely future migration candidates into a native CAM core

Over time, the following may migrate behind a native core boundary if needed:

- geometry import and STEP topology processing
- feature extraction that depends on native topology/kernel access
- native preview generation and richer selection graphs
- postprocessor interfaces
- deeper path-planning and simulation-adjacent logic

## Windows launch intent

The intended Windows development flow is:

```powershell
cmake --preset windows-msvc-qt
cmake --build out/desktop-native --config Release
```

For STEP/XDE loading locally:

```powershell
cmake --preset windows-msvc-qt-occt
cmake --build out/desktop-native --config Release
```

Set:

- `CAM_QT_PREFIX=C:/Qt/6.8.2/msvc2022_64`
- `CAM_OCCT_PREFIX=C:/OpenCASCADE-7.x/install` (or your local OCCT prefix)

## Honest milestone status

Implemented now:

- native desktop shell path
- professional dock layout refinement
- file workflow plus bridge-snapshot attach/reload
- TypeScript-to-native workbench bridge snapshot consumption
- selection synchronization between native panels
- visibility-command hooks for future display-object lifecycle control
- OCCT/XDE STEP loading boundary with native STEP model-tree population in OCCT-enabled builds

Still foundational:

- AIS/V3d viewport object rendering
- topology-backed viewport selection
- native path visualization
- postprocessing
- production CAM-core depth
