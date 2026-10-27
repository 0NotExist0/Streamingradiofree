'use strict';

/* Khorg — sintetizzatore browser: kick, hats, bass, onda visibile e comandi */

const ctxState = { audioCtx: null, started: false };
const synthState = {
  oscType: 'sawtooth',
  freq: 220,
  detune: 0,
  subBass: false,
  subBassMix: 0.4,
  env: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
  filter: { type: 'lowpass', freq: 2000, q: 1, env: { attack: 0.01, decay: 0.1, sustain: 1, release: 0.2 } },
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

const drumState = {
  kick: { pitch: 150, decay: 0.4, vol: 0.6 },
  hats: { pitch: 8000, decay: 0.12, vol: 0.35 },
  bass: { pitch: 55, decay: 0.3, vol: 0.5 },
};

function playKick(ctx, startTime = ctx.currentTime) {
  initFx(ctx);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(drumState.kick.pitch, startTime);
  osc.frequency.exponentialRampToValueAtTime(40, startTime + drumState.kick.decay);
  gain.gain.setValueAtTime(drumState.kick.vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + drumState.kick.decay + 0.05);
  osc.connect(gain);
  gain.connect(masterAnalyser);
  osc.start(startTime);
  osc.stop(startTime + drumState.kick.decay + 0.1);
}

function playHats(ctx, startTime = ctx.currentTime) {
  initFx(ctx);
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(drumState.hats.vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + drumState.hats.decay);
  noise.connect(gain);
  gain.connect(masterAnalyser);
  noise.start(startTime);
  noise.stop(startTime + 0.15);
}

function playBass(ctx, startTime = ctx.currentTime) {
  initFx(ctx);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(drumState.bass.pitch, startTime);
  osc.frequency.exponentialRampToValueAtTime(40, startTime + drumState.bass.decay);
  gain.gain.setValueAtTime(drumState.bass.vol, startTime);
  gain.gain.linearRampToValueAtTime(0.1, startTime + drumState.bass.decay);
  osc.connect(gain);
  gain.connect(masterAnalyser);
  osc.start(startTime);
  osc.stop(startTime + drumState.bass.decay + 0.1);
}

const sounds = { kick: playKick, hats: playHats, bass: playBass };
const loopState = { kick: false, hats: false, bass: false };

const WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
const activeVoices = new Map();

const synthVoiceState = {
  oscType: 'sawtooth',
  freq: 220,
  detune: 0,
  subBass: false,
  subBassMix: 0.4,
  env: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
  filter: { type: 'lowpass', freq: 2000, q: 1, env: { attack: 0.01, decay: 0.1, sustain: 1, release: 0.2 } },
  masterVol: 0.5,
};

function envGainNode(gainNode, { attack, decay, sustain, release }, ctx) {
  const now = ctx.currentTime;
  const g = gainNode.gain || gainNode;
  g.cancelScheduledValues(now);
  g.setValueAtTime(0, now);
  g.linearRampToValueAtTime(1, now + attack);
  g.linearRampToValueAtTime(sustain, now + attack + decay);
  g.setValueAtTime(sustain, now + attack + decay);
  g.linearRampToValueAtTime(0, now + attack + decay + release);
}

function filterEnvNode(filter, { attack, decay, sustain, release }, baseFreq, ctx) {
  const now = ctx.currentTime;
  const f = filter.frequency || filter;
  f.cancelScheduledValues(now);
  f.setValueAtTime(baseFreq, now);
  f.linearRampToValueAtTime(baseFreq * 3, now + attack);
  f.linearRampToValueAtTime(baseFreq * sustain, now + attack + decay);
  f.setValueAtTime(baseFreq * sustain, now + attack + decay);
  f.linearRampToValueAtTime(baseFreq, now + attack + decay + release);
}

function startVoice(noteFreq) {
  const ctx = ensureAudio();
  initFx(ctx);
  const osc = ctx.createOscillator();
  const subOsc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const analyser = ctx.createAnalyser();

  osc.type = synthVoiceState.oscType;
  osc.frequency.setValueAtTime(noteFreq, ctx.currentTime);
  osc.detune.setValueAtTime(synthVoiceState.detune, ctx.currentTime);

  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(noteFreq / 2, ctx.currentTime);

  filter.type = synthVoiceState.filter.type;
  filter.frequency.setValueAtTime(synthVoiceState.filter.freq, ctx.currentTime);
  filter.Q.setValueAtTime(synthVoiceState.filter.q, ctx.currentTime);

  osc.connect(filter);
  subOsc.connect(gain);
  filter.connect(gain);
  gain.gain.setValueAtTime(0, ctx.currentTime);

  gain.connect(analyser);
  analyser.connect(fxDry);
  fxDry.connect(ctx.destination);
  analyser.connect(fxWet);
  fxWet.connect(fxReverb);
  fxReverb.connect(fxDelay);
  fxDelay.connect(fxDistortion);
  fxDistortion.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);

  osc.start(ctx.currentTime);
  subOsc.start(ctx.currentTime);

  envGainNode(gain, synthVoiceState.env, ctx);
  filterEnvNode(filter, synthVoiceState.filter.env, synthVoiceState.filter.freq, ctx);

  const stopTime = ctx.currentTime + synthVoiceState.env.attack + synthVoiceState.env.decay + synthVoiceState.env.release + 0.5;
  osc.stop(stopTime);
  subOsc.stop(stopTime);

  const voice = { osc, subOsc, gain, filter, analyser, stopTime };
  activeVoices.set(noteFreq, voice);

  setTimeout(() => {
    try { osc.onended = null; } catch (e) {}
    activeVoices.delete(noteFreq);
  }, (stopTime - ctx.currentTime) * 1000 + 100);

  return voice;
}

function stopVoice(noteFreq) {
  const voice = activeVoices.get(noteFreq);
  if (!voice) return;
  try {
    voice.osc.stop();
    voice.subOsc.stop();
  } catch (e) {}
  activeVoices.delete(noteFreq);
}

function stopAllVoices() {
  for (const [freq, voice] of activeVoices) {
    try { voice.osc.stop(); voice.subOsc.stop(); } catch (e) {}
  }
  activeVoices.clear();
}

// =====================================================================
// 2. EFFETTI MASTER: Distortion, Delay stereo, Reverb
// =====================================================================

const fxState = {
  distortion: { enabled: false, drive: 1.5 },
  delay: { enabled: false, time: 0.25, feedback: 0.4 },
  reverb: { enabled: false, mix: 0.2 },
};

let fxDistortion, fxDelay, fxDelayFeedback, fxReverb, fxDry, fxWet, masterAnalyser;

function initFx(ctx) {
  if (fxDistortion) return;
  fxDistortion = ctx.createWaveShaper();
  fxDistortion.curve = makeDistortionCurve(fxState.distortion.drive);

  fxDelay = ctx.createDelay(1);
  fxDelay.delayTime.setValueAtTime(fxState.delay.time, 0);
  fxDelayFeedback = ctx.createGain();
  fxDelayFeedback.gain.setValueAtTime(fxState.delay.feedback, 0);
  fxDelay.connect(fxDelayFeedback);
  fxDelayFeedback.connect(fxDelay);

  fxReverb = ctx.createConvolver();
  fxReverb.buffer = makeImpulseResponse(ctx, 1.5);

  masterAnalyser = ctx.createAnalyser();

  fxDry = ctx.createGain();
  fxWet = ctx.createGain();
  fxWet.gain.setValueAtTime(fxState.reverb.mix, 0);
  fxDry.gain.setValueAtTime(1 - fxState.reverb.mix, 0);
}

function makeDistortionCurve(drive) {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; i++) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (Math.PI + drive) * x / (Math.PI + drive * Math.abs(x));
  }
  return curve;
}

function makeImpulseResponse(ctx, duration) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }
  return impulse;
}

function startSynthVoice(freq) {
  const noteFreq = freq || synthState.freq;
  return startVoice(noteFreq);
}

function stopSynthVoice(freq) {
  const noteFreq = freq || synthState.freq;
  stopVoice(noteFreq);
}

function drawWaveform() {
  const canvas = document.getElementById('waveform');
  if (!canvas || !masterAnalyser) {
    requestAnimationFrame(drawWaveform);
    return;
  }
  const ctx = canvas.getContext('2d');
  const bufferLength = masterAnalyser.frequencyBinCount;
  const data = new Uint8Array(bufferLength);
  masterAnalyser.getByteTimeDomainData(data);

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

document.querySelectorAll('.controls button[data-loop]').forEach((button) => {
  button.addEventListener('click', () => {
    const sound = button.dataset.loop;
    loopState[sound] = !loopState[sound];
    button.classList.toggle('active', loopState[sound]);
    if (loopState[sound]) {
      startAudio();
      // Mette il suono in tutti gli step della barra corrente
      const dp = currentBar().drumPatterns;
      for (let i = 0; i < SEQ_STEPS; i++) dp[sound][i] = 1;
      drawBarSteps(currentBarIndex);
      sounds[sound](ensureAudio());
    } else {
      // Toglie il suono da tutti gli step della barra corrente
      const dp = currentBar().drumPatterns;
      for (let i = 0; i < SEQ_STEPS; i++) dp[sound][i] = 0;
      drawBarSteps(currentBarIndex);
    }
  });
});

// =====================================================================
// 4. TASTIERA 2 OTTAVE (generata dinamicamente)
// =====================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_FREQS = {
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61,
  'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23,
  'F#4': 370.00, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25,
};
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]); // indici di bianco dopo cui c'è un nero

// Intonazione cromatica: arrotonda una frequenza al semitono più vicino (A4 = 440 Hz)
// così ogni nota registrata, anche se stonata, viene intonata automaticamente.
function quantizeToSemitone(freq) {
  if (!freq || freq <= 0) return 0;
  const n = Math.round(12 * Math.log2(freq / 440));
  return 440 * Math.pow(2, n / 12);
}

function buildKeyboard() {
  const whites = document.querySelector('.keyboard-whites');
  const blacks = document.querySelector('.keyboard-black');
  if (!whites || !blacks) return;
  let octave = 3;
  let whiteIndex = 0;
  NOTE_NAMES.forEach((name, i) => {
    const note = `${name}${octave}`;
    const freq = NOTE_FREQS[note];
    if (!freq) return;
    const white = document.createElement('button');
    white.type = 'button';
    white.className = 'key-white';
    white.dataset.note = note;
    white.dataset.freq = freq;
    white.title = note;
    white.addEventListener('mousedown', () => {
      white.classList.add('active');
      startAudio();
      synthVoiceState.freq = freq;
      startSynthVoice(freq);
      recordStepNote(freq);
    });
    white.addEventListener('mouseup', () => white.classList.remove('active'));
    white.addEventListener('mouseleave', () => white.classList.remove('active'));
    white.addEventListener('touchstart', (e) => {
      e.preventDefault();
      white.classList.add('active');
      startAudio();
      synthVoiceState.freq = freq;
      startSynthVoice(freq);
      recordStepNote(freq);
    }, { passive: false });
    white.addEventListener('touchend', () => white.classList.remove('active'));
    whites.appendChild(white);

    if (BLACK_AFTER.has(i)) {
      const black = document.createElement('button');
      black.type = 'button';
      black.className = 'key-black';
      black.dataset.note = `${name}#${octave}`;
      black.dataset.freq = NOTE_FREQS[`${name}#${octave}`];
      black.title = black.dataset.note;
      const blackFreq = NOTE_FREQS[`${name}#${octave}`];
      black.addEventListener('mousedown', () => {
        black.classList.add('active');
        startAudio();
        synthVoiceState.freq = blackFreq;
        startSynthVoice(blackFreq);
        recordStepNote(blackFreq);
      });
      black.addEventListener('mouseup', () => black.classList.remove('active'));
      black.addEventListener('mouseleave', () => black.classList.remove('active'));
      black.addEventListener('touchstart', (e) => {
        e.preventDefault();
        black.classList.add('active');
        startAudio();
        synthVoiceState.freq = blackFreq;
        startSynthVoice(blackFreq);
        recordStepNote(blackFreq);
      }, { passive: false });
      black.addEventListener('touchend', () => black.classList.remove('active'));
      blacks.appendChild(black);
    }

    whiteIndex++;
    if (name === 'B') octave++;
  });

  // Aggiungi C5 bianco finale
  const c5 = document.createElement('button');
  c5.type = 'button';
  c5.className = 'key-white';
  c5.dataset.note = 'C5';
  c5.dataset.freq = NOTE_FREQS['C5'];
  c5.title = 'C5';
  c5.addEventListener('mousedown', () => {
    c5.classList.add('active');
    startAudio();
    synthVoiceState.freq = NOTE_FREQS['C5'];
    startSynthVoice(NOTE_FREQS['C5']);
    recordStepNote(NOTE_FREQS['C5']);
  });
  c5.addEventListener('mouseup', () => c5.classList.remove('active'));
  c5.addEventListener('mouseleave', () => c5.classList.remove('active'));
  c5.addEventListener('touchstart', (e) => {
    e.preventDefault();
    c5.classList.add('active');
    startAudio();
    synthVoiceState.freq = NOTE_FREQS['C5'];
    startSynthVoice(NOTE_FREQS['C5']);
  }, { passive: false });
  c5.addEventListener('touchend', () => c5.classList.remove('active'));
  whites.appendChild(c5);
}

buildKeyboard();

// =====================================================================
// 5. STEP SEQUENCER 16 STEP
// =====================================================================

const SEQ_STEPS = 16;
const SEQ_BARS = 16; // 16 ottave/blocchi stile FL Studio, solo per la diretta

function newBar() {
  return {
    seqPattern: new Array(SEQ_STEPS).fill(0), // 0 = spento, oppure frequenza registrata (layer melodia)
    drumPatterns: {
      kick: new Array(SEQ_STEPS).fill(0),
      hats: new Array(SEQ_STEPS).fill(0),
      bass: new Array(SEQ_STEPS).fill(0),
    },
  };
}

const bars = Array.from({ length: SEQ_BARS }, newBar);
let currentBarIndex = 0; // barra corrente (ottava attiva e modificabile)

function currentBar() {
  return bars[currentBarIndex];
}

// Riferimenti alla barra corrente (aggiornati a ogni cambio di barra)
let seqPattern = currentBar().seqPattern;
let drumPatterns = currentBar().drumPatterns;

function switchBar(newIndex) {
  currentBarIndex = newIndex;
  seqPattern = currentBar().seqPattern;
  drumPatterns = currentBar().drumPatterns;
}

function clearCurrentBar() {
  const bar = currentBar();
  bar.seqPattern.fill(0);
  bar.drumPatterns.kick.fill(0);
  bar.drumPatterns.hats.fill(0);
  bar.drumPatterns.bass.fill(0);
}

// Registra la nota premuta nello step corrente della barra corrente (layer melodia live)
function recordStepNote(freq) {
  if (!seqIsPlaying) return;
  const bar = currentBar();
  bar.seqPattern[seqStepIndex] = quantizeToSemitone(freq);
  drawBarSteps(currentBarIndex);
}

let seqIsPlaying = false;
let seqStepIndex = 0;
let seqInterval = null;

const seqStepsEl = document.getElementById('seq-steps');
const seqStepLed = document.getElementById('seq-step');
const seqPlayBtn = document.getElementById('seq-play');
const bpmInp = document.getElementById('bpm');
const seqWaveSel = document.getElementById('seq-wave');
const seqGateInp = document.getElementById('seq-gate');

function buildSeqSteps() {
  if (!seqStepsEl) return;
  seqStepsEl.innerHTML = '';
  for (let b = 0; b < SEQ_BARS; b++) {
    const barEl = document.createElement('div');
    barEl.className = 'seq-bar';
    barEl.dataset.bar = b;
    if (b === currentBarIndex) barEl.classList.add('active');
    for (let i = 0; i < SEQ_STEPS; i++) {
      const step = document.createElement('button');
      step.type = 'button';
      step.className = 'seq-step';
      step.dataset.bar = b;
      step.dataset.index = i;
      step.addEventListener('click', () => {
        if (b !== currentBarIndex) return; // si può modificare solo la barra corrente
        const val = seqPattern[i] ? 0 : 1;
        seqPattern[i] = val;
        step.classList.toggle('active', val === 1);
        updateStepDrumClasses(step, i);
      });
      updateStepDrumClasses(step, i);
      barEl.appendChild(step);
    }
    seqStepsEl.appendChild(barEl);
  }
}
buildSeqSteps();

function activateBar(barIndex) {
  // Attiva visivamente solo il blocco corrente
  document.querySelectorAll('.seq-bar').forEach((barEl, b) => {
    barEl.classList.toggle('active', b === barIndex);
  });
  // Aggiorna i riferimenti alla barra corrente
  seqPattern = currentBar().seqPattern;
  drumPatterns = currentBar().drumPatterns;
  // Disegna gli step della barra corrente con lo stato salvato
  drawBarSteps(barIndex);
}

function drawBarSteps(barIndex) {
  const barEl = document.querySelector(`.seq-bar[data-bar="${barIndex}"]`);
  if (!barEl) return;
  const bar = bars[barIndex];
  const steps = barEl.querySelectorAll('.seq-step');
  steps.forEach((step, i) => {
    const noteVal = bar.seqPattern[i];
    step.classList.toggle('active', noteVal !== 0);
    updateStepDrumClasses(step, i);
  });
}

function updateStepDrumClasses(step, index) {
  const dp = currentBar().drumPatterns;
  step.classList.toggle('drum-kick', dp.kick[index] === 1);
  step.classList.toggle('drum-hats', dp.hats[index] === 1);
  step.classList.toggle('drum-bass', dp.bass[index] === 1);
}

function updateSeqLed(index) {
  if (!seqStepLed) return;
  seqStepLed.textContent = (index + 1).toString().padStart(2, '0');
  seqStepLed.classList.toggle('lit', true);
}

function clearSeqLed() {
  if (!seqStepLed) return;
  seqStepLed.classList.remove('lit');
}

function seqStepDurationMs() {
  const bpm = Number(bpmInp && bpmInp.value ? bpmInp.value : 120);
  return (60 / bpm) * 1000;
}

function playSeqStep(index) {
  const barEl = document.querySelector(`.seq-bar[data-bar="${currentBarIndex}"]`);
  const step = barEl ? barEl.querySelector(`.seq-step[data-index="${index}"]`) : null;
  if (step) {
    step.classList.add('playing');
    step.classList.toggle('record', seqPattern[index] !== 0);
    setTimeout(() => {
      step.classList.remove('playing');
      step.classList.remove('record');
    }, 120);
  }
  const noteVal = seqPattern[index];
  if (noteVal) {
    startAudio();
    const wave = (seqWaveSel && seqWaveSel.value) || 'sawtooth';
    // Se è un numero > 1 è una frequenza registrata (layer melodia), altrimenti usa la scala base
    const freq = typeof noteVal === 'number' && noteVal > 1 ? noteVal : (() => {
      const baseFreqs = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
      return baseFreqs[index % baseFreqs.length];
    })();
    synthVoiceState.oscType = wave;
    startSynthVoice(freq);
  }
  const ctx = ensureAudio();
  const dp = currentBar().drumPatterns;
  if (dp.kick[index]) playKick(ctx);
  if (dp.hats[index]) playHats(ctx);
  if (dp.bass[index]) playBass(ctx);
}

function seqTick() {
  playSeqStep(seqStepIndex);
  updateSeqLed(seqStepIndex);
  seqStepIndex++;
  if (seqStepIndex >= SEQ_STEPS) {
    // Fine barra: passa alla successiva senza cancellare i pattern registrati
    const nextBar = (currentBarIndex + 1) % SEQ_BARS;
    switchBar(nextBar);
    activateBar(nextBar);
    seqStepIndex = 0;
  }
}
function toggleSeq() {
  if (seqIsPlaying) {
    stopSeq();
  } else {
    startSeq();
  }
}

function startSeq() {
  if (seqIsPlaying) return;
  seqIsPlaying = true;
  if (seqPlayBtn) seqPlayBtn.textContent = '⏹ Stop';
  seqStepIndex = 0;
  seqTick();
  const ms = seqStepDurationMs();
  seqInterval = setInterval(seqTick, ms);
}

function stopSeq() {
  if (!seqIsPlaying) return;
  seqIsPlaying = false;
  if (seqPlayBtn) seqPlayBtn.textContent = '▶ Play';
  clearInterval(seqInterval);
  seqInterval = null;
  clearSeqLed();
}

if (seqPlayBtn) seqPlayBtn.addEventListener('click', toggleSeq);
if (bpmInp) bpmInp.addEventListener('input', () => {
  if (seqIsPlaying) {
    clearInterval(seqInterval);
    seqInterval = setInterval(seqTick, seqStepDurationMs());
  }
});

// =====================================================================
// 6. DRUM PADS: controlli pitch e decay
// =====================================================================

wireControl(document.getElementById('drum-kick-pitch'), 'input', (v) => { drumState.kick.pitch = Number(v); });
wireControl(document.getElementById('drum-kick-decay'), 'input', (v) => { drumState.kick.decay = Number(v); });
wireControl(document.getElementById('drum-hats-pitch'), 'input', (v) => { drumState.hats.pitch = Number(v); });
wireControl(document.getElementById('drum-hats-decay'), 'input', (v) => { drumState.hats.decay = Number(v); });
wireControl(document.getElementById('drum-bass-pitch'), 'input', (v) => { drumState.bass.pitch = Number(v); });
wireControl(document.getElementById('drum-bass-decay'), 'input', (v) => { drumState.bass.decay = Number(v); });

// =====================================================================
// 7. LED DI STATO E ESPORTAZIONE PATTERN
// =====================================================================

const ledClock = document.getElementById('led-clock');
const ledSeq = document.getElementById('led-seq');
const exportBtn = document.getElementById('export-pattern');

let clockLedOn = false;
let clockInterval = null;

function tickClockLed() {
  if (!ledClock) return;
  clockLedOn = !clockLedOn;
  ledClock.classList.toggle('off', clockLedOn);
}

function setSeqLed(on) {
  if (!ledSeq) return;
  ledSeq.classList.toggle('off', !on);
}

const origStartSeq = startSeq;
const origStopSeq = stopSeq;
startSeq = function () {
  origStartSeq();
  setSeqLed(true);
  if (!clockLedOn) {
    tickClockLed();
    clockInterval = setInterval(tickClockLed, 250);
  }
};
stopSeq = function () {
  origStopSeq();
  setSeqLed(false);
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
};

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify({ pattern: seqPattern, bpm: Number(bpmInp.value), wave: seqWaveSel.value }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'khorg-pattern.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

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

wireControl(waveTypeSel, 'change', (v) => { synthState.oscType = v; });
wireControl(freqInp, 'input', (v) => { synthState.freq = Number(v); });
wireControl(masterVolInp, 'input', (v) => { synthState.masterVol = Number(v); });
wireControl(envAttack, 'input', (v) => { synthState.env.attack = Number(v); });
wireControl(envDecay, 'input', (v) => { synthState.env.decay = Number(v); });
wireControl(envSustain, 'input', (v) => { synthState.env.sustain = Number(v); });
wireControl(envRelease, 'input', (v) => { synthState.env.release = Number(v); });
wireControl(filterTypeSel, 'change', (v) => { synthState.filter.type = v; });
wireControl(filterFreq, 'input', (v) => { synthState.filter.freq = Number(v); });
wireControl(filterQ, 'input', (v) => { synthState.filter.q = Number(v); });

function wireControl(el, event, handler) {
  if (!el) return;
  el.addEventListener(event, () => handler(el.value));
  el.addEventListener('change', () => handler(el.value));
}

drawWaveform();
console.log('Khorg pronto');
