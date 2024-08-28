from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS  # 导入CORS
import torchsynth.config
import torchsynth.synth
from torch import tensor
import torch
from torchsynth.synth import Voice, Noise, AudioMixer, MonophonicKeyboard, SineVCO, SquareSawVCO
import torchaudio
import io
from torchsynth.module import LFO, ModulationMixer
from torchsynth.module import ADSR


app = Flask(__name__)
CORS(app)  # 启用CORS

# 音频文件保存位置
AUDIO_FOLDER = "/Users/linyafeng/Desktop"
FILE_NAME_TEMPLATE = "output_{}.wav"

# SynthConfig设置,生成声音的配置
#generate 1 sound at once, 4 seconds each
synthconfig1 = torchsynth.config.SynthConfig(
    batch_size=1, reproducible=False, sample_rate=44100, buffer_size_seconds=4.0
)
device = "cuda" if torch.cuda.is_available() else "cpu"
voice1 = Voice(synthconfig=synthconfig1).to(device)
keyboard = MonophonicKeyboard(synthconfig=synthconfig1, device=device)

#ADSR parameters
@app.route('/update_adsr', methods=['POST'])
def update_adsr():
    request_data = request.json
    if request_data is None:
        return jsonify({"status": "error", "message": "Invalid JSON data"}), 400

    # 更新ADSR参数
    voice1.adsr_1.set_parameter("attack", torch.tensor([request_data.get("attack", 0.1)]))
    voice1.adsr_1.set_parameter("decay", torch.tensor([request_data.get("decay", 0.2)]))
    voice1.adsr_1.set_parameter("sustain", torch.tensor([request_data.get("sustain", 0.7)]))
    voice1.adsr_1.set_parameter("release", torch.tensor([request_data.get("release", 0.3)]))
    return jsonify({"status": "success", "message": "ADSR parameters updated"}), 200

square_saw = SquareSawVCO(
    tuning=torch.tensor([0.0] * synthconfig1.batch_size),
    mod_depth=torch.tensor([0.0] * synthconfig1.batch_size),
    shape=torch.tensor([1.0] * synthconfig1.batch_size),
    synthconfig=synthconfig1,
    device=device,
)
sine = SineVCO(
    tuning=torch.tensor([0.0] * synthconfig1.batch_size),
    synthconfig=synthconfig1,
).to(device)

noise = Noise(synthconfig=synthconfig1, seed=42, device=device)
audio_mixer = AudioMixer(synthconfig=synthconfig1, n_input=3, curves=[1.0, 1.0, 0.25]).to(device)



lfo=LFO(synthconfig=synthconfig1, device=device)
lfo.set_parameter("mod_depth", torch.tensor(10.0,[0.0] * synthconfig1.batch_size))
lfo.set_parameter("frequency", torch.tensor([1.0,0.0] * synthconfig1.batch_size))
out=lfo()
midi_f0,duration=keyboard
adsr=ADSR(synthconfig1, device=device)
envelope = adsr(duration)

lfo2 = LFO(synthconfig1, device=device)
out2 = lfo2(envelope)

# A modulation mixer can be used to mix a modulation sources together
# and maintain a 0 to 1 amplitude range
mixer = ModulationMixer(synthconfig=synthconfig1, device=device, n_input=2, n_output=1)
mods_mixed = mixer(out, out2)

print(f"Mixed: LFO 1:{mixer.p('0->0')[0]:.2}, LFO 2: {mixer.p('1->0')[0]:.2}")

@app.route('/generate_audio', methods=['POST'])
def generate_audio():
    try:
        request_data = request.json
        midi_note = request_data.get("midi_note", 69)

        # 更新ADSR参数
        voice1.adsr_1.set_parameter("attack", torch.tensor([request_data.get("attack", 0.1)]))
        voice1.adsr_1.set_parameter("decay", torch.tensor([request_data.get("decay", 0.2)]))
        voice1.adsr_1.set_parameter("sustain", torch.tensor([request_data.get("sustain", 0.7)]))
        voice1.adsr_1.set_parameter("release", torch.tensor([request_data.get("release", 0.3)]))

        # 设置合成器参数
        voice1.set_parameters({
            ("keyboard", "midi_f0"): torch.tensor([midi_note]),
            ("keyboard", "duration"): torch.tensor([1.0]),
            ("vco_1", "tuning"): torch.tensor([0.0]),
            ("vco_1", "mod_depth"): torch.tensor([12.0]),
        })

        # 生成音频
        env = torch.zeros((synthconfig1.batch_size, synthconfig1.buffer_size), device=device)
        midi_f0, note_on_duration = keyboard()
        sine_out = sine(midi_f0, env)
        sqr_out = square_saw(midi_f0, env)
        noise_out = noise()
        audio_out, parameters, is_train = voice1()
        audio_tensor = audio_out.detach().cpu()

        if audio_tensor.ndim == 3:
            audio_tensor = audio_tensor.squeeze(0)

        # 保存音频为WAV文件
        audio_path = f"{AUDIO_FOLDER}/{FILE_NAME_TEMPLATE.format(midi_note)}"
        torchaudio.save(audio_path, audio_tensor, 44100)
        return jsonify({"status": "success", "url": f"/audio/{FILE_NAME_TEMPLATE.format(midi_note)}"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_FOLDER, filename, mimetype='audio/wav')

if __name__ == '__main__':
    app.run('0.0.0.0', 5000)
