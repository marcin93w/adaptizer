from adaptizer import Adaptizer
from ableton_exporter import AbletonExporter
from midi_controller import MidiController
import os
import time

class Exporter:
    def __init__(self, adaptizer: Adaptizer, dawExporter: AbletonExporter, midiController: MidiController):
        self.adaptizer = adaptizer
        self.dawExporter = dawExporter
        self.midiController = midiController

    def export(self, output_path: str, bpm: int):
        (trackIndex, totalTracks) = self.adaptizer.start_export()
        while trackIndex <= totalTracks:
            self.midiController.send_control_values(self.adaptizer.get_control_values())
            
            self.dawExporter.export(output_path + "\\" + f"{trackIndex}.wav")
            self._wait_for_output_file(output_path, trackIndex)

            print(f"Exporting track {trackIndex} of {totalTracks} completed.")
            
            (trackIndex, totalTracks) = self.adaptizer.continue_export()

        self._convert_to_dash(output_path, bpm)
        print("Export complete. Host manifest.mpd in the same directory with all .webm files.")

    def _wait_for_output_file(self, output_path: str, trackIndex: int):
        while not os.path.exists(output_path + "\\" + f"{trackIndex}.wav"):
            time.sleep(2)

    def _convert_to_dash(self, output_path: str, BPM: int):
        print("Converting WAV files to DASH format...")
        os.system(f'powershell -File "dash-converter.ps1" {output_path} {BPM}')
        print("DASH conversion complete.")
