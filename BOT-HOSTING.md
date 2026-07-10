# تشغيل بوت codeX على السحابة (مو على البي سي)

الموقع (Vercel) ≠ البوت.
- الموقع: صفحات + طلبات → يبقى على Vercel
- البوت: أزرار / ترحيب / حماية / تكتات → يحتاج Railway أو Render 24/7

## الخيار الموصى به: Railway

1) ادخل https://railway.app وسجّل بـ GitHub
2) New Project → Deploy from GitHub repo (ارفع مشروع codeX لـ GitHub أولاً)
3) بعد ما ينشئ الخدمة:
   - Settings → Start Command: `npm run bot`
   - أو استخدم Dockerfile.bot: Settings → Dockerfile Path = `Dockerfile.bot`
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
PORT=8787
```

5) Deploy → انتظر لين تشوف في اللوق: `bot ready as CodeX#6800`
6) بعد ما يشتغل على Railway، أوقف البوت على جهازك (عشان ما يصير تعارض)

## ملاحظة مهمة
لا تحط البوت على Vercel — Vercel يطفي السيرفر بعد الطلب، والأزرار/التكتات توقف.
