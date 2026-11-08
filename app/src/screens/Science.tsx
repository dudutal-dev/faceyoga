import TopBar from '../components/TopBar';
import Evidence from '../components/Evidence';

const ROWS: { what: string; level: 0 | 1 | 2 | 3; text: string }[] = [
  { what: 'גואשה ועיסוי לנפיחות', level: 3, text: 'ניסוי מבוקר (2025) מצא ירידה מדידה בנפיחות ובמתח שריר. ההשפעה זמנית: שעות עד ימים.' },
  { what: 'חיזוק הלחיים', level: 2, text: 'המחקר היחיד עם תוצאה פורסם ב-2018 בכתב העת JAMA Dermatology: 16 נשים, 20 שבועות, מלאות לחיים טובה יותר. בלי קבוצת ביקורת.' },
  { what: 'שחרור הלסת', level: 2, text: 'עיסוי מפחית מתח בשריר הלעיסה, במיוחד אצל מי שחורקת שיניים.' },
  { what: 'יציבת ראש', level: 2, text: 'ראש שבולט קדימה קשור למתח בצוואר. זה מבוסס היטב בפיזיותרפיה.' },
  { what: 'קמטי מצח, עיניים וחיוך', level: 1, text: 'אותו מחקר לא מצא שיפור באזורים האלה. לכן אנחנו מתרגלות שם בעיקר הרפיה, ובלי לקמט.' },
  { what: 'הרמת עפעף, שיפור ראייה, שינוי מבנה הלסת', level: 0, text: 'אין לזה בסיס. עפעף שצונח הוא סיבה לבדיקה אצל רופא, לא לתרגיל.' },
];

export default function Science() {
  return (
    <section className="flex flex-col gap-5 pb-6">
      <TopBar title="מה המדע אומר" exitTo="/library" exitLabel="סגירה" />
      <h1 className="text-[1.9rem] leading-tight">הכנות היא חלק מהשיטה</h1>
      <p className="soft">יוגה לפנים בטוחה, זולה, ונעימה. הראיות שלה דלות. הנה מה שידוע, בלי קישוטים.</p>
      <ul className="flex flex-col gap-3">{ROWS.map(r => <li key={r.what} className="card p-4 flex flex-col gap-2"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{r.what}</span><Evidence level={r.level} /></div><p className="soft text-sm">{r.text}</p></li>)}</ul>
      <div className="card-tint p-5 flex flex-col gap-2">
        <div className="font-semibold">במינון</div>
        <p className="text-sm">במחקר תרגלו 30 דקות ביום. אנחנו מציעות פחות, כדי שזה יחזיק לאורך זמן. לכן גם התוצאה הצפויה צנועה יותר.</p>
      </div>
      <div className="card-tint p-5 flex flex-col gap-2">
        <div className="font-semibold">מה עוד עוזר לעור יותר מכל תרגיל</div>
        <p className="text-sm">קרם הגנה כל יום, שינה, לא לעשן. אלה בעלי הראיות החזקות ביותר.</p>
      </div>
      <p className="text-xs soft">זו לא אפליקציה רפואית, והיא לא מחליפה ייעוץ רפואי או דרמטולוגי. מקורות: Alam M. et al., JAMA Dermatology 2018;154(3):365–367 · Hwang U.J. et al., J Korean Phys Ther 2023 (סקירה שיטתית).</p>
    </section>
  );
}
