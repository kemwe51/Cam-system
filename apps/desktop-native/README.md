# Native Windows CAM Workbench Foundation

This directory contains the native Windows-first **professional CAM workbench foundation** for the CAM system.

## What is implemented in this milestone

- real **Qt Widgets** application structure for a professional CAM-style main window
- persistent **main menu + toolbar + status bar** with command routing and keyboard shortcuts
- docked workbench layout with:
  - left tabs for **Model tree**, **Features**, **Operations**, and **Tools**
  - center **viewport foundation** area inside a future multi-document/tabbed workspace
  - right **Inspector** dock
  - bottom tabs for **Warnings**, **Checklist**, **AI review**, **Logs / console**, and **Project metadata**
- local **open/save project** scaffolding via `.camproj.json`
- local **bridge snapshot attach/reload** flow for `native-workbench-v1` JSON
- local **import STEP** / **import DXF** file dialogs
- recent-files persistence through `QSettings`
- native consumption of `native-workbench-v1` nodes, link mappings, display layers, warnings, and selection links
- selection synchronization across model tree, features, operations, tools, inspector, and viewport status messaging
- visibility hooks for **hide / show all / isolate** commands wired into native workbench state
- explicit **Open CASCADE / XDE** loading boundary that can load STEP document structure in OCCT-enabled builds and populate a native STEP model tree
- concrete viewport/display architecture boundaries for future AIS display objects, selection/highlight routing, and path-plan overlays

## What remains foundational on purpose

- Open CASCADE **viewport rendering** is **not** fully wired yet
- STEP/XDE **document loading** is wired for OCCT-enabled builds, but final viewport display-object creation is still pending
- topology-based face/edge/solid **viewport selection/highlighting** is **not** implemented yet
- deterministic planning still lives in the existing TypeScript engine and companion API
- this shell does **not** claim production CAM parity, NC output, or a CAD kernel

## Build prerequisites

This app is intended for Windows-first development with:

- CMake 3.24+
- Qt 6.5+ Widgets
- optional Open CASCADE 7.x for STEP/XDE loading and future viewer integration
- a C++20-capable compiler such as MSVC 2022

## Windows configure/build

Environment variables used by the included `CMakePresets.json`:

- `CAM_QT_PREFIX` → Qt install prefix such as `C:/Qt/6.8.2/msvc2022_64`
- `CAM_OCCT_PREFIX` → Open CASCADE install prefix when available

Qt-only configuration:

```powershell
cmake --preset windows-msvc-qt
cmake --build out/desktop-native --config Release
```

Qt + Open CASCADE configuration:

```powershell
cmake --preset windows-msvc-qt-occt
cmake --build out/desktop-native --config Release
```

Equivalent direct configure/build without presets:

```powershell
cmake -S apps/desktop-native -B out/desktop-native ^
  -DCMAKE_PREFIX_PATH="C:/Qt/6.8.2/msvc2022_64"
cmake --build out/desktop-native --config Release
```

With Open CASCADE available through CMake package discovery:

- the target compiles with `CAM_DESKTOP_HAS_OCCT=1`
- STEP import attempts real `STEPCAFControl_Reader` + XDE document loading
- the native model tree shows imported STEP/XDE structure metadata
- the viewport still reports honestly that AIS/V3d display-object wiring is the remaining local integration step

## Launching the native shell on Windows

After building:

```powershell
.\out\desktop-native\Release\cam_desktop_native.exe
```

Recommended local flow:

1. start the companion API/web tooling from the repo root when needed
2. open the native shell
3. create or open a `.camproj.json` file
4. attach a `native-workbench-v1` snapshot exported from the companion project flow
5. import a STEP file for the native OCCT/XDE session when testing STEP loading locally
6. use the docked workbench, inspector, and visibility hooks to review synchronization and unresolved links

## Bridge to the existing TypeScript CAM stack

The native shell is designed to consume the `native-workbench-v1` JSON snapshot exposed by the existing TypeScript project model/API bridge.

Expected responsibilities:

- **TypeScript domain + engine**
  - import normalization
  - deterministic planning authority
  - extracted features / operations / preview links
  - AI advisory review payloads
- **native desktop shell**
  - Windows workbench UX
  - file workflow
  - docked authoring experience
  - bridge snapshot consumption
  - selection/link inspection
  - OCCT/XDE session loading and future viewport/selection ownership

## Honest milestone status

Fully implemented in this repo:

- professional Qt workbench shell improvements
- native bridge-snapshot consumption
- selection/inspector synchronization across native panels
- real OCCT/XDE STEP document loading path in OCCT-enabled builds
- native STEP session metadata tree population

Partial / still local-prerequisite dependent:

- OCCT build/runtime requires Qt + OCCT installed on Windows
- STEP/XDE loading can run in those local builds, but final geometry display in the viewport still needs AIS/V3d hookup
- topology-aware CAM authoring contracts exist through stable ids, link mappings, and unresolved-link warnings, but face/edge/solid viewport selection is still a follow-up milestone
