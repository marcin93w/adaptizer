import mido
from adaptator import Adaptator

adaptator = Adaptator()

output_names = mido.get_output_names()
outport_name = next((name for name in output_names if name.lower().startswith('adaptator')), None)

if outport_name:
    outport = mido.open_output(outport_name)
else:
    raise RuntimeError("No MIDI output found for Adaptator")

print("Adaptator controller commands: 🎹")
print("-- Configure controls using 'cc <controlTypeNumber> <minValue> <maxValue> <inputType>'")
print("-- Set input values using 'set <inputType> <value>'")
print("-- Exit using 'e' ")

while True:
    user_input = input("Enter command: ")

    if user_input.lower() == "e":
        print("Exiting MIDI control...")
        break

    if user_input.startswith("cc"):
        _, controlTypeNumber, minValue, maxValue, inputType = user_input.split(" ")
        adaptator.add_control(int(controlTypeNumber), int(minValue), int(maxValue), inputType)
        print(f"Added control: {controlTypeNumber} {minValue} {maxValue} {inputType}")

    if user_input.startswith("set"):
        _, inputType, value = user_input.split(" ")
        adaptator.set_input(inputType, int(value))
        print(f"Set input: {inputType} {value}")

        control_values = adaptator.get_control_values()
        for control_value in control_values:
            cc_message = mido.Message('control_change', control=control_value.typeNumber, value=control_value.value, channel=1)
            outport.send(cc_message)
            print(f"Sent MIDI CC value: {control_value.value}")

print("Goodbye! 🎹")