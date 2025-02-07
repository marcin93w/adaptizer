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
                std::cout << "Connected to MIDI device: " + devices[1].name;
        }
        else
        {
            std::cout << "No MIDI output devices found!";
        }
    }

    ~VirtualMidiDevice() { midiOutput.reset(); }

    void sendMidiNote()
    {
        if (midiOutput)
        {
            juce::MidiMessage noteOn = juce::MidiMessage::noteOn(1, 60, (juce::uint8)100);
            midiOutput->sendMessageNow(noteOn);

            std::cout << "MIDI Note Sent: C4 (60)";
        }
    }

private:
    std::unique_ptr<juce::MidiOutput> midiOutput;
};

int main()
{
    juce::ConsoleApplication app;
    VirtualMidiDevice virtualMidi;

    std::cout << "Press enter to send";
    std::cin.get();

    virtualMidi.sendMidiNote();

    std::cout << "Press enter to exit";
    std::cin.get();

    return 0;
}
