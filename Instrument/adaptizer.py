from dataclasses import dataclass
from enum import Enum
from typing import List, Dict

class InputType(Enum):
    INTENSITY = 1

class TransformType(Enum):
    BINARY_ON = 1
    BINARY_OFF = 2
    LINEAR = 3
    REVERSED_LINEAR = 4
        
@dataclass
class ControlConfig:
    controlTypeNumber: int
    minValue: int
    maxValue: int
    inputType: InputType
    minInput: int
    maxInput: int
    transformType: TransformType

@dataclass
class ControlValue:
    typeNumber: int
    value: int

class Adaptizer:
    def __init__(self):
        self.controls: List[ControlConfig] = []
        self.inputs: Dict[InputType, int] = {InputType.INTENSITY: 0}

    def add_control(self, controlTypeNumber, minValue, maxValue, inputType, minInput, maxInput, transformType):
        for existing_control in self.controls:
            if existing_control.controlTypeNumber == controlTypeNumber:
                self.controls.remove(existing_control)
        self.controls.append(
            ControlConfig(controlTypeNumber, minValue, maxValue, inputType, minInput, maxInput, transformType))

    def set_input(self, inputType, value):
        self.inputs[inputType] = value

    def get_control_values(self) -> List[ControlValue]:
        return [ControlValue(control.controlTypeNumber, self._calculate_control_value(control)) for control in self.controls]

    def _calculate_control_value(self, control: ControlConfig):
        input_value = self.inputs[control.inputType]
        
        if control.transformType == TransformType.BINARY_ON:
            return control.maxValue if input_value >= control.minInput and input_value <= control.maxInput else control.minValue
        if control.transformType == TransformType.BINARY_OFF:
            return control.minValue if input_value >= control.minInput and input_value <= control.maxInput else control.maxValue

        limited_input = max(control.minInput, min(control.maxInput, input_value))
        normalized_input = (limited_input - control.minInput) / (control.maxInput - control.minInput)
        
        if control.transformType == TransformType.REVERSED_LINEAR:
            normalized_input = 1 - normalized_input
        
        return int(round(control.minValue + normalized_input * (control.maxValue - control.minValue)))
    
    def save_to_file(self, filename):
        with open(filename, "w") as file:
            for control in self.controls:
                file.write(f"{control.controlTypeNumber} {control.minValue} {control.maxValue} {control.inputType.name} {control.minInput} {control.maxInput} {control.transformType.name}\n")

    def load_from_file(self, filename):
        with open(filename, "r") as file:
            for line in file:
                controlTypeNumber, minValue, maxValue, inputType, minInput, maxInput, transformType = line.strip().split(" ")
                self.add_control(int(controlTypeNumber), int(minValue), int(maxValue), InputType[inputType.upper()], int(minInput), int(maxInput), TransformType[transformType.upper()])

    def start_export(self) -> tuple[int, int]:
        self.inputs[InputType.INTENSITY] = 0
        return 0, 9

    def continue_export(self) -> tuple[bool, int, int]:
        self.inputs[InputType.INTENSITY] += 1
        trackIndex = self.inputs[InputType.INTENSITY]
        return (trackIndex, 9)