param(
    [Parameter(Mandatory = $true)]
    [string] $CorePath
)

$ErrorActionPreference = 'Stop'
$core = (Resolve-Path -LiteralPath $CorePath).Path
$project = Split-Path -Parent $PSScriptRoot
$javaBuild = Join-Path $project '.svelte-kit\graduation-java'
$classes = Join-Path $javaBuild ([guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $classes -Force | Out-Null
try {
    $sources = foreach ($module in @('structures', 'algorithm', 'app')) {
        $folder = Join-Path $core "$module\src\main\java"
        Get-ChildItem -LiteralPath $folder -Filter '*.java' -Recurse |
            Where-Object { $_.Name -ne 'module-info.java' } |
            Select-Object -ExpandProperty FullName
    }
    & javac -encoding UTF-8 -d $classes @sources
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación. Comprueba que javac corresponda al JDK 25.' }

    $jarPath = Join-Path $javaBuild 'graduation.jar'
    & jar --create --file $jarPath --main-class co.edu.unal.bog2016699.graduation.app.App -C $classes .
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el JAR de Graduación UNAL.' }
    Write-Output $jarPath
} finally {
    if ((Resolve-Path -LiteralPath $classes).Path -eq $classes -and
        $classes.StartsWith($javaBuild + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $classes -Recurse -Force
    }
}
