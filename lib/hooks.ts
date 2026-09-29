"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiSekali, bersihkanCacheApi } from "./api";

export const EVENT_RELOAD = "finansial:reload";
export const EVENT_BOOTSTRAP = "finansial:bootstrap";

/** Panggil setelah menyimpan data agar semua halaman memuat ulang. */
export function picuMuatUlang() {
  if (typeof window !== "undefined") {
    bersihkanCacheApi();
    window.dispatchEvent(new Event(EVENT_RELOAD));
  }
}

/** Panggil setelah dompet atau kategori berubah. */
export function picuBootstrap() {
  if (typeof window !== "undefined") {
    bersihkanCacheApi();
    window.dispatchEvent(new Event(EVENT_BOOTSTRAP));
    window.dispatchEvent(new Event(EVENT_RELOAD));
  }
}

/**
 * Ambil data dari backend Apps Script.
 * `action` null berarti tidak memuat apa pun (mis. menunggu pilihan filter).
 *
 * Hasilnya disimpan sebentar oleh apiSekali(), jadi berpindah menu bolak-balik
 * tidak memanggil server lagi. Setelah menyimpan data, cache dibuang lewat
 * picuMuatUlang() sehingga angkanya selalu segar.
 */
export function useApi<T = unknown>(
  action: string | null,
  payload?: Record<string, unknown>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!action);
  const [error, setError] = useState<ApiError | null>(null);
  const [versi, setVersi] = useState(0);

  const kunci = JSON.stringify(payload ?? null);

  useEffect(() => {
    if (!action) {
      setLoading(false);
      return;
    }
    let dibatalkan = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        /* versi > 0 berarti pemuatan ulang yang diminta pengguna atau
           dipicu penyimpanan data: lewati cache */
        const hasil = await apiSekali<T>(action, JSON.parse(kunci), {
          paksa: versi > 0,
        });
        if (!dibatalkan) setData(hasil);
      } catch (e) {
        if (!dibatalkan) {
          setError(e instanceof ApiError ? e : new ApiError("ERROR", String(e)));
        }
      } finally {
        if (!dibatalkan) setLoading(false);
      }
    })();

    return () => {
      dibatalkan = true;
    };
  }, [action, kunci, versi]);

  /* semua hook ikut menyegarkan diri saat data berubah di mana pun */
  useEffect(() => {
    const handler = () => setVersi((v) => v + 1);
    window.addEventListener(EVENT_RELOAD, handler);
    return () => window.removeEventListener(EVENT_RELOAD, handler);
  }, []);

  const reload = useCallback(() => setVersi((v) => v + 1), []);

  return { data, loading, error, reload };
}
