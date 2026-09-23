import { pullRequestQueueLabels, pullRequestQueueModes, type PullRequestQueueMode, type PullRequestUserQueueMode } from "./domain.js"
import { type ItemListInput, type ItemStateFilter, itemQueryCacheKey, pullRequestQueryToListInput, type PullRequestQuery } from "./item.js"

export type PullRequestView =
	| { readonly _tag: "Repository"; readonly repository: string; readonly state: ItemStateFilter }
	| { readonly _tag: "Queue"; readonly mode: PullRequestUserQueueMode; readonly repository: string | null; readonly state: ItemStateFilter }

export const initialPullRequestView = (repository: string | null = null): PullRequestView =>
	repository ? { _tag: "Repository", repository, state: "open" } : { _tag: "Queue", mode: "authored", repository: null, state: "open" }

export const viewMode = (view: PullRequestView): PullRequestQueueMode => (view._tag === "Repository" ? "repository" : view.mode)

export const viewRepository = (view: PullRequestView) => view.repository

export const viewState = (view: PullRequestView): ItemStateFilter => view.state

// Convert a view into the new unified service input. `_tag: "Repository"` is
// the user-facing "all PRs in this repo" view → server-side `mode: "all"`.
export const viewToPullRequestQuery = (view: PullRequestView): PullRequestQuery =>
	view._tag === "Repository"
		? { mode: "all", state: view.state, repository: view.repository, textFilter: "" }
		: { mode: view.mode, state: view.state, repository: view.repository, textFilter: "" }

export const viewToListInput = (view: PullRequestView, cursor: string | null, pageSize: number): ItemListInput<"pullRequest"> =>
	pullRequestQueryToListInput(viewToPullRequestQuery(view), cursor, pageSize)

// Cache key is the only thing the rest of the app needs from a view; it's
// derived through the same `itemQueryCacheKey` the service seam uses.
export const viewCacheKey = (view: PullRequestView) => itemQueryCacheKey("pullRequest", viewToPullRequestQuery(view))

export const viewEquals = (left: PullRequestView, right: PullRequestView) =>
	left._tag === right._tag && viewMode(left) === viewMode(right) && left.repository === right.repository && left.state === right.state

export const activePullRequestViews = (view: PullRequestView): readonly PullRequestView[] => {
	const repository = viewRepository(view)
	const state = viewState(view)
	return [
		...(repository ? [{ _tag: "Repository" as const, repository, state }] : []),
		...pullRequestQueueModes.map((mode) => ({ _tag: "Queue" as const, mode, repository, state })),
	]
}

export const nextView = (view: PullRequestView, views: readonly PullRequestView[], delta: 1 | -1) => {
	const index = Math.max(
		0,
		views.findIndex((candidate) => viewEquals(candidate, view)),
	)
	return views[(index + delta + views.length) % views.length]!
}

export const viewLabel = (view: PullRequestView) => {
	const base = view._tag === "Repository" ? view.repository : pullRequestQueueLabels[view.mode]
	return view.state === "open" ? base : `${base} · ${view.state}`
}

export const parseRepositoryInput = (input: string) => {
	const trimmed = input.trim()
	const urlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)(?:[/?#].*)?$/i)
	const shorthandMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/)
	const match = urlMatch ?? shorthandMatch
	if (!match) return null
	const owner = match[1]!
	const repo = match[2]!.replace(/\.git$/i, "")
	if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null
	return `${owner}/${repo}`
}
