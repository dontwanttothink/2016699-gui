import {
	type Course,
	type Limits,
	validateCourses,
	validateLimits,
} from "./curriculum.ts";

export type PlanResult = {
	semesters: number[][];
	optimal: boolean;
	lowerBound: number;
};

export function calculatePlan(
	courses: Course[],
	limits: Limits,
	budgetMs = 1800,
): PlanResult {
	validateLimits(limits);
	const { ordered, byId, dependents } = validateCourses(courses);
	const creditLimit = limits.credits ?? Infinity;
	const excessive = courses.find((course) => course.credits > creditLimit);
	if (excessive)
		throw new Error(
			`${excessive.name} supera el máximo de créditos de un semestre.`,
		);
	const indices = new Map(ordered.map((id, index) => [id, index]));
	const bits = ordered.map((_, index) => 1n << BigInt(index));
	const depth: number[] = [];
	for (const id of [...ordered].reverse()) {
		const index = indices.get(id) as number;
		depth[index] =
			1 +
			Math.max(
				0,
				...(dependents.get(id) ?? []).map(
					(next) => depth[indices.get(next) as number],
				),
			);
	}
	const rows = ordered
		.map((id, index) => {
			const course = byId.get(id) as Course;
			return {
				id,
				bit: bits[index],
				depth: depth[index],
				credits: course.credits,
				dependents: dependents.get(id)?.length ?? 0,
				required: course.prerequisites.reduce(
					(mask, prerequisite) =>
						mask | bits[indices.get(prerequisite) as number],
					0n,
				),
			};
		})
		.sort(
			(a, b) =>
				b.depth - a.depth ||
				b.dependents - a.dependents ||
				b.credits - a.credits ||
				a.id - b.id,
		);
	type Row = (typeof rows)[number];
	const all = bits.reduce((mask, bit) => mask | bit, 0n);

	function available(done: bigint, priority: Row[] = rows) {
		return priority.filter(
			(row) => !(row.bit & done) && (row.required & done) === row.required,
		);
	}

	function greedy(priority: Row[]) {
		const semesters: number[][] = [];
		let done = 0n;
		while (done !== all) {
			const semester: number[] = [];
			let credits = 0;
			for (const row of available(done, priority)) {
				if (semester.length === limits.courses) break;
				if (credits + row.credits > creditLimit) continue;
				credits += row.credits;
				done |= row.bit;
				semester.push(row.id);
			}
			semesters.push(semester);
		}
		return semesters;
	}

	function bound(done: bigint) {
		let count = 0;
		let credits = 0;
		let chain = 0;
		for (const row of rows) {
			if (row.bit & done) continue;
			count++;
			credits += row.credits;
			chain = Math.max(chain, row.depth);
		}
		return Math.max(
			chain,
			Math.ceil(count / limits.courses),
			Math.ceil(credits / creditLimit),
		);
	}

	let best = greedy(rows);
	const byWeight = greedy(
		[...rows].sort(
			(a, b) => b.credits - a.credits || b.depth - a.depth || a.id - b.id,
		),
	);
	if (byWeight.length < best.length) best = byWeight;
	const deadline = performance.now() + budgetMs;
	const visits = new Map<bigint, number>();
	const path: number[][] = [];
	const initialBound = bound(0n);
	let provenBound = initialBound;
	let checks = 0;
	let interrupted = false;

	function checkBudget() {
		checks++;
		if (checks === 1 || (checks & 255) === 0) {
			interrupted = performance.now() >= deadline || checks >= 250_000;
		}
		return interrupted;
	}

	function search(done: bigint, remaining: number): boolean {
		if (checkBudget()) return false;
		if (done === all) return true;
		if (bound(done) > remaining || (visits.get(done) ?? 0) >= remaining)
			return false;
		visits.set(done, remaining);
		const ready = available(done);
		const chosen: number[] = [];

		function next(
			index: number,
			mask: bigint,
			credits: number,
			lightestSkipped: number,
		): boolean {
			if (checkBudget()) return false;
			if (index === ready.length || chosen.length === limits.courses) {
				// An optimal schedule can always take an additional ready course if it fits.
				if (
					!chosen.length ||
					(chosen.length < limits.courses &&
						lightestSkipped < Infinity &&
						credits + lightestSkipped <= creditLimit)
				)
					return false;
				path.push([...chosen]);
				if (search(done | mask, remaining - 1)) return true;
				path.pop();
				return false;
			}
			const row = ready[index];
			if (credits + row.credits <= creditLimit) {
				chosen.push(row.id);
				if (
					next(
						index + 1,
						mask | row.bit,
						credits + row.credits,
						lightestSkipped,
					)
				)
					return true;
				chosen.pop();
			}
			if (interrupted) return false;
			// Without credit constraints, every candidate fills all available slots.
			if (
				limits.credits === null &&
				chosen.length + ready.length - index <= limits.courses
			)
				return false;
			return next(
				index + 1,
				mask,
				credits,
				Math.min(lightestSkipped, row.credits),
			);
		}
		return next(0, 0n, 0, Infinity);
	}

	for (let target = initialBound; target < best.length; target++) {
		visits.clear();
		if (search(0n, target)) {
			best = [...path];
			provenBound = best.length;
			break;
		}
		if (interrupted) break;
		provenBound = target + 1;
	}

	return {
		semesters: best,
		optimal: provenBound === best.length,
		lowerBound: provenBound,
	};
}

export type PlanStep = {
	ready: number[];
	selected: number[];
	unlocked: number[];
	completed: number[];
};

export function planSteps(
	courses: Course[],
	semesters: number[][],
): PlanStep[] {
	const completed = new Set<number>();
	function ready() {
		return courses
			.filter(
				(course) =>
					!completed.has(course.id) &&
					course.prerequisites.every((id) => completed.has(id)),
			)
			.map((course) => course.id);
	}
	return semesters.map((selected) => {
		const atStart = ready();
		const before = new Set(atStart);
		for (const id of selected) completed.add(id);
		return {
			ready: atStart,
			selected,
			unlocked: ready().filter((id) => !before.has(id)),
			completed: [...completed],
		};
	});
}
