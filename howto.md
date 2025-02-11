## Prepare audio files
```
ffmpeg 
    -i 1_0.wav -i 1_1.wav -i 1_2.wav -i 1_3.wav -i 1_4.wav -i 1_5.wav -i 1_6.wav -i 1_7.wav -i 1_8.wav -i 1_9.wav 
    -map 0:a -map 1:a -map 2:a -map 3:a -map 4:a -map 5:a -map 6:a -map 7:a -map 8:a -map 9:a 
    -c:a libopus 
    -b:a 128k 
    -metadata:s:a:0 title="0" -metadata:s:a:1 title="1" -metadata:s:a:2 title="2" -metadata:s:a:3 title="3" -metadata:s:a:4 title="4" -metadata:s:a:5 title="5" -metadata:s:a:6 title="6" -metadata:s:a:7 title="7" -metadata:s:a:8 title="8" -metadata:s:a:9 title="9" 
    output.webm
```
```
.\packager-win-x64.exe `
  input=output.webm,stream=audio,output=audio0_dash.webm `
  input=output1.webm,stream=audio,output=audio1_dash.webm `
  input=output2.webm,stream=audio,output=audio2_dash.webm `
  input=output3.webm,stream=audio,output=audio3_dash.webm `
  input=output4.webm,stream=audio,output=audio4_dash.webm `
  input=output5.webm,stream=audio,output=audio5_dash.webm `
  input=output6.webm,stream=audio,output=audio6_dash.webm `
  input=output7.webm,stream=audio,output=audio7_dash.webm `
  input=output8.webm,stream=audio,output=audio8_dash.webm `
  input=output9.webm,stream=audio,output=audio9_dash.webm `
  --segment_duration 10 `
  --mpd_output manifest.mpd
```
