import * as Tone from 'tone';
import './PianoComponent.css';

declare global {
  interface Window {
    handlePianoNotePressed?: (note: number) => void;
  }
}

export default function PianoComponent() {
  const handleClick = async (note: number) => {
    // 启动音频上下文
    await Tone.start();

    // 创建一个合成器并连接到目的地（扬声器）
    const synth = new Tone.Synth().toDestination();

    // 将MIDI音符转换为音符名称（例如 C4, D#4 等）
    const noteName = Tone.Frequency(note, "midi").toNote();

    // 播放音符，时长为8分音符
    synth.triggerAttackRelease(noteName, "8n");

    // 如果全局对象 window 上存在 handlePianoNotePressed 函数，则调用它
    if (typeof window.handlePianoNotePressed === 'function') {
      window.handlePianoNotePressed(note);
    }
  };

  return (
    <div id="piano">
      {/* 创建12个钢琴键，假设每个键代表一个MIDI音符 */}
      {[...Array(12)].map((_, index) => {
        const note = 60 + index;  // 从 MIDI 音符 60 (C4) 开始
        const isWhiteKey = index % 2 === 0;  // 偶数索引为白键，奇数为黑键

        return (
          <div
            key={index}
            className={`key ${isWhiteKey ? 'white' : 'black'}`}
            onClick={() => handleClick(note)}
          >
            {/* 可以在每个键上显示音符名称，供调试或显示用途 */}
            {/* <span>{Tone.Frequency(note, "midi").toNote()}</span> */}
          </div>
        );
      })}
    </div>
  );
}
