# ElevenLabs API — מה אומת ב-31.10.2026

נקרא מ-elevenlabs.io/docs ונבדק מול המפתח. לא להסתמך על זיכרון.

## אימות
כותרת `xi-api-key`. בסיס `https://api.elevenlabs.io`.

## Text-to-Speech
`POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`
גוף: `text`, `model_id`, `language_code` (`he`), `voice_settings{stability, similarity_boost, style, use_speaker_boost, speed}`,
`previous_text`/`next_text` להמשכיות בין קליפים, `pronunciation_dictionary_locators` (עד 3), `seed`.

**עברית**: לפי דף המודלים, עברית נתמכת רשמית ב-`eleven_v4` ו-`eleven_v4_turbo` (90+ שפות).
`eleven_v3` (70+) לא מציין עברית ברשימה, אבל **בבדיקה בפועל** שני המודלים הפיקו את משפט
הבדיקה עם תמלול חזרה 14/14 מילים (Matilda). v4 מתואר כשדרוג על v3; **ל-v4 אין מחווני
style ו-speed** (הפרמטרים מתקבלים אבל לא מתועדים כפעילים). השוואת מהירות:
אותו משפט ≈7.4 ש' ב-v3 (speed 0.85) מול ≈8.4 ש' ב-v4. הכרעה סופית אחרי דוגמאות הקול בשלב 2.
`eleven_multilingual_v2` אינו תומך בעברית (הוכח ב-3.9: ג'יבריש).

מחיר (pricing/api): v4 ו-v3 $0.08 ל-1,000 תווים; v4 Turbo $0.04.

## Speech-to-Text (לאימות קריינות)
`POST /v1/speech-to-text` multipart: `file`, `model_id=scribe_v1`, `language_code=heb`.

## Image
`POST /v1/flows/image` → `{id, status:"pending"}`; `GET /v1/flows/image/{id}` עד `completed` (`content_url` חתום, פג אחרי ~שעה).
מודלים עם model_id: `gpt-image-2.5-sunburst` (aspect_ratio, resolution 1K/2K/4K, quality, images עד 10, mask),
`gemini-3-pro-image` = Nano Banana Pro (aspect_ratio, resolution, images עד 10), `gemini-3.1-flash-image`.
רווח בין poll לתמונה: ≥2 ש'.

## Video (image-to-video)
`POST /v1/flows/video` → `{id, status}`; `GET /v1/flows/video/{id}`. poll כל ≥10 ש'.
סטטוסים: pending / generating / completed / failed (`failure_reason`, לא מחויב).
- `veo-3.1-generate-001` ו-`veo-3.1-fast-generate-001`: `duration_secs` 4/6/8, `aspect_ratio` 16:9|9:16,
  `resolution` 720p|1080p|4K, `generate_audio`, `enhance_prompt`, `negative_prompt`, `seed`,
  `start_frame`/`end_frame` או `images` (עד 3, role subject|style, מחייב 8 ש').
- `bytedance-seedance-v2.5`: 4–30 ש', 480p/720p (אין 1080p), `start_frame`/`end_frame`, בלי negative_prompt/seed מתועדים.
  מודלי ByteDance "מושבתים כברירת מחדל ל-API ודורשים אישור" לפי התיעוד.
- הפניות למדיה: `{type:"asset", asset_id}` (העלאה ל-`POST /v1/assets`), `{type:"generation", generation_id}`,
  `{type:"inline_base64", content_base64, mime_type}` (עד 25MB). אין URL ציבורי.
- **לולאה חלקה**: `start_frame` + `end_frame` עם אותה תמונה = מועמד טבעי ללולאה. לבדוק בפיילוט.

**עלות וידאו/תמונה**: התיעוד אומר רק "משתנה לפי הגדרות ומשך" ואין טבלת מחירים.
יימדד בפיילוט מתוך דוח השימוש בחשבון (אין `user_read` במפתח) ויירשם ב-`costs.json`.

## Music
`POST /v1/music`: `prompt`, `music_length_ms` 3,000–600,000 (10 דק' = 600,000, בדיוק הגבול), `force_instrumental:true`,
`model_id` music_v1|music_v2|music_v2_5. מחיר $0.15 לדקה.

## Sound Effects
`POST /v1/sound-generation`: `text`, `duration_seconds` 0.5–30, `prompt_influence`, `loop:true`,
`model_id` eleven_text_to_sound_v2|v3. מחיר $0.12 לדקה. צלילי אווירה של 30 ש' בלולאה.

## בדיקת המפתח (00_check.mjs)
- `/v1/user/subscription`, `/v1/models`, `/v1/voices`: 401 חסרות הרשאות קריאה.
- `GET /v1/flows/image`: 200 (רשימה עם יצירה אחת שהושלמה בעבר). `GET /v1/flows/video`: 200 (ריק).
- `POST /v1/flows/image` ו-`/video` עם model_id שגוי: 422 ולידציה, לא 402 `paid_plan_required`.
  המסקנה: המפתח עובר את שער התוכנית. אימות סופי יהיה ביצירה הראשונה בשלב 1.
