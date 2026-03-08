# Roadmap

## Near term

1. Wire real Open CASCADE STEP/XDE loading into `apps/desktop-native` with viewport navigation and persistent topology ids.
2. Expand topology-aware feature extraction so the desktop workbench can relate solids/faces/loops to deterministic CAM features.
3. Add native path-planning visualization and richer operation/preview linking in the desktop shell.
4. Expand the deterministic tool library and operation rules by material and machine class.
5. Add persistent jobs, review history, and approval audit records across both the companion API and future desktop workbench storage.

## Explicit stubs in v1

- OpenAI review calls fall back to a local structured heuristic when no API key is configured.
- Cycle time is a coarse estimate only.
- The service worker is intentionally minimal and not yet production-hardened.
