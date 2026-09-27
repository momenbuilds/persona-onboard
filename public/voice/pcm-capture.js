// AudioWorklet: capture mic audio at the context's native rate, resample to
// 24 kHz, and post ~100 ms chunks of PCM16 (what the Voice Agent API expects).
// Resampling here keeps Safari and Firefox (which don't honour a forced 24 kHz
// context without side effects) sounding right.
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { inputSampleRate, targetSampleRate = 24000 } = options.processorOptions || {};
    this.ratio = (inputSampleRate || sampleRate) / targetSampleRate;
    this.chunkSize = targetSampleRate / 10;
    this.buffer = new Int16Array(this.chunkSize);
    this.filled = 0;
    this.pos = 0;
    // Chunks go to a port handed over by the page (wired to the network worker),
    // so they never wait on the main thread.
    this.out = null;
    this.port.onmessage = (e) => {
      if (e.data && e.data.port) this.out = e.data.port;
    };
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    // Linear-interpolated resample, carrying the fractional position across blocks.
    while (this.pos < input.length - 1) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const sample = input[i] + (input[i + 1] - input[i]) * frac;
      this.buffer[this.filled++] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
      if (this.filled === this.chunkSize) {
        const out = this.buffer;
        (this.out || this.port).postMessage(out.buffer, [out.buffer]);
        this.buffer = new Int16Array(this.chunkSize);
        this.filled = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= input.length;
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
