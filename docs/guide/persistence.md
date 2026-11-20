# Persistence

A tour can remember what the user did, so it skips a tour they finished and optionally picks up where they left off. Set `progress` on the tour and give it a store.

<<< @/snippets/guide/persistence-local.ts

## Options

`progress` takes these fields.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `store` | `ProgressStore` | required | Where records are kept. |
| `skipCompleted` | `boolean` | `true` | When the saved record says the tour was finished, `start()` does not run it. |
| `resume` | `boolean` | `false` | Start at the last step shown instead of the first. |

<<< @/snippets/guide/persistence-resume.ts

## What you must set

- A stable tour `id`. Without one the id is random on every page load, so nothing matches. A development build logs a warning when `progress` is set and `id` is not.
- Stable step `id`s. Progress stores the id of the last step shown. Generated ids (`step-1`, `step-2`) change when you reorder steps, and a saved id that no longer exists is not an error (development builds warn). See [Resume](#resume).

## The store

A store is an object with three methods. Each may return a value or a promise.

| Method | Purpose |
|---|---|
| `load(tourId)` | Returns the saved `ProgressRecord`, or `null` when there is none. |
| `save(record)` | Writes a record. |
| `clear(tourId)` | Deletes a record. The tour never calls it. It is there for your own "show me the tour again" action. |

A `ProgressRecord` has `tourId`, `updatedAt` and, depending on what happened, `lastStepId`, `completedAt` and `exitedAt`. The timestamps are ISO strings. Fields of the wrong type are dropped when a record is read.

<<< @/snippets/guide/persistence-store.ts

Two stores ship with the library.

| Store | Behavior |
|---|---|
| `localStorageStore(prefix?)` | Uses `window.localStorage`. The key is `<prefix>:<tourId>` and the value is JSON. The prefix defaults to `virtualtour`. Storage is touched only when a method runs, never at import, so it is safe on the server. |
| `memoryStore()` | Keeps records in memory for the life of the page. Useful for tests and for single-page demos. |

`localStorageStore` never throws. Blocked storage, a full quota and corrupt or foreign values all behave as "nothing saved": `load` returns `null`, and `save` and `clear` do nothing. A visitor in a private window may simply see the tour every time.

Beware of colons. The key is a plain join, so prefix `app` with tour id `a:b` and prefix `app:a` with tour id `b` both use the key `app:a:b`. A read ignores a record whose stored `tourId` differs, but a save overwrites it. Keep `:` out of tour ids and prefixes, or give each its own prefix.

<<< @/snippets/guide/persistence-reset.ts

## What gets saved, and when

| Moment | Saved |
|---|---|
| A step is shown | `lastStepId` is that step. An earlier `completedAt` is kept. An earlier `exitedAt` is dropped. |
| The tour finishes | `completedAt` is set. `lastStepId` is dropped, so a replay starts at the first step. |
| The tour exits | `exitedAt` is set and `lastStepId` is the step that was current. An earlier `completedAt` is kept. Every exit reason is saved except `replaced`. Exiting while a step transition is still in flight saves the previously shown step, not the one about to appear. If the run ends before any step has begun to show, `lastStepId` is not updated. |

Exiting is not completing. A user who closes the tour sees it again on the next page load, from the first step, unless `resume` is on. An exit from code (reason `api`), such as a framework wrapper unmounting, is saved like any other exit.

Saves are fire and forget. The tour does not wait for a save before it moves on, and it never rejects because of one. A store that throws or rejects is caught. Development builds log a warning, and production builds say nothing, so check your store separately if losing a save matters. Saves for one tour run one after another in the order they were made. A save that has not settled within `waitBudget` of starting stops holding up the saves behind it: a development build logs a warning and the next save starts anyway, so a hung store can no longer stall the rest. After such a timeout the hung save may still finish later, so saves can overlap and the order the store sees is no longer guaranteed. `start()` also waits for pending saves before it loads, within the load bound below.

## Starting with saved progress

`start()` loads the record first.

1. If the record has `completedAt` and `skipCompleted` is `true`, the tour does not run. The tour emits `bypassed` with reason `completed`, and `start()` resolves. No `started`, no step events and no `deactivated` fire.
2. If `resume` is `true` and the record has a `lastStepId` that is not the first step, the tour starts there. The earlier steps are not shown, so `step-shown` fires first for the resumed step with `previous` set to `null`.
3. Otherwise the tour starts at the first step.

Load is bounded by the tour's `waitBudget` (default 10000 ms). If `load` has not settled by then, development builds log a warning that names the cause, a pending save or the load itself, and the tour starts as if there were no record. The wait for pending saves counts toward the bound. A late answer is ignored, except that its `completedAt` is kept and saved so later saves do not erase it. It is dropped if another `start()` has loaded since, and a late rejection is swallowed. `waitBudget: 0` or `Infinity` waits forever, so a `load` that never settles then leaves `start()` pending and one hung save holds up every save after it. A `waitBudget` that is `NaN` or negative is treated as the default 10000 ms, with a development warning. A `load` that throws or rejects is treated as "no record" with a development warning. While a load is pending, a second `start()` returns at once without starting a second run.

`goTo()` does not read the store. It starts the tour where you tell it and still saves progress.

### Resume

Resume uses the normal eligibility rules from the saved step onward. If the saved step's `shouldShow` is now `false`, or its target is missing with `whenMissing: "skip"`, the tour moves on to the next step that can show.

If the saved step id is not in the tour any more, for example because you renamed or removed it, the tour starts at step 1. Development builds log a warning naming the saved id. No event fires.

Next: [JSON tours](./json-tours).
