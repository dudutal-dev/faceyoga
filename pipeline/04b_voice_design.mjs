// שלב 1 — עיצוב קול למדריכה (Voice Design) + 2 קולות ספרייה להשוואה. תוצרים: outputs/stage1/voices/
// הרצה: node pipeline/04b_voice_design.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, api, logCost } from './lib.mjs';
import { tts, verify } from './04_narration.mjs';

const OUT = path.join(ROOT, 'outputs', 'stage1', 'voices_v3'); fs.mkdirSync(OUT, { recursive: true });
export const SENTENCE = 'הַיי, בְּרוּכָה הַבָּאָה לְ"פָּנִים 12". הַיּוֹם נַתְחִיל בְּשִׁחְרוּר שֶׁל הַצוואר וְהַלֶּסֶת. שִׂימִי אֶת קְצוֹת הָאֶצְבָּעוֹת עַל עַצְמוֹת הַלְּחָיַיִם, חַיְּכִי לְאַט, וְתַחְזִיקִי חָמֵשׁ שְׁנִיּוֹת. הַמֵּצַח נִשְׁאָר רַךְ, וְהַפָּנִים רְגוּעוֹת.';
export const DESIGNS = {
  design_a: 'A warm, friendly Israeli woman around forty speaking natural modern Hebrew. Clear mid-range voice with a gentle smile in it, close and intimate like a personal trainer guiding a friend in front of a mirror. Calm but alive, encouraging, unhurried, natural breathing, no breathiness, no theatrical drama.',
  design_b: 'A soft, caring Hebrew-speaking woman in her late thirties, light warm voice, relaxed spa-like delivery, slow and reassuring, rounded friendly tone, gentle confidence, like a facial therapist talking you through a calming routine.',
  design_c: 'A bright, upbeat yet soothing Israeli woman about forty-two, natural everyday Hebrew, warm and grounded mid-low voice, playful warmth, clear articulation, steady relaxed pace, like a favourite yoga teacher on a Saturday morning.',
};
const report = [];
for (const [name, voice_description] of Object.entries(DESIGNS)) {
  const r = await api('/v1/text-to-voice/design?output_format=mp3_44100_128', { method: 'POST', body: { voice_description, text: SENTENCE, model_id: 'eleven_ttv_v3', guidance_scale: 4, loudness: 0.4 } });
  if (!r.ok) { const t = await r.text(); console.error(`${name}: ${r.status} ${t.slice(0, 300)}`); report.push({ label: name, error: t.slice(0, 200) }); continue; }
  const j = await r.json();
  logCost({ stage: 1, kind: 'voice-design', label: name, chars: SENTENCE.length, previews: j.previews.length, usd: null });
  for (const [i, p] of j.previews.entries()) {
    const label = `${name}_${i + 1}`; const dest = path.join(OUT, `${label}.mp3`);
    fs.writeFileSync(dest, Buffer.from(p.audio_base_64, 'base64'));
    const v = await verify(dest, SENTENCE);
    report.push({ label, generated_voice_id: p.generated_voice_id, duration: p.duration_secs, match: Math.round(v.match * 100), heard: v.heard });
    console.log(`${label}: ${p.duration_secs?.toFixed(1)}s · ${Math.round(v.match * 100)}%`);
  }
}
// קולות ספרייה להשוואה (רכים, מוכחים בעברית בטאי צ'י)
for (const [name, voiceId] of Object.entries({ lib_matilda: 'XrExE9yKIg1WjnnlVkGX', lib_sarah: 'EXAVITQu4vr4xnSDxMaL' })) {
  const { file } = await tts({ text: SENTENCE, voiceId, modelId: 'eleven_v4', label: name });
  const dest = path.join(OUT, `${name}.mp3`); fs.copyFileSync(file, dest);
  const v = await verify(dest, SENTENCE); report.push({ label: name, voiceId, match: Math.round(v.match * 100), heard: v.heard });
  console.log(`${name}: ${Math.round(v.match * 100)}%`);
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ sentence: SENTENCE, designs: DESIGNS, report }, null, 2));
