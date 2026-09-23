import { describe, expect, test } from "bun:test"
import { pullRequestQueueSearchQualifier } from "../src/domain.js"
import { activePullRequestViews, viewCacheKey, viewEquals, viewLabel } from "../src/pullRequestViews.js"
import { issueViewCacheKey, issueViewEquals } from "../src/issueViews.js"

describe("pullRequestQueueSearchQualifier", () => {
	test("repository mode with repository → repo: qualifier", () => {
		expect(pullRequestQueueSearchQualifier("repository", "owner/name")).toBe("repo:owner/name")
	})

	test("repository mode without repository falls back to @me and excludes archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("repository", null)).toBe("author:@me archived:false")
	})

	test("authored mode → author:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("authored", null)).toBe("author:@me archived:false")
	})

	test("review mode with repository scopes the search to that repository", () => {
		expect(pullRequestQueueSearchQualifier("review", "owner/name")).toBe("review-requested:@me repo:owner/name archived:false")
	})

	test("assigned mode → assignee:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("assigned", null)).toBe("assignee:@me archived:false")
	})

	test("mentioned mode → mentions:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("mentioned", null)).toBe("mentions:@me archived:false")
	})
})

describe("viewCacheKey", () => {
	test("repository view key uses the unified item-query cache key", () => {
		expect(viewCacheKey({ _tag: "Repository", repository: "owner/name", state: "open" })).toBe("pullRequest:all:owner/name")
	})

	test("queue view key uses the unified item-query cache key", () => {
		expect(viewCacheKey({ _tag: "Queue", mode: "authored", repository: null, state: "open" })).toBe("pullRequest:authored:_")
		expect(viewCacheKey({ _tag: "Queue", mode: "review", repository: "owner/name", state: "open" })).toBe("pullRequest:review:owner/name")
	})

	test("open keys stay byte-identical so existing snapshot caches survive", () => {
		expect(viewCacheKey({ _tag: "Repository", repository: "owner/name", state: "open" })).toBe("pullRequest:all:owner/name")
		expect(issueViewCacheKey({ _tag: "Repository", repository: "owner/name", state: "open" })).toBe("issue:all:owner/name")
	})

	test("non-open keys stay distinct and keep the repository last", () => {
		expect(viewCacheKey({ _tag: "Repository", repository: "owner/name", state: "closed" })).toBe("pullRequest:all:closed:owner/name")
		expect(viewCacheKey({ _tag: "Queue", mode: "authored", repository: null, state: "merged" })).toBe("pullRequest:authored:merged:_")
		expect(issueViewCacheKey({ _tag: "Repository", repository: "owner/name", state: "closed" })).toBe("issue:all:closed:owner/name")
	})
})

describe("viewEquals", () => {
	test("views differing only in state are not equal", () => {
		expect(viewEquals({ _tag: "Repository", repository: "owner/name", state: "open" }, { _tag: "Repository", repository: "owner/name", state: "closed" })).toBe(false)
		expect(viewEquals({ _tag: "Repository", repository: "owner/name", state: "open" }, { _tag: "Repository", repository: "owner/name", state: "open" })).toBe(true)
		expect(issueViewEquals({ _tag: "Queue", mode: "authored", repository: null, state: "open" }, { _tag: "Queue", mode: "authored", repository: null, state: "closed" })).toBe(
			false,
		)
	})
})

describe("viewLabel", () => {
	test("open views keep the bare label", () => {
		expect(viewLabel({ _tag: "Repository", repository: "owner/repo", state: "open" })).toBe("owner/repo")
		expect(viewLabel({ _tag: "Queue", mode: "authored", repository: null, state: "open" })).toBe("authored")
	})

	test("non-open views append a short state suffix", () => {
		expect(viewLabel({ _tag: "Repository", repository: "owner/repo", state: "closed" })).toBe("owner/repo · closed")
		expect(viewLabel({ _tag: "Queue", mode: "authored", repository: null, state: "merged" })).toBe("authored · merged")
	})
})

describe("activePullRequestViews", () => {
	test("enumerated views preserve the active state", () => {
		const views = activePullRequestViews({ _tag: "Repository", repository: "owner/repo", state: "closed" })
		expect(views.length).toBeGreaterThan(1)
		expect(views.every((view) => view.state === "closed")).toBe(true)
		expect(views).toContainEqual({ _tag: "Repository", repository: "owner/repo", state: "closed" })
	})
})
