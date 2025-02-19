import React, { useEffect, useState } from 'react';
import MidiService from '../../services/midi-service';
import './midi-connection-warning.scss';

export const MidiConnectionWarning: React.FC = () => {
  const [isOutputMissing, setIsOutputMissing] = useState(MidiService.isOutputMissing());

  useEffect(() => {
    MidiService.requestMIDIAccess().then(() => {
      setIsOutputMissing(MidiService.isOutputMissing());
    });
  }, []);

  return isOutputMissing ? (
    <div className="warning-container">
      <span>There is no MIDI port named <b>Adaptizer</b>. Please follow the instructions in the README to setup loopMIDI interface.</span>
      <button 
        onClick={() => {
          MidiService.requestMIDIAccess().then(() => {
            setIsOutputMissing(MidiService.isOutputMissing());
          });
        }}
        className="refresh-button"
      >
        ⟳
      </button>
    </div>
  ) : null;
};
