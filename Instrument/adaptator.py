from dataclasses import dataclass
from enum import Enum
from typing import List, Dict

class InputType(Enum):
    VOLUME = 1
        
@dataclass
class ControlConfig:
    controlTypeNumber: int
    minValue: int
    maxValue: int
    inputType: InputType

@dataclass
class ControlValue:
    typeNumber: int
    value: int

class Adaptator:
    def __init__(self):
        self.controls: List[ControlConfig] = []
        self.inputs: Dict[InputType, int] = {InputType.VOLUME: 0}

    def add_control(self, controlTypeNumber, minValue, maxValue, inputType):
        self.controls.append(ControlConfig(controlTypeNumber, minValue, maxValue, InputType[inputType.upper()]))

    def set_input(self, inputType, value):
        self.inputs[InputType[inputType.upper()]] = value

    def get_control_values(self) -> List[ControlValue]:
        return [ControlValue(control.controlTypeNumber, self._calculate_control_value(control)) for control in self.controls]

    def _calculate_control_value(self, control):
        input_value = self.inputs[control.inputType]
        return int(round(control.minValue + (input_value / 10) * (control.maxValue - control.minValue)))