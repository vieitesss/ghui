# Closed items filter

## Why

Every list query hardcodes `is:open`, and the filter modal only offers `all` / `author:@me`. Users cannot review recently merged PRs, audit closed issues, or find a PR they remember merging — all of which GitHub search supports natively via `is:closed` / `is:merged`.

## What we'd ship

- **State travels with every query.** `PullRequestQuery` carries `state: open | closed | merged`; `IssueQuery` carries `state: open | closed`. `searchQualifier` emits `is:<state>` instead of the hardcoded `is:open`. For both surfaces, `closed` deliberately uses GitHub's `is:closed` semantics; on the pull-request surface that includes merged PRs, so the `closed` and `merged` presets intentionally overlap.
- **State travels with every view.** Both `PullRequestView` variants and `IssueView` carry `state` (default `open`), threaded through the query/input/cache-key/equality/label derivations. Non-open views get a short label suffix (`owner/repo · closed`, `authored · merged`). PR `merged` projects to issue `closed` in `issueViewForPullRequestView`.
- **Filter modal presets per surface.** PRs: `open`, `author:@me`, `closed`, `merged`, `author:@me closed`, `author:@me merged`. Issues: the same minus `merged`. Scope `all` → Repository view, `mine` → authored Queue, both with the chosen state. The active preset shows in the filter bar (`closed`, `author:@me · closed`, `null` for open+all).
- **Cache-safe keys.** `open` keys are byte-identical to before (`<kind>:<mode>:<repo>`); non-open keys insert the state (`<kind>:<mode>:<state>:<repo>`) with the repository last so `itemQueryCacheKeyHasRepository` keeps working.

## API and architecture mapping

- GitHub search: `is:open` / `is:closed` / `is:merged` qualifiers in `searchQualifier` (`src/item.ts`) — the only place a search string is assembled.
- Types: `itemStateFilters` / `ItemStateFilter`, `issueStateFilters` / `IssueStateFilter` (`src/item.ts`); `ItemListInput.state`, `PullRequestQuery.state`, `IssueQuery.state`.
- Views: `src/pullRequestViews.ts` (`viewToPullRequestQuery`, `viewToListInput`, `viewCacheKey`, `viewEquals`, `activePullRequestViews`, `viewLabel`), `src/issueViews.ts` (issue counterparts), `src/viewSync.ts` (`issueViewForPullRequestView`).
- UI: `filterOptionsFor(kind)` + dumb `FilterModal` rendering `state.options` (`src/ui/modals/FilterModal.tsx`), `FilterModalState.options` (`src/ui/modals/types.ts`), `useFilterModal` open/apply (`src/ui/filter/useFilterModal.ts`), filter-bar labels `pullRequestFilterLabelForView` / `issueFilterLabelForView` (`src/surfaces/*/use*Surface.ts`).
- Cache: `CachedPullRequestViewSchema` / `CachedIssueViewSchema` accept an optional `state` defaulting to `open` (`src/services/CacheService.ts`), so pre-filter snapshots still decode.

## Open questions

- None — the design above is decided and shipped on this branch.

## Out of scope (for v1)

- Per-state unread/refresh badges or defaulting a surface to closed.
- `is:merged` for issues (GitHub has no such state).
- Search-syntax passthrough (raw `is:` input in the text filter).

## Status

Shipped — see vieitesss/ghui#1
