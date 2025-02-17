import React, { useEffect, useState } from 'react';
import MidiService from './midi-service';

export const MidiConnectionWarning: React.FC = () => {
  const [isOutputMissing, setIsOutputMissing] = useState(MidiService.isOutputMissing());

  useEffect(() => {
    MidiService.requestMIDIAccess().then(() => {
      setIsOutputMissing(MidiService.isOutputMissing());
    });
  }, []);

  return isOutputMissing ? (
    <div style={{
      backgroundColor: '#fff3cd',
      color: '#856404',
      padding: '1rem',
      border: '1px solid #ffeeba',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
        <span>There is no MIDI port named <b>Adaptizer</b>. Please follow the instructions in the README to setup loopMIDI interface.</span>
        <button 
            onClick={() => {
                MidiService.requestMIDIAccess().then(() => {
                    setIsOutputMissing(MidiService.isOutputMissing());
                });
            }}
            style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#856404',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: '1rem'
            }}
        >
            ⟳
        </button>
    </div>
  ) : null;
};
