import { describe, expect, test } from "bun:test"
import { isTerminalTooSmall, MIN_TERMINAL_HEIGHT } from "../src/workspace/layout.ts"
import { computeModalLayouts } from "../src/workspace/modalLayouts.ts"
import { filterOptionsFor } from "../src/ui/modals.js"

describe("computeModalLayouts", () => {
	test("keeps every modal inside narrow terminal bounds", () => {
		const layouts = computeModalLayouts({ contentWidth: 30, terminalHeight: 12, longestLabelName: 48, longestDiffFileName: 72, changedFilesModalActive: true })

		for (const rect of Object.values(layouts)) {
			expect(rect.left).toBeGreaterThanOrEqual(0)
			expect(rect.top).toBeGreaterThanOrEqual(0)
			expect(rect.width).toBeLessThanOrEqual(30)
			expect(rect.height).toBeLessThanOrEqual(12)
		}
	})

	test("fits all pull request filter presets at the minimum terminal height", () => {
		expect(isTerminalTooSmall(60, MIN_TERMINAL_HEIGHT)).toBe(false)
		const layouts = computeModalLayouts({ contentWidth: 80, terminalHeight: MIN_TERMINAL_HEIGHT, longestLabelName: 0, longestDiffFileName: 0, changedFilesModalActive: false })
		const filter = layouts.Filter
		expect(filter.height - 7).toBeGreaterThanOrEqual(filterOptionsFor("pullRequest").length)
		expect(filter.top).toBeGreaterThanOrEqual(0)
		expect(filter.top + filter.height).toBeLessThanOrEqual(MIN_TERMINAL_HEIGHT)
	})
})
