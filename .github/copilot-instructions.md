# Project mission

Build a next-generation CAM system for 2D and 2.5D milling with a programmer-in-the-loop workflow.

The system must:
- accelerate NC programming for milling parts
- detect manufacturing features
- propose tools and operations
- explain risks and reasoning
- require human review and approval before release
- work well on desktop and Android phones
- be production-oriented, modular, testable, and auditable

## Product boundaries

Do NOT pretend to be a full Mastercam replacement on day one.
Do NOT generate production G-code from LLM output alone.
Do NOT place the core manufacturing authority inside prompts.

The deterministic system is responsible for:
- feature modeling
- manufacturing rules
- operation sequencing
- tool libraries
- postprocessor interfaces
- approval states
- audit history

AI is responsible for:
- review assistance
- explanations
- ranking alternatives
- flagging missing operations
- suggesting edits
- learning from prior approved jobs

## Architecture rules

Use a monorepo with:
- apps/web: mobile-first PWA for Android + desktop review
- apps/api: backend API
- packages/shared: shared types and schemas
- packages/engine: deterministic CAM planning engine
- packages/ai: GPT-5.4 integration via OpenAI Responses API
- docs/: architecture, roadmap, domain model

## Technical constraints

- TypeScript for app/API/shared layers
- deterministic engine isolated behind clean interfaces
- easy future migration of core engine to Rust or C++
- strict schemas for all plan/review payloads
- tests required for domain logic
- all risky actions must have explicit review states
- mobile UI must be usable on narrow screens

## Working style

When implementing:
1. inspect existing repo structure first
2. propose minimal changes consistent with architecture
3. implement in small, reviewable commits
4. add or update tests
5. update docs when behavior changes
6. avoid placeholder marketing text
7. prefer explicit TODOs over fake implementations

## Done criteria

A task is done only if:
- code compiles
- tests for changed logic exist and pass
- docs are updated if needed
- API contracts are explicit
- UI states are not broken on mobile
