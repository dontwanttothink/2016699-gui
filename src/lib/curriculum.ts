/**
 * Funciones y tipos para lidiar con planes de estudio serializados :)
 */

export type Course = {
	id: number;
	name: string;
	credits: number;
	dependents: number[];
	prerequisites: number[];
};

export class ParseError extends Error {}

export function parseCourses(text: string): Course[] | ParseError {
	const courses = new Map<number, Course>();
	const rows = text
		.split("\n")
		.map((line, i) => ({ line: line.replace(/\r$/, ""), n: i + 1 }))
		.filter(({ line }) => line.trim() !== "");

	for (const { line, n } of rows) {
		const fields = line.split("$");
		if (fields.length !== 5)
			return new ParseError(`línea ${n}: se esperaban 5 campos`);
		const [idText, creditsText, name, dependents, prerequisites] = fields;

		const id = Number(idText);
		const credits = Number(creditsText);
		if (!Number.isInteger(id) || !Number.isInteger(credits))
			return new ParseError(`línea ${n}: id y créditos deben ser enteros`);

		const deps = parseIds(dependents, n);
		if (deps instanceof ParseError) return deps;
		const prereqs = parseIds(prerequisites, n);
		if (prereqs instanceof ParseError) return prereqs;
		courses.set(id, {
			id,
			name,
			credits,
			dependents: deps,
			prerequisites: prereqs,
		});
	}

	for (const course of courses.values()) {
		for (const id of [...course.dependents, ...course.prerequisites])
			if (!courses.has(id))
				return new ParseError(`curso ${course.id}: no existe el id ${id}`);
	}
	return [...courses.values()];
}

function parseIds(text: string, n: number): number[] | ParseError {
	if (text === "") return [];
	const ids: number[] = [];
	for (const part of text.split(",")) {
		const id = Number(part);
		if (!Number.isInteger(id))
			return new ParseError(`línea ${n}: id inválido "${part}"`);
		ids.push(id);
	}
	return ids;
}

const escapeLabel = (s: string) => s.replace(/[\\"]/g, "\\$&");

export function toDotBody(courses: Course[]): string {
	const nodes = courses.map(
		(c) => `"${c.id}" [label="${escapeLabel(c.name)}\\n${c.credits} cr"];`,
	);

	const edges = new Set<string>();
	for (const c of courses) {
		for (const p of c.prerequisites) edges.add(`"${p}" -> "${c.id}";`);
		for (const d of c.dependents) edges.add(`"${c.id}" -> "${d}";`);
	}
	return [...nodes, ...edges].join("\n");
}
