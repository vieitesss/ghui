import { describe, expect, test } from "bun:test"
import { issueViewForPullRequestView } from "../src/viewSync.ts"

describe("issueViewForPullRequestView", () => {
	test("Repository view → matching Repository issue view", () => {
		expect(issueViewForPullRequestView({ _tag: "Repository", repository: "anomalyco/opencode", state: "open" })).toEqual({
			_tag: "Repository",
			repository: "anomalyco/opencode",
			state: "open",
		})
	})

	test("Queue view with a repository → Repository issue view (same repo)", () => {
		// Regression: previously the sync skipped when view.repository ===
		// selectedRepository, leaving activeIssueView stale after
		// Repository(repo) → Queue(authored, same repo).
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "authored", repository: "anomalyco/opencode", state: "open" })).toEqual({
			_tag: "Repository",
			repository: "anomalyco/opencode",
			state: "open",
		})
	})

	test("Queue view without a repository → global authored issue queue", () => {
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "authored", repository: null, state: "open" })).toEqual({
			_tag: "Queue",
			mode: "authored",
			repository: null,
			state: "open",
		})
	})

	test("Queue view with non-authored mode but no repo → global authored issue queue", () => {
		// Issue side doesn't have a "review" mode; the projection always
		// uses "authored" for global queues.
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "review", repository: null, state: "open" })).toEqual({
			_tag: "Queue",
			mode: "authored",
			repository: null,
			state: "open",
		})
	})

	test("Queue view with non-authored mode AND a repo → Repository issue view (same repo)", () => {
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "review", repository: "kitlangton/ghui", state: "open" })).toEqual({
			_tag: "Repository",
			repository: "kitlangton/ghui",
			state: "open",
		})
	})

	test("open state carries over to the issue view", () => {
		expect(issueViewForPullRequestView({ _tag: "Repository", repository: "owner/repo", state: "open" })).toEqual({
			_tag: "Repository",
			repository: "owner/repo",
			state: "open",
		})
	})

	test("closed state carries over to the issue view", () => {
		expect(issueViewForPullRequestView({ _tag: "Repository", repository: "owner/repo", state: "closed" })).toEqual({
			_tag: "Repository",
			repository: "owner/repo",
			state: "closed",
		})
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "authored", repository: null, state: "closed" })).toEqual({
			_tag: "Queue",
			mode: "authored",
			repository: null,
			state: "closed",
		})
	})

	test("merged PR state maps to closed on the issue view (issues have no merged state)", () => {
		expect(issueViewForPullRequestView({ _tag: "Repository", repository: "owner/repo", state: "merged" })).toEqual({
			_tag: "Repository",
			repository: "owner/repo",
			state: "closed",
		})
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "authored", repository: null, state: "merged" })).toEqual({
			_tag: "Queue",
			mode: "authored",
			repository: null,
			state: "closed",
		})
		expect(issueViewForPullRequestView({ _tag: "Queue", mode: "authored", repository: "owner/repo", state: "merged" })).toEqual({
			_tag: "Repository",
			repository: "owner/repo",
			state: "closed",
		})
	})
})
