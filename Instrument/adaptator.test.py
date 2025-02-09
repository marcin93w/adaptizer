import unittest
from adaptator import Adaptator, InputType, TransformType
from parameterized import parameterized

class AdaptatorTests(unittest.TestCase):
    
    @parameterized.expand([
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_ON, 2, 0),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_ON, 3, 1),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_ON, 5, 1),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_ON, 6, 0),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_OFF, 2, 1),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_OFF, 3, 0),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_OFF, 5, 0),
        (0, 1, InputType.VOLUME, 3, 5, TransformType.BINARY_OFF, 6, 1),

        (0, 127, InputType.VOLUME, 0, 10, TransformType.LINEAR, 5, 64),
        (0, 127, InputType.VOLUME, 0, 10, TransformType.LINEAR, 0, 0),
        (0, 127, InputType.VOLUME, 0, 10, TransformType.LINEAR, 10, 127),
        (0, 127, InputType.VOLUME, 0, 10, TransformType.LINEAR, 1, 13),
        (60, 80, InputType.VOLUME, 0, 10, TransformType.LINEAR, 1, 62),
        (60, 80, InputType.VOLUME, 0, 10, TransformType.LINEAR, 9, 78),
        (0, 127, InputType.VOLUME, 0, 3, TransformType.LINEAR, 1, 42),
        (0, 127, InputType.VOLUME, 0, 3, TransformType.LINEAR, 3, 127),
        (0, 127, InputType.VOLUME, 0, 3, TransformType.LINEAR, 10, 127),
        (0, 127, InputType.VOLUME, 5, 10, TransformType.LINEAR, 5, 0),
        (0, 127, InputType.VOLUME, 5, 10, TransformType.LINEAR, 2, 0),
        (0, 127, InputType.VOLUME, 5, 10, TransformType.LINEAR, 9, 102),
        (100, 105, InputType.VOLUME, 5, 10, TransformType.LINEAR, 9, 104),
        (0, 1, InputType.VOLUME, 5, 6, TransformType.LINEAR, 5, 0),
        (0, 1, InputType.VOLUME, 5, 6, TransformType.LINEAR, 6, 1),
        
        (0, 127, InputType.VOLUME, 0, 10, TransformType.REVERSED_LINEAR, 5, 64),
        (0, 127, InputType.VOLUME, 0, 10, TransformType.REVERSED_LINEAR, 0, 127),
        (0, 127, InputType.VOLUME, 0, 10, TransformType.REVERSED_LINEAR, 10, 0),
        (0, 127, InputType.VOLUME, 0, 10, TransformType.REVERSED_LINEAR, 9, 13),
        (60, 80, InputType.VOLUME, 0, 10, TransformType.REVERSED_LINEAR, 1, 78),
        (60, 80, InputType.VOLUME, 0, 10, TransformType.REVERSED_LINEAR, 9, 62),
        (0, 127, InputType.VOLUME, 0, 3, TransformType.REVERSED_LINEAR, 1, 85),
        (0, 127, InputType.VOLUME, 0, 3, TransformType.REVERSED_LINEAR, 3, 0),
        (0, 127, InputType.VOLUME, 0, 3, TransformType.REVERSED_LINEAR, 10, 0),
        (0, 127, InputType.VOLUME, 5, 10, TransformType.REVERSED_LINEAR, 5, 127),
        (0, 127, InputType.VOLUME, 5, 10, TransformType.REVERSED_LINEAR, 2, 127),
        (0, 127, InputType.VOLUME, 5, 10, TransformType.REVERSED_LINEAR, 9, 25),
        (100, 105, InputType.VOLUME, 5, 10, TransformType.REVERSED_LINEAR, 9, 101),
        (0, 1, InputType.VOLUME, 5, 6, TransformType.REVERSED_LINEAR, 5, 1),
        (0, 1, InputType.VOLUME, 5, 6, TransformType.REVERSED_LINEAR, 6, 0)
    ])
    def test_adaptator_input_to_control_transform(self, min_in, max_in, input_type, min_out, max_out, transform_type, input_value, expected_value):
        adaptator = Adaptator()
        adaptator.add_control(1, min_in, max_in, input_type, min_out, max_out, transform_type)
        adaptator.set_input(input_type, input_value)
        control = adaptator.get_control_values()[0]
        self.assertEqual(control.value, expected_value)

if __name__ == '__main__':
    unittest.main()