import { ClassicPreset as Classic, GetSchemes, NodeEditor } from 'rete';
import { Area2D, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin } from 'rete-connection-plugin';
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin';
import { ContextMenuPlugin, Presets as ContextMenuPresets } from 'rete-context-menu-plugin';



// 定义 socket
const adsrSocket = new Classic.Socket('adsrSocket');

// 定义 DataflowNode 接口
interface DataflowNode {
  data: () => ADSRNode;
}
class ADSRNode extends Classic.Node {
  constructor() {
    super('ADSR');
// 定义 ADSRData 类型
type ADSRData = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  alpha: number;
  signal:number;
};

// 定义 Node 和 Connection 的类型
type Node = ADSRNode | VOCNode | MonophonicKeyboardNode;
type Conn = Connection<ADSRNode, VOCNode> | Connection<MonophonicKeyboardNode, ADSRNode>;
type Schemes = GetSchemes<Node, Conn>;

// 自定义连接类
class Connection<A extends Node, B extends Node> extends Classic.Connection<A, B> {}

// 定义 ADSRNode 类
class ADSRNode extends Classic.Node {
  width = 200;
  height = 400;

  private controlNames: { [key: string]: Classic.InputControl<'number'> };

  constructor() {
    super('ADSR');

    this.controlNames = {};

    // 添加用户输入控制项并保存到映射中
    this.controlNames['attack'] = new Classic.InputControl<'number'>('number',{ initial: 0 });
    this.addControl('attack',this.controlNames['attack']); // 假设第二个参数是可选的或允许传递 null


    this.controlNames['decay'] = new Classic.InputControl<'number'>('number', { initial: 0 });
    this.addControl('decay',this.controlNames['decay']);

    this.controlNames['sustain'] = new Classic.InputControl<'number'>('number', { initial: 0 });
    this.addControl('sustain',this.controlNames['suatain']);

    this.controlNames['release'] = new Classic.InputControl<'number'>('number', { initial: 0 });
   this.addControl('release',this.controlNames['release']);

    this.controlNames['alpha'] = new Classic.InputControl<'number'>('number', { initial: 0 });
    this.addControl('alpha',this.controlNames['alpha']);

    // 添加用于连接其他节点的输出接口，将处理后的数据传递给下一个节点
    this.addOutput(new Classic.Output(adsrSocket,'signal'));

  }
  // 实现数据流处理方法
  data() {
    const attack = this.controlNames['attack']?.value || 0;
    const decay = this.controlNames['decay']?.value || 0;
    const sustain = this.controlNames['sustain']?.value || 0;
    const release = this.controlNames['release']?.value || 0;
    const alpha = this.controlNames['alpha']?.value || 0;

    const adsrData = { attack, decay, sustain, release, alpha };

    console.log('ADSR data:', adsrData);

    // 将数据发送到服务器
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
      .catch(error => {
        console.error('Error:', error);
      });

    return adsrData;
  }
}

// 定义 VOCNode 类
class VOCNode extends Classic.Node implements DataflowNode {
  width = 200;
  height = 250;

  constructor() {
    super('VOC');

    // 添加用于连接其他节点的输入接口
    this.addInput(new Classic.Input(adsrSocket, 'Signal'));

    // 输出处理后的信号
    this.addOutput(new Classic.Output(adsrSocket, 'Processed Signal'));
  }

  data(inputs: { signal?: ADSRData[] }) {
    const { signal = [] } = inputs;
    const vocData = signal[0] || { attack: 0, decay: 0, sustain: 0, release: 0, alpha: 0 };

    console.log('VOC received ADSR data:', vocData);

    // 这里可以进一步处理 vocData 或发送到服务器
    fetch('http://localhost:5000/process_voc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(vocData)
    })
      .then(response => response.json())
      .then(data => {
        console.log('VOC processed successfully:', data);
      })
      .catch(error => {
        console.error('Error processing VOC:', error);
      });

    return vocData;
  }
}

// 定义 MonophonicKeyboardNode 类
class MonophonicKeyboardNode extends Classic.Node implements DataflowNode {
  width = 200;
  height = 200;

  constructor() {
    super('MonophonicKeyboard');

    // 添加用户输入控制项
    this.addControl(new Classic.InputControl<'number'>('number', { initial: 0 }));
    this.addControl(new Classic.InputControl<'number'>('number', { initial: 0 }));

    // 输出音符时长信息
    this.addOutput(new Classic.Output(adsrSocket, 'Note Signal'));
  }

  data() {
    const midi_f0 = (this.controls[0] as Classic.InputControl<'number'>)?.value || 0;
    const note_on_duration = (this.controls[1] as Classic.InputControl<'number'>)?.value || 0;

    const keyboardData = { midi_f0, note_on_duration };

    console.log('Keyboard data:', keyboardData);

    // 将键盘输入数据发送到服务器
    fetch('http://localhost:5000/process_keyboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(keyboardData)
    })
      .then(response => response.json())
      .then(data => {
        console.log('Keyboard processed successfully:', data);
      })
      .catch(error => {
        console.error('Error processing keyboard:', error);
      });

    return keyboardData;
  }
}

// 创建编辑器的函数
export async function createEditor(container: HTMLElement) {
  console.log('createEditor called with container:', container);

  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, Area2D<Schemes>>(container);
  const connection = new ConnectionPlugin<Schemes, Area2D<Schemes>>();

  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: ContextMenuPresets.classic.setup([
      ['ADSR', () => new ADSRNode()],
      ['VOC', () => new VOCNode()],
      ['MonophonicKeyboard', () => new MonophonicKeyboardNode()]
    ]),
  });

  editor.use(area);
  area.use(connection);
  area.use(contextMenu);

  connection.addPreset(ConnectionPresets.classic.setup());

  // 初始化节点
  const adsr = new ADSRNode();
  const voc = new VOCNode();
  const keyboard = new MonophonicKeyboardNode();

  await editor.addNode(adsr);
  await editor.addNode(voc);
  await editor.addNode(keyboard);

  // 创建连接，将 ADSR 的 signal 输出连接到 VOC 的输入
  await editor.addConnection(new Connection(adsr, 'Signal', voc, 'Signal'));

  // 将键盘信号连接到 ADSR 的 alpha 输入
  await editor.addConnection(new Connection(keyboard, 'Note Signal', adsr, 'alpha'));

  // 布局和显示设置
  const arrange = new AutoArrangePlugin<Schemes>();
  arrange.addPreset(ArrangePresets.classic.setup());
  area.use(arrange);
  await arrange.layout();

  Area2D.zoomAt(area, editor.getNodes());

  // 返回编辑器实例
  return {
    destroy: () => area.destroy(),
  };
}
