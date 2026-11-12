param([Parameter(Mandatory = $true)][string]$ApkPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = Get-Item -LiteralPath (Resolve-Path -LiteralPath $ApkPath)
$archive = [System.IO.Compression.ZipFile]::OpenRead($apk.FullName)
try {
  $bundle = $archive.GetEntry('assets/index.android.bundle')
  $manifest = $archive.GetEntry('AndroidManifest.xml')
  $dex = @($archive.Entries | Where-Object FullName -Match '^classes\d*\.dex$')
  $native = @($archive.Entries | Where-Object FullName -Match '^lib/arm64-v8a/.*\.so$')
  if (-not $bundle -or $bundle.Length -eq 0 -or -not $manifest -or $dex.Count -eq 0 -or $native.Count -eq 0) { throw 'APK incompleto: faltam bundle, manifesto, dex ou bibliotecas ARM64.' }
  $stream = $manifest.Open(); $memory = [System.IO.MemoryStream]::new()
  try { $stream.CopyTo($memory); $bytes = $memory.ToArray() } finally { $stream.Dispose(); $memory.Dispose() }
  $packageFound = [Text.Encoding]::UTF8.GetString($bytes).Contains('com.elo.app') -or [Text.Encoding]::Unicode.GetString($bytes).Contains('com.elo.app')
  if (-not $packageFound) { throw 'Identificador com.elo.app nao encontrado no manifesto.' }
  [pscustomobject]@{ apk = $apk.Name; bytes = $apk.Length; package = 'com.elo.app'; bundledJavaScriptBytes = $bundle.Length; dexFiles = $dex.Count; arm64Libraries = $native.Count; sha256 = (Get-FileHash -LiteralPath $apk.FullName -Algorithm SHA256).Hash } | ConvertTo-Json
} finally { $archive.Dispose() }
