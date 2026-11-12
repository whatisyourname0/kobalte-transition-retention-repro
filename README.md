# Kobalte transition retention reproduction

Minimal browser reproduction for detached targets retained by the global transition registry in `@kobalte/utils@0.9.2`.
Uses the published package, vanilla JavaScript, and native CSS transitions. The original `/` page isolates Kobalte. The `/react/` page reproduces the same retention with React Query Devtools; neither page copies library implementation or dispatches synthetic transition events.

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
The candidate source is published in the linked upstream PR; it is not copied into this repository.

## React Query Devtools reproduction

Run `npm ci` and `npm run dev`, then open **`/react/`** on the displayed origin. Wait until the Devtools panel and `Sample query ready` appear.

This entry mounts a real `QueryClientProvider`, one stable sample query and `ReactQueryDevtools` with `initialIsOpen: true`. It does not execute the standalone Kobalte import. Kobalte's transition tracking arrives through the published Devtools bundle. The Vite source override described above only affects the standalone page, not code embedded in that bundle.

1. Click **Run stopped events**. Wait for `done: true`: 1000 started, ended and removed; 0 cancelled.
2. Chrome DevTools → Memory → **Collect garbage**.
3. In Console, evaluate `window.repro.countAliveTargets()`: **1000**.
4. Reload the page, wait for the panel, and click **Run control**. After completion and GC the same expression returns **0**.
5. For the retaining path, take a heap snapshot after the stopped case and inspect `Detached <retention-probe>` through `transitionsByElement` in the Devtools bundle.

`callbackRan: null` is intentional on this page: it does not import or call Kobalte's private transition helper. Only the standalone page measures that callback. The React page measures detached target retention through WeakRefs after manual GC.

Verified in Chrome 157.0.8103.78: stopped case **1000 alive after GC**, normal control **0**. Both cases completed all 1000 transitions and removed all targets, with no cancellations. Versions are pinned in package-lock.json: React 19.3.1, React Query and React Query Devtools 5.107.1 (see package.json for exact installed versions).

Upstream: [Kobalte issue #773](https://github.com/kobaltedev/kobalte/issues/773), [fix PR #774](https://github.com/kobaltedev/kobalte/pull/774).
