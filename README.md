# Graduación UNAL

Interfaz gráfica del proyecto de [Estructuras de Datos 2016699](https://github.com/dontwanttothink/2016699). Usa SvelteKit y Graphviz y puede abrirse en el navegador o en la ventana de Tauri.

## Ejecutar en Windows

Desde la carpeta de la interfaz, con Node.js 24 y pnpm 10:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run dev
```

Abre [http://127.0.0.1:1420](http://127.0.0.1:1420). Puedes calcular el plan de ejemplo de inmediato o agregar tus propias asignaturas. La interfaz guarda el plan y los cupos en este navegador. Exporta JSON para moverlo a otro equipo, TXT para usarlo con Java y CSV para guardar el resultado por semestre.

El botón **Calcular plan** aplica un cupo de materias y, si lo activas, un cupo de créditos. El cálculo se ejecuta en un Web Worker. Usa cotas por cupos y por longitud de la cadena de prerrequisitos, y busca por estados de asignaturas completadas. Si alcanza su presupuesto de búsqueda, muestra una ruta válida con su cota inferior e indica que falta confirmar el mínimo.

## Ejecutar las estructuras Java

Para usar **Estructuras → Núcleo Java**, instala JDK 25 y ten una copia del [repositorio principal](https://github.com/dontwanttothink/2016699). Desde la carpeta de la GUI, ajusta la ruta si tu repositorio principal está en otro lugar:

```powershell
$env:GRADUACION_JAVA_JAR = powershell.exe -NoProfile -File .\scripts\build-java.ps1 -CorePath ..\2016699
if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar el núcleo Java." }
pnpm.cmd run dev
```

La interfaz pasa el plan a la entrada estándar de la CLI original y dibuja la salida de `--verbose`. **Ejecutar lista** usa `--algorithm 0`. **Ejecutar heap + AVL** usa `--algorithm 1`. Ambos usan el cupo fijo de 20 créditos de la CLI actual. La traza muestra únicamente la información emitida por Java. Los estados de lista y AVL imprimen aristas, por lo que un estado sin aristas puede incluir una raíz o materias aisladas que Java no imprime.

El modo Java usa el servidor local de desarrollo. El editor, el grafo de prerrequisitos y el planificador de la interfaz también funcionan en la compilación estática.

## Verificar y compilar

```powershell
pnpm.cmd run check
pnpm.cmd run build
```

Con Rust y las dependencias de [Tauri para Windows](https://v2.tauri.app/start/prerequisites/), detén Vite antes de ejecutar `pnpm.cmd run tauri dev`.
