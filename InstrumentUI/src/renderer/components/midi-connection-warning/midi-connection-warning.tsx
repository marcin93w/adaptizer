import React, { useEffect, useState } from 'react';
import MidiService from '../../services/midi-service';
import { MidiPort } from '../../services/midi-port';
import './midi-connection-warning.scss';

// The port is a prop so a test can drive the warning with a port it controls. The default is
// evaluated at render time, so production callers need no edits and no module-eval-time global
// is touched under jsdom.
export const MidiConnectionWarning: React.FC<{ midiPort?: MidiPort }> = ({ midiPort = MidiService }) => {
  const [isOutputMissing, setIsOutputMissing] = useState(midiPort.isOutputMissing());

  const checkPort = () => {
    midiPort.requestMIDIAccess().then(() => {
      setIsOutputMissing(midiPort.isOutputMissing());
    });
  };

  useEffect(checkPort, [midiPort]);

  return isOutputMissing ? (
    <div className="warning-container">
      <span>There is no MIDI port named <b>Adaptizer</b>. Please follow the instructions in the README to setup loopMIDI interface.</span>
      <button
        onClick={checkPort}
        className="refresh-button"
        aria-label="Check for the Adaptizer MIDI port again"
      >
        ⟳
      </button>
    </div>
  ) : null;
};
