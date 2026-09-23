import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { GitHubService } from "../src/services/GitHubService.ts"
import { MockGitHubService, type MockOptions } from "../src/services/MockGitHubService.ts"

// Run against the synthetic mock (no fixture snapshot) so the closed/merged
// items added by `withMockPullRequestState` / `withMockIssueState` are present.
// The layer reads the fixture path at creation time, so pin it to a path that
// does not exist for the duration of layer construction.
const runMock = <A>(effect: Effect.Effect<A, unknown, GitHubService>, options: MockOptions): Promise<A> => {
	const previous = process.env.GHUI_MOCK_FIXTURE_PATH
	process.env.GHUI_MOCK_FIXTURE_PATH = "/tmp/ghui-no-such-fixture-closed-items.json"
	try {
		const layer = MockGitHubService.layer(options)
		return Effect.runPromise(effect.pipe(Effect.provide(layer)) as Effect.Effect<A>)
	} finally {
		if (previous === undefined) delete process.env.GHUI_MOCK_FIXTURE_PATH
		else process.env.GHUI_MOCK_FIXTURE_PATH = previous
	}
}

const options: MockOptions = { prCount: 24, repoCount: 4, username: "mock-user" }

describe("MockGitHubService state filtering — pull requests", () => {
	test("open returns only open items", async () => {
		const page = await runMock(
			GitHubService.use((github) => github.listPullRequestPage({ kind: "pullRequest", mode: "authored", state: "open", repository: null, cursor: null, pageSize: 50 })),
			options,
		)
		expect(page.items.length).toBeGreaterThan(0)
		expect(page.items.every((item) => item.state === "open")).toBe(true)
	})

	test("closed returns closed and merged, never open", async () => {
		const page = await runMock(
			GitHubService.use((github) => github.listPullRequestPage({ kind: "pullRequest", mode: "authored", state: "closed", repository: null, cursor: null, pageSize: 50 })),
			options,
		)
		expect(page.items.length).toBeGreaterThan(0)
		expect(page.items.every((item) => item.state === "closed" || item.state === "merged")).toBe(true)
	})

	test("closed includes merged (GitHub is:closed semantics)", async () => {
		const page = await runMock(
			GitHubService.use((github) => github.listPullRequestPage({ kind: "pullRequest", mode: "authored", state: "closed", repository: null, cursor: null, pageSize: 50 })),
			options,
		)
		expect(page.items.some((item) => item.state === "merged")).toBe(true)
		expect(page.items.some((item) => item.state === "closed")).toBe(true)
	})

	test("merged returns only merged items", async () => {
		const page = await runMock(
			GitHubService.use((github) => github.listPullRequestPage({ kind: "pullRequest", mode: "authored", state: "merged", repository: null, cursor: null, pageSize: 50 })),
			options,
		)
		expect(page.items.length).toBeGreaterThan(0)
		expect(page.items.every((item) => item.state === "merged")).toBe(true)
	})

	test("repo scope filters closed/merged too", async () => {
		const closed = await runMock(
			GitHubService.use((github) => github.listPullRequestPage({ kind: "pullRequest", mode: "all", state: "closed", repository: "mock-org/repo-0", cursor: null, pageSize: 50 })),
			options,
		)
		expect(closed.items.length).toBeGreaterThan(0)
		expect(closed.items.every((item) => item.state === "closed" || item.state === "merged")).toBe(true)
		const merged = await runMock(
			GitHubService.use((github) => github.listPullRequestPage({ kind: "pullRequest", mode: "all", state: "merged", repository: "mock-org/repo-1", cursor: null, pageSize: 50 })),
			options,
		)
		expect(merged.items.length).toBeGreaterThan(0)
		expect(merged.items.every((item) => item.state === "merged")).toBe(true)
	})

	test("listAllPullRequests threads state", async () => {
		const closed = await runMock(
			GitHubService.use((github) => github.listAllPullRequests({ kind: "pullRequest", mode: "authored", state: "closed", repository: null })),
			options,
		)
		expect(closed.length).toBeGreaterThan(0)
		expect(closed.every((item) => item.state === "closed" || item.state === "merged")).toBe(true)
		expect(closed.some((item) => item.state === "merged")).toBe(true)
		const merged = await runMock(
			GitHubService.use((github) => github.listAllPullRequests({ kind: "pullRequest", mode: "authored", state: "merged", repository: null })),
			options,
		)
		expect(merged.length).toBeGreaterThan(0)
		expect(merged.every((item) => item.state === "merged")).toBe(true)
	})
})

describe("MockGitHubService state filtering — issues", () => {
	test("open returns only open items", async () => {
		const page = await runMock(
			GitHubService.use((github) => github.listIssuePage({ kind: "issue", mode: "all", state: "open", repository: null, cursor: null, pageSize: 50 })),
			options,
		)
		expect(page.items.length).toBeGreaterThan(0)
		expect(page.items.every((issue) => issue.state === "open")).toBe(true)
	})

	test("closed returns only closed items (never merged — issues have no merged state)", async () => {
		const page = await runMock(
			GitHubService.use((github) => github.listIssuePage({ kind: "issue", mode: "all", state: "closed", repository: null, cursor: null, pageSize: 50 })),
			options,
		)
		expect(page.items.length).toBeGreaterThan(0)
		expect(page.items.every((issue) => issue.state === "closed")).toBe(true)
	})

	test("listAllIssues threads state", async () => {
		const closed = await runMock(
			GitHubService.use((github) => github.listAllIssues({ kind: "issue", mode: "all", state: "closed", repository: null })),
			options,
		)
		expect(closed.length).toBeGreaterThan(0)
		expect(closed.every((issue) => issue.state === "closed")).toBe(true)
	})
})

describe("MockGitHubService repository details — open counts", () => {
	test("reported counts equal the open list lengths with closed/merged extras present", async () => {
		for (const repository of ["mock-org/repo-0", "mock-org/repo-1", "mock-org/repo-2", "mock-org/repo-3"]) {
			const details = await runMock(
				GitHubService.use((github) => github.getRepositoryDetails(repository)),
				options,
			)
			const openPullRequests = await runMock(
				GitHubService.use((github) => github.listAllPullRequests({ kind: "pullRequest", mode: "all", state: "open", repository })),
				options,
			)
			const openIssues = await runMock(
				GitHubService.use((github) => github.listAllIssues({ kind: "issue", mode: "all", state: "open", repository })),
				options,
			)
			expect(details.openPullRequestCount).toBe(openPullRequests.length)
			expect(details.openIssueCount).toBe(openIssues.length)
		}
	})

	test("closed/merged extras do not inflate the reported open counts", async () => {
		for (const repository of ["mock-org/repo-0", "mock-org/repo-1"]) {
			const closedPullRequests = await runMock(
				GitHubService.use((github) => github.listAllPullRequests({ kind: "pullRequest", mode: "all", state: "closed", repository })),
				options,
			)
			const closedIssues = await runMock(
				GitHubService.use((github) => github.listAllIssues({ kind: "issue", mode: "all", state: "closed", repository })),
				options,
			)
			expect(closedPullRequests.length).toBeGreaterThan(0)
			expect(closedIssues.length).toBeGreaterThan(0)
			const details = await runMock(
				GitHubService.use((github) => github.getRepositoryDetails(repository)),
				options,
			)
			const openPullRequests = await runMock(
				GitHubService.use((github) => github.listAllPullRequests({ kind: "pullRequest", mode: "all", state: "open", repository })),
				options,
			)
			const openIssues = await runMock(
				GitHubService.use((github) => github.listAllIssues({ kind: "issue", mode: "all", state: "open", repository })),
				options,
			)
			expect(details.openPullRequestCount).toBe(openPullRequests.length)
			expect(details.openIssueCount).toBe(openIssues.length)
			expect(details.openPullRequestCount).toBeLessThan(openPullRequests.length + closedPullRequests.length)
			expect(details.openIssueCount).toBeLessThan(openIssues.length + closedIssues.length)
		}
	})
})
