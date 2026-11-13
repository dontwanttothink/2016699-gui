<script lang="ts">
import licenses from "virtual:licenses";

type Component = (typeof licenses.components)[number];

const sections: { title: string; components: Component[] }[] = [
	{
		title: "Interfaz",
		components: licenses.components.filter((c) => c.ecosystem === "npm"),
	},
	{
		title: "Aplicación nativa",
		components: licenses.components.filter((c) => c.ecosystem === "cargo"),
	},
];
</script>

<main class="acknowledgements">
	<p class="intro">
		Esta aplicación incluye el siguiente software de terceros, distribuido bajo
		los términos de sus respectivas licencias.
	</p>

	{#each sections as section (section.title)}
		<section>
			<h2>
				{section.title} <span class="count">({section.components.length})</span>
			</h2>
			{#each section.components as component (`${component.name}@${component.version}`)}
				<details>
					<summary>
						<span class="name">{component.name}</span>
						<span class="version">{component.version}</span>
						<span class="license">{component.license}</span>
					</summary>
					<div class="body">
						{#if component.url}
							<p class="url">{component.url}</p>
						{/if}
						{#each component.texts as text (text)}
							<pre>{licenses.texts[text]}</pre>
						{:else}
							<p class="missing">
								Este paquete no incluye un archivo de licencia. Su licencia
								declarada es {component.license}.
							</p>
						{/each}
					</div>
				</details>
			{/each}
		</section>
	{/each}
</main>

<style>
.acknowledgements {
	max-width: 48rem;
	margin: 0 auto;
	padding: 1.5rem;
}

h2 {
	margin: 2rem 0 0.5rem;
	font-size: var(--font-size-lg);
}

.count {
	color: var(--subtle);
	font-weight: 400;
}

.intro {
	margin: 0;
	color: var(--muted);
}

details {
	border-bottom: 1px solid var(--border);
}

summary {
	display: flex;
	align-items: baseline;
	gap: 0.75rem;
	padding: 0.5rem 0;
	cursor: pointer;
}

.name {
	font-weight: 600;
	overflow-wrap: anywhere;
}

.version,
.license {
	font-size: var(--font-size-sm);
	color: var(--muted);
}

.license {
	margin-left: auto;
	text-align: right;
}

.body {
	padding: 0 0 0.75rem;
}

.url,
.missing {
	margin: 0 0 0.5rem;
	font-size: var(--font-size-sm);
	color: var(--muted);
	overflow-wrap: anywhere;
	user-select: text;
}

pre {
	margin: 0 0 0.75rem;
	padding: 0.75rem;
	border: 1px solid var(--border);
	border-radius: 0.5rem;
	background-color: var(--surface);
	font-family: ui-monospace, monospace;
	font-size: 0.75rem;
	line-height: 1.4;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	user-select: text;
}
</style>
