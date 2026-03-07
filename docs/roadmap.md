# Roadmap

## Near term

1. Add DXF and STEP ingestion adapters that normalize geometry into the structured part model.
2. Expand the deterministic tool library and operation rules by material and machine class.
3. Add persistent jobs, review history, and approval audit records in the API.
4. Improve AI review prompts and add server-side response recording with explicit traceability.
5. Add richer tests around sequencing, tool reach, and feature-specific risk rules.

## Explicit stubs in v1

- OpenAI review calls fall back to a local structured heuristic when no API key is configured.
- Cycle time is a coarse estimate only.
- The service worker is intentionally minimal and not yet production-hardened.
