export type PrerequisiteRow = { uid: string; value: string };

export type CourseDraft = {
	uid: string;
	id: string;
	name: string;
	prerequisites: PrerequisiteRow[];
};

export type IdProblem = "notInteger" | "taken";

export type PrerequisiteProblem =
	| "notInteger"
	| "self"
	| "repeated"
	| "unknown";

export function createPrerequisiteRow(): PrerequisiteRow {
	return { uid: crypto.randomUUID(), value: "" };
}

export function createCourseDraft(): CourseDraft {
	return { uid: crypto.randomUUID(), id: "", name: "", prerequisites: [] };
}

export function parseId(text: string): number | null {
	const trimmed = text.trim();
	return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function idCounts(courses: CourseDraft[]): Map<number, number> {
	const counts = new Map<number, number>();
	for (const course of courses) {
		const n = parseId(course.id);
		if (n !== null) counts.set(n, (counts.get(n) ?? 0) + 1);
	}
	return counts;
}

export function idProblem(
	id: string,
	counts: ReadonlyMap<number, number>,
): IdProblem | null {
	const n = parseId(id);
	if (n === null) return id.trim() === "" ? null : "notInteger";
	return (counts.get(n) ?? 0) > 1 ? "taken" : null;
}

export function prerequisiteProblems(
	id: string,
	prerequisites: PrerequisiteRow[],
	counts: ReadonlyMap<number, number>,
): (PrerequisiteProblem | null)[] {
	const own = parseId(id);
	const texts = prerequisites.map((row) => row.value.trim());
	return texts.map((text, index) => {
		if (text === "") return null;
		const n = parseId(text);
		if (n === null) return "notInteger";
		if (n === own) return "self";
		if (texts.indexOf(text) !== index) return "repeated";
		if (!counts.has(n)) return "unknown";
		return null;
	});
}

export function checkCourses(courses: CourseDraft[]): {
	missing: number;
	issues: number;
} {
	const counts = idCounts(courses);

	let missing = 0;
	let issues = 0;
	for (const course of courses) {
		if (course.name.trim() === "" || course.id.trim() === "") missing++;
		const hasIssue =
			idProblem(course.id, counts) !== null ||
			prerequisiteProblems(course.id, course.prerequisites, counts).some(
				(problem) => problem !== null,
			);
		if (hasIssue) issues++;
	}
	return { missing, issues };
}

function quote(text: string): string {
	return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function toDotBody(courses: CourseDraft[]): string {
	const counts = idCounts(courses);

	const valid = courses.flatMap((course) => {
		const n = parseId(course.id);
		return n !== null && counts.get(n) === 1 ? [{ n, course }] : [];
	});
	const known = new Set(valid.map(({ n }) => n));

	const nodes: string[] = [];
	const edges: string[] = [];
	for (const { n, course } of valid) {
		nodes.push(`${n} [label=${quote(course.name.trim() || String(n))}];`);
		const prerequisites = new Set(
			course.prerequisites.map((row) => parseId(row.value)),
		);
		for (const p of prerequisites) {
			if (p !== null && p !== n && known.has(p)) edges.push(`${p} -> ${n};`);
		}
	}
	return [...nodes, ...edges].join("\n");
}
