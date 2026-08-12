# Heart rate comes from the BLE Heart Rate Profile, not Health Connect

Heart rate is an input, so it has to produce a live 0..9 reading that changes as
the listener's exertion changes. We read it over Bluetooth LE using the standard
Heart Rate Profile (GATT service `0x180D`), auto-connecting to a device the
listener has already bonded in Android's own Bluetooth settings.

## Considered options

**Health Connect** is the obvious choice by device reach — it aggregates heart
rate from whatever wearable the listener already owns, with no pairing work on
our side. Rejected because it is a store of records, not a stream: wearables
sync into it in batches, so readings arrive minutes late. Reach is worthless for
a signal whose entire job is to be current.

**A Wear OS companion app** gives live, accurate readings, but means designing,
building and shipping a second application to deliver one input.

## Consequences

There is no in-app scan list or device picker — the listener pairs a strap in
Android's Bluetooth settings and the app finds it. That keeps heart rate
shippable without designing this app's first settings screen, at the cost of a
listener with two straps having no way to choose between them. A picker becomes
worth building when someone actually has that problem.

No bonded strap simply means the input is unavailable, which is the same state
as a denied permission or absent hardware and needs no special handling.
