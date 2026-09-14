---
name: rafaelgaspar-fork
description: >-
  Work with the rafaelgaspar/homepage fork of gethomepage/homepage — stacked feat branches,
  rafaelgaspar integration pointer, Docker publish, upstream tag rebuilds.
  Use when changing Homepage upstream-bound code, fork branches, stack order,
  or ghcr.io/rafaelgaspar/homepage images.
disable-model-invocation: true
---

# Homepage fork (`rafaelgaspar/homepage`)

Upstream: [gethomepage/homepage](https://github.com/gethomepage/homepage). Fork:
[rafaelgaspar/homepage](https://github.com/rafaelgaspar/homepage). Ships
**`ghcr.io/rafaelgaspar/homepage`** from integration branch **`rafaelgaspar`**.

This skill covers **this repository only** — branch workflow, CI, and integration replay.
Deploy-specific config (Helm, secrets, theme overlays) belongs in your own private repo, not here.

## Repos and branches

| Branch         | Role                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| `main`         | Upstream mirror only — auto-sync, no features                                         |
| `feat/<name>`  | One feature; branch from the **current stack tip** (or `feat/rafaelgaspar` for infra) |
| `rafaelgaspar` | Points at the stack tip — **only this branch ships** (default branch)                 |

**Invariant:** `feat/rafaelgaspar` is always the stack root (infra: GHCR publish, tag-bump
automation, agent skill, fork README). Upstream CI workflows are removed on the fork.

## Stacked feat branches (git is the source of truth)

Features form a **linear stack**. Each `feat/*` branch carries **exactly one commit** on its parent.

```text
vX.Y.Z (upstream tag)
 └── feat/rafaelgaspar
      └── feat/<next>
           └── feat/<tip>  ← rafaelgaspar reset --hard here
```

Order is defined by **git merge-base**, not a manifest file:

- `feat/rafaelgaspar` must be based on the upstream release tag.
- Every other `feat/*` must be based on exactly one parent **feat branch tip**.
- The stack must be **linear** (one child per parent).
- `rafaelgaspar` must match the stack tip commit.

Inspect the stack:

```sh
git log --oneline --graph --decorate feat/rafaelgaspar feat/<...> rafaelgaspar
```

Validate without changing anything:

```sh
./.github/scripts/rebuild-rafaelgaspar.sh --dry-run vX.Y.Z
```

## Adding a Homepage feature

1. Branch from the **current stack tip** (not directly from the upstream tag):

   ```sh
   git fetch origin
   git checkout -B feat/<name> origin/<stack-tip>
   ```

2. Implement on `feat/<name>` (squash to one commit before publishing).
3. Publish integration:

   ```sh
   git checkout rafaelgaspar
   git reset --hard feat/<name>
   git push --force-with-lease origin rafaelgaspar
   ```

   GHCR publish runs on push to `rafaelgaspar`.

Do **not** commit features to `main` or maintain parallel squash-merge history on
`rafaelgaspar`. Do **not** export patch tarballs — the fork image is the artifact.

## Upstream tag bump (automation / manual replay)

When upstream releases tag **T**, `.github/workflows/rafaelgaspar-tag-bump.yaml` runs
`.github/scripts/rebuild-rafaelgaspar.sh --squash --push`:

1. Discover the linear stack from git merge-base relationships.
2. Validate `feat/rafaelgaspar` is based on **T** (after rebase) and `rafaelgaspar` matches the tip.
3. Rebase `feat/rafaelgaspar` onto **T**, then each next feat onto its parent tip.
4. Squash each layer to one commit on its parent.
5. `git checkout rafaelgaspar && git reset --hard <stack-tip>`.
6. Push rebased feat branches and `rafaelgaspar` with `--force-with-lease`.

Manual replay:

```sh
./.github/scripts/rebuild-rafaelgaspar.sh --squash --push vX.Y.Z
```

Scheduled tag-bump skips when the newest upstream semver tag merged into
`feat/rafaelgaspar` already equals the latest upstream release tag.

## One commit per feat branch

**Always one commit per `feat/*` layer.** Tag-bump and manual rebuilds pass `--squash` so
`git log vX.Y.Z..rafaelgaspar` shows one commit per shipped feature. While developing,
keep a single commit on the feat branch (amend or squash before pushing integration).

## Scope

| Belongs on the fork (`feat/*`)                       | Does not belong on this public repo             |
| ---------------------------------------------------- | ----------------------------------------------- |
| App source changes (MCP monitor, custom CSS hook, …) | Deploy secrets, private config repos            |
| CI: GHCR publish, tag-bump replay                    | References to private infra paths or repo names |
| Agent skill for fork workflow                        | `PLAN-*.md` planning notes                      |

New upstream-bound work targets **`feat/*` stacked on the tip → `rafaelgaspar` pointer**,
not out-of-tree patch stacks.

## Agent checklist

- [ ] Work on a **`feat/*`** branch stacked on the current tip, not `main` or `rafaelgaspar` directly (except pointer updates).
- [ ] **`feat/rafaelgaspar` remains the stack root** on the upstream release tag.
- [ ] New features branch from the stack tip; never create parallel siblings (linear stack only).
- [ ] **One commit per feat branch** before publishing integration.
- [ ] Publish with `rafaelgaspar` reset to the new tip, not squash merges on `rafaelgaspar`.
- [ ] No private deploy repo names, cluster paths, or `PLAN-*.md` in commits here.
