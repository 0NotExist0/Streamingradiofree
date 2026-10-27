'use strict';

/* Khorg — sintetizzatore browser: kick, hats, bass */

const ctxState = { audioCtx: null, started: false };

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
  gainNode.setValueAtTime(0, now);
  gainNode.linearRampToValueAtTime(1, now + attack);
  gainNode.linearRampToValueAtTime(sustain, now + attack + decay);
  gainNode.setValueAtTime(sustain, now + attack + decay);
  gainNode.linearRampToValueAtTime(0, now + attack + decay + release);
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

document.querySelectorAll('.controls button').forEach((button) => {
  button.addEventListener('click', () => {
    startAudio();
    const ctx = ensureAudio();
    const fn = sounds[button.dataset.sound];
    if (fn) fn(ctx);
  });
});

console.log('Khorg pronto');
