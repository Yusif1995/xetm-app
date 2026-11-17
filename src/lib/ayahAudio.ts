"use client";

// Recitation, one mp3 per ayah, streamed from everyayah.com (Saad al-Ghamdi). Files are named
// SSSAAA.mp3; 001001 is the basmala, played before ayah 1 of every surah but al-Fatiha and at-Tawba
// when a whole page is played.
import { useCallback, useEffect, useRef, useState } from "react";

const RECITER_URL = "https://everyayah.com/data/Ghamadi_40kbps";

export const ayahAudioUrl = (s: number, a: number) =>
  `${RECITER_URL}/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;

export interface Track {
  s: number;
  a: number;
  basmala?: boolean;
}

// The tracks for a run of ayahs, with the basmala before a surah's first ayah
export function tracksFor(ayahs: { s: number; a: number }[]): Track[] {
  const out: Track[] = [];
  for (const { s, a } of ayahs) {
    if (a === 1 && s !== 1 && s !== 9) out.push({ s, a: 1, basmala: true });
    out.push({ s, a });
  }
  return out;
}

export interface Player {
  queue: Track[];
  index: number;
  playing: boolean;
  failed: boolean;
  current: Track | null;
  play: (tracks: Track[]) => void;
  toggle: () => void;
  stop: () => void;
}

export function useAyahPlayer(): Player {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const state = useRef({ queue: [] as Track[], index: 0 });

  const load = useCallback((i: number) => {
    const el = audio.current;
    const t = state.current.queue[i];
    if (!el || !t) return;
    state.current.index = i;
    setIndex(i);
    setFailed(false);
    el.src = t.basmala ? ayahAudioUrl(1, 1) : ayahAudioUrl(t.s, t.a);
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audio.current = el;
    const onEnded = () => {
      const next = state.current.index + 1;
      if (next < state.current.queue.length) load(next);
      else {
        setPlaying(false);
        setQueue([]);
        state.current = { queue: [], index: 0 };
      }
    };
    const onError = () => { setFailed(true); setPlaying(false); };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    return () => {
      el.pause();
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
      audio.current = null;
    };
  }, [load]);

  const play = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return;
    state.current = { queue: tracks, index: 0 };
    setQueue(tracks);
    load(0);
  }, [load]);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      if (failed) load(state.current.index);
      else el.play().catch(() => setPlaying(false));
    } else el.pause();
  }, [failed, load]);

  const stop = useCallback(() => {
    audio.current?.pause();
    state.current = { queue: [], index: 0 };
    setQueue([]);
    setPlaying(false);
    setFailed(false);
  }, []);

  return { queue, index, playing, failed, current: queue[index] || null, play, toggle, stop };
}
