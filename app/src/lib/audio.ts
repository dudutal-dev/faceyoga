// מנוע הקול: אלמנט קריינות אחד + אלמנט מוזיקה אחד, מיקסר Web Audio (iOS מתעלם מ-element.volume),
// ducking של המוזיקה בזמן דיבור, וגיבוי speechSynthesis בעברית לשורה שעוד לא הופקה.
import { contentUrl, type Manifest } from '../content/manifest';

export class Voice {
  private nar = new Audio();
  private music = new Audio();
  private ui = new Audio();
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicLevel = 0.5;
  private cancelled = 0;
  private pending: (() => void) | null = null; // משחרר המתנה לשורה שנעצרה באמצע (אחרת onended לא יורה והמפגש נתקע)
  constructor(private m: Manifest, private fallback: Record<string, string>) {
    this.nar.preload = 'auto'; this.music.loop = true; this.music.preload = 'auto';
  }
  /** חייב לרוץ מתוך נגיעה: משחרר שמע ב-iOS/Android ובונה את המיקסר. */
  unlock(musicOn: boolean, level: number) {
    this.musicLevel = level;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = musicOn ? level : 0;
      this.ctx.createMediaElementSource(this.music).connect(this.musicGain).connect(this.ctx.destination);
    } catch { this.music.volume = level; }
    if (this.m.audio.music) { this.music.src = contentUrl(this.m.audio.music); if (musicOn) this.music.play().catch(() => {}); }
    this.nar.play().catch(() => {}); this.nar.pause();
    if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.lang = 'he-IL'; speechSynthesis.speak(u); }
  }
  setMusic(on: boolean) {
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? this.musicLevel : 0, this.ctx.currentTime, 0.3);
    if (on) this.music.play().catch(() => {}); else if (!this.musicGain) this.music.pause();
  }
  private duck(on: boolean) {
    if (!this.musicGain || !this.ctx || this.musicGain.gain.value === 0) return;
    this.musicGain.gain.setTargetAtTime(on ? this.musicLevel * 0.35 : this.musicLevel, this.ctx.currentTime, on ? 0.15 : 0.8);
  }
  pause() { this.nar.pause(); this.music.pause(); if ('speechSynthesis' in window) speechSynthesis.pause(); this.ctx?.suspend().catch(() => {}); }
  resume(musicOn: boolean) { this.ctx?.resume().catch(() => {}); if (musicOn) this.music.play().catch(() => {}); if (this.nar.src && !this.nar.ended && this.nar.currentTime > 0) this.nar.play().catch(() => {}); if ('speechSynthesis' in window) speechSynthesis.resume(); }
  stop() { this.cancelled++; const p = this.pending; this.pending = null; p?.(); this.nar.pause(); this.nar.removeAttribute('src'); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  dispose() { this.stop(); this.music.pause(); this.ctx?.close().catch(() => {}); }
  /** צליל ממשק קצר. */
  tick(name: string) { const u = this.m.audio.ui[name]; if (!u) return; this.ui.src = contentUrl(u); this.ui.volume = 0.6; this.ui.play().catch(() => {}); }

  /** משמיע תור שורות. מסתיים כשהאחרונה נגמרה (או בוטלה). */
  async say(ids: string[]): Promise<void> {
    const token = ++this.cancelled;
    for (const id of ids) {
      if (token !== this.cancelled) return;
      this.duck(true);
      await this.one(id, token);
      this.duck(false);
    }
  }
  private one(id: string, token: number): Promise<void> {
    const item = this.m.narration[id];
    if (item?.url) return new Promise(res0 => {
      const res = () => { if (this.pending === res) this.pending = null; res0(); };
      this.pending = res;
      const done = () => { this.nar.onended = this.nar.onerror = null; res(); };
      this.nar.onended = done;
      this.nar.onerror = () => { this.nar.onerror = null; this.speak(this.fallback[id], token).then(res); };
      this.nar.src = contentUrl(item.url);
      this.nar.play().catch(() => this.speak(this.fallback[id] ?? item.text, token).then(res));
    });
    return this.speak(this.fallback[id], token);
  }
  private speak(text: string | undefined, token: number): Promise<void> {
    if (!text || !('speechSynthesis' in window) || token !== this.cancelled) return Promise.resolve();
    return new Promise(res0 => {
      const res = () => { if (this.pending === res) this.pending = null; res0(); };
      this.pending = res;
      const u = new SpeechSynthesisUtterance(text); u.lang = 'he-IL'; u.rate = 0.95;
      const v = speechSynthesis.getVoices().find(x => x.lang.startsWith('he')); if (v) u.voice = v;
      const t = window.setTimeout(res, 2000 + text.length * 120); // ביטחון: יש דפדפנים שלא יורים onend
      u.onend = u.onerror = () => { window.clearTimeout(t); res(); };
      speechSynthesis.speak(u);
    });
  }
}

/** טקסט גיבוי לכל מזהה קריינות (אותו טקסט שהצנרת הפיקה, בלי ניקוד). */
import { EXERCISES, LINES, ORDINALS, SESSION_OPEN, TEACHER } from '../content/exercises';
export function fallbackLines(): Record<string, string> {
  const o: Record<string, string> = { ...LINES };
  for (const e of EXERCISES) { o[`${e.id}_intro`] = e.intro; if (e.cue) o[`${e.id}_cue`] = e.cue; }
  ORDINALS.forEach((w, i) => { o[`count_${i + 1}`] = w; });
  for (const [w, t] of Object.entries(SESSION_OPEN)) o[`open_w${w}`] = t;
  for (const [w, t] of Object.entries(TEACHER)) o[`teacher_w${w}`] = t;
  return o;
}
