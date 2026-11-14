// 音效與震動：全部用 Web Audio 現場合成（不用音檔），走 8-bit 的路線，和像素畫面搭配。
//   play(name)：播一個音效（名稱見下面的 SOUNDS）
//   buzz(pattern)：手機震動（不支援的裝置什麼都不做）
//   initSoundToggle(button)：靜音開關，選擇會記住
// 瀏覽器規定要等使用者點過畫面才能出聲，所以第一次點擊或按鍵時才建立 AudioContext；
// 在那之前呼叫 play() 會直接略過。
const KEY = 'aliao-muted';
let muted = localStorage.getItem(KEY) === '1';
let ctx = null, out = null, noiseBuf = null;

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.45;
    out.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);    // 一秒的白噪音，各種沙沙聲共用
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);

/* ---------- 兩種基本的聲音：音調、噪音 ---------- */

// 一個音：freq 滑到 to，音量快速起音後指數衰減
function tone(freq, dur, { type = 'square', vol = 0.15, to = freq, at = 0, attack = 0.005 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// 一段濾波過的噪音：filter 的頻率從 freq 滑到 to
function noise(dur, { vol = 0.2, type = 'bandpass', freq = 1000, to = freq, q = 1, at = 0, attack = 0.005 } = {}) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  s.loop = true;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to !== freq) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

/* ---------- 音效 ---------- */

const bark = (at = 0) => {
  tone(330, 0.13, { type: 'sawtooth', vol: 0.2, to: 150, at });
  noise(0.09, { vol: 0.18, freq: 700, q: 2, at });
};

const SOUNDS = {
  tick: () => tone(1400, 0.03, { vol: 0.05 }),                                    // 按鈕
  pick: () => tone(660, 0.09, { to: 1100 }),                                      // 拿起東西
  place: () => { tone(520, 0.06, { type: 'triangle', vol: 0.2 }); tone(780, 0.08, { type: 'triangle', vol: 0.2, at: 0.06 }); },
  step: () => { tone(784, 0.1, { type: 'triangle', vol: 0.22 }); tone(1047, 0.18, { type: 'triangle', vol: 0.22, at: 0.09 }); },
  done: () => {                                                                    // 任務完成的小號角
    [523, 659, 784].forEach((f, i) => tone(f, 0.12, { vol: 0.13, at: i * 0.09 }));
    tone(1047, 0.45, { vol: 0.13, at: 0.27 });
    tone(131, 0.6, { type: 'triangle', vol: 0.25, at: 0.27 });
    tone(1319, 0.35, { type: 'triangle', vol: 0.08, at: 0.36 });
  },
  dayDone: () => {                                                                 // 一天全部做完
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.12, { vol: 0.12, at: i * 0.1 }));
    tone(131, 0.9, { type: 'triangle', vol: 0.25, at: 0.6 });
  },
  woof: () => bark(),
  woof2: () => { bark(); bark(0.2); },
  meow: () => {
    const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.18);
    o.frequency.linearRampToValueAtTime(430, t + 0.5);
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + 0.6);
  },
  clip: () => { tone(2400, 0.03, { vol: 0.1 }); tone(1800, 0.05, { vol: 0.1, at: 0.05 }); },   // 牽繩扣上
  door: () => { tone(300, 0.3, { type: 'triangle', vol: 0.1, to: 220 }); noise(0.18, { type: 'lowpass', freq: 300, vol: 0.4, at: 0.25 }); },
  drawer: () => noise(0.28, { freq: 600, to: 1200, q: 3, vol: 0.25 }),
  gate: () => { tone(1250, 0.15, { vol: 0.08 }); tone(1680, 0.12, { vol: 0.06, at: 0.01 }); noise(0.06, { type: 'highpass', freq: 3000, vol: 0.12 }); },
  flush: () => noise(1.5, { freq: 300, to: 1600, q: 0.8, vol: 0.35, attack: 0.15 }),
  pour: () => { for (let i = 0; i < 16; i++) noise(0.02, { type: 'highpass', freq: 2500 + Math.random() * 2000, vol: 0.2, at: i * 0.035 + Math.random() * 0.02 }); },
  scoop: () => { noise(0.22, { type: 'lowpass', freq: 1800, to: 600, vol: 0.3 }); noise(0.15, { type: 'lowpass', freq: 1200, vol: 0.2, at: 0.25 }); },
  munch: () => noise(0.05, { type: 'lowpass', freq: 1400, vol: 0.25 }),
  whoosh: () => noise(0.25, { freq: 400, to: 1800, q: 1.5, vol: 0.25 }),
  hit: () => { tone(140, 0.3, { type: 'sine', vol: 0.6, to: 45 }); noise(0.12, { type: 'lowpass', freq: 500, vol: 0.4 }); },
  press: () => tone(320, 0.08, { type: 'sine', vol: 0.3, to: 220 }),
  relief: () => [523, 659, 784].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.12, at: i * 0.12, attack: 0.05 })),
  ouch: () => tone(340, 0.28, { vol: 0.12, to: 180 }),
  alarm: () => [0, 0.2, 0.4].forEach((at, i) => tone(i % 2 ? 660 : 880, 0.14, { vol: 0.1, at })),
  tv: () => { noise(0.2, { type: 'highpass', freq: 2000, vol: 0.15 }); tone(1000, 0.08, { type: 'sine', vol: 0.15, at: 0.2 }); },
};

export function play(name) {
  if (muted || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
  SOUNDS[name]();
}

// 點到任務目標時的音效（id 後面的編號不算：pad0、pad1 都是 pad）
const TARGETS = {
  leash: ['pick'], dog: ['clip', 'woof'], bag: ['pick'], door: ['door'], stack: ['pick'], toilet: ['flush'],
  backdoor: ['door'], bowl: ['pick'], kibble: ['pour'], freeze: ['pour'], drawer: ['drawer'], litter: ['scoop'],
  catfood: ['pick'], gate: ['gate'], pad: ['pick'], poop: ['pick'], spot: ['place'], catbowl: ['pour', 'meow'],
};
export function playTarget(id) {
  for (const name of TARGETS[id.replace(/\d+$/, '')] || ['pick']) play(name);
}

export function buzz(pattern) {
  if (!muted && navigator.vibrate) navigator.vibrate(pattern);
}

// 底部狀態列的靜音開關
export function initSoundToggle(button) {
  const render = () => {
    button.classList.toggle('off', muted);
    button.setAttribute('aria-pressed', String(!muted));
    button.querySelector('small').textContent = muted ? '靜音' : '聲音';
  };
  button.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(KEY, muted ? '1' : '0');
    render();
    play('tick');
  });
  render();
}

// 畫面上的按鈕都有一個輕輕的按鍵聲
document.addEventListener('click', e => { if (e.target.closest('button')) play('tick'); }, true);
