'use strict';

/* Khorg — sintetizzatore browser: kick, hats, bass, onda visibile e comandi */

const ctxState = { audioCtx: null, started: false };
const synthState = {
  voice: null,
  gain: null,
  filter: null,
  analyser: null,
  oscType: 'sine',
  freq: 220,
  env: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
  filterType: 'none',
  filterFreq: 1000,
  filterQ: 1,
  masterVol: 0.5,
};

function ensureAudio() {
  if (ctxState.audioCtx) return ctxState.audioCtx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  ctxState.audioCtx = new AudioContext();
  return ctxState.audioCtx;
}

function startAudio() {
  if (ctxState.started) return;
  const ctx = ensureAudio();
  if (ctx.state === 'suspended') ctx.resume();
  ctxState.started = true;
}

function envGain(ctx, gainNode, { attack, decay, sustain, release }) {
  const now = ctx.currentTime;
  const g = gainNode.gain || gainNode;
  g.setValueAtTime(0, now);
  g.linearRampToValueAtTime(1, now + attack);
  g.linearRampToValueAtTime(sustain, now + attack + decay);
  g.setValueAtTime(sustain, now + attack + decay);
  g.linearRampToValueAtTime(0, now + attack + decay + release);
}

function playKick(ctx) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

function playHats(ctx) {
  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
  noise.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.15);
}

function playBass(ctx) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

const sounds = { kick: playKick, hats: playHats, bass: playBass };

function buildSynth(ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const analyser = ctx.createAnalyser();

  osc.type = synthState.oscType;
  osc.frequency.setValueAtTime(synthState.freq, ctx.currentTime);

  if (synthState.filterType !== 'none') {
    filter.type = synthState.filterType;
    filter.frequency.setValueAtTime(synthState.filterFreq, ctx.currentTime);
    filter.Q.setValueAtTime(synthState.filterQ, ctx.currentTime);
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }
  gain.gain.setValueAtTime(0, ctx.currentTime);
  envGain(ctx, gain, synthState.env);

  gain.connect(analyser);
  analyser.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + synthState.env.attack + synthState.env.decay + synthState.env.release + 0.5);

  return { osc, gain, filter, analyser };
}

function startSynthVoice() {
  if (synthState.voice) {
    try { synthState.voice.osc.stop(); } catch (e) {}
    synthState.voice = null;
  }
  const ctx = ensureAudio();
  synthState.voice = buildSynth(ctx);
}

function stopSynthVoice() {
  if (synthState.voice) {
    try { synthState.voice.osc.stop(); } catch (e) {}
    synthState.voice = null;
  }
}

function drawWaveform() {
  const canvas = document.getElementById('waveform');
  if (!canvas || !synthState.analyser) {
    requestAnimationFrame(drawWaveform);
    return;
  }
  const ctx = canvas.getContext('2d');
  const bufferLength = synthState.analyser.frequencyBinCount;
  const data = new Uint8Array(bufferLength);
  synthState.analyser.getByteTimeDomainData(data);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffb74d';
  ctx.beginPath();
  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = data[i] / 128.0;
    const y = (v * canvas.height) / 2 + canvas.height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  requestAnimationFrame(drawWaveform);
}

document.querySelectorAll('.controls button').forEach((button) => {
  button.addEventListener('click', () => {
    startAudio();
    const ctx = ensureAudio();
    const fn = sounds[button.dataset.sound];
    if (fn) fn(ctx);
  });
});

document.querySelectorAll('.keys button').forEach((button) => {
  button.addEventListener('click', () => {
    startAudio();
    const noteFreqs = {
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
      G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25,
    };
    const freq = noteFreqs[button.dataset.note];
    if (!freq) return;
    synthState.freq = freq;
    startSynthVoice();
  });
});

const waveTypeSel = document.getElementById('wave-type');
const freqInp = document.getElementById('freq');
const masterVolInp = document.getElementById('master-vol');
const envAttack = document.getElementById('env-attack');
const envDecay = document.getElementById('env-decay');
const envSustain = document.getElementById('env-sustain');
const envRelease = document.getElementById('env-release');
const filterTypeSel = document.getElementById('filter-type');
const filterFreq = document.getElementById('filter-freq');
const filterQ = document.getElementById('filter-q');

wireControl(waveTypeSel, 'change', (v) => { synthState.oscType = v; if (synthState.voice) synthState.voice.osc.type = v; });
wireControl(freqInp, 'input', (v) => { synthState.freq = Number(v); if (synthState.voice) synthState.voice.osc.frequency.setValueAtTime(synthState.freq, ensureAudio().currentTime); });
wireControl(masterVolInp, 'input', (v) => { synthState.masterVol = Number(v); if (synthState.voice) synthState.voice.gain.gain.setValueAtTime(synthState.masterVol, ensureAudio().currentTime); });
wireControl(envAttack, 'input', (v) => { synthState.env.attack = Number(v); });
wireControl(envDecay, 'input', (v) => { synthState.env.decay = Number(v); });
wireControl(envSustain, 'input', (v) => { synthState.env.sustain = Number(v); });
wireControl(envRelease, 'input', (v) => { synthState.env.release = Number(v); });
wireControl(filterTypeSel, 'change', (v) => { synthState.filterType = v; if (synthState.voice) synthState.voice.filter.type = v; });
wireControl(filterFreq, 'input', (v) => { synthState.filterFreq = Number(v); if (synthState.voice) synthState.voice.filter.frequency.setValueAtTime(synthState.filterFreq, ensureAudio().currentTime); });
wireControl(filterQ, 'input', (v) => { synthState.filterQ = Number(v); if (synthState.voice) synthState.voice.filter.Q.setValueAtTime(synthState.filterQ, ensureAudio().currentTime); });

function wireControl(el, event, handler) {
  if (!el) return;
  el.addEventListener(event, () => handler(el.value));
  el.addEventListener('change', () => handler(el.value));
}

drawWaveform();
console.log('Khorg pronto');
