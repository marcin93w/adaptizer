# Converts the rendered .wav tracks into a DASH stream, the same way the Python
# instrument does with dash-converter.ps1.
param (
  [Parameter(Mandatory = $true)][string]$ExportPath,
  [Parameter(Mandatory = $true)][double]$Bpm,
  [Parameter(Mandatory = $true)][int]$TrackCount,
  [string]$PackagerPath = "packager-win-x64.exe",
  # Verifies the settings and the external tools without touching any file, so
  # the export can fail before it spends half an hour rendering the tracks
  [switch]$CheckToolsOnly
)

$ErrorActionPreference = "Stop"

# The UI shows only the tagged message, so neither the PowerShell error trace
# nor the ffmpeg log that also lands on stderr ends up in it
trap {
  [Console]::Error.WriteLine("ADAPTIZER_ERROR: " + $_.Exception.Message)
  exit 1
}

if ($Bpm -le 0) {
  throw "The tempo has to be greater than zero, but '$Bpm' was given."
}

if (-not (Get-Command "ffmpeg" -ErrorAction SilentlyContinue)) {
  throw "ffmpeg was not found. Please install ffmpeg and make sure it is available in the PATH."
}

if (-not (Get-Command $PackagerPath -ErrorAction SilentlyContinue)) {
  throw "Shaka packager was not found at '$PackagerPath'. Please select the packager executable in the export settings."
}

if ($CheckToolsOnly) {
  Write-Output "Conversion tools are available"
  exit 0
}

$segmentDuration = 2 * (60 / $Bpm)
Write-Output "Segment duration: $segmentDuration"

Set-Location -LiteralPath $ExportPath

$packagerInputs = @()
for ($trackIndex = 0; $trackIndex -lt $TrackCount; $trackIndex++) {
  $wavFile = "$trackIndex.wav"
  if (-not (Test-Path $wavFile)) {
    throw "Rendered track '$wavFile' is missing in $ExportPath."
  }

  Write-Output "Encoding $wavFile"
  ffmpeg -y -i $wavFile -map 0:a -c:a libopus -b:a 128k "tmp$trackIndex.webm"
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while encoding $wavFile."
  }

  $packagerInputs += "input=tmp$trackIndex.webm,stream=audio,output=audio${trackIndex}_dash.webm"
}

Write-Output "Packaging DASH stream"
& $PackagerPath @packagerInputs --segment_duration $segmentDuration --mpd_output manifest.mpd
if ($LASTEXITCODE -ne 0) {
  throw "Shaka packager failed while creating the DASH manifest."
}

Remove-Item tmp*.webm

Write-Output "DASH conversion complete"
