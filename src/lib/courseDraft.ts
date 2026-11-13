import type { Course } from "#lib/curriculum.ts";

export type PrerequisiteRow = { uid: string; value: string };

export type CourseDraft = {
	uid: string;
	id: string;
	name: string;
	credits: string;
	prerequisites: PrerequisiteRow[];
};

export const MIN_CREDITS = 1;
export const MAX_CREDITS = 1000;

export type IdProblem = "notInteger" | "taken";

export type PrerequisiteProblem =
	| "notInteger"
	| "self"
	| "repeated"
	| "unknown";

export type CreditsProblem =
	| "empty"
	| "notInteger"
	| "outOfRange"
	| "exceedsSemester";

export function createPrerequisiteRow(): PrerequisiteRow {
	return { uid: crypto.randomUUID(), value: "" };
}

export function createCourseDraft(): CourseDraft {
	return {
		uid: crypto.randomUUID(),
		id: "",
		name: "",
		credits: "1",
		prerequisites: [],
	};
}

export function stripUnsafeName(text: string): string {
	return text.replace(/[$\r\n]/g, "");
}

export function parseInteger(text: string): number | null {
	const trimmed = text.trim();
	return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function creditsProblem(
	text: string,
	semesterLimit: number,
): CreditsProblem | null {
	if (text.trim() === "") return "empty";
	const n = parseInteger(text);
	if (n === null) return "notInteger";
	if (n < MIN_CREDITS || n > MAX_CREDITS) return "outOfRange";
	return n > semesterLimit ? "exceedsSemester" : null;
}

export function semesterLimit(maxCredits: string): number {
	const n = parseInteger(maxCredits);
	return n !== null && creditsProblem(maxCredits, MAX_CREDITS) === null
		? n
		: MAX_CREDITS;
}

export function creditsLabel(n: number): string {
	return `${n} ${n === 1 ? "crédito" : "créditos"}`;
}

export function creditsMessage(
	problem: CreditsProblem,
	semesterLimit: number,
): string {
	switch (problem) {
		case "empty":
			return "Ingrese un número de créditos.";
		case "notInteger":
			return "Los créditos deben ser un número entero.";
		case "outOfRange":
			return `Los créditos deben estar entre ${MIN_CREDITS} y ${MAX_CREDITS}.`;
		case "exceedsSemester":
			return `Los créditos no pueden superar el máximo por semestre (${semesterLimit}).`;
	}
}

export function idCounts(courses: CourseDraft[]): Map<number, number> {
	const counts = new Map<number, number>();
	for (const course of courses) {
		const n = parseInteger(course.id);
		if (n !== null) counts.set(n, (counts.get(n) ?? 0) + 1);
	}
	return counts;
}

export function idProblem(
	id: string,
	counts: ReadonlyMap<number, number>,
): IdProblem | null {
	const n = parseInteger(id);
	if (n === null) return id.trim() === "" ? null : "notInteger";
	return (counts.get(n) ?? 0) > 1 ? "taken" : null;
}

export function prerequisiteProblems(
	id: string,
	prerequisites: PrerequisiteRow[],
	counts: ReadonlyMap<number, number>,
): (PrerequisiteProblem | null)[] {
	const own = parseInteger(id);
	const texts = prerequisites.map((row) => row.value.trim());
	return texts.map((text, index) => {
		if (text === "") return null;
		const n = parseInteger(text);
		if (n === null) return "notInteger";
		if (n === own) return "self";
		if (texts.indexOf(text) !== index) return "repeated";
		if (!counts.has(n)) return "unknown";
		return null;
	});
}

export function checkCourses(
	courses: CourseDraft[],
	semesterLimit: number,
): {
	missing: { name: number; id: number; credits: number };
	issues: number;
} {
	const counts = idCounts(courses);

	const missing = { name: 0, id: 0, credits: 0 };
	let issues = 0;
	for (const course of courses) {
		const credits = creditsProblem(course.credits, semesterLimit);
		if (course.name.trim() === "") missing.name++;
		if (course.id.trim() === "") missing.id++;
		if (credits === "empty") missing.credits++;
		const hasIssue =
			idProblem(course.id, counts) !== null ||
			(credits !== null && credits !== "empty") ||
			prerequisiteProblems(course.id, course.prerequisites, counts).some(
				(problem) => problem !== null,
			);
		if (hasIssue) issues++;
	}
	return { missing, issues };
}

function coursesCount(n: number): string {
	return n === 1 ? "Una materia" : `${n} materias`;
}

export function planProblems(
	courses: CourseDraft[],
	maxCredits: string,
): string[] {
	const problems: string[] = [];

	if (courses.length === 0) {
		problems.push("Agregue al menos una materia.");
	} else {
		const { missing, issues } = checkCourses(
			courses,
			semesterLimit(maxCredits),
		);
		const missingFields = [
			["nombre", missing.name],
			["ID", missing.id],
			["créditos", missing.credits],
		] as const;
		for (const [field, n] of missingFields) {
			if (n > 0) problems.push(`${coursesCount(n)} sin ${field}.`);
		}
		if (issues > 0) {
			problems.push(
				`${coursesCount(issues)} con problemas en su ID, créditos o prerrequisitos.`,
			);
		}
	}

	const maxProblem = creditsProblem(maxCredits, MAX_CREDITS);
	if (maxProblem !== null) {
		problems.push(
			`Máximo de créditos por semestre: ${creditsMessage(maxProblem, MAX_CREDITS)}`,
		);
	}
	return problems;
}

export function toPlannerInput(courses: CourseDraft[]): string {
	const rows = courses.flatMap((course) => {
		const id = parseInteger(course.id);
		const credits = parseInteger(course.credits);
		if (id === null || credits === null) return [];
		const prerequisites = course.prerequisites.flatMap((row) => {
			const n = parseInteger(row.value);
			return n === null ? [] : [n];
		});
		return [{ id, credits, name: course.name.trim(), prerequisites }];
	});

	return rows
		.map(({ id, credits, name, prerequisites }) => {
			const dependents = rows
				.filter((other) => other.prerequisites.includes(id))
				.map((other) => other.id);
			return `${id}$${credits}$${name}$${dependents.join(",")}$${prerequisites.join(",")}`;
		})
		.join("\n");
}

export function toCourseDrafts(courses: Course[]): CourseDraft[] {
	return courses.map((course) => {
		const prerequisites = new Set(course.prerequisites);
		for (const other of courses) {
			if (other.dependents.includes(course.id)) prerequisites.add(other.id);
		}
		return {
			uid: crypto.randomUUID(),
			id: String(course.id),
			name: course.name,
			credits: String(course.credits),
			prerequisites: [...prerequisites].map((id) => ({
				uid: crypto.randomUUID(),
				value: String(id),
			})),
		};
	});
}

export type PlannedCourse = { id: number; name: string; credits: number };

export function toPlannedSemesters(
	semesters: number[][],
	courses: CourseDraft[],
): PlannedCourse[][] {
	const byId = new Map<number, PlannedCourse>();
	for (const course of courses) {
		const id = parseInteger(course.id);
		const credits = parseInteger(course.credits);
		if (id !== null && credits !== null)
			byId.set(id, { id, name: course.name.trim(), credits });
	}
	return semesters.map((semester) =>
		semester.flatMap((id) => {
			const course = byId.get(id);
			return course ? [course] : [];
		}),
	);
}

function quote(text: string): string {
	return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function toDotBody(courses: CourseDraft[]): string {
	const counts = idCounts(courses);

	const valid = courses.flatMap((course) => {
		const n = parseInteger(course.id);
		return n !== null && counts.get(n) === 1 ? [{ n, course }] : [];
	});
	const known = new Set(valid.map(({ n }) => n));

	const nodes: string[] = [];
	const edges: string[] = [];
	for (const { n, course } of valid) {
		nodes.push(`${n} [label=${quote(course.name.trim() || String(n))}];`);
		const prerequisites = new Set(
			course.prerequisites.map((row) => parseInteger(row.value)),
		);
		for (const p of prerequisites) {
			if (p !== null && p !== n && known.has(p)) edges.push(`${p} -> ${n};`);
		}
	}
	return [...nodes, ...edges].join("\n");
}
