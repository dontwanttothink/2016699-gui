import type { PlannedCourse } from "#lib/courseDraft.ts";
import type { Snapshot } from "#lib/verbose.ts";

export type PlanResult = {
	semesters: PlannedCourse[][];
	snapshots: Snapshot[];
};

let result = $state.raw<PlanResult | null>(null);

export function setPlanResult(plan: PlanResult) {
	result = plan;
}

export function getPlanResult(): PlanResult | null {
	return result;
}
