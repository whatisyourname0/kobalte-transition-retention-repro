# Kobalte transition retention reproduction

Minimal browser reproduction for detached targets retained by the global transition registry in `@kobalte/utils@0.9.2`.
Uses the published package, vanilla JavaScript, and native CSS transitions. No React, TanStack Query, copied implementation, or synthetic transition events are involved.

## Run

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

1. Open the local URL in Chrome and click **Run control**. All transitions complete, elements are removed, and **Callback ran** appears.
2. Click **Reload** to reset the package's global state.
3. Click **Run stopped events**. The target listener calls `stopPropagation()` for each real `transitionend`, then the code removes the targets **after** all transitions finish. No `transitioncancel` is expected for an already completed transition.
4. The published version shows **Callback blocked**, although `started`, `ended`, and `removed` all equal 1000 and `cancelled` equals 0.

The expected behavior after removal is that the detached targets are released and the queued `runAfterTransition` callback runs.
This does not claim that every normal DOM removal leaks, or establish the cause of any particular application's full memory usage.

## Check retention

After the run is finished, open Chrome DevTools **Memory**, collect garbage, and take a heap snapshot.
Find `Detached <retention-probe>` instances and inspect their retaining paths. The affected package holds them through `transitionsByElement`, a module-level `Map`.
The fixture keeps only `WeakRef`s after `run()` settles; it does not log or export the elements themselves.

After forcing garbage collection, this Console expression reports the remaining live targets:

```js
window.repro.countAliveTargets()
```

On the affected version, the stopped-events case retains 1000 targets; the control retains 0.
Do not treat a nonzero weak-reference count without a GC as proof of a leak. Avoid inspecting individual probe objects in Console, which may itself retain them.

## Compare a local fix

Point the source override at a Kobalte checkout's transition module:

```sh
KOBALTE_TRANSITION_SOURCE=/absolute/path/to/kobalte/packages/utils/src/run-after-transition.ts npm run dev -- --port 5174
```

Repeat both cases in a fresh page. With the candidate fix, the stopped-events case should also run the callback and retain 0 targets after GC.
The override is optional; the default always imports the published package.

## Scope

The affected implementation is [Kobalte's run-after-transition.ts](https://github.com/kobaltedev/kobalte/blob/675b4a11f4f074007c98b47a573760a1b60849ff/packages/utils/src/run-after-transition.ts).
Its body-level `transitionend` listener misses a stopped event, leaving the target in a strong `Map`. Removal after completion produces no cancellation event to clear that entry.
A source-level regression test and candidate fix are being prepared separately for maintainer review.

## Observed result

Verified in Chrome 157.0.8103.78 on macOS 26.7, with 1000 native transitions and manual DevTools garbage collection after each stopped-events run:

| Implementation | Started / ended / removed | Cancelled | Callback | Live probe targets after GC |
| --- | --- | --- | --- | --- |
| Published `@kobalte/utils@0.9.2` | 1000 / 1000 / 1000 | 0 | Blocked | 1000 |
| Local candidate | 1000 / 1000 / 1000 | 0 | Ran | 0 |

Both implementations ran the callback in the normal-event control.
The affected-version heap snapshot confirms a strong path: module context → `transitionsByElement` → Map backing table → 1000 probe targets.
The candidate source and upstream submission drafts remain local pending review; they are not part of this repository.
