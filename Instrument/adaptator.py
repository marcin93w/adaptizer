from dataclasses import dataclass
from enum import Enum
from typing import List, Dict

class InputType(Enum):
    VOLUME = 1

class TransformType(Enum):
    LINEAR = 1
    REVERSED_LINEAR = 2
        
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

class Adaptator:
    def __init__(self):
        self.controls: List[ControlConfig] = []
        self.inputs: Dict[InputType, int] = {InputType.VOLUME: 0}

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

    def _calculate_control_value(self, control):
        input_value = self.inputs[control.inputType]
        limited_input = max(control.minInput, min(control.maxInput, input_value))
        normalized_input = (limited_input - control.minInput) / (control.maxInput - control.minInput)
        return int(round(control.minValue + normalized_input * (control.maxValue - control.minValue)))
    
    def save_to_file(self, filename):
        with open(filename, "w") as file:
            for control in self.controls:
                file.write(f"{control.controlTypeNumber} {control.minValue} {control.maxValue} {control.inputType.name} {control.minInput} {control.maxInput} {control.transformType.name}\n")

    def load_from_file(self, filename):
        with open(filename, "r") as file:
            for line in file:
                controlTypeNumber, minValue, maxValue, inputType, minInput, maxInput, transformType = line.strip().split(" ")
                self.add_control(int(controlTypeNumber), int(minValue), int(maxValue), inputType, int(minInput), int(maxInput), transformType)