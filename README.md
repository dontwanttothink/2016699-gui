La interfaz gráfica para el proyecto sobre [planear graduaciones para 2016699](https://github.com/dontwanttothink/2016699).

Para más información sobre el proyecto en general, véase ese repositorio.

## Este repositorio

El código aquí es una interfaz gráfica en Tauri que llama al CLI implementado en el repositorio principal.

## Compilación

Se debe suministrar la imagen nativa del programa de Java que vive en el otro repositorio. Para compilarla, se necesita un JDK de GraalVM.

Por ejemplo:

```sh
cd 2016699
./gradlew nativeCompile
mkdir ../2016699-gui/src-tauri/binaries
cp app/build/native/nativeCompile/graduation \
	../2016699-gui/src-tauri/binaries/graduation-$(rustc -vV | sed -n 's/^host: //p')
```

O en Windows PowerShell:

```powershell
cd 2016699
.\gradlew.bat nativeCompile
$triple = (rustc -vV | Select-String '^host: (.*)').Matches[0].Groups[1].Value
Copy-Item app\build\native\nativeCompile\graduation.exe `
	"..\2016699-gui\src-tauri\binaries\graduation-$triple.exe"
```

Tauri exige que el binario lleve como sufijo la tripla de la plataforma.
(Digamos, `graduation-aarch64-apple-darwin`.) Los comandos anteriores usan la tripla de la computadora actual.

### Ícono en macOS

Puede que `pnpm tauri build` falle con el mensaje `failed to run actool ... Bad file descriptor`. En ese caso, usar el siguiente wrapper debería ayudar:

```sh
PATH="$PWD/scripts/macos:$PATH" pnpm tauri build --bundles app
```

Si ya falló un intento sin el wrapper, hay que reiniciar el daemon de `ibtool` antes de reintentar: `killall ibtoold`.
