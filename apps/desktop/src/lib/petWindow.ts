/**
 * Ukuran window logis (CSS px) untuk jendela pet transparan.
 *
 * Window DIPELUK ke sprite agar area transparan yang ikut memblokir klik ke
 * window di belakang seminimal mungkin dan dinamis mengikuti petScale:
 * sprite 128px + breathing 32px (16/sisi untuk bob/shadow/outline).
 * Pill countdown / bubble alert / badge timer melebarkan/meninggikan window
 * hanya saat kontennya sedang tampil.
 */
export const PET_SPRITE_PX = 128;
export const PET_WINDOW_BREATHING = 32;

export interface PetWindowReserves {
  alert: boolean;
  mini: boolean;
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
    + (reserves.timer ? 28 : 0)
    + 8;
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
  const minH = Math.round(PET_SPRITE_PX * effectiveScale + PET_WINDOW_BREATHING) + 8;
  try {
    const petR = document.querySelector(".dp-pet-wrap")?.getBoundingClientRect();
    const petH = petR && petR.height > 0 ? petR.height : PET_SPRITE_PX * effectiveScale;
    const hOf = (sel: string): number => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return el ? Math.ceil(el.offsetHeight) : 0;
    };
    const hasBubble = !!document.querySelector(".dp-root.has-bubble");
    const speechH = hOf(".dp-root > .dp-speech"); // margin-bottom 2
    const miniH = hOf(".dp-root > .dp-bubble-mini"); // margin-bottom 4
    const statusH = hOf(".dp-root > .dp-status"); // margin-top 6
    let total = 8; // napas atas
    if (speechH > 0) total += speechH + 2;
    if (miniH > 0) total += miniH + 4;
    total += Math.ceil(petH);
    if (statusH > 0) total += 6 + statusH;
    total += hasBubble ? 10 : 8; // padding-bottom root
    return Math.max(Math.ceil(total) + 2, minH); // +2 pengaman pembulatan
  } catch {
    return minH;
  }
}
