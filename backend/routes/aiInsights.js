/**
 * AI Insights for Business Owners
 * POST /api/ai-insights/:businessId
 *
 * Groq анализирует:
 * - Все отзывы бизнеса (текст + рейтинг)
 * - Статистику бронирований (загрузка, популярные дни/часы)
 * - Flash deals активность
 *
 * Возвращает:
 * - strengths: что хвалят
 * - weaknesses: на что жалуются
 * - advice: конкретный совет на сегодня
 * - busySlots: самые загруженные часы
 * - rating trend
 */

const express = require('express');
const { protect, owner } = require('../middleware/auth');
const { db, normalizeBusiness } = require('../config/db');

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────
const callGroq = async (messages, model) => {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 1024,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
};

// ─── local fallback analysis (no Groq needed) ─────────────────────────────────
const localAnalysis = (reviews, bookings, business, lang) => {
  // keyword sentiment
  const positiveKw = ['yaxshi','ajoyib','zo\'r','tavsiya','professional','toza','tez',
    'хорош','отличн','рекоменд','профессионал','чисто','быстро',
    'good','great','excellent','clean','fast','recommend','professional'];
  const negativeKw = ['yomon','sekin','kech','qimmat','kirli','yoqmadi','kutdim',
    'плохо','медленно','дорог','грязно','долго','ждал','очередь',
    'bad','slow','dirty','expensive','wait','queue','late'];

  const texts = reviews.map(r => (r.comment || '').toLowerCase());
  const posCount = {}, negCount = {};

  positiveKw.forEach(kw => { const c = texts.filter(t => t.includes(kw)).length; if (c) posCount[kw] = c; });
  negativeKw.forEach(kw => { const c = texts.filter(t => t.includes(kw)).length; if (c) negCount[kw] = c; });

  const topPos = Object.entries(posCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k]) => k);
  const topNeg = Object.entries(negCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k]) => k);

  // booking stats
  const hourCounts = {};
  const dayCounts  = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 };
  bookings.forEach(b => {
    const h = b.start_time?.slice(0,2);
    if (h) hourCounts[h] = (hourCounts[h]||0) + 1;
    if (b.date) { const d = new Date(b.date+'T12:00').getDay(); dayCounts[d]++; }
  });

  const busyHour = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const quietHour = Object.entries(hourCounts).sort((a,b)=>a[1]-b[1])[0]?.[0];
  const busyDay = ['Yak','Du','Se','Chor','Pay','Ju','Shan'][
    Number(Object.entries(dayCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 5)
  ];

  const pending = bookings.filter(b => b.status === 'pending').length;
  const avgRating = reviews.length ? (reviews.reduce((s,r) => s+r.rating, 0) / reviews.length).toFixed(1) : null;

  // build advice
  const advices = [];
  if (pending > 0) advices.push(
    lang==='ru' ? `У вас ${pending} неподтверждённых записей — подтвердите их, чтобы клиенты не ждали.`
    : lang==='en' ? `You have ${pending} pending bookings — confirm them so clients don't wait.`
    : `Sizda ${pending} ta tasdiqlanmagan yozuv bor — mijozlar kutmasin, tasdiqlang.`
  );
  if (topNeg.length) advices.push(
    lang==='ru' ? `Клиенты упоминают: "${topNeg.join('", "')}". Обратите внимание на эти моменты.`
    : lang==='en' ? `Clients mention: "${topNeg.join('", "')}". Pay attention to these points.`
    : `Mijozlar shikoyat qilmoqda: "${topNeg.join('", "')}". Shu jihatlarga e'tibor bering.`
  );
  if (quietHour) advices.push(
    lang==='ru' ? `Тихое время: ${quietHour}:00. Попробуйте Flash Deal в это время.`
    : lang==='en' ? `Quiet hours: ${quietHour}:00. Try a Flash Deal at this time.`
    : `Sokin vaqt: ${quietHour}:00. Bu paytda Flash Deal qo'ying.`
  );

  return {
    avgRating,
    totalReviews: reviews.length,
    totalBookings: bookings.length,
    strengths: topPos.length
      ? topPos
      : [lang==='uz'?'Hozircha ijobiy kalit so\'zlar topilmadi':lang==='ru'?'Пока нет явных плюсов':'No clear strengths yet'],
    weaknesses: topNeg.length
      ? topNeg
      : [lang==='uz'?'Shikoyat topilmadi':lang==='ru'?'Жалоб не обнаружено':'No complaints found'],
    advice: advices.length
      ? advices
      : [lang==='uz'?'Mijozlarni sharh qoldirishga undang!':lang==='ru'?'Просите клиентов оставлять отзывы!':'Ask clients to leave reviews!'],
    busyHour: busyHour ? `${busyHour}:00` : null,
    quietHour: quietHour ? `${quietHour}:00` : null,
    busyDay,
    provider: 'local',
  };
};

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────────
router.post('/:businessId', protect, owner, async (req, res) => {
  const { businessId } = req.params;
  const lang = req.body.language || 'uz';

  // ownership check
  const bizRow = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  if (!bizRow) return res.status(404).json({ message: 'Business not found' });
  if (bizRow.owner_id !== req.user._id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Not authorized' });

  const biz = normalizeBusiness(bizRow);

  // gather data
  const reviews = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.name AS user_name
    FROM reviews r LEFT JOIN users u ON u.id=r.user_id
    WHERE r.business_id=? ORDER BY r.created_at DESC LIMIT 50
  `).all(businessId);

  const bookings = db.prepare(`
    SELECT b.status, b.date, b.start_time, b.total_price, s.name AS service_name
    FROM bookings b LEFT JOIN services s ON s.id=b.service_id
    WHERE b.business_id=? ORDER BY b.created_at DESC LIMIT 100
  `).all(businessId);

  // booking stats
  const hourCounts = {}, dayCounts = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
  bookings.forEach(b => {
    const h = b.start_time?.slice(0,2);
    if (h) hourCounts[h] = (hourCounts[h]||0)+1;
    if (b.date) { const d = new Date(b.date+'T12:00').getDay(); dayCounts[d]++; }
  });

  const busyHour  = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const quietHour = Object.entries(hourCounts).sort((a,b)=>a[1]-b[1]).find(([,v])=>v<(hourCounts[busyHour]||0)/2)?.[0];
  const DAY_NAMES = {
    uz: ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'],
    ru: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
    en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  };
  const busyDayIdx = Number(Object.entries(dayCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 5);
  const busyDay = DAY_NAMES[lang]?.[busyDayIdx] || DAY_NAMES.uz[busyDayIdx];

  const pending   = bookings.filter(b=>b.status==='pending').length;
  const confirmed = bookings.filter(b=>b.status==='confirmed').length;
  const completed = bookings.filter(b=>b.status==='completed').length;
  const revenue   = bookings.filter(b=>['confirmed','completed'].includes(b.status))
    .reduce((s,b)=>s+(b.total_price||0),0);
  const avgRating = reviews.length
    ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1)
    : null;

  // try Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const reviewText = reviews.length
        ? reviews.map(r => `[${r.rating}⭐] ${r.user_name}: "${r.comment||'(no comment)'}"`).join('\n')
        : 'No reviews yet.';

      const svcStats = {};
      bookings.forEach(b => { if (b.service_name) svcStats[b.service_name] = (svcStats[b.service_name]||0)+1; });
      const topServices = Object.entries(svcStats).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} (${v}x)`).join(', ');

      const sysPrompt = lang==='ru'
        ? `Ты бизнес-консультант для малого бизнеса в Узбекистане. Отвечай только на русском. 
Дай краткий, конкретный и практичный анализ. Формат ответа — строго JSON:
{"strengths":["...","..."],"weaknesses":["...","..."],"advice":["...","...","..."],"summary":"..."}`
        : lang==='en'
        ? `You are a business consultant for small businesses in Uzbekistan. Answer in English only.
Give brief, specific and actionable analysis. Response format — strict JSON:
{"strengths":["...","..."],"weaknesses":["...","..."],"advice":["...","...","..."],"summary":"..."}`
        : `Siz O'zbekistondagi kichik bizneslar uchun biznes-konsultantsiz. Faqat o'zbek tilida javob bering.
Qisqa, aniq va amaliy tahlil bering. Javob formati — faqat JSON:
{"strengths":["...","..."],"weaknesses":["...","..."],"advice":["...","...","..."],"summary":"..."}`;

      const userMsg = lang==='ru'
        ? `Бизнес: ${biz.name} (${biz.category}, ${biz.city})
Рейтинг: ${avgRating||'нет'}/5 (${reviews.length} отзывов)
Записей: ${bookings.length} (ожидают: ${pending}, подтверждены: ${confirmed}, завершены: ${completed})
Доход: ${revenue.toLocaleString()} сум
Популярные услуги: ${topServices||'нет данных'}
Загруженное время: ${busyHour||'неизвестно'}:00 | Тихое время: ${quietHour||'неизвестно'}:00
Загруженный день: ${busyDay}

Последние отзывы:
${reviewText}

Дай анализ и 3 конкретных совета на сегодня.`
        : lang==='en'
        ? `Business: ${biz.name} (${biz.category}, ${biz.city})
Rating: ${avgRating||'none'}/5 (${reviews.length} reviews)
Bookings: ${bookings.length} (pending: ${pending}, confirmed: ${confirmed}, completed: ${completed})
Revenue: ${revenue.toLocaleString()} sum
Top services: ${topServices||'no data'}
Peak hours: ${busyHour||'unknown'}:00 | Quiet hours: ${quietHour||'unknown'}:00
Busiest day: ${busyDay}

Recent reviews:
${reviewText}

Give analysis and 3 specific actionable tips for today.`
        : `Biznes: ${biz.name} (${biz.category}, ${biz.city})
Reyting: ${avgRating||'yo\'q'}/5 (${reviews.length} ta sharh)
Yozuvlar: ${bookings.length} ta (kutilmoqda: ${pending}, tasdiqlangan: ${confirmed}, yakunlangan: ${completed})
Daromad: ${revenue.toLocaleString()} so'm
Mashhur xizmatlar: ${topServices||'ma\'lumot yo\'q'}
Band vaqt: ${busyHour||'noma\'lum'}:00 | Sokin vaqt: ${quietHour||'noma\'lum'}:00
Band kun: ${busyDay}

So'nggi sharhlar:
${reviewText}

Tahlil qiling va bugun uchun 3 ta aniq maslahat bering.`;

      const raw = await callGroq([
        { role: 'system', content: sysPrompt },
        { role: 'user',   content: userMsg },
      ]);

      // parse JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          ...parsed,
          avgRating, totalReviews: reviews.length, totalBookings: bookings.length,
          pending, confirmed, completed, revenue,
          busyHour: busyHour ? `${busyHour}:00` : null,
          quietHour: quietHour ? `${quietHour}:00` : null,
          busyDay, topServices,
          provider: 'groq',
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Groq insights error:', err.message);
    }
  }

  // fallback: local analysis
  const local = localAnalysis(reviews, bookings, biz, lang);
  return res.json({
    ...local,
    pending, confirmed, completed, revenue,
    busyDay,
    topServices: Object.entries(
      bookings.reduce((acc,b) => { if (b.service_name) acc[b.service_name]=(acc[b.service_name]||0)+1; return acc; }, {})
    ).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} (${v}x)`).join(', ') || null,
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;
