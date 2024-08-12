import { ClassicPreset, NodeEditor } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, Presets as ReactPresets } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';
import { DataflowEngine } from 'rete-engine';
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin';
import { ContextMenuPlugin, Presets as ContextMenuPresets } from 'rete-context-menu-plugin';
import 'react-piano/dist/styles.css';

const adsrSocket = new ClassicPreset.Socket('adsrSocket');

class Connection extends ClassicPreset.Connection {}

class ADSRComponentNode extends ClassicPreset.Node {
    constructor(name, initial, change) {
        super(name);
        this.width = 180;
        this.height = 120;
        this.addOutput('value', new ClassicPreset.Output(adsrSocket, 'Number'));
        this.addControl('value', new ClassicPreset.InputControl('number', { initial, change }));
    }

    data() {
        const value = this.controls['value'].value;
        return { value };
    }
}

class AttackNode extends ADSRComponentNode {
    constructor(initial, change) {
        super('Attack', initial, change);
    }
}

class DecayNode extends ADSRComponentNode {
    constructor(initial, change) {
        super('Decay', initial, change);
    }
}

class SustainNode extends ADSRComponentNode {
    constructor(initial, change) {
        super('Sustain', initial, change);
    }
}

class ReleaseNode extends ADSRComponentNode {
    constructor(initial, change) {
        super('Release', initial, change);
    }
}

class ADSRNode extends ClassicPreset.Node {
    constructor() {
        super('ADSR');
        this.width = 200;
        this.height = 280;
        this.addInput('attack', new ClassicPreset.Input(adsrSocket, 'Attack'));
        this.addInput('decay', new ClassicPreset.Input(adsrSocket, 'Decay'));
        this.addInput('sustain', new ClassicPreset.Input(adsrSocket, 'Sustain'));
        this.addInput('release', new ClassicPreset.Input(adsrSocket, 'Release'));
        this.addInput('alpha', new ClassicPreset.Input(adsrSocket, 'Alpha'));
        this.addOutput('signal', new ClassicPreset.Output(adsrSocket, 'Signal'));
    }

    data(inputs) {
        const { attack = [], decay = [], sustain = [], release = [], alpha = [] } = inputs;

        const adsrData = {
            attack: attack[0] || 0,
            decay: decay[0] || 0,
            sustain: sustain[0] || 0,
            release: release[0] || 0,
            alpha: alpha[0] || 0,
        };

        console.log('ADSR data:', adsrData);

        fetch('http://localhost:5000/update_adsr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(adsrData),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('Success:', data);
            })
            .catch((error) => {
                console.error('Error:', error);
            });

        return adsrData;
    }
}

class VoiceNode extends ClassicPreset.Node {
    constructor() {
        super('Voice');
        this.width = 180;
        this.height = 195;
        this.addInput('signal', new ClassicPreset.Input(adsrSocket, 'Signal'));
        this.addInput('voc', new ClassicPreset.Input(adsrSocket, 'VOC'));
    }

    data(inputs) {
        const { signal = [], voc = [] } = inputs;

        const voiceData = {
            signal: signal[0] || {},
            voc: voc[0] || {},
        };

        console.log('Voice data:', voiceData);

        return voiceData;
    }
}

class VOCNode extends ClassicPreset.Node {
    constructor() {
        super('VOC');
        this.width = 200;
        this.height = 250;
        this.addOutput('signal', new ClassicPreset.Output(adsrSocket, 'Signal'));
        this.addControl('tuning', new ClassicPreset.InputControl('number', { initial: 0 }));
        this.addControl('mod_depth', new ClassicPreset.InputControl('number', { initial: 0 }));
        this.addControl('initial_phase', new ClassicPreset.InputControl('number', { initial: 0 }));
    }

    data() {
        const tuning = this.controls['tuning'].value;
        const mod_depth = this.controls['mod_depth'].value;
        const initial_phase = this.controls['initial_phase'].value;

        return {
            tuning,
            mod_depth,
            initial_phase,
        };
    }
}

class MonophonicKeyboardNode extends ClassicPreset.Node {
    constructor() {
        super('MonophonicKeyboard');
        this.width = 200;
        this.height = 200;
        this.addControl('midi_f0', new ClassicPreset.InputControl('number', { initial: 0 }));
        this.addControl('note_on_duration', new ClassicPreset.InputControl('number', { initial: 0 }));
        this.addOutput('note_on_duration', new ClassicPreset.Output(adsrSocket, 'Number'));
    }

    data() {
        const midi_f0 = this.controls['midi_f0'].value;
        const note_on_duration = this.controls['note_on_duration'].value;

        return {
            midi_f0,
            note_on_duration,
        };
    }
}

export async function createEditor(container) {
    const editor = new NodeEditor();
    const area = new AreaPlugin(container);
    const connection = new ConnectionPlugin();
    const reactRender = new ReactPlugin({ createRoot });
    const contextMenu = new ContextMenuPlugin({
        items: ContextMenuPresets.classic.setup([
            ['Attack', () => new AttackNode(0.1, process)],
            ['Decay', () => new DecayNode(0.2, process)],
            ['Sustain', () => new SustainNode(0.7, process)],
            ['Release', () => new ReleaseNode(0.3, process)],
            ['ADSR', () => new ADSRNode()],
            ['Voice', () => new VoiceNode()],
            ['VOC', () => new VOCNode()],
            ['MonophonicKeyboard', () => new MonophonicKeyboardNode()],
        ]),
    });

    editor.use(area);
    area.use(reactRender);
    area.use(connection);
    area.use(contextMenu);

    connection.addPreset(ConnectionPresets.classic.setup());
    reactRender.addPreset(ReactPresets.classic.setup());
    reactRender.addPreset(ReactPresets.contextMenu.setup());

    const dataflow = new DataflowEngine();
    editor.use(dataflow);

    const attack = new AttackNode(0.1, process);
    const decay = new DecayNode(0.2, process);
    const sustain = new SustainNode(0.7, process);
    const release = new ReleaseNode(0.3, process);
    const adsr = new ADSRNode();
    const voice = new VoiceNode();
    const voc = new VOCNode();
    const keyboard = new MonophonicKeyboardNode();

    await editor.addNode(attack);
    await editor.addNode(decay);
    await editor.addNode(sustain);
    await editor.addNode(release);
    await editor.addNode(adsr);
    await editor.addNode(voice);
    await editor.addNode(voc);
    await editor.addNode(keyboard);

    await editor.addConnection(new Connection(attack, 'value', adsr, 'attack'));
    await editor.addConnection(new Connection(decay, 'value', adsr, 'decay'));
    await editor.addConnection(new Connection(sustain, 'value', adsr, 'sustain'));
    await editor.addConnection(new Connection(release, 'value', adsr, 'release'));
    await editor.addConnection(new Connection(adsr, 'signal', voice, 'signal'));
    await editor.addConnection(new Connection(voc, 'signal', voice, 'voc'));
    await editor.addConnection(new Connection(keyboard, 'note_on_duration', adsr, 'alpha'));

    const arrange = new AutoArrangePlugin();
    arrange.addPreset(ArrangePresets.classic.setup());
    area.use(arrange);
    await arrange.layout();

    AreaExtensions.zoomAt(area, editor.getNodes());
    AreaExtensions.simpleNodesOrder(area);

    const selector = AreaExtensions.selector();
    const accumulating = AreaExtensions.accumulateOnCtrl();
    AreaExtensions.selectableNodes(area, selector, { accumulating });

    async function process() {
        dataflow.reset();
        editor
            .getNodes()
            .filter((node) => node instanceof VoiceNode)
            .forEach(async (node) => {
                const data = await dataflow.fetch(node.id);
                console.log(node.id, 'produces', data);
            });
    }

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

// "use strict";
// var __extends = (this && this.__extends) || (function () {
//     var extendStatics = function (d, b) {
//         extendStatics = Object.setPrototypeOf ||
//             ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
//             function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
//         return extendStatics(d, b);
//     };
//     return function (d, b) {
//         if (typeof b !== "function" && b !== null)
//             throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
//         extendStatics(d, b);
//         function __() { this.constructor = d; }
//         d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
//     };
// })();
// var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
//     function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
//     return new (P || (P = Promise))(function (resolve, reject) {
//         function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
//         function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
//         function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
//         step((generator = generator.apply(thisArg, _arguments || [])).next());
//     });
// };
// var __generator = (this && this.__generator) || function (thisArg, body) {
//     var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
//     return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
//     function verb(n) { return function (v) { return step([n, v]); }; }
//     function step(op) {
//         if (f) throw new TypeError("Generator is already executing.");
//         while (g && (g = 0, op[0] && (_ = 0)), _) try {
//             if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
//             if (y = 0, t) op = [op[0] & 2, t.value];
//             switch (op[0]) {
//                 case 0: case 1: t = op; break;
//                 case 4: _.label++; return { value: op[1], done: false };
//                 case 5: _.label++; y = op[1]; op = [0]; continue;
//                 case 7: op = _.ops.pop(); _.trys.pop(); continue;
//                 default:
//                     if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
//                     if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
//                     if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
//                     if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
//                     if (t[2]) _.ops.pop();
//                     _.trys.pop(); continue;
//             }
//             op = body.call(thisArg, _);
//         } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
//         if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
//     }
// };
// // Object.defineProperty(exports, "__esModule", { value: true });
// // exports.createEditor = void 0;
// var rete_1 = require("rete");
// var rete_area_plugin_1 = require("rete-area-plugin");
// var rete_connection_plugin_1 = require("rete-connection-plugin");
// var rete_react_plugin_1 = require("rete-react-plugin");
// var client_1 = require("react-dom/client");
// var rete_engine_1 = require("rete-engine");
// var rete_auto_arrange_plugin_1 = require("rete-auto-arrange-plugin");
// var rete_context_menu_plugin_1 = require("rete-context-menu-plugin");
// require("react-piano/dist/styles.css");
// var adsrSocket = new rete_1.ClassicPreset.Socket('adsrSocket');
// var Connection = /** @class */ (function (_super) {
//     __extends(Connection, _super);
//     function Connection() {
//         return _super !== null && _super.apply(this, arguments) || this;
//     }
//     return Connection;
// }(rete_1.ClassicPreset.Connection));
// var ADSRComponentNode = /** @class */ (function (_super) {
//     __extends(ADSRComponentNode, _super);
//     function ADSRComponentNode(name, initial, change) {
//         var _this = _super.call(this, name) || this;
//         _this.width = 180;
//         _this.height = 120;
//         _this.addOutput('value', new rete_1.ClassicPreset.Output(adsrSocket, 'Number'));
//         _this.addControl('value', new rete_1.ClassicPreset.InputControl('number', { initial: initial, change: change }));
//         return _this;
//     }
//     ADSRComponentNode.prototype.data = function () {
//         var value = this.controls['value'].value;
//         return { value: value };
//     };
//     return ADSRComponentNode;
// }(rete_1.ClassicPreset.Node));
// var AttackNode = /** @class */ (function (_super) {
//     __extends(AttackNode, _super);
//     function AttackNode(initial, change) {
//         return _super.call(this, 'Attack', initial, change) || this;
//     }
//     return AttackNode;
// }(ADSRComponentNode));
// var DecayNode = /** @class */ (function (_super) {
//     __extends(DecayNode, _super);
//     function DecayNode(initial, change) {
//         return _super.call(this, 'Decay', initial, change) || this;
//     }
//     return DecayNode;
// }(ADSRComponentNode));
// var SustainNode = /** @class */ (function (_super) {
//     __extends(SustainNode, _super);
//     function SustainNode(initial, change) {
//         return _super.call(this, 'Sustain', initial, change) || this;
//     }
//     return SustainNode;
// }(ADSRComponentNode));
// var ReleaseNode = /** @class */ (function (_super) {
//     __extends(ReleaseNode, _super);
//     function ReleaseNode(initial, change) {
//         return _super.call(this, 'Release', initial, change) || this;
//     }
//     return ReleaseNode;
// }(ADSRComponentNode));
// var ADSRNode = /** @class */ (function (_super) {
//     __extends(ADSRNode, _super);
//     function ADSRNode() {
//         var _this = _super.call(this, 'ADSR') || this;
//         _this.width = 200;
//         _this.height = 280;
//         _this.addInput('attack', new rete_1.ClassicPreset.Input(adsrSocket, 'Attack'));
//         _this.addInput('decay', new rete_1.ClassicPreset.Input(adsrSocket, 'Decay'));
//         _this.addInput('sustain', new rete_1.ClassicPreset.Input(adsrSocket, 'Sustain'));
//         _this.addInput('release', new rete_1.ClassicPreset.Input(adsrSocket, 'Release'));
//         _this.addInput('alpha', new rete_1.ClassicPreset.Input(adsrSocket, 'Alpha'));
//         _this.addOutput('signal', new rete_1.ClassicPreset.Output(adsrSocket, 'Signal'));
//         return _this;
//     }
//     ADSRNode.prototype.data = function (inputs) {
//         var _a = inputs.attack, attack = _a === void 0 ? [] : _a, _b = inputs.decay, decay = _b === void 0 ? [] : _b, _c = inputs.sustain, sustain = _c === void 0 ? [] : _c, _d = inputs.release, release = _d === void 0 ? [] : _d, _e = inputs.alpha, alpha = _e === void 0 ? [] : _e;
//         var adsrData = {
//             attack: attack[0] || 0,
//             decay: decay[0] || 0,
//             sustain: sustain[0] || 0,
//             release: release[0] || 0,
//             alpha: alpha[0] || 0
//         };
//         console.log('ADSR data:', adsrData);
//         fetch('http://localhost:5000/update_adsr', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify(adsrData)
//         })
//             .then(function (response) { return response.json(); })
//             .then(function (data) {
//             console.log('Success:', data);
//         })
//             .catch(function (error) {
//             console.error('Error:', error);
//         });
//         return adsrData;
//     };
//     return ADSRNode;
// }(rete_1.ClassicPreset.Node));
// var VoiceNode = /** @class */ (function (_super) {
//     __extends(VoiceNode, _super);
//     function VoiceNode() {
//         var _this = _super.call(this, 'Voice') || this;
//         _this.width = 180;
//         _this.height = 195;
//         _this.addInput('signal', new rete_1.ClassicPreset.Input(adsrSocket, 'Signal'));
//         _this.addInput('voc', new rete_1.ClassicPreset.Input(adsrSocket, 'VOC'));
//         return _this;
//     }
//     VoiceNode.prototype.data = function (inputs) {
//         var _a = inputs.signal, signal = _a === void 0 ? [] : _a, _b = inputs.voc, voc = _b === void 0 ? [] : _b;
//         var voiceData = {
//             signal: signal[0] || {},
//             voc: voc[0] || {}
//         };
//         console.log('Voice data:', voiceData);
//         return voiceData;
//     };
//     return VoiceNode;
// }(rete_1.ClassicPreset.Node));
// var VOCNode = /** @class */ (function (_super) {
//     __extends(VOCNode, _super);
//     function VOCNode() {
//         var _this = _super.call(this, 'VOC') || this;
//         _this.width = 200;
//         _this.height = 250;
//         _this.addOutput('signal', new rete_1.ClassicPreset.Output(adsrSocket, 'Signal'));
//         _this.addControl('tuning', new rete_1.ClassicPreset.InputControl('number', { initial: 0 }));
//         _this.addControl('mod_depth', new rete_1.ClassicPreset.InputControl('number', { initial: 0 }));
//         _this.addControl('initial_phase', new rete_1.ClassicPreset.InputControl('number', { initial: 0 }));
//         return _this;
//     }
//     VOCNode.prototype.data = function () {
//         var tuning = this.controls['tuning'].value;
//         var mod_depth = this.controls['mod_depth'].value;
//         var initial_phase = this.controls['initial_phase'].value;
//         return {
//             tuning: tuning,
//             mod_depth: mod_depth,
//             initial_phase: initial_phase
//         };
//     };
//     return VOCNode;
// }(rete_1.ClassicPreset.Node));
// var MonophonicKeyboardNode = /** @class */ (function (_super) {
//     __extends(MonophonicKeyboardNode, _super);
//     function MonophonicKeyboardNode() {
//         var _this = _super.call(this, 'MonophonicKeyboard') || this;
//         _this.width = 200;
//         _this.height = 200;
//         _this.addControl('midi_f0', new rete_1.ClassicPreset.InputControl('number', { initial: 0 }));
//         _this.addControl('note_on_duration', new rete_1.ClassicPreset.InputControl('number', { initial: 0 }));
//         _this.addOutput('note_on_duration', new rete_1.ClassicPreset.Output(adsrSocket, 'Number'));
//         return _this;
//     }
//     MonophonicKeyboardNode.prototype.data = function () {
//         var midi_f0 = this.controls['midi_f0'].value;
//         var note_on_duration = this.controls['note_on_duration'].value;
//         return {
//             midi_f0: midi_f0,
//             note_on_duration: note_on_duration
//         };
//     };
//     return MonophonicKeyboardNode;
// }(rete_1.ClassicPreset.Node));
// export function createEditor(container) {
//     return __awaiter(this, void 0, void 0, function () {
//         function process() {
//             return __awaiter(this, void 0, void 0, function () {
//                 var _this = this;
//                 return __generator(this, function (_a) {
//                     dataflow.reset();
//                     editor
//                         .getNodes()
//                         .filter(function (node) { return node instanceof VoiceNode; })
//                         .forEach(function (node) { return __awaiter(_this, void 0, void 0, function () {
//                         var data;
//                         return __generator(this, function (_a) {
//                             switch (_a.label) {
//                                 case 0: return [4 /*yield*/, dataflow.fetch(node.id)];
//                                 case 1:
//                                     data = _a.sent();
//                                     console.log(node.id, 'produces', data);
//                                     return [2 /*return*/];
//                             }
//                         });
//                     }); });
//                     return [2 /*return*/];
//                 });
//             });
//         }
//         var editor, area, connection, reactRender, contextMenu, dataflow, attack, decay, sustain, release, adsr, voice, voc, keyboard, arrange, selector, accumulating;
//         return __generator(this, function (_a) {
//             switch (_a.label) {
//                 case 0:
//                     editor = new rete_1.NodeEditor();
//                     area = new rete_area_plugin_1.AreaPlugin(container);
//                     connection = new rete_connection_plugin_1.ConnectionPlugin();
//                     reactRender = new rete_react_plugin_1.ReactPlugin({ createRoot: client_1.createRoot });
//                     contextMenu = new rete_context_menu_plugin_1.ContextMenuPlugin({
//                         items: rete_context_menu_plugin_1.Presets.classic.setup([
//                             ['Attack', function () { return new AttackNode(0.1, process); }],
//                             ['Decay', function () { return new DecayNode(0.2, process); }],
//                             ['Sustain', function () { return new SustainNode(0.7, process); }],
//                             ['Release', function () { return new ReleaseNode(0.3, process); }],
//                             ['ADSR', function () { return new ADSRNode(); }],
//                             ['Voice', function () { return new VoiceNode(); }],
//                             ['VOC', function () { return new VOCNode(); }],
//                             ['MonophonicKeyboard', function () { return new MonophonicKeyboardNode(); }]
//                         ]),
//                     });
//                     editor.use(area);
//                     area.use(reactRender);
//                     area.use(connection);
//                     area.use(contextMenu);
//                     connection.addPreset(rete_connection_plugin_1.Presets.classic.setup());
//                     reactRender.addPreset(rete_react_plugin_1.Presets.classic.setup());
//                     reactRender.addPreset(rete_react_plugin_1.Presets.contextMenu.setup());
//                     dataflow = new rete_engine_1.DataflowEngine();
//                     editor.use(dataflow);
//                     attack = new AttackNode(0.1, process);
//                     decay = new DecayNode(0.2, process);
//                     sustain = new SustainNode(0.7, process);
//                     release = new ReleaseNode(0.3, process);
//                     adsr = new ADSRNode();
//                     voice = new VoiceNode();
//                     voc = new VOCNode();
//                     keyboard = new MonophonicKeyboardNode();
//                     return [4 /*yield*/, editor.addNode(attack)];
//                 case 1:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(decay)];
//                 case 2:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(sustain)];
//                 case 3:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(release)];
//                 case 4:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(adsr)];
//                 case 5:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(voice)];
//                 case 6:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(voc)];
//                 case 7:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addNode(keyboard)];
//                 case 8:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(attack, 'value', adsr, 'attack'))];
//                 case 9:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(decay, 'value', adsr, 'decay'))];
//                 case 10:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(sustain, 'value', adsr, 'sustain'))];
//                 case 11:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(release, 'value', adsr, 'release'))];
//                 case 12:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(adsr, 'signal', voice, 'signal'))];
//                 case 13:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(voc, 'signal', voice, 'voc'))];
//                 case 14:
//                     _a.sent();
//                     return [4 /*yield*/, editor.addConnection(new Connection(keyboard, 'note_on_duration', adsr, 'alpha'))];
//                 case 15:
//                     _a.sent();
//                     arrange = new rete_auto_arrange_plugin_1.AutoArrangePlugin();
//                     arrange.addPreset(rete_auto_arrange_plugin_1.Presets.classic.setup());
//                     area.use(arrange);
//                     return [4 /*yield*/, arrange.layout()];
//                 case 16:
//                     _a.sent();
//                     rete_area_plugin_1.AreaExtensions.zoomAt(area, editor.getNodes());
//                     rete_area_plugin_1.AreaExtensions.simpleNodesOrder(area);
//                     selector = rete_area_plugin_1.AreaExtensions.selector();
//                     accumulating = rete_area_plugin_1.AreaExtensions.accumulateOnCtrl();
//                     rete_area_plugin_1.AreaExtensions.selectableNodes(area, selector, { accumulating: accumulating });
//                     editor.addPipe(function (context) {
//                         if (context.type === 'connectioncreated' || context.type === 'connectionremoved') {
//                             process();
//                         }
//                         return context;
//                     });
//                     process();
//                     return [2 /*return*/, {
//                             destroy: function () { return area.destroy(); },
//                         }];
//             }
//         });
//     });
// }
// // exports.default = createEditor;
