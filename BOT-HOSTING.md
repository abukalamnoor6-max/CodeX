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
7) في السيرفر شغّل `/setup-logs` لإنشاء رومات اللوقات الكاملة
8) لوحة الويب (حماية/برودكاست) على رابط Railway العام، مثال:
   `https://YOUR-SERVICE.up.railway.app/`
   وفي Variables حط:
```
GUARD_API_KEY=مفتاح-سري-طويل
```
   افتح اللوحة من الجوال بنفس الرابط (من أي شبكة).

اختياري:
```
CODEX_SETUP_LOGS=1
```

أوامر مفيدة: `/bc-panel` · `/setup-logs` · `/logs-info`

## Stripe (اختبار / دفع)

1) في Stripe Dashboard (Test mode) → **Developers → API keys**
2) **جدّد الـ Secret key** إذا انكشف بالشات/سكرين، ولا ترسله لأحد
3) Railway → Variables:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_BASE_URL=https://YOUR-SERVICE.up.railway.app
STRIPE_CURRENCY=aed
STRIPE_NOTIFY_CHANNEL_ID=1524961264869310494
```

4) Stripe → **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-SERVICE.up.railway.app/stripe/webhook`
   - Event: `checkout.session.completed`
   - انسخ Signing secret → `STRIPE_WEBHOOK_SECRET`

5) بعد الـ Deploy جرّب:
   `https://YOUR-SERVICE.up.railway.app/pay?amount=50&name=بوت`
   بطاقة تجريبية: `4242 4242 4242 4242`

بعد الدفع الناجح يرسل البوت إشعار في روم التسليم (أو `STRIPE_NOTIFY_CHANNEL_ID`).

## ملاحظة
لا تشغّل البوت على Vercel — يحتاج عملية 24/7.
لا تشغّل نفس التوكن محلياً وRailway معاً.
لا تحط مفاتيح Stripe داخل الكود أو الشات — Railway Variables فقط.
