# Songs declare their adaptation dimension by name

A song is authored against one **dimension** — the axis a variant index 0..9
means — and that choice has to survive from InstrumentUI, through a hand-written
catalog row, into the Player. We record the dimension as a **name** (`volume`,
`heartRate`, `movementSpeed`, `intensity`), never as the computation behind it,
so that changing how a dimension is derived — retuning intensity's weights,
adding a member to it — changes every existing song's behaviour without a single
song being re-exported or re-published.

## Considered options

Baking the resolved behaviour into the export was the alternative: the exported
song would carry the formula, making it self-contained and immune to a future
release changing how it sounds. Rejected because that immunity is the problem,
not the feature — the whole point of an aggregate like intensity is that it
improves as inputs are added, and a catalog of songs each frozen against the
formula that existed on its export date can never benefit.

## The identical-string contract

The name is written by InstrumentUI into the `.adz` project, typed by hand into
the catalog, returned by the Worker, narrowed in the React Native layer and
resolved in Kotlin — five layers across Electron, Cloudflare and Gradle with no
shared package between them. **The string is byte-identical at every layer**: never
re-cased, never mapped, never parsed, only compared. A shared package to enforce
this across three build systems costs far more than it protects for four
constant strings; a documented contract plus each context's `CONTEXT.md` is the
deliberate trade.

## Consequences

A dimension name the installed Player does not recognise resolves to `intensity`
and is logged, rather than the song being rejected. This is what makes adding a
fifth dimension a non-breaking catalog change for every app already in the
field — the cost being that a typo in a hand-written catalog row degrades
silently instead of failing loudly.
