// מנוע הקול: אלמנט קריינות אחד + אלמנט מוזיקה אחד + צלילי ממשק, מיקסר Web Audio, ו-ducking של המוזיקה בזמן דיבור.
// רק הקריינית המוקלטת. אין קול מערכת (speechSynthesis): באייפון הוא נשמע כעברית לא תקנית.
// באייפון אלמנט שמע "משתחרר" רק אחרי play() מתוך נגיעה, ולכן unlock() מנגן קובץ שקט בכל האלמנטים.
import { contentUrl, type Manifest } from '../content/manifest';

const SILENCE = 'audio/ui/silence.mp3';

export class Voice {
  private nar = new Audio();
  private music = new Audio();
  private ui = new Audio();
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicLevel = 0.5;
  private cancelled = 0;
  private pending: (() => void) | null = null; // משחרר המתנה לשורה שנעצרה באמצע (אחרת onended לא יורה והמפגש נתקע)
  /** כתובית: הטקסט של השורה שמושמעת עכשיו (או null). */
  onCaption: (text: string | null) => void = () => {};

  constructor(private m: Manifest, private texts: Record<string, string>) {
    for (const a of [this.nar, this.music, this.ui]) { a.preload = 'auto'; a.setAttribute('playsinline', ''); }
    this.music.loop = true;
  }

  /** חייב לרוץ מתוך נגיעה (ב"התחילי"): משחרר את כל אלמנטי השמע ובונה את המיקסר. */
  unlock(musicOn: boolean, level: number) {
    this.musicLevel = level;
    for (const a of [this.nar, this.ui]) { a.src = contentUrl(SILENCE); a.play().then(() => a.pause()).catch(() => {}); }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = musicOn ? level : 0;
      this.ctx.createMediaElementSource(this.music).connect(this.musicGain).connect(this.ctx.destination);
      this.ctx.resume().catch(() => {});
    } catch { this.music.volume = level; }
    this.music.src = contentUrl(this.m.audio.music ?? SILENCE);
    this.music.play().catch(() => {});
  }
  setMusic(on: boolean) {
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? this.musicLevel : 0, this.ctx.currentTime, 0.3);
    else this.music.muted = !on;
  }
  private duck(on: boolean) {
    if (!this.musicGain || !this.ctx || this.musicGain.gain.value === 0) return;
    this.musicGain.gain.setTargetAtTime(on ? this.musicLevel * 0.35 : this.musicLevel, this.ctx.currentTime, on ? 0.15 : 0.8);
  }
  pause() { this.nar.pause(); this.music.pause(); this.ctx?.suspend().catch(() => {}); }
  resume() { this.ctx?.resume().catch(() => {}); this.music.play().catch(() => {}); if (this.nar.src && !this.nar.ended && this.nar.currentTime > 0) this.nar.play().catch(() => {}); }
  stop() { this.cancelled++; const p = this.pending; this.pending = null; p?.(); this.nar.pause(); this.onCaption(null); }
  dispose() { this.stop(); this.music.pause(); this.ctx?.close().catch(() => {}); }
  /** צליל ממשק קצר. */
  tick(name: string) { const u = this.m.audio.ui[name]; if (!u) return; this.ui.src = contentUrl(u); this.ui.volume = 0.6; this.ui.play().catch(() => {}); }

  /** משמיע תור שורות. מסתיים כשהאחרונה נגמרה (או בוטלה). */
  async say(ids: string[]): Promise<void> {
    const token = ++this.cancelled;
    for (const id of ids) {
      if (token !== this.cancelled) return;
      this.duck(true);
      await this.one(id);
      this.duck(false);
    }
    if (token === this.cancelled) this.onCaption(null);
  }

  private one(id: string): Promise<void> {
    const item = this.m.narration[id];
    const text = item?.text?.replace(/[֑-ׇ]/g, '') ?? this.texts[id] ?? '';
    this.onCaption(text || null);
    return new Promise(res0 => {
      let done = false;
      const res = () => { if (done) return; done = true; if (this.pending === res) this.pending = null; this.nar.onended = this.nar.onerror = null; res0(); };
      this.pending = res;
      // אין הקלטה, או שהדפדפן חוסם: מחכים בשקט בערך את משך השורה, והטקסט מוצג ככתובית.
      const silentWait = () => window.setTimeout(res, Math.max(1500, item?.durationMs ?? text.length * 75));
      if (!item?.url) { silentWait(); return; }
      this.nar.onended = res;
      this.nar.onerror = silentWait;
      this.nar.src = contentUrl(item.url);
      this.nar.play().catch(() => window.setTimeout(() => { if (!done) this.nar.play().catch(silentWait); }, 300));
    });
  }
}

/** טקסט לכל מזהה קריינות (לכתוביות, ולשורה שאין לה הקלטה). */
import { EXERCISES, LINES, ORDINALS, SESSION_OPEN, TEACHER } from '../content/exercises';
export function fallbackLines(): Record<string, string> {
  const o: Record<string, string> = { ...LINES };
  for (const e of EXERCISES) { o[`${e.id}_intro`] = e.intro; if (e.cue) o[`${e.id}_cue`] = e.cue; }
  ORDINALS.forEach((w, i) => { o[`count_${i + 1}`] = w; });
  for (const [w, t] of Object.entries(SESSION_OPEN)) o[`open_w${w}`] = t;
  for (const [w, t] of Object.entries(TEACHER)) o[`teacher_w${w}`] = t;
  return o;
}
