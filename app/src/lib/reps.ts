// זיהוי חזרות מאות רציף (0..1) עם היסטרזיס. טהור וניתן לבדיקה: מקבל דגימות, מחזיר אירועים.
export interface RepEvent { type: 'start' | 'rep' | 'drop'; heldMs: number }

export class RepCounter {
  private active = false;
  private since = 0;
  reps = 0;
  /** on: סף כניסה. off: סף יציאה (ברירת מחדל 60% מ-on). minHoldMs: החזקה מינימלית שנספרת. */
  constructor(private on: number, private minHoldMs: number, private off = on * 0.6) {}
  push(value: number, t: number): RepEvent | null {
    if (!this.active && value >= this.on) { this.active = true; this.since = t; return { type: 'start', heldMs: 0 }; }
    if (this.active && value < this.off) {
      this.active = false; const held = t - this.since;
      if (held >= this.minHoldMs) { this.reps++; return { type: 'rep', heldMs: held }; }
      return { type: 'drop', heldMs: held };
    }
    return null;
  }
  get holding() { return this.active; }
}

/** התרעת קימוט: המצח עולה מעל הסף ברציפות לפחות ms; לא יותר מפעם אחת בכל cooldownMs. */
export class WrinkleGuard {
  private over: number | null = null; private lastWarn = -Infinity;
  constructor(private threshold = 0.45, private ms = 700, private cooldownMs = 12000) {}
  push(brow: number, t: number): boolean {
    if (brow < this.threshold) { this.over = null; return false; }
    if (this.over === null) this.over = t;
    if (t - this.over >= this.ms && t - this.lastWarn >= this.cooldownMs) { this.lastWarn = t; this.over = null; return true; }
    return false;
  }
}
