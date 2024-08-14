from flask import Flask, request, jsonify, Response, send_from_directory
import asyncio
import websockets
import json
import torchsynth.config
import torchsynth.synth
from torch import tensor
import torch
from torchsynth.synth import Voice, Noise, AudioMixer, MonophonicKeyboard, SineVCO, SquareSawVCO
import torchaudio
import IPython.display as ipd
import matplotlib.pyplot as plt
import io
import numpy as np
from concurrent.futures import ThreadPoolExecutor
app = Flask(__name__)


# For a few examples, we'll only generate one sound
# 设置了批处理大小（batch_size）为1，表示我们只生成一段音频；
# 设置了采样率（sample_rate）为44100，这是音频的质量；
# 设置了缓冲区大小（buffer_size_seconds）为4.0，这是音频的长度。
synthconfig1 = torchsynth.config.SynthConfig(
    batch_size=1, reproducible=False, sample_rate=44100, buffer_size_seconds=4.0
)
# 创建合成器实例
device = "cuda" if torch.cuda.is_available() else "cpu"
voice1 = Voice(synthconfig=synthconfig1).to(device)
# 初始化噪声生成器
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

async def handle_connection(websocket, path):
    async for message in websocket:
        data = json.loads(message)

@app.route('/update_adsr', methods=['POST'])
def update_adsr():
    request_data = request.json

    if request_data is None:
        return jsonify({"status": "error", "message": "Invalid JSON data"}), 400

    # Update ADSR parameters
    voice1.adsr_1.set_parameter("attack", torch.tensor([request_data.get("attack", 0.1)]))
    voice1.adsr_1.set_parameter("decay", torch.tensor([request_data.get("decay", 0.2)]))
    voice1.adsr_1.set_parameter("sustain", torch.tensor([request_data.get("sustain", 0.7)]))
    voice1.adsr_1.set_parameter("release", torch.tensor([request_data.get("release", 0.3)]))
    return jsonify({"status": "success", "message": "ADSR parameters updated" }),200

#MIDI 音高是一个介于 0 到 127 的整数，表示音符的音高。69 对应的是 A4，即标准音高（440 Hz）。
#设置键盘模块的音符持续时间为 1.0 秒
#设置第一个电压控制振荡器（VCO）模块的调谐为 0.0。调谐是一个介于 -1 到 1 的值，表示音高的偏移。
#设置第一个 VCO 模块的调制深度为 12.0。调制深度是一个介于 0 到 1 的值，表示调制信号的强度。

AUDIO_FOLDER = "/Users/linyafeng/Desktop"
FILE_NAME="output.wav"
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
        voice1.set_parameters(
            {
                ("keyboard", "midi_f0"): torch.tensor([midi_note]),
                ("keyboard", "duration"): torch.tensor([1.0]),
                ("vco_1", "tuning"): torch.tensor([0.0]),
                ("vco_1", "mod_depth"): torch.tensor([12.0]),
                ("filter_1", "cutoff_frequency"): torch.tensor([2000.0]),
                ("filter_1", "resonance"): torch.tensor([0.5]),
            }
        )

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

        torchaudio.save(f"/Users/linyafeng/Desktop/{FILE_NAME}", audio_tensor, 44100)
        return jsonify({"status": "success", "url": f"/audio/{FILE_NAME}"}), 200

        # # 将音频数据转换为字节流
        # buffer = io.BytesIO()
        # torchaudio.save(buffer, audio_tensor.unsqueeze(0), 44100, format="wav")
        # buffer.seek(0)
        #
        # # 返回音频数据流作为响应
        # return Response(buffer, mimetype="audio/wav")

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route(f'/audio/{FILE_NAME}')
def serve_audio(filename):
    return send_from_directory(AUDIO_FOLDER, filename)

if __name__ == '__main__':
    app.run('0.0.0.0', 5000)

def stft_plot(signal):
    # Plot the STFT of the signal
    plt.figure(figsize=(10, 4))
    plt.specgram(signal, NFFT=2048, Fs=44100, noverlap=512)
    plt.title('STFT Magnitude')
    plt.xlabel('Time [s]')
    plt.ylabel('Frequency [Hz]')
    plt.colorbar(format='%+2.0f dB')
    plt.show()

audio_out, parameters, is_train = voice1()
print(f"Audio output: \n{audio_out}\n")
print(f"Parameters used to create audio: \n{parameters}\n")
print(f"Is test: \n{is_train}\n")

# 转换音频数据为 2D 张量
audio_tensor = audio_out.detach().cpu()  # [batch_size, samples]

# 确保 tensor 是 2D 的
if audio_tensor.ndim == 3:
    audio_tensor = audio_tensor.squeeze(0)  # [samples]

# 保存音频为 WAV 文件，采样率为 44100 Hz
torchaudio.save("/Users/linyafeng/Desktop/outputaaa.wav", audio_tensor, 44100)
print(f"Audio output saved.")

async def start_server():
    server = await websockets.serve(handle_connection, "localhost", 8765)
    await server.wait_closed()
start_server = websockets.serve(handle_connection, "localhost", 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()

if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_server)
    loop.run_in_executor(None, app.run, '0.0.0.0', 5000)
    loop.run_forever()