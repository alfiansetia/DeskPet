/** Efek suara mungil WebAudio (offline, tanpa file aset).
 * No-op aman bila AudioContext tak tersedia (jsdom/SSR) atau dibisukan.
 */
export function playPetSound(muted: boolean): void {
  if (muted) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    // Arpeggio ceria naik: C5 -> E5 -> G5
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const start = t0 + i * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.15);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* audio tidak tersedia — abaikan */
  }
}
