# Ejecuta la prueba de carga en modo consola (sin GUI) y genera el reporte HTML de JMeter
# Uso: .\ejecutar.ps1 -Usuarios 50 -Iteraciones 5 -Rampa 10 -Proyecto labtrack-2be73 -HostWeb labtrack-2be73.web.app
# Requiere JAVA_HOME (JDK 17+) y JMETER_HOME (carpeta de apache-jmeter-5.6.3)
param(
  [int]$Usuarios = 50,
  [int]$Iteraciones = 5,
  [int]$Rampa = 10,
  [string]$Proyecto = "labtrack-2be73",
  [string]$HostWeb = "labtrack-2be73.web.app",
  [string]$Salida = (Join-Path $PSScriptRoot "resultados"),
  [string]$Plan = "labtrack_catalogo.jmx"
)
$jmeterHome = if ($env:JMETER_HOME) { $env:JMETER_HOME } else { Resolve-Path "..\..\..\apache-jmeter-5.6.3\apache-jmeter-5.6.3" }
$java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { "java" }
$carpeta = Join-Path $Salida "$Usuarios-usuarios"
if (Test-Path $carpeta) { Remove-Item -Recurse -Force $carpeta }
New-Item -ItemType Directory -Force "$carpeta\temp" | Out-Null

Push-Location $PSScriptRoot
& $java -jar "$jmeterHome\bin\ApacheJMeter.jar" -n -t "$Plan" `
  "-Jusuarios=$Usuarios" "-Jiteraciones=$Iteraciones" "-Jrampa=$Rampa" `
  "-Jproyecto=$Proyecto" "-Jhost=$HostWeb" `
  "-Jjmeter.reportgenerator.temp_dir=$carpeta\temp" `
  -l "$carpeta\resultados.jtl" -j "$carpeta\jmeter.log" -e -o "$carpeta\reporte"
Pop-Location
