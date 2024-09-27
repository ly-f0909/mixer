import {ClassicPreset as Classic, GetSchemes, NodeEditor} from 'rete';
import {Area2D, AreaExtensions, AreaPlugin} from 'rete-area-plugin';
import {ConnectionPlugin, Presets as ConnectionPresets} from 'rete-connection-plugin';
import {ReactPlugin, ReactArea2D, Presets as ReactPresets} from 'rete-react-plugin';
import {createRoot} from 'react-dom/client';
import {DataflowEngine, DataflowNode} from 'rete-engine';
import {AutoArrangePlugin, Presets as ArrangePresets} from 'rete-auto-arrange-plugin';
import {ContextMenuPlugin, ContextMenuExtra, Presets as ContextMenuPresets} from 'rete-context-menu-plugin';

const adsrSocket = new Classic.Socket('adsrSocket');
const noiseSocket = new Classic.Socket('noiseSocket');
const vcaSocket = new Classic.Socket('vcaSocket');
// node and connection
type Node =
    AttackNode
    | DecayNode
    | SustainNode
    | ReleaseNode
    | ADSRNode
    | MixerNode
    | VCONode
    | MonophonicKeyboardNode
    | NoiseNode
    | VCANode;

class Connection<A extends Node, B extends Node> extends Classic.Connection<A, B> {
}

type Conn =
    | Connection<MonophonicKeyboardNode, ADSRNode>
    | Connection<AttackNode, ADSRNode>
    | Connection<DecayNode, ADSRNode>
    | Connection<SustainNode, ADSRNode>
    | Connection<ReleaseNode, ADSRNode>
    | Connection<ADSRNode, VCONode>
    | Connection<NoiseNode, VCONode>
    | Connection<VCANode, VCONode>
    | Connection<VCONode, MixerNode>;
type Schemes = GetSchemes<Node, Conn>;


class AttackNode extends Classic.Node implements DataflowNode {
    width = 180;
    height = 120;

    constructor(initial: number, change?: (value: number) => void) {
        super('Attack');
        this.addOutput('attackOutput', new Classic.Output(adsrSocket, 'Number'));
        this.addControl('value', new Classic.InputControl('number', {initial, change}));
    }

    data() {
        const value: number | undefined = (this.controls['value'] as Classic.InputControl<'number'>).value;
        return {value};
    }

}

class DecayNode extends Classic.Node implements DataflowNode {
    width = 180;
    height = 120;

    constructor(initial: number, change?: (value: number) => void) {
        super('Decay');
        this.addOutput('decayOutput', new Classic.Output(adsrSocket, 'Number'));
        this.addControl('value', new Classic.InputControl('number', {initial, change}));

    }

    data() {
        const value: number | undefined = (this.controls['value'] as Classic.InputControl<'number'>).value;
        return {value};
    }


}

class SustainNode extends Classic.Node implements DataflowNode {
    width = 180;
    height = 120;

    constructor(initial: number, change?: (value: number) => void) {
        super('Sustain');
        this.addOutput('sustainOutput', new Classic.Output(adsrSocket, 'Number'));
        this.addControl('value', new Classic.InputControl('number', {initial, change}));


    }

    data() {
        const value: number | undefined = (this.controls['value'] as Classic.InputControl<'number'>).value;
        return {value};
    }


}

class ReleaseNode extends Classic.Node implements DataflowNode {
    width = 180;
    height = 120;

    constructor(initial: number, change?: (value: number) => void) {
        super('Release');
        this.addOutput('releaseOutput', new Classic.Output(adsrSocket, 'Number'));
        this.addControl('value', new Classic.InputControl('number', {initial, change}));
    }

    data() {
        const value: number | undefined = (this.controls['value'] as Classic.InputControl<'number'>).value;
        return {value};
    }

}

class ADSRNode extends Classic.Node implements DataflowNode {
    width = 200;
    height = 280;

    constructor() {
        super('ADSR');
        this.addInput('inputFromAttack', new Classic.Input(adsrSocket, 'Attack'));
        this.addInput('inputFromDecay', new Classic.Input(adsrSocket, 'Decay'));
        this.addInput('inputFromSustain', new Classic.Input(adsrSocket, 'Sustain'));
        this.addInput('inputFromRelease', new Classic.Input(adsrSocket, 'Release'));
        this.addInput('inputFromKeyboard', new Classic.Input(adsrSocket, 'input'));
        this.addOutput('adsrOutput', new Classic.Output(adsrSocket, 'Signal'));
    }
    data() {
        const value = 1;
        return {value};
    }

}

class MixerNode extends Classic.Node implements DataflowNode {
    width = 180;
    height = 140;

    constructor() {
        super('Mixer');
        this.addInput('inputFromVco', new Classic.Input(adsrSocket, 'Signal'));
    }

    data(inputs: { signal?: never[]; voc?: never[] }) {
        const {signal = [], voc = []} = inputs;

        const voiceData = {
            signal: signal[0] || {},
            voc: voc[0] || {}
        };

        console.log('Voice data:', voiceData);

        return voiceData;
    }

}

class VCONode extends Classic.Node implements DataflowNode {
    width = 200;
    height = 250;

    constructor() {
        super('VCO');
        this.addOutput('vcoOutput', new Classic.Output(adsrSocket, 'Signal'));
        this.addInput('inputFromAdsr', new Classic.Input(adsrSocket, 'adsr'));
        this.addInput('inputFromVca', new Classic.Input(vcaSocket, 'vca'));
        this.addInput('inputFromNoise', new Classic.Input(noiseSocket, 'noise'));

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
    height = 120;

    constructor() {
        super('MonophonicKeyboard');
        this.addOutput('keyboardOutput', new Classic.Output(adsrSocket, 'note_on_duration'));
    }

    data() {
        const value: number | undefined = 1;
        return {value};
    }

}

class VCANode extends Classic.Node implements DataflowNode {
    width = 180;
    height = 150;

    constructor(initial: number, change?: (value: number) => void) {
        super('VCA');
        this.addOutput('vcaOutput', new Classic.Output(vcaSocket, 'vca'));
        this.addControl('value', new Classic.InputControl('number', {initial, change})); // 增益
    }

    data() {
        const value: number | undefined = (this.controls['value'] as Classic.InputControl<'number'>).value;
        return {value};
    }

}

class NoiseNode extends Classic.Node implements DataflowNode {
    width = 200;
    height = 180;

    constructor(initial: number, change?: (value: number) => void) {
        super('Noise');
        this.addOutput('noiseOutput', new Classic.Output(noiseSocket, 'seed'));
        this.addControl('value', new Classic.InputControl('number', {initial, change})); // 振幅
    }

    data() {
        const value: number | undefined = (this.controls['value'] as Classic.InputControl<'number'>).value;
        return {value};
    }

}

export function handlePianoNotePressed(note: number) {
    console.log('Note received in TypeScript:', note);

    fetch('/play_note', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({note})
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


//---------------------------------------------------------
// the core function
export async function createEditor(container: HTMLElement) {
    console.log('createEditor called with container:', container);
    const editor = new NodeEditor<Schemes>();
    const area = new AreaPlugin<Schemes, AreaExtra>(container);
    const connection = new ConnectionPlugin<Schemes, AreaExtra>();
    const reactRender = new ReactPlugin<Schemes, AreaExtra>({createRoot});

    const contextMenu = new ContextMenuPlugin<Schemes>({
        items: ContextMenuPresets.classic.setup([
            ['Attack', () => new AttackNode(0, () => process)],
            ['Decay', () => new DecayNode(0, () => process)],
            ['Sustain', () => new SustainNode(0, () => process)],
            ['Release', () => new ReleaseNode(0, () => process)],
            ['ADSR', () => new ADSRNode()],
            ['Mixer', () => new MixerNode()],
            ['VCO', () => new VCONode()],
            ['Noise', () => new NoiseNode(1, process)],
            ['VCA', () => new VCANode(1, process)],
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

    const attackNode = new AttackNode(0, process);
    const decayNode = new DecayNode(0, process);
    const sustainNode = new SustainNode(0, process);
    const releaseNode = new ReleaseNode(0, process);
    const noiseNode = new NoiseNode(1, process);
    const vcaNode = new VCANode(1, process);
    const adsrNode = new ADSRNode();
    const mixerNode = new MixerNode();
    const vcoNode = new VCONode();
    const keyboardNode = new MonophonicKeyboardNode();


    await editor.addNode(attackNode);
    await editor.addNode(decayNode);
    await editor.addNode(sustainNode);
    await editor.addNode(releaseNode);
    await editor.addNode(adsrNode);
    await editor.addNode(mixerNode);
    await editor.addNode(vcoNode);
    await editor.addNode(vcaNode);
    await editor.addNode(noiseNode);
    await editor.addNode(keyboardNode);

    await editor.addConnection(new Connection(attackNode, 'attackOutput', adsrNode, 'inputFromAttack'));
    await editor.addConnection(new Connection(decayNode, 'decayOutput', adsrNode, 'inputFromDecay'));
    await editor.addConnection(new Connection(sustainNode, 'sustainOutput', adsrNode, 'inputFromSustain'));
    await editor.addConnection(new Connection(releaseNode, 'releaseOutput', adsrNode, 'inputFromRelease'));
    await editor.addConnection(new Connection(adsrNode, 'adsrOutput', vcoNode, 'inputFromAdsr'));
    await editor.addConnection(new Connection(vcoNode, 'vcoOutput', mixerNode, 'inputFromVco'));
    await editor.addConnection(new Connection(vcaNode, 'vcaOutput', vcoNode, 'inputFromVca'));
    await editor.addConnection(new Connection(noiseNode, 'noiseOutput', vcoNode, 'inputFromNoise'));
    await editor.addConnection(new Connection(keyboardNode, 'keyboardOutput', adsrNode, 'inputFromKeyboard'));

    const arrange = new AutoArrangePlugin<Schemes>();
    arrange.addPreset(ArrangePresets.classic.setup({spacing: 80}));
    area.use(arrange);
    await arrange.layout();
    AreaExtensions.zoomAt(area, editor.getNodes());
    AreaExtensions.simpleNodesOrder(area);

    const selector = AreaExtensions.selector();
    const accumulating = AreaExtensions.accumulateOnCtrl();
    AreaExtensions.selectableNodes(area, selector, {accumulating});

    //--------------------------------------------------------
    //communication with backend
    async function sendToBackend(Data: {
        attack: number;
        decay: number;
        sustain: number;
        release: number;
        keyboard: number;
        vca: number;
        noise: number
    }) {
        try {
            console.log('Sending data to backend:', Data); // 调试信息
            const response = await fetch('http://localhost:5000/update_adsr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Data)
            });

            const data = await response.json();
            console.log('Backend response:', data);
        } catch (error) {
            console.error('Error sending data to backend:', error);
        }
    }

    async function process() {

        // First test if connection is established
        // console.log(editor.getConnections())

        interface Conns {
            sourceOutput: string;
            targetInput: string;
            // 其他属性如 id, source, target 等，可以根据需要添加
        }

        function isConnectionExist(
            connections: Conns[],
            sourceOutput: string,
            targetInput: string
        ): boolean {
            return connections.some(
                (conn) => conn.sourceOutput === sourceOutput && conn.targetInput === targetInput
            );
        }

        // 从各个节点获取数据
        let attackValue = attackNode.data().value ?? 0;
        let decayValue = decayNode.data().value ?? 0;
        let sustainValue = sustainNode.data().value ?? 0;
        let releaseValue = releaseNode.data().value ?? 0;
        let keyboardValue = keyboardNode.data().value ?? 0;
        let vcaValue = vcaNode.data().value ?? 0;
        let noiseValue = noiseNode.data().value ?? 0;
        // console.log('调试信息 attack'+attackNode.data().value);
        // console.log('调试信息 vca'+vcaNode.data().value);
        // 将收集到的数据发送到后端
        const connections: Conns[] = editor.getConnections(); // 确保 getConnections() 返回的类型匹配
        if (!isConnectionExist(connections, 'attackOutput', 'inputFromAttack') || !isConnectionExist(connections, 'adsrOutput', 'inputFromAdsr')) {
            attackValue = NaN;
        }
        if (!isConnectionExist(connections, 'decayOutput', 'inputFromDecay') || !isConnectionExist(connections, 'adsrOutput', 'inputFromAdsr')) {
            decayValue = NaN;
        }
        if (!isConnectionExist(connections, 'sustainOutput', 'inputFromSustain') || !isConnectionExist(connections, 'adsrOutput', 'inputFromAdsr')) {
            sustainValue = NaN;
        }
        if (!isConnectionExist(connections, 'releaseOutput', 'inputFromRelease') || !isConnectionExist(connections, 'adsrOutput', 'inputFromAdsr')) {
            releaseValue = NaN;
        }
        if (!isConnectionExist(connections, 'keyboardOutput', 'inputFromKeyboard') || !isConnectionExist(connections, 'adsrOutput', 'inputFromAdsr') || !isConnectionExist(connections, 'vcoOutput', 'inputFromVco')) {
            keyboardValue = NaN;
        }
        if (!isConnectionExist(connections, 'vcaOutput', 'inputFromVca')) {
            vcaValue = NaN;
        }
        if (!isConnectionExist(connections, 'noiseOutput', 'inputFromNoise')) {
            noiseValue = NaN;
        }

        const Data = {
            attack: attackValue,
            decay: decayValue,
            sustain: sustainValue,
            release: releaseValue,
            keyboard: keyboardValue,
            vca: vcaValue,
            noise: noiseValue
        };

        await sendToBackend(Data);
    }

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
