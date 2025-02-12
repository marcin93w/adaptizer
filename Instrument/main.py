from adaptizer import Adaptizer, InputType
from ableton_exporter import AbletonExporter
from exporter import Exporter
from midi_controller import MidiController

adaptizer = Adaptizer()
midi_controller = MidiController()

print("Adaptizer controller commands: 🎹")
print("-- Configure controls using 'cc <controlTypeNumber> <minValue> <maxValue> <inputType>'")
print("-- Set input values using 'set <inputType> <value>'")
print("-- Send test signal to assign mapping in DAW 'assign <controlTypeNumber>'")
print("-- Save config 'save <fileName>'")
print("-- Load config 'load <fileName>'")
print("-- Export Ableton project 'e <outputPath>'")
print("-- Exit using 'q' ")

try:
    while True:
        user_input = input("Enter command: ")

        if user_input.lower() == "q":
            print("Exiting MIDI control...")
            break

        if user_input.startswith("cc"):
            _, controlTypeNumber, minValue, maxValue, inputType = user_input.split(" ")
            adaptizer.add_control(int(controlTypeNumber), int(minValue), int(maxValue), InputType[inputType.upper()])
            print(f"Added control: {controlTypeNumber} {minValue} {maxValue} {inputType}")

        if user_input.startswith("set"):
            _, inputType, value = user_input.split(" ")
            adaptizer.set_input(InputType[inputType.upper()], int(value))
            print(f"Set input: {inputType} {value}")
            midi_controller.send_control_values(adaptizer.get_control_values())

        if user_input.startswith("assign"):
            _, controlTypeNumber = user_input.split(" ")
            midi_controller.send_assign_signal(controlTypeNumber)

        if user_input.startswith("save"):
            _, filename = user_input.split(" ")
            adaptizer.save_to_file(filename)
            print(f"Saved config to file: {filename}")

        if user_input.startswith("load"):
            _, filename = user_input.split(" ")
            adaptizer.load_from_file(filename)
            print(f"Loaded config from file: {filename}")

        if user_input.startswith("e"):
            _, outputPath = user_input.split(" ")
            exporter = Exporter(adaptizer, AbletonExporter(), midi_controller)
            exporter.export(outputPath)

finally:
    midi_controller.close()
    print("Goodbye! 🎹")