# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is multi-context: `API`, `Instrument`, `InstrumentUI`, and `Player` are independent components (different stacks, different READMEs, no shared root `package.json`/workspace), each treated as its own context.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** at the repo root — system-wide decisions that span components (e.g. the MIDI CC contract, the DASH export format, the catalog schema shared between InstrumentUI, Player, and API).
- **`<Component>/docs/adr/`** — context-scoped decisions for that component only (e.g. `Player/docs/adr/`, `InstrumentUI/docs/adr/`).

If any of these files don't exist yet, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT-MAP.md
├── docs/adr/                  ← system-wide decisions
├── API/
│   ├── CONTEXT.md
│   └── docs/adr/              ← API-specific decisions
├── Instrument/
│   ├── CONTEXT.md
│   └── docs/adr/
├── InstrumentUI/
│   ├── CONTEXT.md
│   └── docs/adr/
└── Player/
    ├── CONTEXT.md
    └── docs/adr/              ← already in use, e.g. 0001-react-native-shell-with-kotlin-adaptive-audio.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant component's `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
