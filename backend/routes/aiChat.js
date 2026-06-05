/**
 * HizmatTop AI Chat — Smart Booking Assistant v3
 *
 * FIXES:
 * - Session reset between users fixed (was shared state bug)
 * - Budget step removed from middle of flow — only asked ONCE at start
 * - When user types anything new → always reset and restart fresh
 * - Confirmation works: "ha" / "yes" / "да" → creates real booking
 * - Free-text booking works: "Ertaga 16:00 sartarosh" → straight to confirm
 */

const express = require('express');
const { protect } = require('../middleware/auth');
const { db, normalizeBusiness, normalizeService } = require('../config/db');
const { randomUUID } = require('crypto');

const router = express.Router();

// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  uz: {
    welcome:     'Salom! Qanday xizmat kerak?\nMasalan: "Ertaga soat 16da eng arzon sartarosh"',
    notFound:    'Hech narsa topilmadi. Boshqa so\'rov yuboring.',
    askCat:      'Qanday xizmat qidiryapsiz?',
    askDate:     'Qaysi sanaga? (bugun / ertaga / 15.06)',
    askTime:     (d, list) => `${d} sanasida bo\'sh vaqtlar:\n${list}\nQaysi vaqtni tanlaysiz?`,
    noSlots:     (d) => `${d} kuni bo\'sh vaqt yo\'q. Boshqa sana tanlang:`,
    askBiz:      'Qaysi birini tanlaysiz?',
    askSvc:      'Qaysi xizmatni olmoqchisiz?',
    confirmAsk:  '✅ Tasdiqlaysizmi?',
    confirmed:   (b,s,d,t,p) => `🎉 Band qilindi!\n📍 ${b}\n✂️ ${s}\n📅 ${d} · ⏰ ${t}\n💰 ${p}`,
    cancelled:   'Bekor qilindi. Yangi so\'rov yuboring.',
    slotTaken:   'Bu vaqt band bo\'ldi. Boshqa vaqt tanlang:',
    error:       (m) => `❌ Xatolik: ${m}`,
    yes:         ['ha','yes','да','ok','tasdiql','confirm','bo\'ladi','yaxshi','sure','+'],
    no:          ['yo\'q','no','нет','bekor','cancel','boshqa'],
    free:        'Bepul',
    today:       'Bugun',
    tomorrow:    'Ertaga',
    catLabels:   { barbershop:'💈 Sartarosh', game_club:'🎮 O\'yin klubi', restaurant:'🍽 Restoran', salon:'💅 Salon', car_wash:'🚗 Avtoyuvish', gym:'💪 Fitnes' },
  },
  ru: {
    welcome:     'Привет! Что ищете?\nНапример: "Завтра в 16:00 дешёвая парикмахерская"',
    notFound:    'Ничего не найдено. Попробуйте другой запрос.',
    askCat:      'Какой сервис ищете?',
    askDate:     'На какую дату? (сегодня / завтра / 15.06)',
    askTime:     (d, list) => `Свободное время на ${d}:\n${list}\nКакое время?`,
    noSlots:     (d) => `На ${d} нет свободного времени. Выберите другую дату:`,
    askBiz:      'Какой вариант выберете?',
    askSvc:      'Какую услугу хотите?',
    confirmAsk:  '✅ Подтверждаете?',
    confirmed:   (b,s,d,t,p) => `🎉 Забронировано!\n📍 ${b}\n✂️ ${s}\n📅 ${d} · ⏰ ${t}\n💰 ${p}`,
    cancelled:   'Отменено. Напишите новый запрос.',
    slotTaken:   'Это время уже занято. Выберите другое:',
    error:       (m) => `❌ Ошибка: ${m}`,
    yes:         ['да','yes','ha','ok','подтв','confirm','конечно','ок','+'],
    no:          ['нет','no','отмен','cancel','другой','назад'],
    free:        'Бесплатно',
    today:       'Сегодня',
    tomorrow:    'Завтра',
    catLabels:   { barbershop:'💈 Парикмахерская', game_club:'🎮 Игровой клуб', restaurant:'🍽 Ресторан', salon:'💅 Салон', car_wash:'🚗 Автомойка', gym:'💪 Фитнес' },
  },
  en: {
    welcome:     'Hi! What service do you need?\nExample: "Cheapest barbershop tomorrow at 4pm"',
    notFound:    'Nothing found. Try a different search.',
    askCat:      'What kind of service are you looking for?',
    askDate:     'What date? (today / tomorrow / 15.06)',
    askTime:     (d, list) => `Available slots on ${d}:\n${list}\nWhich time?`,
    noSlots:     (d) => `No free slots on ${d}. Choose another date:`,
    askBiz:      'Which one do you prefer?',
    askSvc:      'Which service would you like?',
    confirmAsk:  '✅ Confirm booking?',
    confirmed:   (b,s,d,t,p) => `🎉 Booked!\n📍 ${b}\n✂️ ${s}\n📅 ${d} · ⏰ ${t}\n💰 ${p}`,
    cancelled:   'Cancelled. Send a new request.',
    slotTaken:   'That slot was just taken. Choose another:',
    error:       (m) => `❌ Error: ${m}`,
    yes:         ['yes','ha','да','ok','confirm','sure','yep','+'],
    no:          ['no','нет','cancel','bekor','change'],
    free:        'Free',
    today:       'Today',
    tomorrow:    'Tomorrow',
    catLabels:   { barbershop:'💈 Barbershop', game_club:'🎮 Game club', restaurant:'🍽 Restaurant', salon:'💅 Salon', car_wash:'🚗 Car wash', gym:'💪 Gym' },
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const norm    = (s) => String(s || '').toLowerCase().trim();
const toMin   = (t) => { const [h,m] = String(t||'00:00').split(':').map(Number); return h*60+(m||0); };
const fromMin = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const fmtPrice = (p, lang) => p > 0 ? `${Number(p).toLocaleString('ru-RU')} so'm` : (T[lang]?.free || 'Bepul');

// ─── PARSERS ──────────────────────────────────────────────────────────────────
const CAT_SYNS = {
  barbershop: ['barber','sartarosh','soch','haircut','стрижк','парикм','boroda','beard','sartaroshxona'],
  game_club:  ['game','oyin','cyber','ps5','playstation','игр','кибер','компьютер','gaming'],
  restaurant: ['restoran','cafe','kafe','plov','ovqat','ресторан','кафе','еда','food','lunch','dinner'],
  salon:      ['salon','beauty','manikyur','gozallik','косметол','салон','маникюр','nail'],
  car_wash:   ['avtoyuv','moyka','carwash','wash','автомойк','мойк','avto'],
  gym:        ['gym','fitness','sport','zal','fitnes','фитнес','зал','тренаж'],
};

const detectCat = (t) => {
  const s = norm(t);
  for (const [cat, syns] of Object.entries(CAT_SYNS))
    if (syns.some(w => s.includes(w))) return cat;
  return null;
};

const parseDate = (text) => {
  const t = norm(text);
  const today = new Date();
  if (/bugun|today|сегодня/.test(t)) return today.toISOString().slice(0,10);
  if (/ertaga|tomorrow|завтра/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10);
  }
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dot = text.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  if (dot) {
    const y = dot[3] || today.getFullYear();
    return `${y}-${String(dot[2]).padStart(2,'0')}-${String(dot[1]).padStart(2,'0')}`;
  }
  return null;
};

const parseTime = (text) => {
  const t = norm(text);
  const hhmm = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2,'0')}:${hhmm[2]}`;
  const soat = t.match(/(?:soat|в|at|час)\s*(\d{1,2})/);
  if (soat) { const h = Number(soat[1]); return `${String(h < 7 ? h+12 : h).padStart(2,'0')}:00`; }
  const pm = t.match(/(\d{1,2})\s*pm/);
  if (pm) { const h = Number(pm[1]); return `${String(h < 12 ? h+12 : h).padStart(2,'0')}:00`; }
  return null;
};

const parseBudget = (text) => {
  const t = norm(text);
  if (/chegirm|flash|скидк|discount/.test(t)) return { flashOnly: true };
  if (/arzon|cheap|дешев|budget/.test(t)) return { max: 50000, flashOnly: false };
  if (/premium|qimmat|дорог|expensive/.test(t)) return { min: 80000, flashOnly: false };
  if (/o['']rta|средн|mid/.test(t)) return { min: 30000, max: 80000, flashOnly: false };
  const upTo = t.match(/(\d[\d ]*)\s*(?:gacha|до|under|max)/);
  if (upTo) return { max: Number(upTo[1].replace(/\s/g,'')), flashOnly: false };
  return null;
};

// ─── SEARCH ───────────────────────────────────────────────────────────────────
const searchBiz = ({ category, budget, lat, lng }) => {
  const catClause = category ? `AND b.category = '${category}'` : '';
  const rows = db.prepare(`
    SELECT b.*, MIN(s.price) AS min_price,
      GROUP_CONCAT(
        s.id||'::'||s.name||'::'||CAST(s.price AS TEXT)||'::'||
        CAST(s.duration_minutes AS TEXT)||'::'||
        CAST(COALESCE(s.discount_price,'') AS TEXT)||'::'||
        CAST(COALESCE(s.flash_deal_ends_at,'') AS TEXT)||'::'||
        CAST(s.is_flash_deal AS TEXT)
      , '||') AS svc_raw
    FROM businesses b
    LEFT JOIN services s ON s.business_id=b.id AND s.is_active=1
    WHERE b.status='approved' ${catClause}
    GROUP BY b.id ORDER BY b.rating DESC LIMIT 30
  `).all();

  const distKm = (la1,lo1,la2,lo2) => {
    const R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
    const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  };

  return rows.map(row => {
    const biz = normalizeBusiness(row);
    const services = (row.svc_raw||'').split('||').filter(Boolean).map(chunk => {
      const [id,name,price,dur,dp,fea,isF] = chunk.split('::');
      const flashActive = isF==='1' && fea && new Date(fea) > new Date();
      return {
        _id: id, name,
        price: Number(price||0),
        durationMinutes: Number(dur||60),
        discountPrice: dp ? Number(dp) : null,
        flashActive,
        isFlashDeal: isF==='1',
        effectivePrice: flashActive && dp ? Number(dp) : Number(price||0),
      };
    });

    let svcs = services;
    if (budget) {
      if (budget.flashOnly) svcs = services.filter(s => s.flashActive);
      else if (budget.max && budget.min) svcs = services.filter(s => s.effectivePrice >= budget.min && s.effectivePrice <= budget.max);
      else if (budget.max) svcs = services.filter(s => s.effectivePrice <= budget.max);
      else if (budget.min) svcs = services.filter(s => s.effectivePrice >= budget.min);
    }

    if (!svcs.length) return null;

    const dist = lat && lng ? distKm(lat, lng, Number(row.lat), Number(row.lng)) : null;
    return { ...biz, services: svcs, distance: dist };
  })
  .filter(Boolean)
  .sort((a,b) => {
    if (budget?.max || budget?.flashOnly) {
      const pA = Math.min(...a.services.map(s=>s.effectivePrice));
      const pB = Math.min(...b.services.map(s=>s.effectivePrice));
      if (pA !== pB) return pA - pB;
    }
    return (b.rating||0) - (a.rating||0);
  })
  .slice(0, 6);
};

// ─── SLOTS ────────────────────────────────────────────────────────────────────
const getSlots = (serviceId, date) => {
  const svc = normalizeService(db.prepare('SELECT * FROM services WHERE id=? AND is_active=1').get(serviceId));
  if (!svc) return [];
  const biz = normalizeBusiness(db.prepare('SELECT * FROM businesses WHERE id=?').get(svc.business));
  if (!biz) return [];

  const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const wh = biz.workingHours?.[dayKeys[new Date(date+'T12:00:00').getDay()]];
  if (wh?.closed) return [];

  const open  = toMin(wh?.open  || '09:00');
  let   close = toMin(wh?.close || '21:00');
  if (close <= open) close += 1440;

  const dur    = svc.durationMinutes;
  const now    = new Date();
  const today  = now.toISOString().slice(0,10);
  const nowMin = now.getHours()*60+now.getMinutes();
  const slots  = [];

  for (let s = open; s+dur <= close; s += 30) {
    if (date === today && s <= nowMin+30) continue;
    const st = fromMin(s), et = fromMin(s+dur);
    const busy = db.prepare(`
      SELECT 1 FROM bookings
      WHERE service_id=? AND date=? AND status NOT IN ('cancelled','rejected')
        AND start_time < ? AND end_time > ? LIMIT 1
    `).get(serviceId, date, et, st);
    if (!busy) slots.push({ time: st, endTime: et });
  }
  return slots;
};

// ─── DATE QUICK PICKS ─────────────────────────────────────────────────────────
const dateQuickPicks = (lang) => {
  const i18n = T[lang];
  const today = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate()+i);
    const val = d.toISOString().slice(0,10);
    const label = i === 0 ? i18n.today : i === 1 ? i18n.tomorrow
      : d.toLocaleDateString({ uz:'uz-UZ', ru:'ru-RU', en:'en-US' }[lang]||'uz-UZ', { weekday:'short', day:'numeric', month:'short' });
    return { label, value: val };
  });
};

// ─── BIZ CHOICE LABEL ────────────────────────────────────────────────────────
const bizLabel = (b, lang) => {
  const minP = b.services.length ? Math.min(...b.services.map(s=>s.effectivePrice)) : (b.minPrice||0);
  const LOCALE = { uz:'uz-UZ', ru:'ru-RU', en:'en-US' };
  return `${b.name}${b.distance!=null ? ' · '+b.distance.toFixed(1)+' km' : ''} · ⭐${(b.rating||0).toFixed(1)} · ${minP > 0 ? Number(minP).toLocaleString(LOCALE[lang])+' so\'m\'dan' : T[lang].free}`;
};

const svcLabel = (s, lang) => {
  const LOCALE = { uz:'uz-UZ', ru:'ru-RU', en:'en-US' };
  const p = s.flashActive && s.discountPrice ? s.discountPrice : s.price;
  return `${s.name} — ${Number(p).toLocaleString(LOCALE[lang])} so'm${s.flashActive ? ' 🔥' : ''} · ${s.durationMinutes} min`;
};

// ─── SESSION ──────────────────────────────────────────────────────────────────
// step: SEARCH | ASK_CAT | ASK_BIZ | ASK_SVC | ASK_DATE | ASK_TIME | CONFIRM
const sessions = new Map();
const getSess  = (uid) => { if (!sessions.has(uid)) sessions.set(uid, { step:'SEARCH' }); return sessions.get(uid); };
const resetSess = (uid) => { sessions.set(uid, { step:'SEARCH' }); return sessions.get(uid); };

// ─── MAIN ─────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { message = '', language = 'uz', location } = req.body;
  const uid  = req.user._id;
  const lang = ['uz','ru','en'].includes(language) ? language : 'uz';
  const i18n = T[lang];
  const msg  = message.trim();
  const low  = norm(msg);

  let sess = getSess(uid);

  // ── cancel anywhere ──────────────────────────────────────────────────────────
  if (sess.step !== 'SEARCH' && i18n.no.some(w => low === w || low.startsWith(w+' '))) {
    resetSess(uid);
    return res.json({ step:'SEARCH', answer: i18n.cancelled });
  }

  // ── SEARCH — new request ─────────────────────────────────────────────────────
  if (sess.step === 'SEARCH') {
    if (!msg) return res.json({ step:'SEARCH', answer: i18n.welcome });

    const cat      = detectCat(msg);
    const date     = parseDate(msg);
    const time     = parseTime(msg);
    const budget   = parseBudget(msg);

    // no category → ask
    if (!cat) {
      sess.step   = 'ASK_CAT';
      sess.date   = date;
      sess.time   = time;
      sess.budget = budget;
      return res.json({
        step: 'ASK_CAT',
        answer: i18n.askCat,
        choices: Object.keys(CAT_SYNS).map(k => ({ label: i18n.catLabels[k], value: k })),
      });
    }

    // have category → search
    sess.cat    = cat;
    sess.date   = date;
    sess.time   = time;
    sess.budget = budget;
    return doSearch(res, sess, uid, lang, i18n, location);
  }

  // ── ASK_CAT ──────────────────────────────────────────────────────────────────
  if (sess.step === 'ASK_CAT') {
    const cat = detectCat(msg) || Object.keys(CAT_SYNS).find(k => low === k) || null;
    if (!cat) {
      return res.json({
        step: 'ASK_CAT',
        answer: i18n.askCat,
        choices: Object.keys(CAT_SYNS).map(k => ({ label: i18n.catLabels[k], value: k })),
      });
    }
    sess.cat = cat;
    if (!sess.date) sess.date = parseDate(msg);
    if (!sess.time) sess.time = parseTime(msg);
    if (!sess.budget) sess.budget = parseBudget(msg);
    return doSearch(res, sess, uid, lang, i18n, location);
  }

  // ── ASK_BIZ ──────────────────────────────────────────────────────────────────
  if (sess.step === 'ASK_BIZ') {
    const list = sess.bizList || [];
    const idx = Number(msg) - 1;
    let biz = (!isNaN(idx) && idx >= 0 && idx < list.length)
      ? list[idx]
      : list.find(b => norm(b.name).includes(low) || b._id === msg) || null;

    if (!biz) {
      return res.json({
        step: 'ASK_BIZ',
        answer: i18n.askBiz,
        businesses: list,
        choices: list.map((b,i) => ({ label: bizLabel(b, lang), value: b._id, index: i })),
      });
    }

    sess.biz = biz;
    if (biz.services.length === 1) {
      sess.svc = biz.services[0];
      return doAfterSvc(res, sess, lang, i18n);
    }
    sess.step = 'ASK_SVC';
    return res.json({
      step: 'ASK_SVC',
      answer: i18n.askSvc,
      businesses: [biz],
      services: biz.services.map((s,i) => ({ label: svcLabel(s, lang), value: s._id, index: i })),
    });
  }

  // ── ASK_SVC ──────────────────────────────────────────────────────────────────
  if (sess.step === 'ASK_SVC') {
    const list = sess.biz?.services || [];
    const idx = Number(msg) - 1;
    let svc = (!isNaN(idx) && idx >= 0 && idx < list.length)
      ? list[idx]
      : list.find(s => norm(s.name).includes(low) || s._id === msg) || null;

    if (!svc) {
      return res.json({
        step: 'ASK_SVC',
        answer: i18n.askSvc,
        businesses: [sess.biz],
        services: list.map((s,i) => ({ label: svcLabel(s, lang), value: s._id, index: i })),
      });
    }
    sess.svc = svc;
    return doAfterSvc(res, sess, lang, i18n);
  }

  // ── ASK_DATE ─────────────────────────────────────────────────────────────────
  if (sess.step === 'ASK_DATE') {
    const date = parseDate(msg);
    if (!date) {
      return res.json({
        step: 'ASK_DATE',
        answer: i18n.askDate,
        businesses: [sess.biz],
        quickDates: dateQuickPicks(lang),
      });
    }
    sess.date = date;
    if (!sess.time) sess.time = parseTime(msg);
    return doAfterSvc(res, sess, lang, i18n);
  }

  // ── ASK_TIME ─────────────────────────────────────────────────────────────────
  if (sess.step === 'ASK_TIME') {
    const slots = sess.slots || [];
    let slot = slots.find(s => s.time === msg);
    if (!slot) {
      const t = parseTime(msg);
      if (t) slot = slots.find(s => s.time === t) || slots.find(s => s.time >= t);
    }
    if (!slot) {
      const idx = Number(msg) - 1;
      if (!isNaN(idx) && idx >= 0) slot = slots[idx];
    }

    if (!slot) {
      return res.json({
        step: 'ASK_TIME',
        answer: i18n.askTime(sess.date, slots.slice(0,8).map(s=>s.time).join('  |  ')),
        slots,
        date: sess.date,
        businesses: [sess.biz],
      });
    }
    sess.slot = slot;
    return doConfirm(res, sess, lang, i18n);
  }

  // ── CONFIRM ───────────────────────────────────────────────────────────────────
  if (sess.step === 'CONFIRM') {
    if (i18n.yes.some(w => low === w || low.includes(w))) {
      return doBook(res, sess, uid, lang, i18n);
    }
    resetSess(uid);
    return res.json({ step:'SEARCH', answer: i18n.cancelled });
  }

  // ── fallback: treat as new search ────────────────────────────────────────────
  resetSess(uid);
  sess = getSess(uid);
  const cat    = detectCat(msg);
  const date   = parseDate(msg);
  const time   = parseTime(msg);
  const budget = parseBudget(msg);

  if (!cat) {
    sess.step   = 'ASK_CAT';
    sess.date   = date;
    sess.time   = time;
    sess.budget = budget;
    return res.json({
      step: 'ASK_CAT',
      answer: i18n.askCat,
      choices: Object.keys(CAT_SYNS).map(k => ({ label: i18n.catLabels[k], value: k })),
    });
  }
  sess.cat    = cat;
  sess.date   = date;
  sess.time   = time;
  sess.budget = budget;
  return doSearch(res, sess, uid, lang, i18n, location);
});

// ─── FLOW HELPERS ─────────────────────────────────────────────────────────────

function doSearch(res, sess, uid, lang, i18n, location) {
  const results = searchBiz({
    category: sess.cat,
    budget:   sess.budget,
    lat:      location?.lat,
    lng:      location?.lng,
  });

  if (!results.length) {
    // try without budget filter
    const fallback = searchBiz({ category: sess.cat, lat: location?.lat, lng: location?.lng });
    if (!fallback.length) {
      resetSess(uid);
      return res.json({ step:'SEARCH', answer: i18n.notFound });
    }
    sess.budget  = null;
    sess.bizList = fallback;
    sess.step    = 'ASK_BIZ';
    const lang2 = lang;
    return res.json({
      step: 'ASK_BIZ',
      answer: (lang2==='uz' ? 'Bu narxda topilmadi, lekin boshqa variantlar bor:' : lang2==='ru' ? 'По этой цене не найдено, но есть другие варианты:' : 'Not found at this price, but here are other options:'),
      businesses: fallback,
      choices: fallback.map((b,i) => ({ label: bizLabel(b, lang2), value: b._id, index: i })),
    });
  }

  sess.bizList = results;

  // 1 result → auto-select biz
  if (results.length === 1) {
    sess.biz = results[0];
    if (results[0].services.length === 1) {
      sess.svc = results[0].services[0];
      return doAfterSvc(res, sess, lang, i18n);
    }
    sess.step = 'ASK_SVC';
    return res.json({
      step: 'ASK_SVC',
      answer: i18n.askSvc,
      businesses: results,
      services: results[0].services.map((s,i) => ({ label: svcLabel(s, lang), value: s._id, index: i })),
    });
  }

  // multiple → pick biz
  sess.step = 'ASK_BIZ';
  return res.json({
    step: 'ASK_BIZ',
    answer: i18n.askBiz,
    businesses: results,
    choices: results.map((b,i) => ({ label: bizLabel(b, lang), value: b._id, index: i })),
  });
}

function doAfterSvc(res, sess, lang, i18n) {
  if (!sess.date) {
    sess.step = 'ASK_DATE';
    return res.json({
      step: 'ASK_DATE',
      answer: i18n.askDate,
      businesses: [sess.biz],
      quickDates: dateQuickPicks(lang),
    });
  }

  const slots = getSlots(sess.svc._id, sess.date);
  if (!slots.length) {
    sess.date = null;
    sess.step = 'ASK_DATE';
    return res.json({
      step: 'ASK_DATE',
      answer: i18n.noSlots(sess.date || ''),
      businesses: [sess.biz],
      quickDates: dateQuickPicks(lang),
    });
  }

  if (sess.time) {
    const t = sess.time;
    sess.slot = slots.find(s => s.time === t) || slots.find(s => s.time >= t) || slots[0];
    return doConfirm(res, sess, lang, i18n);
  }

  sess.slots = slots;
  sess.step  = 'ASK_TIME';
  return res.json({
    step: 'ASK_TIME',
    answer: i18n.askTime(sess.date, slots.slice(0,8).map(s=>s.time).join('  |  ')),
    slots,
    date: sess.date,
    businesses: [sess.biz],
  });
}

function doConfirm(res, sess, lang, i18n) {
  sess.step = 'CONFIRM';
  const biz  = sess.biz;
  const svc  = sess.svc;
  const slot = sess.slot;
  const price = svc.flashActive && svc.discountPrice ? svc.discountPrice : svc.price;

  return res.json({
    step: 'CONFIRM',
    answer: i18n.confirmAsk,
    businesses: [biz],
    bookingDraft: {
      businessId:      biz._id,
      businessName:    biz.name,
      serviceId:       svc._id,
      serviceName:     svc.name,
      servicePrice:    price,
      originalPrice:   svc.price,
      flashActive:     svc.flashActive || false,
      durationMinutes: svc.durationMinutes,
      date:            sess.date,
      startTime:       slot.time,
      endTime:         slot.endTime,
    },
  });
}

function doBook(res, sess, uid, lang, i18n) {
  const { biz, svc, date, slot } = sess;

  const conflict = db.prepare(`
    SELECT 1 FROM bookings
    WHERE service_id=? AND date=? AND status NOT IN ('cancelled','rejected')
      AND start_time < ? AND end_time > ? LIMIT 1
  `).get(svc._id, date, slot.endTime, slot.time);

  if (conflict) {
    const newSlots = getSlots(svc._id, date);
    sess.slots = newSlots;
    sess.slot  = null;
    sess.step  = 'ASK_TIME';
    return res.json({
      step: 'ASK_TIME',
      answer: i18n.slotTaken + '\n' + i18n.askTime(date, newSlots.slice(0,8).map(s=>s.time).join('  |  ')),
      slots: newSlots, date,
      businesses: [biz],
    });
  }

  const flash = svc.flashActive || false;
  const price = flash && svc.discountPrice ? svc.discountPrice : svc.price;
  const id    = randomUUID();

  db.prepare(`
    INSERT INTO bookings
      (id,user_id,business_id,service_id,date,start_time,end_time,
       total_price,original_price,final_price,was_flash_deal,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')
  `).run(id, uid, biz._id, svc._id, date, slot.time, slot.endTime,
    price, svc.price, price, flash ? 1 : 0);

  const bizRow = db.prepare('SELECT owner_id FROM businesses WHERE id=?').get(biz._id);
  try {
    db.prepare('INSERT INTO notifications(id,user_id,type,title,message) VALUES(?,?,?,?,?)')
      .run(randomUUID(), uid, 'booking_created', '📅 Band qilish tasdiqlandi',
        `${biz.name} — ${svc.name}: ${date} ${slot.time}`);
    if (bizRow?.owner_id) {
      db.prepare('INSERT INTO notifications(id,user_id,type,title,message) VALUES(?,?,?,?,?)')
        .run(randomUUID(), bizRow.owner_id, 'booking_new', '🔔 Yangi yozilish',
          `${svc.name}: ${date} ${slot.time}`);
    }
  } catch {}

  const LOCALE = { uz:'uz-UZ', ru:'ru-RU', en:'en-US' };
  const dateLabel = new Date(date+'T12:00:00')
    .toLocaleDateString(LOCALE[lang]||'uz-UZ', { weekday:'long', day:'numeric', month:'long' });

  resetSess(uid);

  return res.json({
    step: 'DONE',
    answer: i18n.confirmed(biz.name, svc.name, dateLabel, slot.time, fmtPrice(price, lang)),
    businesses: [biz],
    booking: {
      _id: id,
      businessId: biz._id, businessName: biz.name,
      serviceId: svc._id, serviceName: svc.name,
      date, startTime: slot.time, endTime: slot.endTime,
      totalPrice: price, wasFlashDeal: flash, status: 'pending',
    },
  });
}

// ─── RESET ────────────────────────────────────────────────────────────────────
router.post('/reset', protect, (req, res) => {
  resetSess(req.user._id);
  res.json({ ok: true });
});

module.exports = router;
