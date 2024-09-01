import { ClassicPreset as Classic, GetSchemes, NodeEditor } from 'rete';
import { Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, ReactArea2D, Presets as ReactPresets } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';
import { DataflowEngine, DataflowNode } from 'rete-engine';
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin';
import { ContextMenuPlugin, ContextMenuExtra, Presets as ContextMenuPresets } from 'rete-context-menu-plugin';

const adsrSocket = new Classic.Socket('adsrSocket');

type Node = AttackNode | DecayNode | SustainNode | ReleaseNode | ADSRNode | VoiceNode | VOCNode | MonophonicKeyboardNode | LFONode | VCANode;
type Conn =
  | Connection<AttackNode, ADSRNode>
  | Connection<DecayNode, ADSRNode>
  | Connection<SustainNode, ADSRNode>
  | Connection<ReleaseNode, ADSRNode>
  | Connection<ADSRNode, VoiceNode>
  | Connection<VOCNode, VoiceNode>
  | Connection<LFONode, VoiceNode>
  | Connection<VCANode, VoiceNode>
  | Connection<MonophonicKeyboardNode, ADSRNode>;
type Schemes = GetSchemes<Node, Conn>;

class Connection<A extends Node, B extends Node> extends Classic.Connection<A, B> {}

class ADSRComponentNode extends Classic.Node implements DataflowNode {
  width = 180;
  height = 120;

  constructor(name: string, initial: number, change?: (value: number) => void) {
    super(name);
    this.addOutput('value', new Classic.Output(adsrSocket, 'Number'));
    this.addControl('value', new Classic.InputControl('number', { initial, change }));
  }

  data() {
    const value = (this.controls['value'] as Classic.InputControl<'number'>).value;
    return { value };
  }
}

class AttackNode extends ADSRComponentNode {
  constructor(initial: number, change?: (value: number) => void) {
    super('Attack', initial, change);
  }
}

class DecayNode extends ADSRComponentNode {
  constructor(initial: number, change?: (value: number) => void) {
    super('Decay', initial, change);
  }
}

class SustainNode extends ADSRComponentNode {
  constructor(initial: number, change?: (value: number) => void) {
    super('Sustain', initial, change);
  }
}

class ReleaseNode extends ADSRComponentNode {
  constructor(initial: number, change?: (value: number) => void) {
    super('Release', initial, change);
  }
}

class ADSRNode extends Classic.Node implements DataflowNode {
  width = 200;
  height = 280;

  constructor() {
    super('ADSR');
    this.addInput('attack', new Classic.Input(adsrSocket, 'Attack'));
    this.addInput('decay', new Classic.Input(adsrSocket, 'Decay'));
    this.addInput('sustain', new Classic.Input(adsrSocket, 'Sustain'));
    this.addInput('release', new Classic.Input(adsrSocket, 'Release'));
    this.addInput('alpha', new Classic.Input(adsrSocket, 'Alpha'));
    this.addOutput('signal', new Classic.Output(adsrSocket, 'Signal'));
  }

  data(inputs: { attack?: number[]; decay?: number[]; sustain?: number[]; release?: number[]; alpha?: number[] }) {
    const { attack = [], decay = [], sustain = [], release = [], alpha = [] } = inputs;

    const adsrData = {
      attack: attack[0] || 0,
      decay: decay[0] || 0,
      sustain: sustain[0] || 0,
      release: release[0] || 0,
      alpha: alpha[0] || 0
    };

    console.log('ADSR data:', adsrData);

    // 实时发送到后端
    fetch('http://localhost:5000/update_adsr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adsrData)
    })
      .then(response => response.json())
      .then(data => {
        console.log('Success:', data);
      })
      .catch((error) => {
        console.error('Error:', error);
      });

    return adsrData;
  }
}

class VoiceNode extends Classic.Node implements DataflowNode {
  width = 180;
  height = 195;

  constructor() {
    super('Voice');
    this.addInput('signal', new Classic.Input(adsrSocket, 'Signal'));
    this.addInput('voc', new Classic.Input(adsrSocket, 'VOC'));
  }

  data(inputs: { signal?: never[]; voc?: never[] }) {
    const { signal = [], voc = [] } = inputs;

    const voiceData = {
      signal: signal[0] || {},
      voc: voc[0] || {}
    };

    console.log('Voice data:', voiceData);

    return voiceData;
  }
}

class VOCNode extends Classic.Node implements DataflowNode {
  width = 200;
  height = 250;

  constructor() {
    super('VOC');
    this.addOutput('signal', new Classic.Output(adsrSocket, 'Signal'));
    this.addControl('tuning', new Classic.InputControl('number', { initial: 0 }));
    this.addControl('mod_depth', new Classic.InputControl('number', { initial: 0 }));
    this.addControl('initial_phase', new Classic.InputControl('number', { initial: 0 }));
  }

  data() {
    const tuning = (this.controls['tuning'] as Classic.InputControl<'number'>).value;
    const mod_depth = (this.controls['mod_depth'] as Classic.InputControl<'number'>).value;
    const initial_phase = (this.controls['initial_phase'] as Classic.InputControl<'number'>).value;

    return {
      tuning,
      mod_depth,
      initial_phase
    };
  }
}

class MonophonicKeyboardNode extends Classic.Node implements DataflowNode {
  width = 200;
  height = 200;

  constructor() {
    super('MonophonicKeyboard');
    this.addControl('midi_f0', new Classic.InputControl('number', { initial: 0 }));
    this.addControl('note_on_duration', new Classic.InputControl('number', { initial: 0 }));
    this.addOutput('note_on_duration', new Classic.Output(adsrSocket, 'Number'));
  }

  data() {
    const midi_f0 = (this.controls['midi_f0'] as Classic.InputControl<'number'>).value;
    const note_on_duration = (this.controls['note_on_duration'] as Classic.InputControl<'number'>).value;

    return {
      midi_f0,
      note_on_duration
    };
  }
}

class VCANode extends Classic.Node implements DataflowNode {
  width = 180;
  height = 150;

  constructor() {
    super('VCA');
    this.addInput('cv', new Classic.Input(adsrSocket, 'CV Input')); // 控制电压输入
    this.addOutput('amplified_signal', new Classic.Output(adsrSocket, 'Amplified Signal'));
    this.addControl('gain', new Classic.InputControl('number', { initial: 1 })); // 增益
  }

  data(inputs: { cv?: number[] }) {
    const cv = inputs.cv?.[0] || 0;
    const gain = (this.controls['gain'] as Classic.InputControl<'number'>).value ?? 1;

    return {
      amplified_signal: cv * gain, // 放大后的信号
      gain
    };
  }
}

// LFONode 类
class LFONode extends Classic.Node implements DataflowNode {
  width = 200;
  height = 180;

  constructor() {
    super('LFO');
    this.addOutput('modulation_signal', new Classic.Output(adsrSocket, 'Modulation Signal'));
    this.addControl('frequency', new Classic.InputControl('number', { initial: 5 })); // 频率
    this.addControl('amplitude', new Classic.InputControl('number', { initial: 1 })); // 振幅
  }

  data() {
    const frequency = (this.controls['frequency'] as Classic.InputControl<'number'>).value;
    const amplitude = (this.controls['amplitude'] as Classic.InputControl<'number'>).value;

    return {
      modulation_signal: {}, // 输出调制信号
      frequency,
      amplitude
    };
  }
}

export function handlePianoNotePressed(note: number) {
  console.log('Note received in TypeScript:', note);

  fetch('/play_note', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ note })
  })
    .then(response => response.json())
    .then(data => {
      console.log('Note played successfully:', data);
    })
    .catch(error => {
      console.error('Error playing note:', error);
    });
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
(window as unknown).handlePianoNotePressed = handlePianoNotePressed;

type AreaExtra = Area2D<Schemes> | ReactArea2D<Schemes> | ContextMenuExtra;

export async function createEditor(container: HTMLElement) {
  console.log('createEditor called with container:', container);
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: ContextMenuPresets.classic.setup([
      ['Attack', () => new AttackNode(0.1, process)],
      ['Decay', () => new DecayNode(0.2, process)],
      ['Sustain', () => new SustainNode(0.7, process)],
      ['Release', () => new ReleaseNode(0.3, process)],
      ['ADSR', () => new ADSRNode()],
      ['Voice', () => new VoiceNode()],
      ['VOC', () => new VOCNode()],
      ['LFO', () => new LFONode()],
      ['VCA', () => new VCANode()],
      ['MonophonicKeyboard', () => new MonophonicKeyboardNode()]
    ]),
  });

  editor.use(area);
  area.use(reactRender);
  area.use(connection);
  area.use(contextMenu);

  connection.addPreset(ConnectionPresets.classic.setup());
  reactRender.addPreset(ReactPresets.classic.setup());
  reactRender.addPreset(ReactPresets.contextMenu.setup());

  const dataflow = new DataflowEngine<Schemes>();
  editor.use(dataflow);

  let attackNode = new AttackNode(0.1, process);
  let decayNode = new DecayNode(0.2, process);
  let sustainNode = new SustainNode(0.7, process);
  let releaseNode = new ReleaseNode(0.3, process);
  const adsrNode = new ADSRNode();
  const voiceNode = new VoiceNode();
  const vocNode = new VOCNode();
  const vcaNode = new VCANode();
  const lfoNode = new LFONode();
  const keyboardNode = new MonophonicKeyboardNode();

  await editor.addNode(attackNode);
  await editor.addNode(decayNode);
  await editor.addNode(sustainNode);
  await editor.addNode(releaseNode);
  await editor.addNode(adsrNode);
  await editor.addNode(voiceNode);
  await editor.addNode(vocNode);
  await editor.addNode(vcaNode);
  await editor.addNode(lfoNode);
  await editor.addNode(keyboardNode);

  await editor.addConnection(new Connection(attackNode, 'value', adsrNode, 'attack'));
  await editor.addConnection(new Connection(decayNode, 'value', adsrNode, 'decay'));
  await editor.addConnection(new Connection(sustainNode, 'value', adsrNode, 'sustain'));
  await editor.addConnection(new Connection(releaseNode, 'value', adsrNode, 'release'));
  await editor.addConnection(new Connection(adsrNode, 'signal', voiceNode, 'ADSR'));
  await editor.addConnection(new Connection(vocNode, 'signal', voiceNode, 'VOC'));
  await editor.addConnection(new Connection(vcaNode, 'signal', voiceNode, 'VCA'));
  await editor.addConnection(new Connection(lfoNode, 'signal', voiceNode, 'LFO'));
  await editor.addConnection(new Connection(keyboardNode, 'note_on_duration', adsrNode, 'alpha'));

  const arrange = new AutoArrangePlugin<Schemes>();
  arrange.addPreset(ArrangePresets.classic.setup());
  area.use(arrange);
  await arrange.layout();

  AreaExtensions.zoomAt(area, editor.getNodes());
  AreaExtensions.simpleNodesOrder(area);

  const selector = AreaExtensions.selector();
  const accumulating = AreaExtensions.accumulateOnCtrl();
  AreaExtensions.selectableNodes(area, selector, { accumulating });

  //--------------------------------------------------------
  //communication with backend
  async function sendToBackend(adsrData: { attack: number; decay: number; sustain: number; release: number; alpha: number }) {
  try {
    console.log('Sending data to backend:', adsrData); // 调试信息
    const response = await fetch('http://localhost:5000/update_adsr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adsrData)
    });

    const data = await response.json();
    console.log('Backend response:', data);
  } catch (error) {
    console.error('Error sending data to backend:', error);
  }
}
async function process() {
  // 从各个节点获取数据
  const attackValue = attackNode.data().value ?? 0;
  const decayValue = decayNode.data().value ?? 0;
  const sustainValue = sustainNode.data().value ?? 0;
  const releaseValue = releaseNode.data().value ?? 0;
  const alphaValue = keyboardNode.data().note_on_duration ?? 0;

  // 将收集到的数据发送到后端
  const adsrData = {
    attack: attackValue,
    decay: decayValue,
    sustain: sustainValue,
    release: releaseValue,
    alpha: alphaValue
  };

  await sendToBackend(adsrData);
}

  attackNode = new AttackNode(0.1, () => process());
  decayNode = new DecayNode(0.2, () => process());
  sustainNode = new SustainNode(0.7, () => process());
  releaseNode = new ReleaseNode(0.3, () => process());

// 每次输入变化时触发 `process()` 函数，确保数据实时发送
editor.addPipe((context) => {
  if (context.type === 'connectioncreated' || context.type === 'connectionremoved') {
    process();
  }
  return context;
});

process();
  return {
    destroy: () => area.destroy(),
  };
}
