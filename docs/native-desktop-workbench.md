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

### STEP viewer integration foundation

This milestone does **not** fake STEP loading.

What exists now:

- a Windows-native viewport host area
- an explicit optional Open CASCADE detection point in CMake
- a dedicated viewport foundation widget that marks where the following plug in:
  - STEP file loading
  - XDE document creation
  - AIS display-object mapping
  - viewport navigation commands
  - selection / highlight synchronization

What does **not** exist yet:

- real STEP parsing in the native app
- real XDE model loading
- face/edge/solid visualization
- true selection/highlight on STEP topology

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
cmake -S apps/desktop-native -B out/desktop-native ^
  -DCMAKE_PREFIX_PATH="C:/Qt/6.8.2/msvc2022_64"
cmake --build out/desktop-native --config Release
```

Optional future Open CASCADE integration should be supplied through CMake package discovery when available.

## Honest milestone status

Implemented now:

- native desktop shell path
- professional dock layout scaffold
- file workflow scaffold
- OCCT/STEP integration boundary
- TypeScript-to-native workbench bridge snapshot

Still foundational:

- real STEP loading
- topology-backed selection
- native path visualization
- postprocessing
- production CAM-core depth
