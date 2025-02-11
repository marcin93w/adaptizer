import mido
from adaptizer import Adaptizer, InputType

adaptizer = Adaptizer()

output_names = mido.get_output_names()
outport_name = next((name for name in output_names if name.lower().startswith('adaptizer')), None)

if outport_name:
    outport = mido.open_output(outport_name)
else:
    raise RuntimeError("No MIDI output found for Adaptizer")

print("Adaptizer controller commands: 🎹")
print("-- Configure controls using 'cc <controlTypeNumber> <minValue> <maxValue> <inputType>'")
print("-- Set input values using 'set <inputType> <value>'")
print("-- Send test signal to assign mapping in DAW 'assign <controlTypeNumber>'")
print("-- Save config 'save <fileName>'")
print("-- Load config 'load <fileName>'")
print("-- Exit using 'e' ")

while True:
    user_input = input("Enter command: ")

    if user_input.lower() == "e":
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

        control_values = adaptizer.get_control_values()
        for control_value in control_values:
            cc_message = mido.Message('control_change', control=control_value.typeNumber, value=control_value.value, channel=1)
            outport.send(cc_message)
            print(f"Sent MIDI CC value: {control_value.value} as type: {control_value.typeNumber}")

    if user_input.startswith("assign"):
        _, controlTypeNumber = user_input.split(" ")
        cc_message = mido.Message('control_change', control=int(controlTypeNumber), value=100, channel=1)
        outport.send(cc_message)
        print(f"Sent MIDI CC value 100 as type: {controlTypeNumber}")

    if user_input.startswith("save"):
        _, filename = user_input.split(" ")
        adaptizer.save_to_file(filename)
        print(f"Saved config to file: {filename}")

    if user_input.startswith("load"):
        _, filename = user_input.split(" ")
        adaptizer.load_from_file(filename)
        print(f"Loaded config from file: {filename}")

print("Goodbye! 🎹")