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

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
  video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();
  return stream;
}
export function stopCamera(stream: MediaStream | null) { stream?.getTracks().forEach(t => t.stop()); }

/** לולאת זיהוי: קוראת ל-onFrame עד שמבטלים. ~15 פריימים לשנייה כדי לחסוך סוללה. */
export function runFace(video: HTMLVideoElement, lm: FaceLandmarker, onFrame: (f: FaceFrame | null) => void): () => void {
  let stop = false, last = 0;
  const loop = () => {
    if (stop) return;
    const now = performance.now();
    if (now - last > 66 && video.readyState >= 2 && video.videoWidth) {
      last = now;
      try {
        const r = lm.detectForVideo(video, now);
        const pts = r.faceLandmarks?.[0];
        if (!pts) onFrame(null);
        else {
          const blend: Record<string, number> = {};
          for (const c of r.faceBlendshapes?.[0]?.categories ?? []) blend[c.categoryName] = c.score;
          const mat = r.facialTransformationMatrixes?.[0]?.data;
          const ang = mat ? anglesFromMatrix(mat) : { yaw: 0, pitch: 0, roll: 0 };
          let minX = 1, maxX = 0, sx = 0, sy = 0;
          for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); sx += p.x; sy += p.y; }
          onFrame({ t: now, blend, ...ang, width: maxX - minX, cx: sx / pts.length, cy: sy / pts.length, landmarks: pts });
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
