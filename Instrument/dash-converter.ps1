param (
  [int]$BPM
)

$segmentDuration = 2 * (60 / $BPM)
Write-Output "Segment Duration: $segmentDuration"

ffmpeg -i 0.wav -map 0:a -c:a libopus -b:a 128k output0.webm
ffmpeg -i 1.wav -map 0:a -c:a libopus -b:a 128k output1.webm
ffmpeg -i 2.wav -map 0:a -c:a libopus -b:a 128k output2.webm
ffmpeg -i 3.wav -map 0:a -c:a libopus -b:a 128k output3.webm
ffmpeg -i 4.wav -map 0:a -c:a libopus -b:a 128k output4.webm
ffmpeg -i 5.wav -map 0:a -c:a libopus -b:a 128k output5.webm
ffmpeg -i 6.wav -map 0:a -c:a libopus -b:a 128k output6.webm
ffmpeg -i 7.wav -map 0:a -c:a libopus -b:a 128k output7.webm
ffmpeg -i 8.wav -map 0:a -c:a libopus -b:a 128k output8.webm
ffmpeg -i 9.wav -map 0:a -c:a libopus -b:a 128k output9.webm

.\packager-win-x64.exe `
  input=output0.webm,stream=audio,output=audio0_dash.webm `
  input=output1.webm,stream=audio,output=audio1_dash.webm `
  input=output2.webm,stream=audio,output=audio2_dash.webm `
  input=output3.webm,stream=audio,output=audio3_dash.webm `
  input=output4.webm,stream=audio,output=audio4_dash.webm `
  input=output5.webm,stream=audio,output=audio5_dash.webm `
  input=output6.webm,stream=audio,output=audio6_dash.webm `
  input=output7.webm,stream=audio,output=audio7_dash.webm `
  input=output8.webm,stream=audio,output=audio8_dash.webm `
  input=output9.webm,stream=audio,output=audio9_dash.webm `
  --segment_duration $segmentDuration `
  --mpd_output manifest.mpd