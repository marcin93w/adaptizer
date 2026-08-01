<!--
Migration PR template. See REACT_NATIVE_MIGRATION_PLAN.md for step IDs, lanes and review boundaries.
One pull request should correspond to one migration step (or a split-off piece of one), per the plan's branch discipline.
-->

## Migration step

- **Step ID:** <!-- e.g. B02 -->
- **Lane:** <!-- A / B / C / D / Integration / Release -->
- **Depends on (dependency IDs):** <!-- e.g. B01 -->
- **Parallel with:** <!-- as listed for this step in the plan, if relevant -->

## Summary

<!-- What changed and why, in 2-5 sentences. Reference the plan section (e.g. "Phase 2 - B02") and this step's stated Goal. -->

## Manual check performed

<!--
Describe what was manually exercised and on what device/emulator, or state "None" / "Not applicable" explicitly.
Do not describe a check that was not actually performed. If a manual device check is required by the plan for this
step (native-boundary or playback changes) and has not yet happened, say so plainly rather than omitting this section.
-->

## Automated checks run

<!-- List the commands/CI jobs run locally or in CI, and their result (pass/fail). e.g.:
- [ ] Legacy Android debug build (`gradlew assembleDebug`)
- [ ] adaptive-audio/ unit tests
- [ ] adaptive-audio/ instrumentation tests
- [ ] React Native format/lint/typecheck
- [ ] React Native component tests
- [ ] React Native Android debug build
- [ ] Codegen regeneration check
-->

## Rollback

- **Is rollback still possible after this change?** <!-- Yes / No -->
- **How:** <!-- e.g. "Branch revert; legacy app unaffected and additive only" (pre-R01), or the specific rollback procedure if this PR is at/after R01/R02. -->

## Screenshots / logs

<!-- Attach for any UI change, native-boundary change, or playback change. State "Not applicable" if none apply. -->

## Appendix C review checklist

<!-- From REACT_NATIVE_MIGRATION_PLAN.md, Appendix C - Review checklist for each pull request. -->

- [ ] Scope matches one migration step and lists its dependency IDs.
- [ ] Authored code is small enough to review; generated output and binaries are isolated.
- [ ] Tests fail before the change where practical and pass afterward.
- [ ] No unapproved behavior change is hidden inside extraction or formatting work.
- [ ] Kotlin remains the owner of sensor handling, intensity and track selection.
- [ ] Manual evidence is attached for native-boundary or playback changes.
- [ ] Rollback remains possible and is described above.
- [ ] Documentation and the parity matrix are updated when the observable behavior changes.
