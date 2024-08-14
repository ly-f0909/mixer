import * as Tone from 'tone';
import React from 'react';
import './PianoComponent.css';

const PianoComponent: React.FC = () => {
  const handleClick = (note: number) => {
    const adsrParams = {
      attack: 0.1, // 可根据UI动态调整
      decay: 0.2,
      sustain: 0.7,
      release: 0.3,
      midi_note: note
    };

    // 发送音符和ADSR参数到后端生成音频
    fetch('/generate_audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adsrParams),
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        // 创建音频对象并播放
        const audio = new Audio(data.url);
        audio.play();
      } else {
        console.error('Failed to generate audio:', data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
  };

  const whiteKeyNotes = [0, 2, 4, 5, 7, 9, 11]; // 白键MIDI note的相对位置
  const blackKeyNotes = [1, 3, null, 6, 8, 10, null]; // 黑键MIDI note的相对位置

  return (
    <div id="piano">
      {whiteKeyNotes.map((offset, index) => {
        const note = 60 + offset;
        return (
          <div
            key={`white-${index}`}
            className="key white"
            onClick={() => handleClick(note)}
          >
            <span>{Tone.Frequency(note, 'midi').toNote()}</span>
          </div>
        );
      })}
      {blackKeyNotes.map((offset, index) => {
        if (offset !== null) {
          const note = 60 + offset;
          return (
            <div
              key={`black-${index}`}
              className="key black"
              onClick={() => handleClick(note)}
            >
              <span>{Tone.Frequency(note, 'midi').toNote()}</span>
            </div>
          );
        } else {
          return <div key={`spacer-${index}`} className="spacer" style={{ width: '50px' }} />;
        }
      })}
    </div>
  );
};

export default PianoComponent;
