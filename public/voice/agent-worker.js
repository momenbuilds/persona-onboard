// Dedicated worker that owns the Voice Agent WebSocket.
//
// Mic audio flows AudioWorklet (audio thread) → MessagePort → this worker →
// WebSocket, never touching the main thread. A busy UI (animations, React
// renders, a laptop with 40 tabs) can't delay or drop the user's speech —
// late audio reaches AssemblyAI as gaps, which chops words and breaks turn
// detection. Incoming voice audio is decoded here too.

let ws = null;
let ready = false;
let micLive = false;
let pcmPort = null;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function pcm16ToFloat(b64) {
  const bin = atob(b64);
  const out = new Float32Array(bin.length >> 1);
  for (let i = 0; i < out.length; i++) {
    let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}

function sendJson(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

self.onmessage = (e) => {
  const m = e.data || {};
  switch (m.type) {
    case "connect": {
      ws = new WebSocket(m.url);
      ws.onopen = () => {
        sendJson({ type: "session.update", session: m.session });
        self.postMessage({ type: "ws.open" });
      };
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "session.ready") ready = true;
        if (msg.type === "reply.audio") {
          const samples = pcm16ToFloat(msg.data || "");
          self.postMessage({ type: "reply.audio", samples }, [samples.buffer]);
          return;
        }
        self.postMessage(msg);
      };
      ws.onerror = () => self.postMessage({ type: "ws.error" });
      ws.onclose = (ev) => self.postMessage({ type: "ws.close", code: ev.code });
      break;
    }
    case "pcm-port":
      pcmPort = m.port;
      pcmPort.onmessage = (ev) => {
        if (micLive && ready) sendJson({ type: "input.audio", audio: toBase64(ev.data) });
      };
      break;
    case "mic":
      micLive = !!m.live;
      break;
    case "send":
      sendJson(m.msg);
      break;
    case "close":
      if (pcmPort) pcmPort.onmessage = null;
      if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
      break;
  }
};
