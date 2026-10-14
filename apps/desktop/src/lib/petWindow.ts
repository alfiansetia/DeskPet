/**
 * Ukuran window logis (CSS px) untuk jendela pet transparan.
 *
 * Window DIPELUK ke sprite agar area transparan yang ikut memblokir klik ke
 * window di belakang seminimal mungkin dan dinamis mengikuti petScale:
 * sprite 128px + breathing 32px (16/sisi untuk bob/shadow/outline).
 * Skala dasar tampilan 0.5 (sprite 128px dirender 64px, tetap tajam karena
 * sumber 2x + `image-rendering: pixelated`), sehingga 100% di pengaturan
 * = ukuran default yang ringkas. Pill countdown / bubble alert / badge timer
 * melebarkan/meninggikan window hanya saat kontennya sedang tampil.
 */
export const PET_SPRITE_PX = 128;
export const PET_WINDOW_BREATHING = 32;

/** Skala dasar tampilan: aset 128px tampil 64px @100%. Naikkan bila ingin default lebih besar. */
export const PET_BASE_SCALE = 0.5;

/**
 * Skala efektif render = (alert 200% ? 2 : petScale) x skala dasar.
 * Alert penting selalu 2x dari ukuran normal user (64px -> 128px @100%).
 */
export function resolveEffectiveScale(petScale: number, alertEnlarged: boolean): number {
  const s = Number.isFinite(petScale) ? Math.min(2, Math.max(0.5, petScale)) : 1;
  return (alertEnlarged ? 2 : s) * PET_BASE_SCALE;
}

/**
 * Kotak layout wrapper pet (CSS px). HARUS sama dengan ukuran visual hasil
 * scale agar tidak ada ruang transparan hantu di layout: transform scale
 * tidak mengubah layout box, jadi tanpa ini badge timer / bubble terlihat
 * jauh dari pet (gap selebar selisih box 128px vs visual 64px @100%).
 */
export function petWrapBox(effectiveScale: number): { width: number; height: number } {
  const s = Math.max(1, Math.round(PET_SPRITE_PX * effectiveScale));
  return { width: s, height: s };
}

export interface PetWindowReserves {
  alert: boolean;
  mini: boolean;
  temp: boolean;
  timer: boolean;
}

export function petWindowLogicalSize(
  effectiveScale: number,
  reserves: PetWindowReserves,
): { width: number; height: number } {
  const tight = Math.round(PET_SPRITE_PX * effectiveScale + PET_WINDOW_BREATHING);
  // Lebar mengikuti konten terlebar yang sedang tampil: alert (wrap multi-baris)
  // > mini (satu baris countdown) > temp/sapaan (teks pendek). Tanpa ini,
  // temp-only (tanpa mini) terjepit di window ~96px -> pill kepotong samping.
  const width = reserves.alert
    ? Math.max(tight, 360)
    : reserves.mini
      ? Math.max(tight, 330)
      : reserves.temp
        ? Math.max(tight, 250)
        : tight;
  // Tinggi di sini hanya tebakan awal; tinggi final diukur dari DOM via
  // measurePetContentHeight agar bubble sepanjang apa pun tidak kepotong.
  // Slot ambient hanya menampung SATU pill (rotasi suhu <-> countdown),
  // jadi cadangannya satu pill (38px) berapa pun yang tersedia.
  const slot = reserves.mini || reserves.temp;
  const height = tight
    + (reserves.alert ? 190 : 0)
    + (slot ? 38 : 0)
    + (reserves.timer ? 28 : 0)
    + 6;
  return { width, height };
}

/**
 * Ukur lebar konten aktual (CSS px): bubble/pill/sapaan terlebar + napas
 * horizontal. Dipakai untuk mengoreksi tebakan lebar awal — sama seperti
 * tinggi, agar pill/sapaan tidak kepotong samping saat teksnya panjang
 * (mis. nama kota + countdown) atau saat font-scale OS membesar.
 * Pakai max(offsetWidth, scrollWidth): offsetWidth terjepit selebar window
 * saat konten overflow, scrollWidth menyimpan kebutuhan penuhnya.
 * Tidak pernah lebih kecil dari `fallback` (anti-flicker countdown).
 */
export function measurePetContentWidth(fallback: number): number {
  try {
    const needOf = (sel: string): number => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return 0;
      return Math.max(el.offsetWidth || 0, el.scrollWidth || 0);
    };
    const stack = ".dp-pet-stack, [data-testid='pet-stack']";
    const needs = [
      needOf(".dp-root > .dp-speech"),
      needOf(".dp-root > .dp-bubble-mini"),
      needOf(".dp-root > .dp-bubble-temp"),
      needOf(`${stack} > .dp-greet`),
      needOf(".dp-root > .dp-status"),
    ];
    const widest = Math.max(0, ...needs);
    if (widest <= 0) return fallback;
    // +24 napas horizontal (padding window + bayangan), dibulatkan ke atas.
    return Math.max(fallback, Math.ceil(widest) + 24);
  } catch {
    return fallback;
  }
}

/**
 * Ukur tinggi konten aktual (CSS px) untuk window pet: bubble + pill + pet
 * + badge + margin/padding layout. Dipakai setelah window di-resize ke lebar
 * final (bubble wrap mengikuti lebar), lalu tinggi window dikoreksi.
 * Tidak pernah lebih kecil dari ukuran tight agar blocking tetap minimal
 * tapi tidak collapse saat DOM belum siap.
 */
export function measurePetContentHeight(effectiveScale: number): number {
  const minH = Math.round(PET_SPRITE_PX * effectiveScale + PET_WINDOW_BREATHING) + 6;
  try {
    const hOf = (sel: string): number => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return el ? Math.ceil(el.offsetHeight) : 0;
    };
    // Tinggi pet WAJIB dari box layout luar (.dp-pet-stack, offsetHeight tidak
    // kena transform). JANGAN pakai getBoundingClientRect(.dp-pet-wrap): wrap
    // punya `transform: scale()` sehingga rect = box × scale (64×0.5 = 32
    // @100%) padahal sprite terlukis 64px — window jadi ~32px kependekan dan
    // ATAS selalu kepotong, makin parah saat konten tinggi (slot + badge).
    const stackH = Math.max(hOf(".dp-pet-stack"), hOf("[data-testid='pet-stack']"));
    const petR = stackH > 0 ? null : document.querySelector(".dp-pet-wrap")?.getBoundingClientRect();
    const petH = stackH > 0
      ? stackH
      : petR && petR.height > 0 ? petR.height : PET_SPRITE_PX * effectiveScale;
    // Overlay (sapaan/hati/emote) dijangkarkan ke stack pet — dukung selektor
    // lama (class) maupun baru (testid) agar tidak pernah 0 diam-diam.
    const hOfStack = (cls: string): number => Math.max(
      hOf(`.dp-pet-stack > ${cls}`),
      hOf(`[data-testid='pet-stack'] > ${cls}`),
    );
    const hasBubble = !!document.querySelector(".dp-root.has-bubble");
    const hasStatus = !!document.querySelector(".dp-root.has-status");
    const anchoredBottom = hasBubble || hasStatus; // padding-bottom root 10
    const speechH = hOf(".dp-root > .dp-speech"); // margin-bottom 0 (ekor speech menjembatani)
    const miniH = hOf(".dp-root > .dp-bubble-mini"); // margin-bottom 2
    const tempH = hOf(".dp-root > .dp-bubble-temp"); // margin-bottom 2
    const statusH = hOf(".dp-root > .dp-status"); // margin-top 6
    let total = 6; // napas atas
    if (speechH > 0) total += speechH;
    if (tempH > 0) total += tempH + 2;
    if (miniH > 0) total += miniH + 2;
    // Overlay mengambang (sapaan/hati/emote): absolute di atas stack, di atas
    // pill (--above). Ambil yang tertinggi agar tak kepotong window.
    // Hanya SATU overlay yang dirender dalam satu waktu (prioritas di App:
    // hearts > greet > emote), jadi max() di sini setara tingginya.
    // Basis mencakup travel animasi: hearts melayang naik 14px
    // (dp-heart-float), emote naik 18px (dp-emote-float, terlihat penuh
    // sampai -8px) — tanpa ini puncak animasi kepotong tepi atas.
    const ov = (cls: string, base: number): number => {
      const h = hOfStack(cls);
      return h > 0 ? h + base : 0;
    };
    total += Math.max(
      ov(".dp-greet", 6),
      ov(".dp-hearts", 8),
      ov(".dp-micro-emote", 26),
    );
    total += Math.ceil(petH);
    if (statusH > 0) total += 6 + statusH;
    total += anchoredBottom ? 10 : 8; // padding-bottom root
    return Math.max(Math.ceil(total) + 8, minH); // +8 pengaman font-scale/pembulatan
  } catch {
    return minH;
  }
}
