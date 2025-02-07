import mido

outport = mido.open_output(mido.get_output_names()[1])

print("Enter MIDI CC values (0-127). Type 'exit' to quit.")

while True:
    user_input = input("Enter MIDI CC value: ")

    if user_input.lower() == "exit":
        print("Exiting MIDI control...")
        break

    if user_input.isdigit():
        cc_value = int(user_input)
        cc_value = max(0, min(127, cc_value))

        cc_message = mido.Message('control_change', control=1, value=cc_value, channel=1)
        outport.send(cc_message)

        print(f"Sent MIDI CC value: {cc_value}")
    else:
        print("Invalid input! Enter a number (0-127) or 'exit'.")

print("Goodbye! 🎹")