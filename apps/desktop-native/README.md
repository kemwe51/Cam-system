# Native Windows CAM Workbench Foundation

This directory adds the first **native desktop shell** for the CAM system.

## What is implemented in this milestone

- real **Qt Widgets** application structure for a professional CAM-style main window
- persistent **main menu + toolbar + status bar** with command routing and keyboard shortcuts
- docked workbench layout with:
  - left tabs for **Model tree**, **Features**, **Operations**, and **Tools**
  - center **viewport foundation** area inside a future multi-document/tabbed workspace
  - right **Inspector** dock
  - bottom tabs for **Warnings**, **Checklist**, **AI review**, **Logs / console**, and **Project metadata**
- local **open/save project** scaffolding via `.camproj.json`
- local **import STEP** / **import DXF** file dialog scaffolding
- recent-files persistence through `QSettings`
- explicit **Open CASCADE handoff boundary** for future STEP/XDE/AIS viewer integration

## What remains foundational on purpose

- STEP parsing is **not** implemented here yet
- Open CASCADE scene/view objects are **not** wired yet
- topology-based face/edge/solid selection is **not** implemented yet
- deterministic planning still lives in the existing TypeScript engine and companion API
- this shell does **not** claim production CAM parity, NC output, or a CAD kernel

## Build prerequisites

This app is intended for Windows-first development with:

- CMake 3.24+
- Qt 6.5+ Widgets
- optional Open CASCADE (future STEP viewer integration)
- a C++20-capable compiler such as MSVC 2022

## Example Windows configure/build

```powershell
cmake -S apps/desktop-native -B out/desktop-native ^
  -DCMAKE_PREFIX_PATH="C:/Qt/6.8.2/msvc2022_64"
cmake --build out/desktop-native --config Release
```

If Open CASCADE is available through CMake package discovery, the target will compile with `CAM_DESKTOP_HAS_OCCT=1` and the viewport foundation widget will report that the OCCT handoff point is active.

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
  - future OCCT viewport, selection, and long-session desktop behaviors
