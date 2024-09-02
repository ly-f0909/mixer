from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import torchsynth.config
import torchsynth.synth
from torch import tensor
import torch
from torchsynth.synth import Voice, Noise, AudioMixer, MonophonicKeyboard, SineVCO, SquareSawVCO
import torchaudio

import matplotlib.pyplot as plt
import numpy as np
import os
from flask import send_file

# location of audio folder and image folder
AUDIO_FOLDER = "/Users/linyafeng/Desktop"
IMAGE_FOLDER = "/Users/linyafeng/Desktop/images"
FILE_NAME_TEMPLATE = "output_{}.wav"
os.makedirs(IMAGE_FOLDER, exist_ok=True)
# create if not exist


# create flask as backend, interact with frontend via HTTP
app = Flask(__name__)
# Cross-Origin Resource Sharing CORS: allow frontend to interact with backend
CORS(app)


# Synth Configuration
synthconfig1 = torchsynth.config.SynthConfig(
    batch_size=1, reproducible=False, sample_rate=44100, buffer_size_seconds=4.0
)


device ="cpu"
voice1 = Voice(synthconfig=synthconfig1).to(device)
# create an instance of voice synth ma move it to the desired device
keyboard = MonophonicKeyboard(synthconfig=synthconfig1, device=device)
sine = SineVCO(
    tuning=torch.tensor([0.0] * synthconfig1.batch_size),
    synthconfig=synthconfig1,
).to(device)
square_saw = SquareSawVCO(
    tuning=torch.tensor([0.0] * synthconfig1.batch_size),
    mod_depth=torch.tensor([0.0] * synthconfig1.batch_size),
    shape=torch.tensor([1.0] * synthconfig1.batch_size),
    synthconfig=synthconfig1,
    device=device,
)
noise = Noise(synthconfig=synthconfig1, seed=42, device=device)
audio_mixer = AudioMixer(synthconfig=synthconfig1, n_input=3, curves=[1.0, 1.0, 0.25]).to(device)

# 记录当前ADSR参数
current_adsr = {
    "attack": 0.1,
    "decay": 0.2,
    "sustain": 0.7,
    "release": 0.3,
}

@app.route('/update_adsr', methods=['POST'])
def update_adsr():
    global current_adsr
    request_data = request.json
    if request_data is None:
        return jsonify({"status": "error", "message": "Invalid JSON data"}), 400

    # 获取参数并进行范围校验，确保参数在 [0, 1] 之间
    attack = max(0.0, min(1.0, request_data.get("attack", 0.1)))
    decay = max(0.0, min(1.0, request_data.get("decay", 0.2)))
    sustain = max(0.0, min(1.0, request_data.get("sustain", 0.7)))
    release = max(0.0, min(1.0, request_data.get("release", 0.3)))

    # 更新全局参数记录
    current_adsr.update({
        "attack": attack,
        "decay": decay,
        "sustain": sustain,
        "release": release
    })

    try:
        # 更新ADSR参数到合成器
        voice1.adsr_1.set_parameter("attack", torch.tensor([current_adsr['attack']]))
        voice1.adsr_1.set_parameter("decay", torch.tensor([current_adsr['decay']]))
        voice1.adsr_1.set_parameter("sustain", torch.tensor([current_adsr['sustain']]))
        voice1.adsr_1.set_parameter("release", torch.tensor([current_adsr['release']]))
        print(f"Updated ADSR parameters: {current_adsr}")
        return jsonify({"status": "success", "message": "ADSR parameters updated"}), 200
    except AssertionError as e:
        print(f"Error updating ADSR parameters: {e}")
        return jsonify({"status": "error", "message": "Parameter out of range"}), 400


@app.route('/generate_audio', methods=['POST'])
def generate_audio():
    try:
        request_data = request.json
        midi_note = request_data.get("midi_note", 69)

        # 调整ADSR参数以确保其在合理范围内
        print(f"Using ADSR parameters for audio generation: {current_adsr}")
        attack_value = min(max(current_adsr['attack'], 0.0), 1.0)
        decay_value = min(max(current_adsr['decay'], 0.0), 1.0)
        sustain_value = min(max(current_adsr['sustain'], 0.0), 1.0)
        release_value = min(max(current_adsr['release'], 0.0), 1.0)

        # 更新ADSR参数
        voice1.adsr_1.set_parameter("attack", torch.tensor([attack_value]))
        voice1.adsr_1.set_parameter("decay", torch.tensor([decay_value]))
        voice1.adsr_1.set_parameter("sustain", torch.tensor([sustain_value]))
        voice1.adsr_1.set_parameter("release", torch.tensor([release_value]))

        # 如果存在重置方法，应用以确保参数更新
        if hasattr(voice1, 'reset_parameters'):
            voice1.reset_parameters()
            print("Voice parameters reset.")

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

        # 可视化音频波形以调试ADSR作用
        plt.figure(figsize=(12, 4))
        plt.plot(audio_tensor.numpy()[0], label='Audio Signal with ADSR')
        plt.title('Generated Audio Waveform')
        plt.xlabel('Time')
        plt.ylabel('Amplitude')
        plt.legend()
        plt.show()

        # 保存音频为WAV文件
        audio_path = f"{AUDIO_FOLDER}/{FILE_NAME_TEMPLATE.format(midi_note)}"
        torchaudio.save(audio_path, audio_tensor, 44100)
        return jsonify({"status": "success", "url": f"/audio/{FILE_NAME_TEMPLATE.format(midi_note)}"}), 200

    except Exception as e:
        print(f"Error generating audio: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_FOLDER, filename, mimetype='audio/wav')

if __name__ == '__main__':
    app.run('0.0.0.0', 5000)
