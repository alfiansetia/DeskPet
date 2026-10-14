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
  const width = reserves.alert
    ? Math.max(tight, 360)
    : reserves.mini
      ? Math.max(tight, 330)
      : tight;
  // Tinggi di sini hanya tebakan awal; tinggi final diukur dari DOM via
  // measurePetContentHeight agar bubble sepanjang apa pun tidak kepotong.
  const height = tight
    + (reserves.alert ? 190 : 0)
    + (reserves.mini ? 38 : 0)
    + (reserves.temp ? 30 : 0)
    + (reserves.timer ? 28 : 0)
    + 6;
  return { width, height };
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
    const petR = document.querySelector(".dp-pet-wrap")?.getBoundingClientRect();
    const petH = petR && petR.height > 0 ? petR.height : PET_SPRITE_PX * effectiveScale;
    const hOf = (sel: string): number => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return el ? Math.ceil(el.offsetHeight) : 0;
    };
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
    total += Math.ceil(petH);
    if (statusH > 0) total += 6 + statusH;
    total += anchoredBottom ? 10 : 8; // padding-bottom root
    return Math.max(Math.ceil(total) + 8, minH); // +8 pengaman font-scale/pembulatan
  } catch {
    return minH;
  }
}
