<script lang="ts">
import "../app.css";
import { listen } from "@tauri-apps/api/event";
import { onMount } from "svelte";
import { loadCoursesFile } from "#lib/loadCourses.ts";

const { children } = $props();

onMount(() => {
	const unlisten = listen("load-courses", loadCoursesFile);
	return () => {
		unlisten.then((stop) => stop());
	};
});
</script>

{@render children()}
