# codeX Discord bot — Railway / Render

المتجر على **رمز** (مو موقع Next.js).

## الخيار الموصى به: Railway

1) ادخل https://railway.app وسجّل بـ GitHub
2) New Project → Deploy from GitHub repo
3) Settings:
   - Start Command: `npm run bot`
   - أو Dockerfile Path = `Dockerfile.bot`
4) Variables → أضف:

```
DISCORD_BOT_TOKEN=توكن_البوت
DISCORD_GUILD_ID=1524901009195798679
DISCORD_OWNER_ID=1210972261968912425
DISCORD_DELIVERY_CHANNEL_ID=1524961264869310494
DISCORD_REVIEWS_CHANNEL_ID=1524981051787837540
DISCORD_WELCOME_CHANNEL_ID=1524961216097816717
DISCORD_TICKET_CHANNEL_ID=1524961237257949275
NEXT_PUBLIC_SITE_URL=https://codex-theta-two.vercel.app
GROQ_API_KEY=اختياري_للذكاء
PORT=8787
```

5) Deploy → انتظر لين تشوف في اللوق: `bot ready`
6) بعد ما يشتغل على Railway، أوقف أي بوت محلي على جهازك
7) في السيرفر شغّل `/setup-logs` لإنشاء رومات اللوقات الكاملة (صوت/بث/ويب هوك/…)

اختياري في Variables:
```
CODEX_SETUP_LOGS=1
```
عشان ينشئ الرومات تلقائياً عند الإقلاع.

## ملاحظة
لا تشغّل البوت على Vercel — يحتاج عملية 24/7.
