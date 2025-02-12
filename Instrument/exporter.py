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

    def export(self, output_path: str):
        trackIndex = self.adaptizer.start_export()
        while True:
            self.midiController.send_control_values(self.adaptizer.get_control_values())
            
            self.dawExporter.export(output_path + "\\" + f"{trackIndex}.wav")
            self.wait_for_output_file(output_path, trackIndex)
            
            (anyTrackLeft, trackIndex, totalTracks) = self.adaptizer.continue_export()

            print(f"Exporting track {trackIndex} of {totalTracks} completed.")

            if not anyTrackLeft:  
                break

    def wait_for_output_file(self, output_path: str, trackIndex: int):
        while not os.path.exists(output_path + "\\" + f"{trackIndex}.wav"):
            time.sleep(2)

