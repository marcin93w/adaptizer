import mido
from adaptizer import InputType

class MidiController:
    def __init__(self):
        self.outport = self._initialize_midi_output()

    def _initialize_midi_output(self):
        output_names = mido.get_output_names()
        outport_name = next((name for name in output_names if name.lower().startswith('adaptizer')), None)

        if outport_name:
            return mido.open_output(outport_name)
        else:
            raise RuntimeError("No MIDI output found for Adaptizer")

    def send_control_values(self, control_values):
        for control_value in control_values:
            cc_message = mido.Message(
                'control_change', 
                control=control_value.typeNumber, 
                value=control_value.value, 
                channel=1
            )
            self.outport.send(cc_message)
            print(f"Sent MIDI CC value: {control_value.value} as type: {control_value.typeNumber}")

    def send_assign_signal(self, control_type_number):
        cc_message = mido.Message(
            'control_change', 
            control=int(control_type_number), 
            value=100, 
            channel=1
        )
        self.outport.send(cc_message)
        print(f"Sent MIDI CC value 100 as type: {control_type_number}")

    def close(self):
        if hasattr(self, 'outport'):
            self.outport.close() 