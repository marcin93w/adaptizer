#include <JuceHeader.h>

class VirtualMidiDevice
{
public:
    VirtualMidiDevice()
    {
        auto devices = juce::MidiOutput::getAvailableDevices();

        if (!devices.isEmpty())
        {
            midiOutput = juce::MidiOutput::openDevice(devices[1].identifier);
            if (midiOutput)
                std::cout << "Connected to MIDI device: " + devices[1].name << std::endl;
        }
        else
        {
            std::cout << "No MIDI output devices found!" << std::endl;
        }
    }

    ~VirtualMidiDevice() { midiOutput.reset(); }

    void sendMidiNote(int value)
    {
        if (midiOutput)
        {
            juce::MidiMessage signal = juce::MidiMessage::controllerEvent(1, 1, value);
            midiOutput->sendMessageNow(signal);

            std::cout << "Signal sent" << std::endl;
        }
    }

private:
    std::unique_ptr<juce::MidiOutput> midiOutput;
};

int readConsoleInputNumber()
{
    int input;
    std::cin >> input;
    return input;
}

int main()
{
    juce::ConsoleApplication app;
    VirtualMidiDevice virtualMidi;
	bool isSignalValue;

	do 
    {
		std::cout << "Press enter value: ";
		int value = readConsoleInputNumber();

		isSignalValue = value >= 0 && value <= 127;
		if (isSignalValue)
            virtualMidi.sendMidiNote(value);
	
    } while (isSignalValue);

    return 0;
}
