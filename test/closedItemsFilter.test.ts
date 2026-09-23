import { describe, expect, test } from "bun:test"
import { issueViewCacheKey, type IssueView } from "../src/issueViews.ts"
import { itemQueryCacheKeyHasRepository } from "../src/item.ts"
import { viewCacheKey, type PullRequestView } from "../src/pullRequestViews.ts"
import { issueFilterLabelForView } from "../src/surfaces/issue/useIssueSurface.ts"
import { pullRequestFilterLabelForView } from "../src/surfaces/pullRequest/usePullRequestSurface.ts"
import { useFilterModal } from "../src/ui/filter/useFilterModal.ts"
import { filterOptionsFor, type FilterOption } from "../src/ui/modals.js"
import type { FilterModalState } from "../src/ui/modals/types.ts"

describe("filterOptionsFor — pull requests", () => {
	test("offers open, closed, and merged presets for both scopes", () => {
		const options = filterOptionsFor("pullRequest")
		expect(options.map((option) => option.label)).toEqual(["open", "author:@me", "closed", "merged", "author:@me closed", "author:@me merged"])
		expect(options.map((option) => [option.scope, option.state])).toEqual([
			["all", "open"],
			["mine", "open"],
			["all", "closed"],
			["all", "merged"],
			["mine", "closed"],
			["mine", "merged"],
		])
	})
})

describe("filterOptionsFor — issues", () => {
	test("offers the same presets minus every merged entry", () => {
		const options = filterOptionsFor("issue")
		expect(options.map((option) => option.label)).toEqual(["open", "author:@me", "closed", "author:@me closed"])
		expect(options.map((option) => [option.scope, option.state])).toEqual([
			["all", "open"],
			["mine", "open"],
			["all", "closed"],
			["mine", "closed"],
		])
		expect(options.every((option) => option.state !== "merged")).toBe(true)
	})
})

describe("closed-items cache keys", () => {
	test("non-open view keys keep the repository as the final segment", () => {
		const prClosed = viewCacheKey({ _tag: "Repository", repository: "owner/repo", state: "closed" })
		const prMerged = viewCacheKey({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "merged" })
		const issueClosed = issueViewCacheKey({ _tag: "Repository", repository: "owner/repo", state: "closed" })
		expect(itemQueryCacheKeyHasRepository(prClosed)).toBe(true)
		expect(itemQueryCacheKeyHasRepository(prMerged)).toBe(true)
		expect(itemQueryCacheKeyHasRepository(issueClosed)).toBe(true)
		expect(itemQueryCacheKeyHasRepository(viewCacheKey({ _tag: "Queue", mode: "authored", repository: null, state: "closed" }))).toBe(false)
	})
})

describe("pullRequestFilterLabelForView", () => {
	test("open + all → null (no filter)", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Repository", repository: "owner/repo", state: "open" })).toBeNull()
	})

	test("open authored queue → author:@me", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "open" })).toBe("author:@me")
	})

	test.each(["assigned", "mentioned", "review"] as const)("open %s queue → null", (mode) => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode, repository: "owner/repo", state: "open" })).toBeNull()
	})

	test("non-authored closed queue → closed", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "review", repository: "owner/repo", state: "closed" })).toBe("closed")
	})

	test("repository closed → closed", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Repository", repository: "owner/repo", state: "closed" })).toBe("closed")
	})

	test("authored closed → author:@me · closed", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "closed" })).toBe("author:@me · closed")
	})

	test("authored merged → author:@me · merged", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "merged" })).toBe("author:@me · merged")
	})
})

describe("issueFilterLabelForView", () => {
	test("open + all → null (no filter)", () => {
		expect(issueFilterLabelForView({ _tag: "Repository", repository: "owner/repo", state: "open" })).toBeNull()
	})

	test("open authored queue → author:@me", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "open" })).toBe("author:@me")
	})

	test.each(["assigned", "mentioned"] as const)("open %s queue → null", (mode) => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode, repository: "owner/repo", state: "open" })).toBeNull()
	})

	test("non-authored closed queue → closed", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "assigned", repository: "owner/repo", state: "closed" })).toBe("closed")
	})

	test("repository closed → closed", () => {
		expect(issueFilterLabelForView({ _tag: "Repository", repository: "owner/repo", state: "closed" })).toBe("closed")
	})

	test("authored closed → author:@me · closed", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "closed" })).toBe("author:@me · closed")
	})
})

describe("filter-label repository gate (global authored queue shows no FILTER bar)", () => {
	test("PR: open + authored + repository → author:@me", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "open" })).toBe("author:@me")
	})

	test("PR: open global authored (repository null) → null", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: null, state: "open" })).toBeNull()
	})

	test("PR: non-open + authored + repository → author:@me · <state>", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "closed" })).toBe("author:@me · closed")
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "merged" })).toBe("author:@me · merged")
	})

	test("PR: non-open otherwise → state only", () => {
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "authored", repository: null, state: "closed" })).toBe("closed")
		expect(pullRequestFilterLabelForView({ _tag: "Queue", mode: "review", repository: "owner/repo", state: "closed" })).toBe("closed")
		expect(pullRequestFilterLabelForView({ _tag: "Repository", repository: "owner/repo", state: "merged" })).toBe("merged")
	})

	test("issue: open + authored + repository → author:@me", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "open" })).toBe("author:@me")
	})

	test("issue: open global authored (repository null) → null", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "authored", repository: null, state: "open" })).toBeNull()
	})

	test("issue: non-open + authored + repository → author:@me · <state>", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "closed" })).toBe("author:@me · closed")
	})

	test("issue: non-open otherwise → state only", () => {
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "authored", repository: null, state: "closed" })).toBe("closed")
		expect(issueFilterLabelForView({ _tag: "Queue", mode: "assigned", repository: "owner/repo", state: "closed" })).toBe("closed")
		expect(issueFilterLabelForView({ _tag: "Repository", repository: "owner/repo", state: "closed" })).toBe("closed")
	})
})

const makeFilterModalInput = (surface: "pullRequests" | "issues", selectedIndex: number, options: readonly FilterOption[]) => {
	const activeView: PullRequestView = { _tag: "Repository", repository: "owner/repo", state: "open" }
	const activeIssueView: IssueView = { _tag: "Repository", repository: "owner/repo", state: "open" }
	const filterModal: FilterModalState = { surface, selectedIndex, options }
	return {
		activeWorkspaceSurface: surface,
		activeView,
		activeIssueView,
		selectedRepository: "owner/repo",
		filterModal,
		setFilterModal: () => {},
		switchViewTo: (view: PullRequestView) => view,
		setActiveIssueView: (view: IssueView) => view,
		closeActiveModal: () => {},
		setSelectedIssueIndex: () => {},
		resetLoadingMoreIssues: () => {},
		bumpRefreshGeneration: () => {},
	}
}

describe("applySelectedFilter", () => {
	test("applies every pull request preset to the expected scoped view", () => {
		const options = filterOptionsFor("pullRequest")
		for (const [selectedIndex, option] of options.entries()) {
			let applied: PullRequestView | null = null
			let closed = false
			const input = makeFilterModalInput("pullRequests", selectedIndex, options)
			useFilterModal({
				...input,
				switchViewTo: (view) => {
					applied = view
				},
				closeActiveModal: () => {
					closed = true
				},
			}).applySelectedFilter()
			expect(applied).toEqual(
				option.scope === "mine"
					? { _tag: "Queue", mode: "authored", repository: "owner/repo", state: option.state }
					: { _tag: "Repository", repository: "owner/repo", state: option.state },
			)
			expect(closed).toBe(true)
		}
	})

	test("applies every issue preset to the expected scoped view", () => {
		const options = filterOptionsFor("issue")
		for (const [selectedIndex, option] of options.entries()) {
			let applied: IssueView | null = null
			let closed = false
			const input = makeFilterModalInput("issues", selectedIndex, options)
			useFilterModal({
				...input,
				setActiveIssueView: (view) => {
					applied = view
				},
				closeActiveModal: () => {
					closed = true
				},
			}).applySelectedFilter()
			expect(applied).toEqual(
				option.scope === "mine"
					? { _tag: "Queue", mode: "authored", repository: "owner/repo", state: option.state }
					: { _tag: "Repository", repository: "owner/repo", state: option.state },
			)
			expect(closed).toBe(true)
		}
	})

	test("guards against a merged issue preset at runtime", () => {
		const options = [{ ...filterOptionsFor("issue")[0]!, label: "merged", state: "merged" as const }]
		let applied = false
		let closed = false
		const input = makeFilterModalInput("issues", 0, options)
		useFilterModal({
			...input,
			setActiveIssueView: () => {
				applied = true
			},
			closeActiveModal: () => {
				closed = true
			},
		}).applySelectedFilter()
		expect(applied).toBe(false)
		expect(closed).toBe(false)
	})
})
