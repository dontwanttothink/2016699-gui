<script lang="ts">
import { Network } from "@lucide/svelte";
import { creditsLabel, type PlannedCourse } from "#lib/courseDraft.ts";
import { getPlanResult } from "#lib/planResult.svelte.ts";
import { openStructuresWindow } from "#lib/structuresWindow.ts";
import { goto } from "$app/navigation";

const plan = $derived(getPlanResult());

$effect(() => {
	if (plan === null) goto("/", { replaceState: true });
});

function totalCredits(semester: PlannedCourse[]): number {
	return semester.reduce((sum, course) => sum + course.credits, 0);
}
</script>

{#if plan}
	<main class="results">
		<header>
			<button type="button" onclick={() => goto("/")}>Volver</button>
			<button
				type="button"
				onclick={() => openStructuresWindow(plan.snapshots)}
			>
				<Network size={16} aria-hidden="true" />
				Ver estructuras
			</button>
		</header>
		<div class="semesters">
			{#each plan.semesters as semester, index (index)}
				<section class="semester">
					<h2>{index + 1}</h2>
					<ul class="courses">
						{#each semester as course (course.id)}
							<li class="course">
								<p class="course-name">{course.name}</p>
								<p class="course-meta">
									ID {course.id} · {creditsLabel(course.credits)}
								</p>
							</li>
						{/each}
					</ul>
					<p class="total">{creditsLabel(totalCredits(semester))}</p>
				</section>
			{/each}
		</div>
	</main>
{/if}

<style>
.results {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	height: 100vh;
}

header {
	display: flex;
	justify-content: space-between;
	padding: 1.5rem 1.5rem 0;
}

.semesters {
	flex: 1;
	min-height: 0;
	display: flex;
	gap: 1rem;
	overflow-x: auto;
	padding: 0.25rem 1.5rem 1.5rem;
}

.semester {
	flex: 0 0 14rem;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.semester h2 {
	margin: 0;
	font-size: var(--font-size-lg);
	text-align: center;
}

.courses {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin: 0;
	padding: 0.25rem;
	overflow-y: auto;
	list-style: none;
}

.course {
	padding: 0.6rem 0.8rem;
	border: 1px solid var(--border);
	border-radius: 0.75rem;
	background-color: var(--surface);
	box-shadow: var(--shadow);
}

.course-name {
	margin: 0;
	font-weight: 600;
	overflow-wrap: anywhere;
}

.course-meta {
	margin: 0;
	font-size: var(--font-size-sm);
	color: var(--muted);
}

.total {
	margin: 0;
	padding-top: 0.5rem;
	border-top: 1px solid var(--border);
	text-align: center;
	font-weight: 600;
}
</style>
