// מאמן הפנים: MediaPipe Face Landmarker ב-WASM, במכשיר בלבד. שום פריים לא נשמר ולא נשלח.
// הקבצים מוגשים מאותו מקור: mediapipe/ (WASM, מועתק בבנייה) + mediapipe/face_landmarker.task (מודל).
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { contentUrl } from '../content/manifest';

export interface FaceFrame { t: number; blend: Record<string, number>; yaw: number; pitch: number; roll: number; width: number; cx: number; cy: number; landmarks: { x: number; y: number }[] }

let loading: Promise<FaceLandmarker> | null = null;
export function loadFace(): Promise<FaceLandmarker> {
  loading ??= (async () => {
    const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(contentUrl('mediapipe'));
    const make = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: contentUrl('mediapipe/face_landmarker.task'), delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.35, minFacePresenceConfidence: 0.35, minTrackingConfidence: 0.35, // פחות איבודים מרחוק
    });
    try { return await make('GPU'); } catch { return await make('CPU'); }
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/** זוויות ראש (מעלות) ממטריצת הטרנספורמציה 4x4 (column-major). */
export function anglesFromMatrix(m: ArrayLike<number>): { yaw: number; pitch: number; roll: number } {
  const r00 = m[0]!, r10 = m[1]!, r20 = m[2]!, r21 = m[6]!, r22 = m[10]!;
  const deg = 180 / Math.PI;
  return { yaw: Math.atan2(-r20, Math.hypot(r21, r22)) * deg, pitch: Math.atan2(r21, r22) * deg, roll: Math.atan2(r10, r00) * deg };
}

/** פותח מצלמה קדמית. שגיאת הרשאה נזרקת; כישלון של play (נפוץ באייפון מחוץ לנגיעה) לא נחשב כישלון: מנסים שוב. */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
  video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.setAttribute('autoplay', '');
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.srcObject = stream;
  ensurePlaying(video);
  return stream;
}
/** מנסה להפעיל את תצוגת המצלמה עד שהיא רצה (בלי לזרוק). */
export function ensurePlaying(video: HTMLVideoElement, tries = 8) {
  if (!video.srcObject || (!video.paused && video.readyState >= 2)) return;
  video.play().catch(() => { if (tries > 0) window.setTimeout(() => ensurePlaying(video, tries - 1), 400); });
}
/** הודעה ידידותית לפי סוג השגיאה. */
export function cameraErrorText(e: unknown): string {
  const name = (e as { name?: string })?.name ?? 'Error';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'אין הרשאה למצלמה. אפשר לאשר בהגדרות: Safari ← מצלמה ← אפשר.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'לא נמצאה מצלמה קדמית.';
  if (name === 'NotReadableError') return 'המצלמה תפוסה על ידי אפליקציה אחרת. סגרי אותה ונסי שוב.';
  return `המצלמה לא נפתחה (${name}). אפשר לנסות שוב בכפתור המראה.`;
}
export function stopCamera(stream: MediaStream | null) { stream?.getTracks().forEach(t => t.stop()); }

/** לולאת זיהוי: קוראת ל-onFrame עד שמבטלים. ~15 פריימים לשנייה כדי לחסוך סוללה.
 *  זיהוי ממרחק (מצב טלוויזיה): המודל מיועד לפנים קרובות, ולכן מזהים בתוך "חלון עניין" מוגדל.
 *  כשיש פנים, החלון עוקב אחריהן (פי 3 מגודלן); כשאין, מחליפים בין כל הפריים למרכז מוגדל. הקואורדינטות מוחזרות ביחס לכל הפריים. */
type Roi = { x: number; y: number; w: number; h: number };
const FULL: Roi = { x: 0, y: 0, w: 1, h: 1 };
const CENTER: Roi = { x: 0.25, y: 0.12, w: 0.5, h: 0.7 };
export function runFace(video: HTMLVideoElement, lm: FaceLandmarker, onFrame: (f: FaceFrame | null) => void): () => void {
  let stop = false, last = 0, misses = 0, roi: Roi = FULL, scanI = 0;
  let scan: Roi[] = [];
  const canvas = document.createElement('canvas'); const g = canvas.getContext('2d');
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const loop = () => {
    if (stop) return;
    const now = performance.now();
    if (now - last > 66 && video.readyState >= 2 && video.videoWidth && g) {
      last = now;
      try {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!scan.length) {
          const tiles = (side: number, cols: number, rows: number, x0: number, x1: number, y0: number, y1: number) => {
            const w = side, h = Math.min(1, side * vw / vh), out: Roi[] = [];
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const cx = x0 + (x1 - x0) * (cols === 1 ? 0.5 : c / (cols - 1)), cy = y0 + (y1 - y0) * (rows === 1 ? 0.5 : r / (rows - 1));
              out.push({ x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h });
            }
            return out;
          };
          // סדר: כל הפריים, מרכז, ואז אריחים קטנים ומוגדלים (פנים רחוקות)
          scan = [FULL, CENTER, ...tiles(0.3, 3, 2, 0.3, 0.7, 0.35, 0.6), ...tiles(0.2, 4, 3, 0.2, 0.8, 0.25, 0.7)];
        }
        const sx = roi.x * vw, sy = roi.y * vh, sw = roi.w * vw, sh = roi.h * vh;
        const k = 640 / Math.max(sw, sh);
        canvas.width = Math.round(sw * k); canvas.height = Math.round(sh * k);
        g.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const r = lm.detectForVideo(canvas, now);
        const raw = r.faceLandmarks?.[0];
        if (!raw) {
          misses++;
          if (misses <= 6) { /* אותו חלון: איבוד רגעי */ }
          else if (roi !== FULL && roi !== CENTER && roi.w < 0.95) {
            const cx = roi.x + roi.w / 2, cy = roi.y + roi.h / 2, w = Math.min(1, roi.w * 1.5), h = Math.min(1, roi.h * 1.5);
            roi = { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
          } else { scanI = (scanI + 1) % scan.length; roi = scan[scanI]!; } // סריקה שיטתית, חלון בכל פריים
          onFrame(null);
        } else {
          misses = 0; scanI = 0;
          const pts = raw.map(p => ({ x: roi.x + p.x * roi.w, y: roi.y + p.y * roi.h }));
          const blend: Record<string, number> = {};
          for (const c of r.faceBlendshapes?.[0]?.categories ?? []) blend[c.categoryName] = c.score;
          const mat = r.facialTransformationMatrixes?.[0]?.data;
          const ang = mat ? anglesFromMatrix(mat) : { yaw: 0, pitch: 0, roll: 0 };
          let minX = 1, maxX = 0, minY = 1, maxY = 0, sxs = 0, sys = 0;
          for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); sxs += p.x; sys += p.y; }
          const cx = sxs / pts.length, cy = sys / pts.length;
          onFrame({ t: now, blend, ...ang, width: maxX - minX, cx, cy, landmarks: pts });
          // החלון הבא: ריבוע (בפיקסלים) בגודל פי 3 מהפנים סביב המרכז; פנים גדולות → כל הפריים
          const sidePx = Math.max((maxX - minX) * vw, (maxY - minY) * vh) * 3;
          const w = clamp(sidePx / vw, 0.22, 1), h = clamp(sidePx / vh, 0.22, 1);
          roi = w >= 0.85 || h >= 0.85 ? FULL : { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
        }
      } catch { onFrame(null); }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { stop = true; };
}

/** אינדקסים של קו מתאר הפנים (FACE_OVAL של MediaPipe), לפי הסדר. */
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

export const avg = (b: Record<string, number>, names: string[]) => names.reduce((a, n) => a + (b[n] ?? 0), 0) / names.length;
export const browTension = (b: Record<string, number>) => Math.max(b.browInnerUp ?? 0, avg(b, ['browDownLeft', 'browDownRight']));

/** בהירות ממוצעת (0–255) מדגימה קטנה של פריים המצלמה. */
let probe: HTMLCanvasElement | null = null;
export function frameBrightness(video: HTMLVideoElement): number {
  probe ??= document.createElement('canvas'); probe.width = 32; probe.height = 24;
  const g = probe.getContext('2d', { willReadFrequently: true }); if (!g || !video.videoWidth) return 128;
  g.drawImage(video, 0, 0, 32, 24);
  const d = g.getImageData(0, 0, 32, 24).data; let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
  return sum / (d.length / 4);
}
