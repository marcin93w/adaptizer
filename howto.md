## Prepare audio files
`ffmpeg -i track-a.wav -i track-b.wav -map 0:a -map 1:a -c:a libopus -b:a 128k -metadata:s:a:0 title="Track 1" -metadata:s:a:1 title="Track 2" output.webm`
