/**
 * فلتر الكلام البذيء — تطبيع + مطابقة (عربي / إنجليزي / إيموجي)
 * يتجاوز تشفير خفيف: ـ / , . فراغات وسط الكلمة
 */

/** كلمات قصيرة جدًا — مطابقة كلمة كاملة فقط */
const SHORT_BAD = [
  "كس",
  "زب",
  "طيز",
  "خول",
  "خرا",
  "خراء",
  "عرص",
  "نيك",
  "قحب",
  "عيري",
  "ايري",
  "زبال",
  "دياثة",
  "ديوث",
  "قواد",
  "انيج",
  "ازغب",
  "زنوه",
  // إنجليزي قصير
  "fck",
  "fuk",
  "fk",
  "dik",
  "dic",
  "cok",
  "cunt",
  "slut",
  "hoe",
  "stfu",
  "wtf",
  "lmao",
];

/** عبارات وكلمات أوضح */
const LONG_BAD = [
  // من قائمتك
  "شرموطة",
  "شرموطه",
  "شرموط",
  "شراميط",
  "كس امك",
  "كسمك",
  "كسك",
  "كس ربك",
  "انيك",
  "انيكك",
  "لنيك",
  "اهينك",
  "طيزك",
  "زبي فطيزك",
  "زبي",
  "زبك",
  "مص زبي",
  "العن ابوك",
  "العن امك",
  "العن ام امك",
  "العن ابو امك",
  "العن ابو ابوك",
  "العن ربك",
  "العن دينك",
  "يلعنكم",
  "يلعن",
  "زرقها",
  "جرار",
  "دياثة",
  "مخنث",
  "خنيث",
  "مخنثه",
  "مخنثة",
  "قواد",
  "القحبه",
  "قحبه",
  "قحبة",
  "ابن الشرموطه",
  "ابن الشرموطة",
  "ابن القحبة",
  "ابن الكلب",
  "يا ابن الكلب",
  "كل زق",
  "على زق",
  "حياكم سيرفر",
  "سيرفركم",
  "النخوة",
  "انيكك",
  "حيوان",
  "ازغب",
  "ابوك",
  "اختك",
  "اركب",
  "اركب عليه",
  "الخايس",
  "امك عندي",
  "امك نار",
  "انيك ربك",
  "انيك عهدك",
  "منيوك",
  "منيك",
  "منايك",
  "يتناك",
  "متناك",
  "متناكة",
  "زب امك",
  "كس ام",
  "كس اختك",

  // إضافات شائعة
  "يا شرموطة",
  "يا قحبة",
  "يا عرص",
  "يا خول",
  "يا ديوث",
  "امك شرمطة",
  "اختك شرمطة",
  "كس ابوك",
  "كس امك يا",
  "ادخل زبي",
  "مصه",
  "امصص",
  "بسرج",
  "يفشخ",
  "فشخته",
  "منيكين",

  // إنجليزي
  "fuck",
  "fucking",
  "fucked",
  "motherfucker",
  "mother fucker",
  "shit",
  "bullshit",
  "bitch",
  "bitches",
  "asshole",
  "dickhead",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "bastard",
  "faggot",
  "fag",
  "nigger",
  "nigga",
  "retard",
  "retarded",
  "porn",
  "pornhub",
  "onlyfans",
  "sex",
  "sexy",
  "nude",
  "nudes",
  "blowjob",
  "handjob",
  "cumshot",
  "dildo",
  "anal",
  "rape",
  "rapist",
  "kill yourself",
  "kys",
  "go die",
  "stfu",
  "shut the fuck up",
  "son of a bitch",
  "s o b",
];

/** إيموجيات ممنوعة بالشات */
export const BAD_EMOJIS = [
  "🍆",
  "🍑",
  "🥒",
  "🌭",
  "🥕",
  "🍌",
  "🍒",
  "💦",
  "👉",
  "👌",
  "🖕",
];

function stripDiacritics(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "");
}

export function normalizeForProfanity(text) {
  let t = stripDiacritics(text).toLowerCase();
  t = t
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/ـ+/g, "")
    // كـ,س  ك.س  ك/س
    .replace(/[\/\\|_\-\*\.\,\!\?\:\;\"\'\`~\(\)\[\]\{\}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = t.replace(/\s+/g, "");
  return { spaced: t, compact };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loosePattern(core) {
  return core
    .split("")
    .map((ch) => escapeRe(ch))
    .join("[\\s\\-_\\/ـ\\,\\.]*");
}

const SHORT_RES = SHORT_BAD.map((w) => {
  const core = normalizeForProfanity(w).compact;
  return {
    raw: w,
    re: new RegExp(`(?:^|\\s)${loosePattern(core)}(?:$|\\s)`, "i"),
  };
});

const LONG_RES = LONG_BAD.map((w) => {
  const core = normalizeForProfanity(w).compact;
  return {
    raw: w,
    re: new RegExp(loosePattern(core), "i"),
  };
});

export function findBadEmoji(text) {
  const s = String(text || "");
  for (const e of BAD_EMOJIS) {
    if (s.includes(e)) return e;
  }
  return null;
}

export function findProfanity(text) {
  if (!text || !String(text).trim()) return null;

  const emojiHit = findBadEmoji(text);
  if (emojiHit) return `emoji:${emojiHit}`;

  const { spaced, compact } = normalizeForProfanity(text);
  const padded = ` ${spaced} `;

  for (const p of SHORT_RES) {
    if (p.re.test(padded)) return p.raw;
  }
  for (const p of LONG_RES) {
    if (p.re.test(padded) || p.re.test(compact)) return p.raw;
  }
  return null;
}

export function hasProfanity(text) {
  return Boolean(findProfanity(text));
}
