/** TTS via native speechSynthesis (PRD §5.5). Queue + mute + stop. Local only. */
let queue: string[] = [];
let speaking = false;

function voices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis?.getVoices() ?? [];
  } catch {
    return [];
  }
}

function pump(muted: boolean, rate = 1, volume = 1): void {
  if (speaking || muted) return;
  const next = queue.shift();
  if (!next) return;
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(next);
    u.rate = rate; u.volume = volume;
    const idVoices = voices().filter((v) => v.lang.startsWith("id"));
    if (idVoices.length > 0) u.voice = idVoices[0];
    u.onend = () => { speaking = false; pump(muted, rate, volume); };
    u.onerror = () => { speaking = false; };
    speaking = true;
    window.speechSynthesis.speak(u);
  } catch {
    speaking = false;
  }
}

export function speak(text: string, opts: { muted: boolean; rate?: number; volume?: number } = { muted: false }): void {
  const clean = text.trim().slice(0, 280);
  if (!clean || opts.muted) return;
  // Never auto-speak sensitive bulk content: caller must pass explicit short strings.
  queue.push(clean);
  if (queue.length > 3) queue = queue.slice(-3);
  pump(opts.muted, opts.rate, opts.volume);
}

export function stopSpeech(): void {
  queue = [];
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  speaking = false;
}

export function availableVoices(): { name: string; lang: string }[] {
  return voices().map((v) => ({ name: v.name, lang: v.lang }));
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
