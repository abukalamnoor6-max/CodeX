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

## PayPal (دفع + إشعار دسكورد)

1) ادخل https://developer.paypal.com → **Apps & Credentials** → Live (حسابك Business)
2) أنشئ App أو افتح الموجود → انسخ **Client ID** و **Secret**
3) في نفس الـ App → **Webhooks** → Add Webhook:
   - URL: `https://YOUR-SERVICE.up.railway.app/paypal/webhook`
   - Events:
     - `PAYMENT.CAPTURE.COMPLETED`
     - `CHECKOUT.ORDER.APPROVED`
   - انسخ **Webhook ID**
4) Railway → Variables:

```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=live
PAYPAL_CURRENCY=USD
PUBLIC_BASE_URL=https://YOUR-SERVICE.up.railway.app
PAYPAL_NOTIFY_CHANNEL_ID=1524971495921684601
```

5) احذف من Railway أي متغيرات Stripe / Moyasar إن وجدت:
   `STRIPE_*` · `MOYASAR_*`

6) بعد الـ Deploy جرّب رابط سريع:
   `https://YOUR-SERVICE.up.railway.app/pay?amount=1&name=اختبار`
   أو ادفع من روابط PayPal NCP الموجودة — نفس الإشعار يجي للدسكورد.

بعد الدفع الناجح يرسل البوت فاتورة في قناة `PAYPAL_NOTIFY_CHANNEL_ID`.

## Discord OAuth (زر ربط دسكورد قبل الدفع)

بدل ما العميل ينسخ اليوزر/الآيدي يدوي:

1) https://discord.com/developers/applications → تطبيق البوت
2) **OAuth2** → انسخ **Client ID** و **Client Secret**
3) Redirects أضف:
   `https://YOUR-SERVICE.up.railway.app/auth/discord/callback`
4) Railway Variables:

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
PUBLIC_BASE_URL=https://YOUR-SERVICE.up.railway.app
```

(إذا `DISCORD_CLIENT_ID` فاضي، البوت يحاول يأخذه من توكن البوت تلقائيًا.)

## ملاحظة
لا تشغّل البوت على Vercel — يحتاج عملية 24/7.
لا تشغّل نفس التوكن محلياً وRailway معاً.
لا تحط مفاتيح PayPal داخل الكود أو الشات — Railway Variables فقط.
