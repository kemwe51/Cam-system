# Domain model

## Input part model

v1 accepts structured JSON with:

- stock
- top surfaces
- contours
- pockets
- slots
- hole groups
- chamfers
- engraving

The input assumes that upstream software or a human has already expressed the intended manufacturing features in a structured way.

## Draft plan output

A deterministic draft plan contains:

- normalized features
- proposed operations
- selected tools from a basic library
- machinability risks
- review checklist items
- estimated cycle time in minutes
- approval state requiring human release

## Approval states

- `draft`: initial deterministic plan with no triggered review risks
- `in_review`: deterministic plan contains risks that should be checked before release
- `approved`: a human explicitly approves the plan

## AI review output

The AI module returns structured advisory fields only:

- likely missing operations
- risk flags
- suggested edits
- overall assessment

That output can inform a programmer, but it never overrides the deterministic plan automatically.
