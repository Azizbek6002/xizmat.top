/**
 * HizmatTop Telegram Bot — Main Entry
 *
 * Commands:
 *   /start   — welcome + language selection
 *   /login   — authenticate with HizmatTop account
 *   /logout  — sign out
 *   /book    — start AI booking wizard
 *   /mybookings — view my bookings
 *   /cancel  — cancel a booking
 *   /help    — show all commands
 *
 * Flow:
 *   User talks to AI in natural language → AI returns step + choices
 *   Bot shows inline keyboards for each step
 *   On CONFIRM → creates real booking via API
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const api         = require('./api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN not set in .env'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Session store ────────────────────────────────────────────────────────────
// { telegramId: { lang, loginStep, loginEmail, pendingDraft, awaitingCancelId } }
const sessions = new Map();

const sess = (id) => {
  if (!sessions.has(id)) sessions.set(id, { lang: 'uz' });
  return sessions.get(id);
};

// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  uz: {
    welcome:        (name) => `Salom, ${name}! 👋\nMen HizmatTop AI botiman.\nXizmat topish va bron qilishda yordam beraman.`,
    chooseLanguage: 'Tilni tanlang:',
    languageSet:    '✅ Til o\'zgartirildi!',
    loginPrompt:    '📧 HizmatTop email manzilingizni yuboring:',
    loginPassword:  '🔒 Parolingizni yuboring:',
    loginOk:        (name) => `✅ Xush kelibsiz, ${name}!`,
    loginFail:      '❌ Email yoki parol noto\'g\'ri. Qayta urinib ko\'ring.\n/login',
    loginRequired:  '🔐 Avval tizimga kiring:\n/login',
    logoutOk:       '👋 Tizimdan chiqdingiz.',
    helpText:       `📋 *Buyruqlar:*\n/book — Xizmat band qilish\n/mybookings — Mening yozuvlarim\n/cancel — Yozuvni bekor qilish\n/login — Kirish\n/logout — Chiqish\n/lang — Til o'zgartirish\n/help — Yordam`,
    noBookings:     '📭 Sizda hozircha yozuvlar yo\'q.',
    cancelPrompt:   'Qaysi yozuvni bekor qilmoqchisiz? Raqamini yuboring:',
    cancelOk:       '✅ Yozuv bekor qilindi.',
    cancelFail:     '❌ Bekor qilishda xatolik yuz berdi.',
    cancelNotFound: '❌ Yozuv topilmadi.',
    errorGeneral:   '❌ Xatolik yuz berdi. Keyinroq urinib ko\'ring.',
    bookStart:      '🤖 AI yordamchiga xabarnoma yuboring.\nMasalan: "Ertaga soat 16da arzon sartarosh"',
    bookDone:       (b, s, d, t) => `🎉 *Band qilindi!*\n📍 ${b}\n✂️ ${s}\n📅 ${d}\n⏰ ${t}\n\nTasdiqlash kutilmoqda — sohibi tasdiqlaydi.`,
    confirmYes:     '✅ Tasdiqlash',
    confirmNo:      '❌ Bekor qilish',
    statusLabels:   { pending: '⏳ Kutilmoqda', confirmed: '✅ Tasdiqlangan', completed: '✔️ Yakunlangan', cancelled: '❌ Bekor', rejected: '🚫 Rad etildi' },
    myBookingsTitle:'📋 *Mening yozuvlarim:*',
  },
  ru: {
    welcome:        (name) => `Привет, ${name}! 👋\nЯ AI-бот HizmatTop.\nПомогу найти сервис и сделать запись.`,
    chooseLanguage: 'Выберите язык:',
    languageSet:    '✅ Язык изменён!',
    loginPrompt:    '📧 Отправьте ваш email от HizmatTop:',
    loginPassword:  '🔒 Отправьте пароль:',
    loginOk:        (name) => `✅ Добро пожаловать, ${name}!`,
    loginFail:      '❌ Неверный email или пароль. Попробуйте снова.\n/login',
    loginRequired:  '🔐 Сначала войдите:\n/login',
    logoutOk:       '👋 Вы вышли из системы.',
    helpText:       `📋 *Команды:*\n/book — Забронировать услугу\n/mybookings — Мои записи\n/cancel — Отменить запись\n/login — Войти\n/logout — Выйти\n/lang — Сменить язык\n/help — Помощь`,
    noBookings:     '📭 У вас пока нет записей.',
    cancelPrompt:   'Какую запись отменить? Отправьте номер:',
    cancelOk:       '✅ Запись отменена.',
    cancelFail:     '❌ Не удалось отменить.',
    cancelNotFound: '❌ Запись не найдена.',
    errorGeneral:   '❌ Произошла ошибка. Попробуйте позже.',
    bookStart:      '🤖 Напишите AI-ассистенту.\nНапример: "Завтра в 16:00 дешёвая парикмахерская"',
    bookDone:       (b, s, d, t) => `🎉 *Забронировано!*\n📍 ${b}\n✂️ ${s}\n📅 ${d}\n⏰ ${t}\n\nОжидает подтверждения хозяина.`,
    confirmYes:     '✅ Подтвердить',
    confirmNo:      '❌ Отменить',
    statusLabels:   { pending: '⏳ Ожидает', confirmed: '✅ Подтверждена', completed: '✔️ Завершена', cancelled: '❌ Отменена', rejected: '🚫 Отклонена' },
    myBookingsTitle:'📋 *Мои записи:*',
  },
  en: {
    welcome:        (name) => `Hi ${name}! 👋\nI'm HizmatTop AI bot.\nI'll help you find a service and book it.`,
    chooseLanguage: 'Choose language:',
    languageSet:    '✅ Language updated!',
    loginPrompt:    '📧 Send your HizmatTop email:',
    loginPassword:  '🔒 Send your password:',
    loginOk:        (name) => `✅ Welcome back, ${name}!`,
    loginFail:      '❌ Wrong email or password. Try again.\n/login',
    loginRequired:  '🔐 Please log in first:\n/login',
    logoutOk:       '👋 Logged out.',
    helpText:       `📋 *Commands:*\n/book — Book a service\n/mybookings — My bookings\n/cancel — Cancel booking\n/login — Sign in\n/logout — Sign out\n/lang — Change language\n/help — Help`,
    noBookings:     '📭 You have no bookings yet.',
    cancelPrompt:   'Which booking to cancel? Send the number:',
    cancelOk:       '✅ Booking cancelled.',
    cancelFail:     '❌ Could not cancel booking.',
    cancelNotFound: '❌ Booking not found.',
    errorGeneral:   '❌ Something went wrong. Try again later.',
    bookStart:      '🤖 Write to the AI assistant.\nExample: "Cheap barbershop tomorrow at 4pm"',
    bookDone:       (b, s, d, t) => `🎉 *Booked!*\n📍 ${b}\n✂️ ${s}\n📅 ${d}\n⏰ ${t}\n\nAwaiting owner confirmation.`,
    confirmYes:     '✅ Confirm',
    confirmNo:      '❌ Cancel',
    statusLabels:   { pending: '⏳ Pending', confirmed: '✅ Confirmed', completed: '✔️ Completed', cancelled: '❌ Cancelled', rejected: '🚫 Rejected' },
    myBookingsTitle:'📋 *My bookings:*',
  },
};
const i18n = (id) => T[sess(id).lang] || T.uz;

// ─── Keyboards ────────────────────────────────────────────────────────────────
const langKeyboard = {
  reply_markup: {
    inline_keyboard: [[
      { text: "🇺🇿 O'zbek", callback_data: 'lang_uz' },
      { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
      { text: '🇬🇧 English', callback_data: 'lang_en' },
    ]],
  },
};

const mainKeyboard = (lang) => ({
  reply_markup: {
    keyboard: [
      [{ text: lang === 'uz' ? '🤖 Xizmat band qilish' : lang === 'ru' ? '🤖 Забронировать' : '🤖 Book service' }],
      [{ text: lang === 'uz' ? '📋 Mening yozuvlarim' : lang === 'ru' ? '📋 Мои записи' : '📋 My bookings' },
       { text: lang === 'uz' ? '❓ Yordam' : lang === 'ru' ? '❓ Помощь' : '❓ Help' }],
    ],
    resize_keyboard: true,
  },
});

const buildChoiceKeyboard = (choices) => ({
  reply_markup: {
    inline_keyboard: choices.map((c, i) => [{
      text: c.label || c.value,
      callback_data: `choice_${i}_${String(c.value || c.label).slice(0, 40)}`,
    }]),
  },
});

const buildSlotKeyboard = (slots) => ({
  reply_markup: {
    inline_keyboard: chunk(slots.slice(0, 12).map(s => ({
      text: s.time,
      callback_data: `slot_${s.time}`,
    })), 4),
  },
});

const buildDateKeyboard = (quickDates) => ({
  reply_markup: {
    inline_keyboard: [quickDates.map(d => ({
      text: d.label,
      callback_data: `date_${d.value}`,
    }))],
  },
});

const confirmKeyboard = (lang) => ({
  reply_markup: {
    inline_keyboard: [[
      { text: T[lang]?.confirmYes || '✅', callback_data: 'confirm_yes' },
      { text: T[lang]?.confirmNo  || '❌', callback_data: 'confirm_no'  },
    ]],
  },
});

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const send = (chatId, text, opts = {}) =>
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });

const formatDraft = (draft, lang) => {
  const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
  const dateLabel = draft.date
    ? new Date(draft.date + 'T12:00:00').toLocaleDateString(LOCALE[lang] || 'uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })
    : draft.date;
  const price = draft.servicePrice ? `${Number(draft.servicePrice).toLocaleString('ru-RU')} so'm` : '—';
  const flash = draft.flashActive ? ' 🔥' : '';
  return [
    `🏢 *${draft.businessName}*`,
    `✂️ ${draft.serviceName}${flash}`,
    `📅 ${dateLabel}`,
    `⏰ ${draft.startTime} – ${draft.endTime}`,
    `💰 ${price}`,
    `⏱ ${draft.durationMinutes} min`,
  ].join('\n');
};

// ─── AI response handler ──────────────────────────────────────────────────────
const handleAIResponse = async (chatId, data) => {
  const s    = sess(chatId);
  const lang = s.lang;

  // Always send the text answer
  if (data.answer) {
    await send(chatId, data.answer);
  }

  switch (data.step) {
    case 'PICK_CATEGORY':
    case 'PICK_BIZ':
    case 'PICK_SERVICE':
    case 'PICK_BUDGET': {
      if (data.choices?.length) {
        await send(chatId, '👇', buildChoiceKeyboard(data.choices));
      }
      break;
    }

    case 'PICK_DATE': {
      if (data.quickDates?.length) {
        await send(chatId, '📅', buildDateKeyboard(data.quickDates));
      }
      break;
    }

    case 'PICK_TIME': {
      if (data.slots?.length) {
        await send(chatId, '🕐', buildSlotKeyboard(data.slots));
      }
      break;
    }

    case 'CONFIRM': {
      if (data.bookingDraft) {
        s.pendingDraft = data.bookingDraft;
        await send(chatId, formatDraft(data.bookingDraft, lang), confirmKeyboard(lang));
      }
      break;
    }

    case 'DONE': {
      const bk = data.booking;
      if (bk) {
        const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
        const dateLabel = new Date(bk.date + 'T12:00:00').toLocaleDateString(LOCALE[lang] || 'uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
        await send(chatId, (T[lang] || T.uz).bookDone(bk.businessName, bk.serviceName, dateLabel, bk.startTime));
        s.pendingDraft = null;
      }
      break;
    }

    case 'SEARCH':
    default:
      // show businesses if any
      if (data.businesses?.length) {
        const list = data.businesses.slice(0, 5).map((b, i) => {
          const minP = b.services?.length
            ? Math.min(...b.services.map(sv => sv.effectivePrice || sv.price))
            : b.minPrice;
          const dist = b.distance != null ? ` · 📍${b.distance.toFixed(1)} km` : '';
          return `${i + 1}. *${b.name}*${dist}\n   ⭐ ${(b.rating || 0).toFixed(1)} · ${minP > 0 ? `${Number(minP).toLocaleString('ru-RU')} so'm'dan` : 'Bepul'}`;
        }).join('\n\n');
        await send(chatId, list);
      }
      break;
  }
};

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name   = msg.from.first_name || 'Foydalanuvchi';
  const s      = sess(chatId);

  await send(chatId, (T[s.lang] || T.uz).welcome(name), langKeyboard);
});

// ─── /lang ────────────────────────────────────────────────────────────────────
bot.onText(/\/lang/, async (msg) => {
  const chatId = msg.chat.id;
  await send(chatId, (i18n(chatId)).chooseLanguage, langKeyboard);
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await send(chatId, i18n(chatId).helpText, mainKeyboard(sess(chatId).lang));
});

// ─── /login ───────────────────────────────────────────────────────────────────
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;
  const s      = sess(chatId);
  s.loginStep  = 'EMAIL';
  delete s.loginEmail;
  await send(chatId, i18n(chatId).loginPrompt);
});

// ─── /logout ──────────────────────────────────────────────────────────────────
bot.onText(/\/logout/, async (msg) => {
  const chatId = msg.chat.id;
  api.logout(chatId);
  const s = sess(chatId);
  delete s.loginStep;
  await send(chatId, i18n(chatId).logoutOk);
});

// ─── /book ────────────────────────────────────────────────────────────────────
bot.onText(/\/book/, async (msg) => {
  const chatId = msg.chat.id;
  if (!api.isLoggedIn(chatId)) {
    return send(chatId, i18n(chatId).loginRequired);
  }
  await api.aiReset(chatId, sess(chatId).lang);
  await send(chatId, i18n(chatId).bookStart);
});

// ─── /mybookings ──────────────────────────────────────────────────────────────
bot.onText(/\/mybookings/, async (msg) => {
  const chatId = msg.chat.id;
  const lang   = sess(chatId).lang;

  if (!api.isLoggedIn(chatId)) return send(chatId, i18n(chatId).loginRequired);

  try {
    const bookings = await api.getMyBookings(chatId);
    if (!bookings.length) return send(chatId, i18n(chatId).noBookings);

    const labels = (T[lang] || T.uz).statusLabels;
    const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

    const lines = bookings.slice(0, 8).map((b, i) => {
      const dateLabel = new Date(b.date + 'T12:00:00').toLocaleDateString(LOCALE[lang] || 'uz-UZ', { day: 'numeric', month: 'short' });
      const status    = labels[b.status] || b.status;
      return `${i + 1}. *${b.business?.name || '—'}* — ${b.service?.name || '—'}\n   ${dateLabel} ${b.startTime} · ${status}`;
    }).join('\n\n');

    const title = (T[lang] || T.uz).myBookingsTitle;
    await send(chatId, `${title}\n\n${lines}`);

    // store for /cancel
    sess(chatId).lastBookings = bookings;
  } catch {
    await send(chatId, i18n(chatId).errorGeneral);
  }
});

// ─── /cancel ─────────────────────────────────────────────────────────────────
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  if (!api.isLoggedIn(chatId)) return send(chatId, i18n(chatId).loginRequired);

  const s = sess(chatId);
  if (!s.lastBookings?.length) {
    // fetch first
    try {
      const bk = await api.getMyBookings(chatId);
      s.lastBookings = bk;
    } catch {}
  }

  const active = (s.lastBookings || []).filter(b => ['pending', 'confirmed'].includes(b.status));
  if (!active.length) return send(chatId, i18n(chatId).noBookings);

  s.awaitingCancelId = true;
  s.cancelableBookings = active;

  const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
  const lang = s.lang;
  const list = active.map((b, i) => {
    const dateLabel = new Date(b.date + 'T12:00:00').toLocaleDateString(LOCALE[lang] || 'uz-UZ', { day: 'numeric', month: 'short' });
    return `${i + 1}. *${b.business?.name}* — ${b.service?.name} · ${dateLabel} ${b.startTime}`;
  }).join('\n');

  await send(chatId, `${i18n(chatId).cancelPrompt}\n\n${list}`);
});

// ─── Text message handler ─────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text   = msg.text.trim();
  const s      = sess(chatId);
  const lang   = s.lang;

  // ── keyboard shortcut buttons ──
  if (text === '🤖 Xizmat band qilish' || text === '🤖 Забронировать' || text === '🤖 Book service') {
    if (!api.isLoggedIn(chatId)) return send(chatId, i18n(chatId).loginRequired);
    await api.aiReset(chatId, lang);
    return send(chatId, i18n(chatId).bookStart);
  }
  if (text === '📋 Mening yozuvlarim' || text === '📋 Мои записи' || text === '📋 My bookings') {
    return bot.emit('message', { ...msg, text: '/mybookings' });
  }
  if (text === '❓ Yordam' || text === '❓ Помощь' || text === '❓ Help') {
    return send(chatId, i18n(chatId).helpText);
  }

  // ── login flow ──
  if (s.loginStep === 'EMAIL') {
    s.loginEmail = text;
    s.loginStep  = 'PASSWORD';
    return send(chatId, i18n(chatId).loginPassword);
  }

  if (s.loginStep === 'PASSWORD') {
    try {
      const user = await api.login(chatId, s.loginEmail, text);
      delete s.loginStep;
      delete s.loginEmail;
      await send(chatId, i18n(chatId).loginOk(user.name), mainKeyboard(lang));
    } catch {
      delete s.loginStep;
      await send(chatId, i18n(chatId).loginFail);
    }
    return;
  }

  // ── cancel flow: user sends number ──
  if (s.awaitingCancelId) {
    const idx = parseInt(text, 10) - 1;
    const bk  = (s.cancelableBookings || [])[idx];
    delete s.awaitingCancelId;
    delete s.cancelableBookings;

    if (!bk) return send(chatId, i18n(chatId).cancelNotFound);
    try {
      await api.cancelBooking(chatId, bk._id);
      return send(chatId, i18n(chatId).cancelOk);
    } catch {
      return send(chatId, i18n(chatId).cancelFail);
    }
  }

  // ── AI booking conversation ──
  if (!api.isLoggedIn(chatId)) {
    return send(chatId, i18n(chatId).loginRequired);
  }

  try {
    bot.sendChatAction(chatId, 'typing');
    const data = await api.aiChat(chatId, text, lang);
    await handleAIResponse(chatId, data);
  } catch (err) {
    console.error('AI error:', err.message);
    await send(chatId, i18n(chatId).errorGeneral);
  }
});

// ─── Callback query handler (inline keyboard buttons) ─────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;
  const s      = sess(chatId);
  const lang   = s.lang;

  await bot.answerCallbackQuery(query.id);

  // ── language selection ──
  if (data.startsWith('lang_')) {
    const newLang = data.replace('lang_', '');
    s.lang = newLang;
    await send(chatId, (T[newLang] || T.uz).languageSet, mainKeyboard(newLang));
    return;
  }

  // ── confirm booking ──
  if (data === 'confirm_yes') {
    if (!s.pendingDraft) return;
    try {
      bot.sendChatAction(chatId, 'typing');
      const aiData = await api.aiChat(chatId, lang === 'uz' ? 'ha' : lang === 'ru' ? 'да' : 'yes', lang);
      await handleAIResponse(chatId, aiData);
    } catch {
      await send(chatId, i18n(chatId).errorGeneral);
    }
    return;
  }

  if (data === 'confirm_no') {
    s.pendingDraft = null;
    const aiData = await api.aiChat(chatId, lang === 'uz' ? 'bekor' : lang === 'ru' ? 'отмена' : 'cancel', lang);
    await handleAIResponse(chatId, aiData);
    return;
  }

  // ── slot selection ──
  if (data.startsWith('slot_')) {
    const time = data.replace('slot_', '');
    try {
      bot.sendChatAction(chatId, 'typing');
      const aiData = await api.aiChat(chatId, time, lang);
      await handleAIResponse(chatId, aiData);
    } catch {
      await send(chatId, i18n(chatId).errorGeneral);
    }
    return;
  }

  // ── date selection ──
  if (data.startsWith('date_')) {
    const date = data.replace('date_', '');
    try {
      bot.sendChatAction(chatId, 'typing');
      const aiData = await api.aiChat(chatId, date, lang);
      await handleAIResponse(chatId, aiData);
    } catch {
      await send(chatId, i18n(chatId).errorGeneral);
    }
    return;
  }

  // ── choice selection (category / biz / service / budget) ──
  if (data.startsWith('choice_')) {
    // format: choice_{index}_{value}
    const parts = data.split('_');
    const value = parts.slice(2).join('_');
    try {
      bot.sendChatAction(chatId, 'typing');
      const aiData = await api.aiChat(chatId, value, lang);
      await handleAIResponse(chatId, aiData);
    } catch {
      await send(chatId, i18n(chatId).errorGeneral);
    }
    return;
  }
});

// ─── Error handler ────────────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

bot.on('error', (err) => {
  console.error('Bot error:', err.message);
});

console.log('🤖 HizmatTop Telegram Bot started...');
