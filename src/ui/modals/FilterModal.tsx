import { TextAttributes } from "@opentui/core"
import { colors } from "../colors.js"
import { Filler, fitCell, HintRow, StandardModal, standardModalDims, TextLine } from "../primitives.js"
import type { ItemStateFilter } from "../../item.js"
import type { FilterModalState } from "./types.js"

export interface FilterPreset {
	readonly scope: "all" | "mine"
	readonly state: ItemStateFilter
}

export interface FilterOption extends FilterPreset {
	readonly label: string
	readonly description: string
}

const prOptions: readonly FilterOption[] = [
	{ label: "open", scope: "all", state: "open", description: "show open items in this view" },
	{ label: "author:@me", scope: "mine", state: "open", description: "open items authored by me" },
	{ label: "closed", scope: "all", state: "closed", description: "show closed items in this view" },
	{ label: "merged", scope: "all", state: "merged", description: "show merged pull requests" },
	{ label: "author:@me closed", scope: "mine", state: "closed", description: "closed items authored by me" },
	{ label: "author:@me merged", scope: "mine", state: "merged", description: "merged pull requests authored by me" },
]

const issueOptions: readonly FilterOption[] = [
	{ label: "open", scope: "all", state: "open", description: "show open items in this view" },
	{ label: "author:@me", scope: "mine", state: "open", description: "open items authored by me" },
	{ label: "closed", scope: "all", state: "closed", description: "show closed items in this view" },
	{ label: "author:@me closed", scope: "mine", state: "closed", description: "closed items authored by me" },
]

export const filterOptionsFor = (kind: "pullRequest" | "issue"): readonly FilterOption[] => (kind === "pullRequest" ? prOptions : issueOptions)

export const FilterModal = ({
	state,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	readonly state: FilterModalState
	readonly modalWidth: number
	readonly modalHeight: number
	readonly offsetLeft: number
	readonly offsetTop: number
}) => {
	const title = state.surface === "issues" ? "Filter Issues" : "Filter Pull Requests"
	const options = state.options
	const selectedIndex = options.length === 0 ? 0 : Math.max(0, Math.min(state.selectedIndex, options.length - 1))
	const { rowWidth, bodyHeight } = standardModalDims(modalWidth, modalHeight)
	return (
		<StandardModal
			left={offsetLeft}
			top={offsetTop}
			width={modalWidth}
			height={modalHeight}
			title={title}
			subtitle={
				<TextLine>
					<span fg={colors.muted}>Choose a preset filter for this view.</span>
				</TextLine>
			}
			footer={
				<HintRow
					items={[
						{ key: "↑↓", label: "move" },
						{ key: "enter", label: "select" },
						{ key: "esc", label: "close" },
					]}
				/>
			}
		>
			{options.map((option, index) => {
				const selected = index === selectedIndex
				const descriptionWidth = Math.max(1, rowWidth - option.label.length - 4)
				return (
					<TextLine key={option.label} width={rowWidth} bg={selected ? colors.selectedBg : undefined} fg={selected ? colors.selectedText : colors.text}>
						<span fg={selected ? colors.accent : colors.muted}>{selected ? "›" : " "}</span>
						<span> </span>
						<span fg={selected ? colors.accent : colors.count} attributes={selected ? TextAttributes.BOLD : 0}>
							{option.label}
						</span>
						<span> </span>
						<span fg={colors.muted}>{fitCell(option.description, descriptionWidth)}</span>
					</TextLine>
				)
			})}
			<Filler rows={Math.max(0, bodyHeight - options.length)} prefix="filter-modal" />
		</StandardModal>
	)
}
