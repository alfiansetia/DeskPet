/** Setting autostart OS: checkbox niat user + status terpasang + tombol selaras.
 *  Windows = Run key, macOS = LaunchAgent (via tauri-plugin-autostart).
 */
import { useEffect, useState } from "react";
import type { DeskSettings } from "../../lib/store";
import { toast } from "../../lib/notify";
import { ensureAutostart, getAutostartState, type AutostartState } from "./autostart";

const STATUS_TEXT: Record<AutostartState | "checking", string> = {
  checking: "mengecek status OS…",
  enabled: "aktif di OS ✅",
  disabled: "belum terpasang di OS",
  unsupported: "tidak didukung di mode preview",
};

export function AutostartView({
  settings, upd,
}: {
  settings: DeskSettings;
  upd: (patch: Partial<DeskSettings>) => void;
}) {
  const [osState, setOsState] = useState<AutostartState | "checking">("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAutostartState().then((s) => { if (!cancelled) setOsState(s); });
    return () => { cancelled = true; };
  }, []);

  const errMsg = (e: unknown) =>
    e instanceof Error ? e.message : String(e);

  const onToggle = async (on: boolean) => {
    upd({ autoStart: on });
    setBusy(true);
    try {
      setOsState(await ensureAutostart(on, true));
      toast(
        on ? "Auto-start dinyalakan" : "Auto-start dimatikan",
        on ? "DeskPet terbuka otomatis saat login." : "DeskPet tidak lagi terbuka saat login.",
        "success",
      );
    } catch (e) {
      // Niat tetap tersimpan; dicoba lagi otomatis saat boot berikutnya.
      setOsState(await getAutostartState());
      toast("Autostart gagal dipasang", `${errMsg(e)} Niat tersimpan, dicoba lagi saat boot.`, "error");
    } finally {
      setBusy(false);
    }
  };

  // Selaraskan OS dengan setting (pasang bila belum ada / copot bila berlebih).
  const onFix = async () => {
    setBusy(true);
    try {
      const st = await ensureAutostart(settings.autoStart, true);
      setOsState(st);
      toast("Autostart selaras", st === "enabled" ? "Terpasang di OS." : "Tidak terpasang di OS.", "success");
    } catch (e) {
      setOsState(await getAutostartState());
      toast("Gagal menyelaraskan", errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };

  // Mismatch = setting minta on tapi OS belum pasang (atau sebaliknya).
  const mismatch = osState !== "checking" && osState !== "unsupported"
    && ((settings.autoStart && osState === "disabled") || (!settings.autoStart && osState === "enabled"));

  return (
    <div>
      <label className="dp-check">
        <input type="checkbox" checked={settings.autoStart === true}
          disabled={busy}
          onChange={(e) => void onToggle(e.target.checked)} />
        Buka otomatis saat login (startup)
      </label>
      <div className="dp-row" style={{ alignItems: "center", margin: "2px 0 0 22px" }}>
        <span className="dp-muted" data-testid="autostart-status" style={{ fontSize: 12 }}>
          Status OS: {STATUS_TEXT[osState]}
        </span>
        {mismatch && (
          <button className="dp-btn sm" data-testid="autostart-fix" disabled={busy} onClick={() => void onFix()}
            title="Samakan status OS dengan setting">
            {settings.autoStart ? "Pasang" : "Selaraskan"}
          </button>
        )}
      </div>
    </div>
  );
}
