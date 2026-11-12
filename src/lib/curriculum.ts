export type Course = {
	id: number;
	name: string;
	credits: number;
	prerequisites: number[];
};

export type Limits = { courses: number; credits: number | null };
export type Curriculum = { courses: Course[]; limits: Limits };

export const DEFAULT_LIMITS: Limits = { courses: 4, credits: null };
export const MAX_COURSES = 120;
export const MAX_ID = 2_147_483_647;
export const MAX_CREDITS = 999;

export const example: Course[] = [
	{ id: 101, name: "Cálculo diferencial", credits: 4, prerequisites: [] },
	{ id: 102, name: "Álgebra lineal", credits: 4, prerequisites: [] },
	{ id: 103, name: "Programación básica", credits: 3, prerequisites: [] },
	{ id: 104, name: "Cálculo integral", credits: 4, prerequisites: [101] },
	{ id: 105, name: "Probabilidad", credits: 4, prerequisites: [104, 102] },
	{ id: 106, name: "Estructuras de datos", credits: 3, prerequisites: [103] },
	{ id: 107, name: "Inferencia estadística", credits: 4, prerequisites: [105] },
	{ id: 108, name: "Bases de datos", credits: 3, prerequisites: [106] },
	{
		id: 109,
		name: "Proyecto integrador",
		credits: 5,
		prerequisites: [107, 108],
	},
];

export function validInteger(value: unknown, maximum: number): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value > 0 &&
		value <= maximum
	);
}

export function validateCourses(courses: Course[]) {
	if (courses.length > MAX_COURSES) {
		throw new Error(
			`El editor admite hasta ${MAX_COURSES} asignaturas por plan.`,
		);
	}
	const byId = new Map<number, Course>();
	for (const course of courses) {
		if (!validInteger(course.id, MAX_ID))
			throw new Error(`Usa un ID entero entre 1 y ${MAX_ID}.`);
		if (byId.has(course.id))
			throw new Error(`El ID ${course.id} ya está registrado.`);
		if (
			!course.name.trim() ||
			course.name.length > 100 ||
			/[\r\n$]/.test(course.name)
		) {
			throw new Error(
				"Usa un nombre de 1 a 100 caracteres, sin saltos de línea ni el signo $.",
			);
		}
		if (!validInteger(course.credits, MAX_CREDITS)) {
			throw new Error(`Indica créditos enteros entre 1 y ${MAX_CREDITS}.`);
		}
		byId.set(course.id, course);
	}

	const dependents = new Map(
		courses.map((course) => [course.id, [] as number[]]),
	);
	for (const course of courses) {
		const prerequisites = new Set(course.prerequisites);
		if (prerequisites.size !== course.prerequisites.length) {
			throw new Error(`${course.name} tiene prerrequisitos repetidos.`);
		}
		for (const id of prerequisites) {
			const next = dependents.get(id);
			if (!next)
				throw new Error(
					`${course.name} requiere el ID ${id}, que no está registrado.`,
				);
			next.push(course.id);
		}
	}

	const ordered: number[] = [];
	const complete = new Set<number>();
	const active = new Set<number>();
	const path: number[] = [];
	function visit(id: number) {
		if (complete.has(id)) return;
		if (active.has(id)) {
			const cycle = [...path.slice(path.indexOf(id)), id].map(
				(key) => byId.get(key)?.name,
			);
			throw new Error(`Se formaría un ciclo: ${cycle.join(" → ")}.`);
		}
		active.add(id);
		path.push(id);
		for (const prerequisite of byId.get(id)?.prerequisites ?? [])
			visit(prerequisite);
		path.pop();
		active.delete(id);
		complete.add(id);
		ordered.push(id);
	}
	for (const course of courses) visit(course.id);
	return { byId, dependents, ordered };
}

export function validateLimits(limits: Limits) {
	if (!validInteger(limits.courses, MAX_COURSES)) {
		throw new Error(
			`El máximo de asignaturas debe estar entre 1 y ${MAX_COURSES}.`,
		);
	}
	if (limits.credits !== null && !validInteger(limits.credits, MAX_CREDITS)) {
		throw new Error(
			`El máximo de créditos debe estar entre 1 y ${MAX_CREDITS}.`,
		);
	}
}

function idList(value: string) {
	return value.trim()
		? value
				.trim()
				.split(/\s*,\s*/)
				.map(Number)
		: [];
}

export function parsePlan(
	text: string,
	currentLimits: Limits = DEFAULT_LIMITS,
): Curriculum {
	const source = text.replace(/^\uFEFF/, "").trim();
	if (!source) throw new Error("El archivo está vacío.");
	if (!source.startsWith("{")) {
		const rows = source
			.split(/\r?\n/)
			.filter((line) => line.trim())
			.map((line, index) => {
				const fields = line.split("$");
				if (fields.length !== 5)
					throw new Error(
						`La fila ${index + 1} debe tener cinco campos separados por $.`,
					);
				const [id, credits, name, dependents, prerequisites] = fields;
				return {
					course: {
						id: Number(id),
						credits: Number(credits),
						name: name.trim(),
						prerequisites: idList(prerequisites),
					},
					dependents: idList(dependents),
				};
			});
		const courses = rows.map(({ course }) => course);
		const byId = new Map(courses.map((course) => [course.id, course]));
		for (const { course, dependents } of rows) {
			for (const id of dependents) {
				const child = byId.get(id);
				if (!child)
					throw new Error(
						`${course.name} habilita el ID ${id}, que no está registrado.`,
					);
				if (!child.prerequisites.includes(course.id))
					child.prerequisites.push(course.id);
			}
		}
		validateCourses(courses);
		validateLimits(currentLimits);
		return { courses, limits: currentLimits };
	}
	const data = JSON.parse(source);
	if (data.version !== 1 || !Array.isArray(data.courses) || !data.limits) {
		throw new Error(
			"Selecciona un plan JSON exportado por Graduación UNAL o un archivo TXT de Java.",
		);
	}
	const courses: Course[] = data.courses.map((row: unknown) => {
		const course = row as Partial<Course> | null;
		if (
			!course ||
			typeof course.name !== "string" ||
			typeof course.id !== "number" ||
			typeof course.credits !== "number" ||
			!Array.isArray(course.prerequisites) ||
			!course.prerequisites.every((id) => typeof id === "number")
		) {
			throw new Error(
				"El archivo contiene una asignatura con campos inválidos.",
			);
		}
		return {
			id: course.id,
			name: course.name.trim(),
			credits: course.credits,
			prerequisites: course.prerequisites,
		};
	});
	const limits = { courses: data.limits.courses, credits: data.limits.credits };
	validateCourses(courses);
	validateLimits(limits);
	return { courses, limits };
}

export function exportJava(courses: Course[]) {
	const { dependents } = validateCourses(courses);
	return `${courses
		.map((course) =>
			[
				course.id,
				course.credits,
				course.name,
				dependents.get(course.id)?.join(","),
				course.prerequisites.join(","),
			].join("$"),
		)
		.join("\n")}\n`;
}
