import type { PlannedCourse } from "#lib/courseDraft.ts";

let semesters = $state<PlannedCourse[][] | null>(null);

export function setPlanResult(plan: PlannedCourse[][]) {
	semesters = plan;
}

export function getPlanResult(): PlannedCourse[][] | null {
	return semesters;
}
