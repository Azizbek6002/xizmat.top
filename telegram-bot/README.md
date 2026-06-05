# HizmatTop Telegram Bot 🤖

AI orqali xizmat band qilish uchun Telegram bot.

---

## Xususiyatlar

- 🤖 AI bilan suhbat — bir xabarda hamma narsani yozing
- 📅 Bo'sh vaqtlar — inline klaviatura bilan vaqt tanlash
- ✅ Bron tasdiqlash — bir tugma bilan
- 📋 Mening yozuvlarim — barcha band qilishlar
- ❌ Bekor qilish
- 🌐 3 tilda: O'zbek / Русский / English

---

## O'rnatish

### 1. Telegram bot yaratish

1. Telegramda `@BotFather` ga yozing
2. `/newbot` buyrug'ini yuboring
3. Nom va username bering
4. Token nusxalang

### 2. Loyihani o'rnating

```bash
cd telegram-bot
cp .env.example .env
```

`.env` faylini to'ldiring:

```env
TELEGRAM_BOT_TOKEN=your_token_here
API_URL=https://your-hizmattop-server.com/api
```

> ⚠️ `API_URL` — bu HizmatTop backend'ingizning publick URL'i.
> Localhost ishlatayotgan bo'lsangiz: `http://localhost:5000/api`
> Lekin Telegram webhook'lar faqat HTTPS bilan ishlaydi.
> Lokal test uchun: [ngrok](https://ngrok.com/) dan foydalaning.

### 3. Dependensiyalarni o'rnating

```bash
npm install
```

### 4. Ishga tushirish

```bash
npm start
```

yoki development uchun:

```bash
npm run dev
```

---

## Buyruqlar

| Buyruq | Tavsif |
|--------|--------|
| `/start` | Boshlash + til tanlash |
| `/login` | HizmatTop hisobiga kirish |
| `/logout` | Tizimdan chiqish |
| `/book` | AI orqali xizmat band qilish |
| `/mybookings` | Mening band qilishlarim |
| `/cancel` | Band qilishni bekor qilish |
| `/lang` | Tilni o'zgartirish |
| `/help` | Yordam |

---

## Foydalanish stsenariysi

```
Foydalanuvchi:  /start
Bot:            Salom! Tilni tanlang: [O'zbek] [Русский] [English]

Foydalanuvchi:  [O'zbek]
Bot:            ✅ Til o'zgartirildi!

Foydalanuvchi:  /login
Bot:            📧 Email manzilingizni yuboring:

Foydalanuvchi:  user@hizmat.top
Bot:            🔒 Parolingizni yuboring:

Foydalanuvchi:  user123
Bot:            ✅ Xush kelibsiz, Dilshod!

Foydalanuvchi:  Ertaga soat 16da arzon sartarosh kerak
Bot:            [💚 Arzon] [💛 O'rta] [💰 Premium] [🔥 Chegirmali]

Foydalanuvchi:  [💚 Arzon]
Bot:            Topildi: Barbershop SULTAN · ⭐4.8 · 30 000 so'm'dan
                [1. Barbershop SULTAN]

Foydalanuvchi:  [1. Barbershop SULTAN]
Bot:            Qaysi xizmat?
                [1. Soch olish — 30 000 so'm 🔥 · 40 min]
                [2. Soqol kesish — 25 000 so'm · 20 min]

Foydalanuvchi:  [1. Soch olish]
Bot:            📅 [Bugun] [Ertaga] [Seshanba] ...

Foydalanuvchi:  [Ertaga]
Bot:            🕐 [09:00] [09:30] [10:00] [16:00] [16:30] ...

Foydalanuvchi:  [16:00]
Bot:            🏢 Barbershop SULTAN
                ✂️ Soch olish 🔥
                📅 Ertaga, 6-iyun
                ⏰ 16:00 – 16:40
                💰 30 000 so'm
                [✅ Tasdiqlash] [❌ Bekor qilish]

Foydalanuvchi:  [✅ Tasdiqlash]
Bot:            🎉 Band qilindi!
                Tasdiqlash kutilmoqda — sohibi tasdiqlaydi.
```

---

## Ngrok bilan lokal test

```bash
# Alohida terminalda:
ngrok http 5000

# .env da:
API_URL=https://abc123.ngrok.io/api
```

---

## Ishlab chiqarish uchun deploy

Tavsiya etilgan platform: **Railway / Render / VPS**

```bash
# Railway
railway up

# yoki systemd service sifatida VPS da:
node bot.js
```

Bot polling rejimda ishlaydi — webhook kerak emas.

---

## Struktura

```
telegram-bot/
├── bot.js         ← Asosiy bot (commands, handlers, AI flow)
├── api.js         ← HizmatTop API client
├── package.json
├── .env.example
└── README.md
```
