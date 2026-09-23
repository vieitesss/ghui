// Item domain — the shape PRs and Issues share at the GitHub search seam.
//
// GitHub's GraphQL `search(type: ISSUE, …)` returns both pull requests and
// issues; they are distinguished only by the `is:pr` / `is:issue` qualifier.
// The qualifiers `author:@me`, `assignee:@me`, `mentions:@me`, `repo:…`,
// `archived:false`, etc. apply to both. "Item" is the supertype.
//
// This module owns:
//   • The kind/mode/input value types that describe what to fetch.
//   • The pure `searchQualifier` builder — the only place a GitHub search
//     string is assembled.
//   • The client-side `PullRequestQuery` / `IssueQuery` values used by the UI
//     and their conversion to a service ListInput.
//   • The cache key derived from a query (stable across cursors, includes
//     everything that affects what GitHub returns).

export type ItemKind = "pullRequest" | "issue"

export const itemListModes = ["all", "authored", "assigned", "mentioned", "review"] as const
export type ItemListMode = (typeof itemListModes)[number]

// Issues cannot be "review-requested" — that's a PR-only concept.
export type IssueListMode = Exclude<ItemListMode, "review">

export type ListModeFor<K extends ItemKind> = K extends "pullRequest" ? ItemListMode : IssueListMode

export const itemStateFilters = ["open", "closed", "merged"] as const
export type ItemStateFilter = (typeof itemStateFilters)[number]

export const issueStateFilters = ["open", "closed"] as const
export type IssueStateFilter = (typeof issueStateFilters)[number]

export interface ItemListInput<K extends ItemKind = ItemKind> {
	readonly kind: K
	readonly mode: ListModeFor<K>
	readonly state: K extends "issue" ? IssueStateFilter : ItemStateFilter
	readonly repository: string | null
	readonly cursor: string | null
	readonly pageSize: number
}

// One page of items returned by the service seam, regardless of kind.
export interface ItemPage<T> {
	readonly items: readonly T[]
	readonly endCursor: string | null
	readonly hasNextPage: boolean
}

export class IllegalQueryError extends Error {
	readonly _tag = "IllegalQueryError"
	constructor(message: string) {
		super(message)
		this.name = "IllegalQueryError"
	}
}

const kindQualifier = (kind: ItemKind) => (kind === "pullRequest" ? "is:pr" : "is:issue")

const modeQualifier = (mode: ItemListMode): string | null => {
	switch (mode) {
		case "all":
			return null
		case "authored":
			return "author:@me"
		case "assigned":
			return "assignee:@me"
		case "mentioned":
			return "mentions:@me"
		case "review":
			return "review-requested:@me"
	}
}

// Build the GitHub search-query string for a given list input.
//
// Always restricts to the input's state (`is:open` / `is:closed` / `is:merged`)
// in non-archived repositories, sorted by most recently updated. Throws
// `IllegalQueryError` for `mode: "all"` with no repository — that combination
// means "every PR/issue on GitHub" and is never intentional.
export const searchQualifier = (input: ItemListInput): string => {
	if (input.kind === "issue" && input.state === "merged") {
		throw new IllegalQueryError(`issues do not support merged state; got kind=${input.kind}`)
	}
	if (input.mode === "all" && input.repository === null) {
		throw new IllegalQueryError(`mode "all" requires a repository; got null for kind=${input.kind}`)
	}
	const parts: string[] = [kindQualifier(input.kind)]
	const peopleQualifier = modeQualifier(input.mode)
	if (peopleQualifier !== null) parts.push(peopleQualifier)
	if (input.repository !== null) parts.push(`repo:${input.repository}`)
	parts.push(`is:${input.state}`, "archived:false", "sort:updated-desc")
	return parts.join(" ")
}

// Client-side query value. `textFilter` is local fuzzy-match and never reaches
// the service seam.
export interface PullRequestQuery {
	readonly mode: ItemListMode
	readonly state: ItemStateFilter
	readonly repository: string | null
	readonly textFilter: string
}

export interface IssueQuery {
	readonly mode: IssueListMode
	readonly state: IssueStateFilter
	readonly repository: string | null
	readonly textFilter: string
}

export type ItemQuery = PullRequestQuery | IssueQuery

// Stable identifier for a query's *server-visible* shape. Two queries that
// differ only in `textFilter` share a cache key on purpose — typing in the
// filter input must not evict loaded pages.
export const itemQueryCacheKey = (kind: ItemKind, query: ItemQuery): string => {
	const repo = query.repository ?? "_"
	// The repository stays the final `:`-separated segment so
	// `itemQueryCacheKeyHasRepository` (which reads the last segment) keeps
	// working. `open` keys stay byte-identical to avoid invalidating existing
	// snapshot caches; non-open keys insert the state between mode and repo.
	if (query.state === "open") return `${kind}:${query.mode}:${repo}`
	return `${kind}:${query.mode}:${query.state}:${repo}`
}

export const itemQueryCacheKeyHasRepository = (key: string): boolean => key.split(":").at(-1) !== "_"

export const pullRequestQueryToListInput = (query: PullRequestQuery, cursor: string | null, pageSize: number): ItemListInput<"pullRequest"> => ({
	kind: "pullRequest",
	mode: query.mode,
	state: query.state,
	repository: query.repository,
	cursor,
	pageSize,
})

export const issueQueryToListInput = (query: IssueQuery, cursor: string | null, pageSize: number): ItemListInput<"issue"> => ({
	kind: "issue",
	mode: query.mode,
	state: query.state,
	repository: query.repository,
	cursor,
	pageSize,
})
