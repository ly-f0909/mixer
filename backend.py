import math
import subprocess
import traceback
import torch
import torchsynth
from torchsynth.module import VCA, ControlRateVCA, Signal
from torchsynth.synth import Voice, Noise, AudioMixer, MonophonicKeyboard, SineVCO, SquareSawVCO
import numpy as np
import matplotlib.pyplot as plt
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import torchaudio
import sounddevice as sd
import soundfile as sf


# Define audio and image folders
AUDIO_FOLDER = "/Users/linyafeng/Desktop"
IMAGE_FOLDER = "/Users/linyafeng/Desktop/images"
FILE_NAME_TEMPLATE = "output_{}.wav"
os.makedirs(IMAGE_FOLDER, exist_ok=True)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Synth configuration
synthconfig1 = torchsynth.config.SynthConfig(
    batch_size=32,  # 设置 batch_size 为 32
    reproducible=False,  # 禁用可重复性，允许任意的 batch_size
    sample_rate=44100,
    buffer_size_seconds=4.0
)
#初始化
device = "cpu"
voice1 = Voice(synthconfig=synthconfig1).to(device)
keyboard = MonophonicKeyboard(synthconfig=synthconfig1, device=device)
sine = SineVCO(
    tuning=torch.zeros(synthconfig1.batch_size, device=device),  # 使用 batch_size 32 创建张量
    synthconfig=synthconfig1
).to(device)
square_saw = SquareSawVCO(
    tuning=torch.zeros(synthconfig1.batch_size, device=device),
    mod_depth=torch.zeros(synthconfig1.batch_size, device=device),
    shape=torch.ones(synthconfig1.batch_size, device=device),
    synthconfig=synthconfig1
).to(device)

#噪音函数
def noise(seed):
    noiseModule = Noise(synthconfig=synthconfig1, seed=seed)
    return noiseModule.output()


# Initialize ADSR parameters
current_data = {
    "attack": float('nan'),
    "decay": float('nan'),
    "sustain": float('nan'),
    "release": float('nan'),
    "keyboard": float('nan'),
    "vca": float('nan'),
    "noise": float('nan')
}

#接收post请求
@app.route('/update_adsr', methods=['POST'])
def update_adsr():
    global current_data
    request_data = request.json
    if request_data is None:
        return jsonify({"status": "error", "message": "Invalid JSON data"}), 400

    # Extract parameters and validate range
    attack = max(0.0, min(1.0, request_data.get("attack", 0.0)))
    decay = max(0.0, min(1.0, request_data.get("decay", 0.0)))
    sustain = max(0.0, min(1.0, request_data.get("sustain", 0.0)))
    release = max(0.0, min(1.0, request_data.get("release", 0.0)))
    keyboards = request_data.get("keyboard", 69)  # default MIDI note 69
    vca = request_data.get("vca", 1.0)  # default VCA value
    noises = request_data.get("noise", 42)  # default noise seed

    # Update ADSR parameters
    current_data.update({
        "attack": attack,
        "decay": decay,
        "sustain": sustain,
        "release": release,
        "keyboard": keyboards,
        "vca": vca,
        "noise": noises
    })

    print('更新后的data')
    print(current_data)
    try:
        # Update ADSR parameters in the synth
        attack_tensor = torch.full((synthconfig1.batch_size,), current_data['attack'], device=device)
        decay_tensor = torch.full((synthconfig1.batch_size,), current_data['decay'], device=device)
        sustain_tensor = torch.full((synthconfig1.batch_size,), current_data['sustain'], device=device)
        release_tensor = torch.full((synthconfig1.batch_size,), current_data['release'], device=device)

        voice1.adsr_1.set_parameter("attack", attack_tensor)
        voice1.adsr_1.set_parameter("decay", decay_tensor)
        voice1.adsr_1.set_parameter("sustain", sustain_tensor)
        voice1.adsr_1.set_parameter("release", release_tensor)

        print(f"Updated ADSR parameters: {current_data}")
        return jsonify({"status": "success", "message": "ADSR parameters updated"}), 200
    except AssertionError as e:
        print(f"Error updating ADSR parameters: {e}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Parameter out of range"}), 400

#生成音频
@app.route('/generate_audio', methods=['POST'])
def generate_audio():
    print('生成音乐时的data')
    print(current_data)
    try:
        request_data = request.json
        midi_note = request_data.get("midi_note", 69)

        if current_data["keyboard"] is None:
            return jsonify({"status": "error", "message": "no keyboard data"}), 400
        # Adjust ADSR parameters
        print(f"Using ADSR parameters for audio generation: {current_data}")
        vca_value = current_data['vca']
        noise_value = current_data['noise']

        # Update ADSR parameters in synth

        if current_data['attack'] is not None and not math.isnan(current_data['attack']):
            attack_value = min(max(current_data['attack'], 0.0), 1.0)
            attack_tensor = torch.full((synthconfig1.batch_size,), attack_value, device=device)
            voice1.adsr_1.set_parameter("attack", attack_tensor)
        if current_data['decay'] is not None and not math.isnan(current_data['decay']):
            decay_value = min(max(current_data['decay'], 0.0), 1.0)
            decay_tensor = torch.full((synthconfig1.batch_size,), decay_value, device=device)
            voice1.adsr_1.set_parameter("decay", decay_tensor)
        if current_data['sustain'] is not None and not math.isnan(current_data['sustain']):
            sustain_value = min(max(current_data['sustain'], 0.0), 1.0)
            sustain_tensor = torch.full((synthconfig1.batch_size,), sustain_value, device=device)
            voice1.adsr_1.set_parameter("sustain", sustain_tensor)
        if current_data['release'] is not None and not math.isnan(current_data['release']):
            release_value = min(max(current_data['release'], 0.0), 1.0)
            release_tensor = torch.full((synthconfig1.batch_size,), release_value, device=device)
            voice1.adsr_1.set_parameter("release", release_tensor)

        # Reset parameters if needed
        if hasattr(voice1, 'reset_parameters'):
            voice1.reset_parameters()
            print("Voice parameters reset.")

        # Set synth parameters
        voice1.set_parameters({
            ("keyboard", "midi_f0"): torch.full((synthconfig1.batch_size,), midi_note, device=device),
            ("keyboard", "duration"): torch.full((synthconfig1.batch_size,), 1.0, device=device),
            ("vco_1", "tuning"): torch.zeros(synthconfig1.batch_size, device=device),
            ("vco_1", "mod_depth"): torch.full((synthconfig1.batch_size,), 12.0, device=device),
        })

        # Initialize VCA and ControlRateVCA
        vca = VCA(synthconfig=synthconfig1, device=device)
        audio_mixer = AudioMixer(synthconfig=synthconfig1, n_input=2, device=device)
        control_rate_vca = ControlRateVCA(synthconfig=synthconfig1, device=device)

        # Generate control signals
        control_signal = torch.ones((synthconfig1.batch_size, synthconfig1.buffer_size), device=device)

        # Generate audio signals
        env = torch.zeros((synthconfig1.batch_size, synthconfig1.buffer_size), device=device)
        midi_f0, note_on_duration = keyboard()
        sine_out = sine(midi_f0, env)
        sqr_out = square_saw(midi_f0, env)

        combined_signal = sine_out+sqr_out
        if current_data['vca'] is not None:
            vca_control_signal = torch.full((synthconfig1.batch_size, synthconfig1.buffer_size), vca_value,device=device)
            vca_control = control_rate_vca.output(control_signal, vca_control_signal)
            vca_signal = vca.output(combined_signal, vca_control)
        else:
            vca_signal = combined_signal

        # Combine noise or not
        if current_data['noise'] is not None:
            noise_out = noise(noise_value)
            signals_to_mix = torch.stack([vca_signal, noise_out])
            mixed_signal = audio_mixer.output(*signals_to_mix)  # 使用解包传递信号
            print("Mixed signal:", mixed_signal)
        else:
            mixed_signal = vca_signal

        # audio generated from adsr
        audio_out, parameters, is_train = voice1()
        audio_out = audio_out.as_subclass(Signal)  # 确保 audio_out 是 Signal 类型

        # Mix the signals
        combined_signal = audio_mixer.output(audio_out, mixed_signal)  # 混合两个 Signal
        print("Combined signal:", combined_signal)

        audio_tensor = combined_signal
        if audio_tensor.ndim == 3:
            audio_tensor = audio_tensor.squeeze(0)

        time_axis = np.arange(audio_tensor.shape[1]) / 44100
        # Visualize the generated audio waveform for debugging
        plt.figure(figsize=(12, 4))
        plt.plot(time_axis, audio_tensor.detach().numpy()[0], label='Audio Signal with ADSR')
        plt.title('Generated Audio Waveform')
        plt.xlabel('Time (seconds)')
        plt.ylabel('Amplitude')
        plt.legend()
        plt.show()

        # 如果 audio_tensor 是 (batch_size, channels, num_samples)
        # 取前两个通道作为立体声
        # audio_tensor = torch.mean(audio_tensor, dim=0, keepdim=True)  # 将多通道平均成单通道
        # 确保音频是单声道 (1, num_samples) 或立体声 (2, num_samples)

        # Save the audio as a WAV file
        audio_path = f"{AUDIO_FOLDER}/{FILE_NAME_TEMPLATE.format(midi_note)}"
        print("音乐保存路径" + audio_path)
        torchaudio.save(audio_path, audio_tensor.detach(), 44100)
        play_audio_with_default_player(audio_path)

        return jsonify({"status": "success", "url": f"/audio/{FILE_NAME_TEMPLATE.format(midi_note)}"}), 200

    except Exception as e:
        print(f"Error generating audio: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

def play_audio_with_default_player(file_path):
    try:
        # Use subprocess to call the 'open' command, which uses macOS's default player
        subprocess.run(["open", file_path])
    except Exception as e:
        print(f"Error playing audio: {str(e)}")

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_FOLDER, filename, mimetype='audio/wav')

#listening
if __name__ == '__main__':
    app.run('0.0.0.0', 5000)
