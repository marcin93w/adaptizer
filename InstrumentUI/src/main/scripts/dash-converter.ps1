# Converts the rendered .wav tracks into a DASH stream, the same way the Python
# instrument does with dash-converter.ps1.
param (
  [Parameter(Mandatory = $true)][string]$ExportPath,
  [Parameter(Mandatory = $true)][int]$Bpm,
  [Parameter(Mandatory = $true)][int]$TrackCount,
  [string]$PackagerPath = "packager-win-x64.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command "ffmpeg" -ErrorAction SilentlyContinue)) {
  throw "ffmpeg was not found. Please install ffmpeg and make sure it is available in the PATH."
}

if (-not (Get-Command $PackagerPath -ErrorAction SilentlyContinue)) {
  throw "Shaka packager was not found at '$PackagerPath'. Please select the packager executable in the export settings."
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
