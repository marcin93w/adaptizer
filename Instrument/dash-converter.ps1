param (
  [string]$exportPath,
  [int]$BPM
)

### Replace with path to shaka packager
$shakaPackagerPath = "C:\projects" 
###

$segmentDuration = 2 * (60 / $BPM)
Write-Output "Segment Duration: $segmentDuration"

cd $exportPath

ffmpeg -i 0.wav -map 0:a -c:a libopus -b:a 128k tmp0.webm
ffmpeg -i 1.wav -map 0:a -c:a libopus -b:a 128k tmp1.webm
ffmpeg -i 2.wav -map 0:a -c:a libopus -b:a 128k tmp2.webm
ffmpeg -i 3.wav -map 0:a -c:a libopus -b:a 128k tmp3.webm
ffmpeg -i 4.wav -map 0:a -c:a libopus -b:a 128k tmp4.webm
ffmpeg -i 5.wav -map 0:a -c:a libopus -b:a 128k tmp5.webm
ffmpeg -i 6.wav -map 0:a -c:a libopus -b:a 128k tmp6.webm
ffmpeg -i 7.wav -map 0:a -c:a libopus -b:a 128k tmp7.webm
ffmpeg -i 8.wav -map 0:a -c:a libopus -b:a 128k tmp8.webm
ffmpeg -i 9.wav -map 0:a -c:a libopus -b:a 128k tmp9.webm

& "$shakaPackagerPath\packager-win-x64.exe" `
  input=tmp0.webm,stream=audio,output=audio0_dash.webm `
  input=tmp1.webm,stream=audio,output=audio1_dash.webm `
  input=tmp2.webm,stream=audio,output=audio2_dash.webm `
  input=tmp3.webm,stream=audio,output=audio3_dash.webm `
  input=tmp4.webm,stream=audio,output=audio4_dash.webm `
  input=tmp5.webm,stream=audio,output=audio5_dash.webm `
  input=tmp6.webm,stream=audio,output=audio6_dash.webm `
  input=tmp7.webm,stream=audio,output=audio7_dash.webm `
  input=tmp8.webm,stream=audio,output=audio8_dash.webm `
  input=tmp9.webm,stream=audio,output=audio9_dash.webm `
  --segment_duration $segmentDuration `
  --mpd_output manifest.mpd

Remove-Item tmp*.webm