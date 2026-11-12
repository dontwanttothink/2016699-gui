<script lang="ts">
import { onMount, tick } from "svelte";
import Graphviz from "#components/Graphviz.svelte";
import SplitPane from "#components/SplitPane.svelte";
import {
	type Course,
	DEFAULT_LIMITS,
	example,
	exportJava,
	type Limits,
	MAX_COURSES,
	MAX_CREDITS,
	MAX_ID,
	parsePlan,
	validateCourses,
	validateLimits,
} from "../lib/curriculum.ts";
import { courseGraph, structureGraph } from "../lib/graph.ts";
import { type JavaTrace, parseJavaTrace } from "../lib/java-trace.ts";
import { type PlanResult, planSteps } from "../lib/planner.ts";

type Tab = "courses" | "results" | "steps";
const tabs: { id: Tab; title: string }[] = [
	{ id: "courses", title: "Asignaturas" },
	{ id: "results", title: "Semestres" },
	{ id: "steps", title: "Estructuras" },
];
const storageKey = "graduacion-unal-plan-v1";
const number = new Intl.NumberFormat("es-CO");
let courses = $state.raw<Course[]>(example);
let limits = $state<Limits>({ ...DEFAULT_LIMITS });
let saved = $state(false);
let storageAvailable = $state(true);
let tab = $state<Tab>("courses");
let search = $state("");
let selected = $state<number | null>(null);
let stepIndex = $state(0);
let result = $state.raw<PlanResult | null>(null);
let activeSemester = $state<number | null>(null);
let calculating = $state(false);
let graphError = $state("");
let error = $state("");
let notice = $state("");
let vertical = $state(false);
let editDialog: HTMLDialogElement;
let replaceDialog: HTMLDialogElement;
let importInput: HTMLInputElement;
let editName: HTMLInputElement;
let graph = $state.raw<ReturnType<typeof Graphviz>>();
let worker: Worker | undefined;
let javaRequest: AbortController | undefined;
let javaTrace = $state.raw<JavaTrace | null>(null);
let traceIndex = $state(0);
let javaBusy = $state(false);
let javaError = $state("");
let structureMode = $state<"plan" | "java">("plan");
let editing = $state<number | null>(null);
let editingId = $state<number | undefined>();
let editingName = $state("");
let editingCredits = $state<number | undefined>(3);
let editingPrerequisites = $state<number[]>([]);
let prerequisiteSearch = $state("");
let editError = $state("");
let deleting = $state(false);
let replacement = $state.raw<{
	courses: Course[];
	limits: Limits;
	message: string;
} | null>(null);
let courseLimit = $state<number | undefined>(DEFAULT_LIMITS.courses);
let creditLimit = $state<number | undefined>();
let useCredits = $state(false);

const byId = $derived(new Map(courses.map((course) => [course.id, course])));
const selectedCourse = $derived(
	selected === null ? undefined : byId.get(selected),
);
const visibleCourses = $derived(
	courses.filter((course) => matches(course, search)),
);
const candidates = $derived(
	courses.filter(
		(course) => course.id !== editing && matches(course, prerequisiteSearch),
	),
);
const totalCredits = $derived(
	courses.reduce((sum, course) => sum + course.credits, 0),
);
const relations = $derived(
	courses.reduce((sum, course) => sum + course.prerequisites.length, 0),
);
const steps = $derived(result ? planSteps(courses, result.semesters) : []);
const step = $derived(steps[stepIndex]);
const highlighted = $derived(
	tab === "steps"
		? (step?.selected ?? [])
		: tab === "results"
			? (result?.semesters[activeSemester ?? -1] ?? [])
			: [],
);
const frame = $derived(
	tab === "steps" && structureMode === "java"
		? javaTrace?.frames[traceIndex]
		: undefined,
);
const dot = $derived(
	frame
		? structureGraph(frame, selected, vertical)
		: courseGraph(courses, selected, highlighted, vertical),
);

onMount(() => {
	try {
		const value = localStorage.getItem(storageKey);
		if (value) {
			const plan = parsePlan(value);
			courses = plan.courses;
			setLimits(plan.limits);
		}
	} catch {
		notice = "Se cargó el ejemplo. Si tienes un respaldo, puedes importarlo.";
	}
	saved = true;
	return () => {
		worker?.terminate();
		javaRequest?.abort();
	};
});

$effect(() => {
	if (!saved) return;
	try {
		localStorage.setItem(
			storageKey,
			JSON.stringify({ version: 1, courses, limits }),
		);
	} catch {
		storageAvailable = false;
	}
});

function matches(course: Course, query: string) {
	const clean = query
		.trim()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase();
	const name = course.name
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase();
	return name.includes(clean) || String(course.id).includes(clean);
}

function messageFrom(value: unknown) {
	return value instanceof Error ? value.message : String(value);
}

function stopCalculation() {
	worker?.terminate();
	worker = undefined;
	calculating = false;
}

function invalidate() {
	stopCalculation();
	result = null;
	activeSemester = null;
	stepIndex = 0;
	error = "";
}

function invalidateJava() {
	javaRequest?.abort();
	javaRequest = undefined;
	javaBusy = false;
	javaTrace = null;
	javaError = "";
	traceIndex = 0;
}

function setLimits(value: Limits) {
	limits = value;
	courseLimit = value.courses;
	creditLimit = value.credits ?? 20;
	useCredits = value.credits !== null;
}

function syncLimits() {
	invalidate();
	const next = {
		courses: courseLimit ?? 0,
		credits: useCredits ? (creditLimit ?? 0) : null,
	};
	try {
		validateLimits(next);
		limits = next;
	} catch {
		// Keep the last valid settings for the next reload.
	}
}

function selectCourse(id: number) {
	selected = selected === id ? null : id;
}

function showCourse(id: number) {
	tab = "courses";
	search = "";
	selected = id;
}

async function openEditor(course?: Course) {
	editing = course?.id ?? null;
	let proposedId = 101;
	while (byId.has(proposedId)) proposedId++;
	editingId = course?.id ?? proposedId;
	editingName = course?.name ?? "";
	editingCredits = course?.credits ?? 3;
	editingPrerequisites = course ? [...course.prerequisites] : [];
	prerequisiteSearch = "";
	editError = "";
	deleting = false;
	editDialog.showModal();
	await tick();
	editName.focus();
}

function saveCourse(event: SubmitEvent) {
	event.preventDefault();
	const course = {
		id: editingId ?? 0,
		name: editingName.trim(),
		credits: editingCredits ?? 0,
		prerequisites: [...editingPrerequisites],
	};
	const next =
		editing === null
			? [...courses, course]
			: courses.map((previous) => {
					if (previous.id === editing) return course;
					return {
						...previous,
						prerequisites: previous.prerequisites.map((id) =>
							id === editing ? course.id : id,
						),
					};
				});
	try {
		validateCourses(next);
		invalidate();
		invalidateJava();
		courses = next;
		selected = course.id;
		search = "";
		notice =
			editing === null ? "Asignatura agregada." : "Asignatura actualizada.";
		editDialog.close();
	} catch (failure) {
		editError = messageFrom(failure);
	}
}

function removeCourse() {
	const id = editing;
	if (id === null) return;
	invalidate();
	invalidateJava();
	courses = courses
		.filter((course) => course.id !== id)
		.map((course) => ({
			...course,
			prerequisites: course.prerequisites.filter(
				(prerequisite) => prerequisite !== id,
			),
		}));
	selected = null;
	notice = "Asignatura eliminada.";
	editDialog.close();
}

function requestReplacement(
	next: Course[],
	nextLimits: Limits,
	message: string,
) {
	replacement = { courses: next, limits: nextLimits, message };
	if (courses.length) replaceDialog.showModal();
	else applyReplacement();
}

function applyReplacement() {
	if (!replacement) return;
	invalidate();
	invalidateJava();
	courses = replacement.courses;
	setLimits(replacement.limits);
	selected = null;
	search = "";
	tab = "courses";
	notice = replacement.message;
	replacement = null;
	if (replaceDialog.open) replaceDialog.close();
}

async function importFile(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file) return;
	try {
		if (file.size > 1_000_000)
			throw new Error("El archivo debe pesar menos de 1 MB.");
		const plan = parsePlan(await file.text(), limits);
		requestReplacement(plan.courses, plan.limits, "Plan importado.");
	} catch (failure) {
		error = messageFrom(failure);
	}
}

function download(content: string, name: string, type: string) {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPlan(kind: "json" | "java" | "csv") {
	if (kind === "json") {
		download(
			JSON.stringify({ version: 1, courses, limits }, null, 2),
			"plan-estudios.json",
			"application/json",
		);
	} else if (kind === "java") {
		download(exportJava(courses), "plan-java.txt", "text/plain;charset=utf-8");
	} else if (result) {
		const quote = (value: string) =>
			`"${(/^[\s\uFEFF]*[=+@-]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
		const rows = result.semesters.flatMap((semester, index) =>
			semester.map((id) => {
				const course = byId.get(id);
				return `${index + 1},${id},${quote(course?.name ?? "")},${course?.credits ?? 0}`;
			}),
		);
		download(
			`\uFEFF${["Semestre,ID,Asignatura,Créditos", ...rows].join("\r\n")}`,
			"semestres.csv",
			"text/csv;charset=utf-8",
		);
	}
}

function runCalculation() {
	if (!courses.length || calculating) return;
	invalidate();
	try {
		const current = {
			courses: courseLimit ?? 0,
			credits: useCredits ? (creditLimit ?? 0) : null,
		};
		validateLimits(current);
		const engine = new Worker(
			new URL("../lib/planner.worker.ts", import.meta.url),
			{ type: "module" },
		);
		worker = engine;
		calculating = true;
		engine.onmessage = ({
			data,
		}: MessageEvent<{ result?: PlanResult; error?: string }>) => {
			if (engine !== worker) return;
			stopCalculation();
			if (data.result) {
				result = data.result;
				tab = "results";
			} else {
				error = data.error ?? "El cálculo no devolvió un resultado.";
			}
		};
		engine.onerror = () => {
			if (engine !== worker) return;
			stopCalculation();
			error = "El cálculo se interrumpió. Vuelve a intentarlo.";
		};
		engine.postMessage({ courses, limits: current });
	} catch (failure) {
		stopCalculation();
		error = messageFrom(failure);
	}
}

function switchTab(value: Tab) {
	tab = value;
	selected = null;
}

function togglePrerequisite(id: number, checked: boolean) {
	editingPrerequisites = checked
		? [...editingPrerequisites, id]
		: editingPrerequisites.filter((previous) => previous !== id);
}

async function runJava(algorithm: "0" | "1") {
	if (!courses.length || javaBusy) return;
	invalidateJava();
	const request = new AbortController();
	javaRequest = request;
	javaBusy = true;
	selected = null;
	try {
		const response = await fetch("/_graduacion/java", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ courses, algorithm }),
			signal: request.signal,
		});
		const data = await response.json();
		if (!response.ok)
			throw new Error(data.error ?? "No se pudo ejecutar Java.");
		if (request === javaRequest)
			javaTrace = parseJavaTrace(data.stdout, courses);
	} catch (failure) {
		if (request === javaRequest) javaError = messageFrom(failure);
	} finally {
		if (request === javaRequest) {
			javaRequest = undefined;
			javaBusy = false;
		}
	}
}
</script>

<svelte:head>
	<title>Graduación UNAL · Planificador académico</title>
	<meta
		name="description"
		content="Organiza asignaturas, visualiza sus prerrequisitos y calcula tu ruta por semestres."
	>
</svelte:head>

<header class="topbar">
	<div class="topbar-inner">
		<div class="brand">
			<span class="brand-icon" aria-hidden="true"><i></i><i></i><i></i></span>
			<span>Graduación <strong>UNAL</strong></span>
		</div>
		<span class="brand-note">Planificador académico</span>
		<span class="storage"
			><span aria-hidden="true"></span>
			{storageAvailable
				? "Guardado local"
				: "Guardado local no disponible"}</span
		>
	</div>
</header>

<div class="shell">
	<section class="intro" aria-labelledby="title">
		<div>
			<p class="eyebrow">UNIVERSIDAD NACIONAL DE COLOMBIA</p>
			<h1 id="title">Plan de estudios</h1>
			<p class="intro-description">
				Organiza tus asignaturas y calcula una ruta que respete sus
				prerrequisitos.
			</p>
		</div>
		<div class="toolbar">
			<input
				type="file"
				accept=".json,.txt,application/json,text/plain"
				bind:this={importInput}
				onchange={importFile}
				hidden
			>
			<button
				class="button secondary"
				type="button"
				onclick={() => importInput.click()}
			>
				<span aria-hidden="true">↑</span>
				Importar
			</button>
			<details class="export-menu">
				<summary class="button secondary">
					<span aria-hidden="true">↓</span>
					Exportar <span class="chevron" aria-hidden="true">⌄</span>
				</summary>
				<div class="menu-items">
					<button type="button" onclick={() => exportPlan("json")}>
						Plan en JSON
					</button>
					<button
						type="button"
						onclick={() => exportPlan("java")}
						disabled={!courses.length}
					>
						Plan para Java (.txt)
					</button>
					<button
						type="button"
						onclick={() => exportPlan("csv")}
						disabled={!result}
					>
						Semestres en CSV
					</button>
				</div>
			</details>
		</div>
	</section>

	<div class="metrics">
		<div class="metric">
			<span class="metric-icon" aria-hidden="true">▤</span>
			<div>
				<span>Asignaturas</span><strong>{number.format(courses.length)}</strong>
			</div>
		</div>
		<div class="metric">
			<span class="metric-icon" aria-hidden="true">◇</span>
			<div>
				<span>Prerrequisitos</span><strong>{number.format(relations)}</strong>
			</div>
		</div>
		<div class="metric">
			<span class="metric-icon" aria-hidden="true">▥</span>
			<div>
				<span>Créditos</span><strong>{number.format(totalCredits)}</strong>
			</div>
		</div>
		<div class="metric">
			<span class="metric-icon result-icon" aria-hidden="true">◷</span>
			<div>
				<span>Semestres {result?.optimal ? "mínimos" : "calculados"}</span
				><strong>{result?.semesters.length ?? "—"}</strong>
			</div>
		</div>
	</div>

	{#if error}
		<div class="alert" role="alert">
			{error}<button
				type="button"
				aria-label="Cerrar aviso"
				onclick={() => (error = "")}
			>
				×
			</button>
		</div>
	{/if}
	<p class="sr-only" aria-live="polite">{notice}</p>

	<div class="workspace">
		<SplitPane initialWidth={59}>
			{#snippet left()}
				<section class="graph-panel" aria-labelledby="graph-title">
					<div class="panel-heading">
						<div>
							<h2 id="graph-title">
								{frame
									? `Estado de ${frame.structure}`
									: "Grafo de prerrequisitos"}
							</h2>
							<p>
								{frame
									? `Paso ${traceIndex + 1} de la ejecución Java.`
									: "De la asignatura requerida a la que habilita."}
							</p>
						</div>
						<button
							type="button"
							class="button secondary compact"
							aria-label="Cambiar orientación del grafo"
							aria-pressed={vertical}
							onclick={() => (vertical = !vertical)}
						>
							{vertical ? "↕ Vertical" : "↔ Horizontal"}
						</button>
					</div>
					<div class="graph-stage">
						{#if frame && !frame.nodes.length}
							<div class="empty">
								<strong>Este estado no contiene nodos visibles</strong>
								<p>
									{frame.structure === "Heap"
										? "El heap está vacío."
										: "Java imprime únicamente las aristas en este estado."}
								</p>
							</div>
						{:else if courses.length}
							<Graphviz
								{dot}
								bind:error={graphError}
								bind:this={graph}
								onselect={selectCourse}
							/>
							{#if graphError}
								<div class="graph-warning" role="alert">
									No se pudo dibujar el grafo. {graphError}
								</div>
							{/if}
							<div class="graph-controls">
								<button
									type="button"
									aria-label="Acercar grafo"
									onclick={() => graph?.scale(1.3)}
								>
									+
								</button>
								<button
									type="button"
									aria-label="Alejar grafo"
									onclick={() => graph?.scale(1 / 1.3)}
								>
									−
								</button>
								<button
									type="button"
									aria-label="Restablecer vista del grafo"
									onclick={() => graph?.reset()}
								>
									⟲
								</button>
							</div>
						{:else}
							<div class="empty">
								<strong>Aquí aparecerá tu grafo</strong>
								<p>Agrega una asignatura o importa un plan.</p>
							</div>
						{/if}
					</div>
					<div class="graph-footer">
						<span><i></i> Asignatura</span
						><span><i class="active-dot"></i> Selección</span
						><span class="graph-hint"
							>Rueda para acercar · Arrastra para mover</span
						>
					</div>
				</section>
			{/snippet}
			{#snippet right()}
				<section class="side-panel" aria-label="Editor y resultados">
					<nav class="tabs" aria-label="Vistas del plan">
						{#each tabs as option (option.id)}
							<button
								type="button"
								class:current={tab === option.id}
								aria-current={tab === option.id ? "page" : undefined}
								onclick={() => switchTab(option.id)}
							>
								{option.title}
							</button>
						{/each}
					</nav>
					{#if tab === "courses"}
						<div class="side-body">
							<div class="panel-heading list-heading">
								<div>
									<h2>Asignaturas</h2>
									<p>
										{courses.length}
										{courses.length === 1 ? "registrada" : "registradas"}
									</p>
								</div>
								<button
									class="button primary compact"
									type="button"
									disabled={courses.length >= MAX_COURSES}
									onclick={() => openEditor()}
								>
									<span aria-hidden="true">+</span>
									Nueva materia
								</button>
							</div>
							<div class="search-wrap">
								<span aria-hidden="true">⌕</span>
								<input
									type="search"
									aria-label="Buscar por nombre o ID"
									placeholder="Buscar por nombre o ID"
									bind:value={search}
								>
							</div>
							{#if selectedCourse}
								<div class="course-detail">
									<strong>{selectedCourse.name}</strong>
									<span
										>{selectedCourse.prerequisites.length
											? "Requiere " +
												selectedCourse.prerequisites
													.map((id) => byId.get(id)?.name)
													.join(", ")
											: "Sin prerrequisitos"}</span
									>
								</div>
							{/if}
							<div class="course-list">
								{#each visibleCourses as course (course.id)}
									<div class="course-row" class:chosen={selected === course.id}>
										<button
											type="button"
											class="course-select"
											aria-pressed={selected === course.id}
											onclick={() => selectCourse(course.id)}
										>
											<span class="course-id">{course.id}</span>
											<span class="course-info"
												><strong>{course.name}</strong
												><small
													>{course.credits}
													créditos · {course.prerequisites.length}
													{course.prerequisites.length === 1
														? "prerrequisito"
														: "prerrequisitos"}</small
												></span
											>
										</button>
										<button
											type="button"
											class="edit-button"
											aria-label={`Editar ${course.name}`}
											title="Editar asignatura"
											onclick={() => openEditor(course)}
										>
											✎
										</button>
									</div>
								{:else}
									<div class="empty list-empty">
										<strong
											>{search
												? "Sin coincidencias"
												: "Tu plan está vacío"}</strong
										>
										<p>
											{search
												? "Prueba con otro nombre o ID."
												: "Usa Nueva materia para empezar."}
										</p>
									</div>
								{/each}
							</div>
							<div class="data-actions">
								<button
									type="button"
									onclick={() =>
										requestReplacement(
											example,
											DEFAULT_LIMITS,
											"Ejemplo cargado.",
										)}
								>
									Cargar ejemplo
								</button>
								<button
									type="button"
									disabled={!courses.length}
									onclick={() => requestReplacement([], limits, "Plan vacío.")}
								>
									Vaciar plan
								</button>
							</div>
						</div>
					{:else if tab === "results"}
						<div class="side-body">
							{#if result}
								<div class="panel-heading list-heading">
									<div>
										<h2>Ruta por semestres</h2>
										<p>
											{result.semesters.length}
											{result.semesters.length === 1 ? "semestre" : "semestres"}
											· {courses.length} asignaturas
										</p>
									</div>
									<button
										type="button"
										class="button secondary compact"
										onclick={() => exportPlan("csv")}
									>
										↓ CSV
									</button>
								</div>
								<div class="result-status" class:estimated={!result.optimal}>
									<strong
										>{result.optimal
											? "Mínimo comprobado"
											: "Plan válido · mínimo sin confirmar"}</strong
									>
									{#if !result.optimal}
										<span
											>Cota inferior: {result.lowerBound}. La búsqueda alcanzó
											su límite.</span
										>
									{/if}
								</div>
								<div class="semester-list">
									{#each result.semesters as semester, index (index)}
										{@const credits = semester.reduce(
											(sum, id) => sum + (byId.get(id)?.credits ?? 0),
											0,
										)}
										<article
											class="semester"
											class:chosen={activeSemester === index}
										>
											<button
												type="button"
												class="semester-title"
												aria-pressed={activeSemester === index}
												onclick={() => {
													selected = null;
													activeSemester =
														activeSemester === index ? null : index;
												}}
											>
												<span
													><small>SEMESTRE</small
													><strong
														>{String(index + 1).padStart(2, "0")}</strong
													></span
												>
												<span
													>{semester.length}
													{semester.length === 1 ? "materia" : "materias"}
													·
													{credits}
													créditos</span
												>
											</button>
											<ul>
												{#each semester as id (id)}
													<li>
														<button
															type="button"
															onclick={() => showCourse(id)}
														>
															<small>{id}</small> {byId.get(id)?.name}
														</button>
													</li>
												{/each}
											</ul>
										</article>
									{/each}
								</div>
							{:else}
								<div class="empty list-empty">
									<strong>Tu ruta aparecerá aquí</strong>
									<p>Define el cupo y pulsa Calcular plan.</p>
								</div>
							{/if}
						</div>
					{:else}
						<div class="side-body">
							{#if import.meta.env.DEV}
								<div class="view-options">
									<button
										type="button"
										class="button secondary compact"
										aria-pressed={structureMode === "plan"}
										onclick={() => {
											selected = null;
											structureMode = "plan";
										}}
									>
										Planificación
									</button>
									<button
										type="button"
										class="button secondary compact"
										aria-pressed={structureMode === "java"}
										onclick={() => {
											selected = null;
											structureMode = "java";
										}}
									>
										Núcleo Java
									</button>
								</div>
							{/if}
							{#if structureMode === "java"}
								<div class="java-options">
									<p>
										La CLI Java usa hasta 20 créditos por semestre y aplica su
										propia heurística.
									</p>
									<div class="view-options">
										<button
											type="button"
											class="button secondary compact"
											disabled={javaBusy || !courses.length}
											onclick={() => runJava("0")}
										>
											Ejecutar lista
										</button>
										<button
											type="button"
											class="button secondary compact"
											disabled={javaBusy || !courses.length}
											onclick={() => runJava("1")}
										>
											Ejecutar heap + AVL
										</button>
									</div>
								</div>
								{#if javaBusy}
									<p class="java-message" aria-live="polite">
										Ejecutando el planificador Java…
									</p>
								{/if}
								{#if javaError}
									<p class="alert" role="alert">{javaError}</p>
								{/if}
								{#if javaTrace && frame}
									<div class="panel-heading list-heading">
										<div>
											<h2>{frame.structure}</h2>
											<p>Paso {traceIndex + 1} de {javaTrace.frames.length}</p>
										</div>
										<div class="step-buttons">
											<button
												type="button"
												class="button secondary compact"
												aria-label="Estado Java anterior"
												disabled={traceIndex === 0}
												onclick={() => {
													selected = null;
													traceIndex--;
												}}
											>
												←
											</button>
											<button
												type="button"
												class="button secondary compact"
												aria-label="Estado Java siguiente"
												disabled={traceIndex === javaTrace.frames.length - 1}
												onclick={() => {
													selected = null;
													traceIndex++;
												}}
											>
												→
											</button>
										</div>
									</div>
									<label class="trace-slider"
										>Ir al paso
										<input
											type="range"
											min="0"
											max={javaTrace.frames.length - 1}
											bind:value={traceIndex}
											oninput={() => (selected = null)}
										></label
									>
									{#if selectedCourse}
										<p class="course-detail">
											{selectedCourse.id}
											· {selectedCourse.name}
										</p>
									{/if}
									<details class="java-result">
										<summary>
											{javaTrace.semesters.length}
											semestres en la ruta Java
										</summary>
										<ol>
											{#each javaTrace.semesters as semester, index (index)}
												<li>
													{semester.map((id) => byId.get(id)?.name).join(", ")}
												</li>
											{/each}
										</ol>
									</details>
								{:else if !javaBusy && !javaError}
									<div class="empty list-empty">
										<strong>Consulta los estados internos de Java</strong>
										<p>Ejecuta lista o heap + AVL para recorrer la traza.</p>
									</div>
								{/if}
							{:else if step}
								<div class="panel-heading list-heading">
									<div>
										<h2>Evolución del plan</h2>
										<p>Semestre {stepIndex + 1} de {steps.length}</p>
									</div>
									<div class="step-buttons">
										<button
											type="button"
											class="button secondary compact"
											aria-label="Paso anterior"
											disabled={stepIndex === 0}
											onclick={() => {
												selected = null;
												stepIndex--;
											}}
										>
											←
										</button>
										<button
											type="button"
											class="button secondary compact"
											aria-label="Paso siguiente"
											disabled={stepIndex === steps.length - 1}
											onclick={() => {
												selected = null;
												stepIndex++;
											}}
										>
											→
										</button>
									</div>
								</div>
								<div class="steps-list">
									{#each [
										{ title: "Disponibles al inicio", ids: step.ready },
										{ title: "Seleccionadas", ids: step.selected },
										{ title: "Habilitadas al finalizar", ids: step.unlocked },
										{
											title: "Completadas hasta este semestre",
											ids: step.completed,
										},
									] as group (group.title)}
										<section class="step-group">
											<h3>{group.title} <small>{group.ids.length}</small></h3>
											{#if group.ids.length}
												<div class="chips">
													{#each group.ids as id (id)}
														<button
															type="button"
															aria-pressed={selected === id}
															onclick={() => selectCourse(id)}
														>
															{byId.get(id)?.name}
														</button>
													{/each}
												</div>
											{:else}
												<p>Ninguna.</p>
											{/if}
										</section>
									{/each}
								</div>
							{:else}
								<div class="empty list-empty">
									<strong>Explora la planificación paso a paso</strong>
									<p>
										Calcula el plan para ver qué asignaturas se habilitan en
										cada semestre.
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<form
						class="planner-controls"
						onsubmit={(event) => {
							event.preventDefault();
							runCalculation();
						}}
					>
						<div class="limit-row">
							<label
								>Máx. materias
								<input
									type="number"
									min="1"
									max={MAX_COURSES}
									required
									bind:value={courseLimit}
									oninput={() => queueMicrotask(syncLimits)}
								></label
							>
							<div class="credit-setting">
								<label class="check-label"
									><input
										type="checkbox"
										bind:checked={useCredits}
										onchange={() => queueMicrotask(syncLimits)}
									>
									Limitar créditos</label
								>
								{#if useCredits}
									<input
										type="number"
										aria-label="Máximo de créditos"
										min="1"
										max={MAX_CREDITS}
										required
										bind:value={creditLimit}
										oninput={() => queueMicrotask(syncLimits)}
									>
								{/if}
							</div>
						</div>
						<button
							type="submit"
							class="button primary calculate"
							disabled={!courses.length || calculating}
						>
							{calculating ? "Calculando…" : "Calcular plan"}
							<span aria-hidden="true">→</span>
						</button>
					</form>
				</section>
			{/snippet}
		</SplitPane>
	</div>
</div>

<dialog bind:this={editDialog} aria-labelledby="editor-title">
	<form class="dialog-content" onsubmit={saveCourse}>
		<div class="panel-heading">
			<div>
				<h2 id="editor-title">
					{editing === null ? "Nueva materia" : "Editar asignatura"}
				</h2>
				<p>Define sus datos y las asignaturas que requiere.</p>
			</div>
			<button
				type="button"
				class="close-button"
				aria-label="Cerrar"
				onclick={() => editDialog.close()}
			>
				×
			</button>
		</div>
		<label
			>Nombre
			<input
				required
				maxlength="100"
				placeholder="Ej. Cálculo diferencial"
				bind:this={editName}
				bind:value={editingName}
			></label
		>
		<div class="form-columns">
			<label
				>ID de la asignatura
				<input
					type="number"
					min="1"
					max={MAX_ID}
					required
					bind:value={editingId}
				></label
			>
			<label
				>Créditos
				<input
					type="number"
					min="1"
					max={MAX_CREDITS}
					required
					bind:value={editingCredits}
				></label
			>
		</div>
		<fieldset>
			<legend>
				Prerrequisitos
				<small>{editingPrerequisites.length} seleccionados</small>
			</legend>
			{#if courses.length > (editing === null ? 0 : 1)}
				<input
					type="search"
					aria-label="Filtrar prerrequisitos"
					placeholder="Buscar una asignatura"
					bind:value={prerequisiteSearch}
				>
				<div class="prerequisite-list">
					{#each candidates as candidate (candidate.id)}
						<label class="check-label"
							><input
								type="checkbox"
								checked={editingPrerequisites.includes(candidate.id)}
								onchange={(event) =>
									togglePrerequisite(candidate.id, event.currentTarget.checked)}
							>
							<span><small>{candidate.id}</small> {candidate.name}</span></label
						>
					{:else}
						<p>Sin coincidencias.</p>
					{/each}
				</div>
			{:else}
				<p>Agrega otras asignaturas para seleccionarlas aquí.</p>
			{/if}
		</fieldset>
		{#if editError}
			<p class="alert" role="alert">{editError}</p>
		{/if}
		{#if deleting}
			<p class="alert">
				Se quitará esta asignatura y las referencias a ella en otros
				prerrequisitos.
			</p>
			<div class="dialog-actions">
				<button
					type="button"
					class="button secondary"
					onclick={() => (deleting = false)}
				>
					Volver
				</button><button
					type="button"
					class="button danger"
					onclick={removeCourse}
				>
					Confirmar eliminación
				</button>
			</div>
		{:else}
			<div class="dialog-actions">
				{#if editing !== null}
					<button
						type="button"
						class="text-danger"
						onclick={() => (deleting = true)}
					>
						Eliminar
					</button>
				{/if}
				<button
					type="button"
					class="button secondary"
					onclick={() => editDialog.close()}
				>
					Cancelar
				</button>
				<button type="submit" class="button primary">Guardar asignatura</button>
			</div>
		{/if}
	</form>
</dialog>

<dialog bind:this={replaceDialog} aria-labelledby="replace-title">
	<div class="dialog-content">
		<div class="panel-heading">
			<div>
				<h2 id="replace-title">Reemplazar el plan actual</h2>
				<p>
					Esta acción sustituye las asignaturas registradas. Puedes exportar el
					plan primero para conservarlo.
				</p>
			</div>
		</div>
		<div class="dialog-actions">
			<button
				type="button"
				class="button secondary"
				onclick={() => replaceDialog.close()}
			>
				Cancelar
			</button><button
				type="button"
				class="button primary"
				onclick={applyReplacement}
			>
				Reemplazar plan
			</button>
		</div>
	</div>
</dialog>
