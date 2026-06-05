import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import useGeolocation from '../hooks/useGeolocation';
import { formatPrice, getCategoryMeta } from '../utils/helpers';

// ─── quick prompts ────────────────────────────────────────────────────────────
const QUICK = {
  uz: ['Ertaga soat 16da eng arzon sartarosh', 'Bugun kechqurun salonga yozilmoqchiman', 'Chegirmali fitnes zal topib ber', 'Yaqinimda restoran bor?'],
  ru: ['Завтра в 16:00 дешёвая парикмахерская', 'Сегодня вечером в салон', 'Фитнес со скидкой', 'Ресторан рядом?'],
  en: ['Cheapest barbershop tomorrow 4pm', 'Salon appointment today evening', 'Gym with discount', 'Restaurant near me?'],
};

const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

// ─── ChoiceButtons ────────────────────────────────────────────────────────────
const ChoiceButtons = ({ choices, onSelect, small }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.6rem' }}>
    {choices.map((c, i) => (
      <button
        key={c.value || i}
        onClick={() => onSelect(c.value, c.label)}
        style={{
          padding: small ? '0.35rem 0.7rem' : '0.5rem 0.9rem',
          borderRadius: 999,
          border: '1.5px solid var(--primary)',
          background: 'var(--primary-light)',
          color: 'var(--primary)',
          fontWeight: 600,
          fontSize: small ? '0.78rem' : '0.85rem',
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'left',
          lineHeight: 1.3,
        }}
      >
        {c.label}
      </button>
    ))}
  </div>
);

// ─── SlotButtons ──────────────────────────────────────────────────────────────
const SlotButtons = ({ slots, selected, onSelect }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
    {slots.slice(0, 12).map(s => (
      <button
        key={s.time}
        onClick={() => onSelect(s.time)}
        style={{
          padding: '0.4rem 0.75rem',
          borderRadius: 8,
          border: `1.5px solid ${selected === s.time ? 'var(--primary)' : 'var(--border)'}`,
          background: selected === s.time ? 'var(--primary)' : 'var(--bg-card)',
          color: selected === s.time ? '#fff' : 'var(--text-primary)',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        {s.time}
      </button>
    ))}
  </div>
);

// ─── BookingCard ──────────────────────────────────────────────────────────────
const BookingCard = ({ draft, onConfirm, onCancel, confirming, language }) => {
  const locale = LOCALE[language] || 'uz-UZ';
  const dateLabel = draft.date
    ? new Date(draft.date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
    : draft.date;
  return (
    <div style={{
      background: 'linear-gradient(135deg,#f0edff,#e8f5e9)',
      border: '2px solid var(--primary)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.1rem 1.25rem',
      maxWidth: 360,
      marginTop: '0.5rem',
    }}>
      <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
        📋 {language === 'uz' ? 'Bron ma\'lumotlari' : language === 'ru' ? 'Данные бронирования' : 'Booking details'}
      </div>
      {[
        ['🏢', language==='uz'?'Biznes':language==='ru'?'Бизнес':'Business', draft.businessName],
        ['✂️', language==='uz'?'Xizmat':language==='ru'?'Услуга':'Service', draft.serviceName],
        ['📅', language==='uz'?'Sana':language==='ru'?'Дата':'Date', dateLabel],
        ['⏰', language==='uz'?'Vaqt':language==='ru'?'Время':'Time', `${draft.startTime} – ${draft.endTime}`],
        ['💰', language==='uz'?'Narx':language==='ru'?'Цена':'Price',
          draft.flashActive
            ? <><s style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>{draft.originalPrice?.toLocaleString()} so'm</s> {' '}<strong style={{color:'var(--danger)'}}>{draft.servicePrice?.toLocaleString()} so'm 🔥</strong></>
            : `${draft.servicePrice?.toLocaleString()} so'm`],
        ['⏱', language==='uz'?'Davomiyligi':language==='ru'?'Длит.':'Duration', `${draft.durationMinutes} min`],
      ].map(([icon, label, val]) => (
        <div key={label} style={{ display:'flex', gap:'0.4rem', alignItems:'flex-start', marginBottom:'0.35rem', fontSize:'0.88rem' }}>
          <span style={{ flexShrink:0, width:20 }}>{icon}</span>
          <span style={{ color:'var(--text-secondary)', minWidth:70 }}>{label}:</span>
          <strong>{val}</strong>
        </div>
      ))}
      <div style={{ display:'flex', gap:'0.6rem', marginTop:'1rem' }}>
        <button
          className="btn"
          style={{ flex:1, background:'var(--success)', fontSize:'0.9rem', padding:'0.6rem' }}
          disabled={confirming}
          onClick={onConfirm}
        >
          {confirming ? '⏳' : `✅ ${language==='uz'?'Tasdiqlash':language==='ru'?'Подтвердить':'Confirm'}`}
        </button>
        <button
          className="btn btn-outline"
          style={{ fontSize:'0.9rem', padding:'0.6rem 1rem' }}
          disabled={confirming}
          onClick={onCancel}
        >
          {language==='uz'?'Bekor':language==='ru'?'Отмена':'Cancel'}
        </button>
      </div>
    </div>
  );
};

// ─── SuccessCard ──────────────────────────────────────────────────────────────
const SuccessCard = ({ booking, language, onProfile }) => (
  <div style={{
    background:'linear-gradient(135deg,#e8f5e9,#f0edff)',
    border:'2px solid var(--success)',
    borderRadius:'var(--radius-lg)',
    padding:'1.1rem 1.25rem',
    maxWidth:320, marginTop:'0.5rem', textAlign:'center',
  }}>
    <div style={{ fontSize:'2.5rem', lineHeight:1 }}>🎉</div>
    <strong style={{ display:'block', color:'var(--success)', margin:'0.4rem 0 0.25rem' }}>
      {language==='uz'?'Muvaffaqiyatli!':language==='ru'?'Успешно!':'Success!'}
    </strong>
    <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:'0.75rem' }}>
      {booking.businessName} · {booking.serviceName}<br/>
      {booking.date} · {booking.startTime}
    </div>
    <button className="btn btn-outline" style={{ width:'100%', fontSize:'0.85rem' }} onClick={onProfile}>
      {language==='uz'?'📋 Profilga o\'tish':language==='ru'?'📋 В профиль':'📋 View profile'}
    </button>
  </div>
);

// ─── BizCard (mini) ───────────────────────────────────────────────────────────
const BizMini = ({ biz, language, onOpen }) => {
  const meta = getCategoryMeta(biz.category);
  const minP = biz.services?.length ? Math.min(...biz.services.map(s=>s.effectivePrice||s.price)) : biz.minPrice;
  return (
    <div style={{
      background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', padding:'0.85rem',
      display:'flex', gap:'0.65rem', alignItems:'center',
    }}>
      <div style={{ width:40,height:40,borderRadius:10, background:meta.color+'22',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.3rem',flexShrink:0 }}>
        {meta.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {biz.name}
        </div>
        <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
          ⭐{(biz.rating||0).toFixed(1)}
          {biz.distance!=null && ` · ${biz.distance.toFixed(1)} km`}
          {minP > 0 && ` · ${Number(minP).toLocaleString()} so'm'dan`}
        </div>
      </div>
      <button className="btn btn-sm btn-outline" style={{ fontSize:'0.75rem', padding:'0.3rem 0.6rem', flexShrink:0 }}
        onClick={() => onOpen(biz)}>
        {language==='uz'?'Ochish':language==='ru'?'Открыть':'Open'}
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const Chat = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { location } = useGeolocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'ai');

  // ── AI state ──
  const [messages, setMessages] = useState([]); // { role, text, step, meta }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // ── Business chat state ──
  const [bizList, setBizList] = useState([]);
  const [convos, setConvos] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatText, setChatText] = useState('');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchConvos = useCallback(async () => {
    const r = await api.get('/chat/conversations');
    setConvos(r.data);
  }, []);

  useEffect(() => {
    api.get('/businesses').then(r => setBizList(r.data)).catch(() => {});
    fetchConvos().catch(() => {});
  }, [fetchConvos]);

  useEffect(() => {
    if (!activeConvo && convos.length) setActiveConvo(convos[0]);
  }, [convos]); // eslint-disable-line

  useEffect(() => {
    if (!activeConvo) return;
    const fetch = () => api.get(`/chat/conversations/${activeConvo._id}/messages`).then(r => setChatMsgs(r.data)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, [activeConvo]);

  // ── send to AI ────────────────────────────────────────────────────────────
  const sendAI = async (text) => {
    if (!text?.trim() || loading) return;
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPendingDraft(null);
    setSelectedSlot(null);

    try {
      const r = await api.post('/ai-chat', { message: text, language, location });
      const data = r.data;

      const aiMsg = {
        role: 'assistant',
        text: data.answer || '',
        step: data.step,
        choices: data.choices || [],
        services: data.services || [],
        slots: data.slots || [],
        date: data.date,
        quickDates: data.quickDates || [],
        businesses: data.businesses || [],
        bookingDraft: data.bookingDraft || null,
        booking: data.booking || null,
      };

      setMessages(prev => [...prev, aiMsg]);
      if (data.bookingDraft) setPendingDraft(data.bookingDraft);

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: language==='uz' ? '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.' : language==='ru' ? '❌ Ошибка. Попробуйте ещё раз.' : '❌ Error. Please try again.',
        step: 'ERROR',
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── confirm booking ───────────────────────────────────────────────────────
  const confirmBooking = async () => {
    setConfirming(true);
    try {
      await sendAI(language==='uz' ? 'ha' : language==='ru' ? 'да' : 'yes');
    } finally {
      setConfirming(false);
      setPendingDraft(null);
    }
  };

  const cancelBooking = async () => {
    setPendingDraft(null);
    await sendAI(language==='uz' ? 'bekor' : language==='ru' ? 'отмена' : 'cancel');
  };

  // ── reset session ──────────────────────────────────────────────────────────
  const resetAI = async () => {
    try { await api.post('/ai-chat/reset', { language }); } catch {}
    setMessages([]);
    setPendingDraft(null);
    setSelectedSlot(null);
  };

  // ── business chat ──────────────────────────────────────────────────────────
  const startConvo = async (biz) => {
    const r = await api.post('/chat/conversations', { businessId: biz._id });
    await fetchConvos();
    const all = (await api.get('/chat/conversations')).data;
    setActiveConvo(all.find(c => c._id === r.data._id) || all[0]);
    setActiveTab('business');
  };

  const sendChatMsg = async (e) => {
    e.preventDefault();
    if (!activeConvo || !chatText.trim()) return;
    const r = await api.post(`/chat/conversations/${activeConvo._id}/messages`, { body: chatText });
    setChatMsgs(prev => [...prev, r.data]);
    setChatText('');
    fetchConvos();
  };

  if (!user) return (
    <div className="container" style={{ padding:'5rem 0', textAlign:'center' }}>
      <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🤖</div>
      <h1>{t('chatTitle')}</h1>
      <p style={{ color:'var(--text-secondary)', marginBottom:'1.5rem' }}>{t('chatLoginRequired')}</p>
      <button className="btn btn-lg" onClick={() => navigate('/login')}>{t('chatLoginBtn')}</button>
    </div>
  );

  // ── last AI message for right panel ──────────────────────────────────────
  const lastAI = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="container animate-in" style={{ paddingBottom:'4rem' }}>
      <div style={{ margin:'2rem 0 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ margin:0 }}>{t('chatTitle')}</h1>
          <p style={{ margin:'0.2rem 0 0', color:'var(--text-secondary)', fontSize:'0.9rem' }}>{t('chatSubtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab==='ai' ? '' : 'btn-outline'}`}
          style={activeTab==='ai' ? { background:'linear-gradient(135deg,var(--primary),#8B5CF6)' } : {}}
          onClick={() => setActiveTab('ai')}
        >
          🤖 {t('aiAssistant')}
        </button>
        <button
          className={`btn btn-sm ${activeTab==='business' ? '' : 'btn-outline'}`}
          onClick={() => setActiveTab('business')}
        >
          💬 {t('businessChat')}
        </button>
      </div>

      {/* ══ AI TAB ════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="chat-ai-layout">

          {/* Left: chat */}
          <div className="chat-panel">
            {/* Header */}
            <div style={{
              padding:'0.85rem 1.1rem', borderBottom:'1px solid var(--border)',
              background:'linear-gradient(135deg,var(--primary-light),#fff)',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                <div style={{ width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,var(--primary),#8B5CF6)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem' }}>🤖</div>
                <div>
                  <strong style={{ fontSize:'0.9rem', display:'block' }}>{t('aiAssistant')}</strong>
                  <span style={{ fontSize:'0.72rem', color:'var(--success)', fontWeight:700 }}>
                    ● {language==='uz'?'Band qila oladi':language==='ru'?'Умеет бронировать':'Can book'}
                  </span>
                </div>
              </div>
              {messages.length > 0 && (
                <button onClick={resetAI} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'0.3rem 0.6rem', fontSize:'0.75rem', cursor:'pointer', color:'var(--text-secondary)' }}>
                  {language==='uz'?'Yangi':language==='ru'?'Заново':'Reset'}
                </button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.9rem' }}>

              {/* Welcome state */}
              {messages.length === 0 && (
                <div style={{ textAlign:'center', padding:'1.5rem 0.5rem' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>🤖</div>
                  <p style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)', margin:'0 0 0.4rem' }}>
                    {language==='uz'?'Salom! Men sizga xizmat topib, band qilib beraman.'
                     :language==='ru'?'Привет! Я найду сервис и забронирую за вас.'
                     :'Hi! I\'ll find a service and book it for you.'}
                  </p>
                  <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', margin:'0 0 1rem' }}>
                    {language==='uz'?'Bir xabarda hamma narsani ayting 👇'
                     :language==='ru'?'Скажите всё в одном сообщении 👇'
                     :'Tell me everything in one message 👇'}
                  </p>
                  <ChoiceButtons
                    choices={QUICK[language].map(q => ({ label: q, value: q }))}
                    onSelect={(v) => sendAI(v)}
                    small
                  />
                </div>
              )}

              {/* Message list */}
              {messages.map((msg, idx) => (
                <div key={idx} style={{ display:'flex', flexDirection:'column', alignItems: msg.role==='user' ? 'flex-end' : 'flex-start', gap:'0.4rem' }}>

                  {/* Bubble */}
                  {msg.text && (
                    <div style={{
                      maxWidth:'90%', whiteSpace:'pre-wrap', lineHeight:1.5,
                      background: msg.role==='user'
                        ? 'linear-gradient(135deg,var(--primary),#8B5CF6)'
                        : 'var(--bg)',
                      color: msg.role==='user' ? '#fff' : 'var(--text-primary)',
                      padding:'0.7rem 1rem',
                      borderRadius: msg.role==='user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize:'0.9rem',
                    }}>
                      {msg.text}
                    </div>
                  )}

                  {/* Choice buttons */}
                  {msg.role==='assistant' && msg.choices?.length > 0 && (
                    <ChoiceButtons choices={msg.choices} onSelect={(v, label) => sendAI(label || v)} />
                  )}

                  {/* Service choices */}
                  {msg.role==='assistant' && msg.services?.length > 0 && (
                    <ChoiceButtons
                      choices={msg.services}
                      onSelect={(v, label) => sendAI(label || v)}
                    />
                  )}

                  {/* Date quick picks */}
                  {msg.role==='assistant' && msg.quickDates?.length > 0 && (
                    <ChoiceButtons
                      choices={msg.quickDates}
                      onSelect={(v, label) => sendAI(label || v)}
                      small
                    />
                  )}

                  {/* Slot buttons */}
                  {msg.role==='assistant' && msg.slots?.length > 0 && (
                    <SlotButtons
                      slots={msg.slots}
                      selected={selectedSlot}
                      onSelect={(t) => { setSelectedSlot(t); sendAI(t); }}
                    />
                  )}

                  {/* Booking confirmation card */}
                  {msg.role==='assistant' && msg.step==='CONFIRM' && msg.bookingDraft && pendingDraft && (
                    <BookingCard
                      draft={pendingDraft}
                      onConfirm={confirmBooking}
                      onCancel={cancelBooking}
                      confirming={confirming}
                      language={language}
                    />
                  )}

                  {/* Success card */}
                  {msg.role==='assistant' && msg.step==='DONE' && msg.booking && (
                    <SuccessCard
                      booking={msg.booking}
                      language={language}
                      onProfile={() => navigate('/profile')}
                    />
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display:'flex', gap:4, padding:'0.7rem 1rem', background:'var(--bg)', borderRadius:'16px 16px 16px 4px', alignSelf:'flex-start' }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:7,height:7,borderRadius:'50%',background:'var(--text-muted)',
                      animation:`aiPulse 1.2s ease-in-out ${i*0.2}s infinite`, display:'inline-block' }} />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={e => { e.preventDefault(); sendAI(input); }}
              style={{ display:'flex', gap:'0.6rem', padding:'0.8rem 1rem', borderTop:'1px solid var(--border)', background:'var(--bg-card)' }}
            >
              <input
                className="form-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  language==='uz' ? 'Ertaga soat 4da arzon sartarosh...'
                  : language==='ru' ? 'Завтра в 16:00 дешёвая парикмахерская...'
                  : 'Cheap barbershop tomorrow at 4pm...'
                }
                style={{ borderRadius:999, fontSize:'0.9rem' }}
                disabled={loading}
              />
              <button
                className="btn"
                disabled={loading || !input.trim()}
                style={{ borderRadius:999, background:'linear-gradient(135deg,var(--primary),#8B5CF6)', padding:'0.6rem 1.1rem', minWidth:46 }}
              >
                {loading ? '⏳' : '➤'}
              </button>
            </form>
          </div>

          {/* Right: businesses panel */}
          <div className="chat-recommendations">
            <h3 style={{ marginBottom:'0.75rem', fontSize:'0.95rem' }}>
              {lastAI?.businesses?.length
                ? t('aiRecommendations')
                : (language==='uz'?'💡 Qanday ishlaydi?':language==='ru'?'💡 Как работает?':'💡 How it works?')}
            </h3>

            {!lastAI?.businesses?.length ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                {[
                  ['🗣', language==='uz'?'Bir xabarda hamma narsani ayting':language==='ru'?'Скажите всё в одном сообщении':'Say everything in one message',
                        language==='uz'?'"Ertaga soat 16da arzon sartarosh"':language==='ru'?'"Завтра в 16:00 дешёвая парикмахерская"':'"Cheap barbershop tomorrow at 4pm"'],
                  ['🤖', language==='uz'?'AI tushunadi va taklif qiladi':language==='ru'?'AI понимает и предлагает варианты':'AI understands and suggests options',
                        language==='uz'?'Narx, joylashuv, reyting hisobga olinadi':language==='ru'?'Учтёт цену, рейтинг, расстояние':'Price, rating, distance considered'],
                  ['✅', language==='uz'?'Bir bosganda band qiladi':language==='ru'?'Бронирует одним нажатием':'Books with one tap',
                        language==='uz'?'Tasdiqlash tugmasi chiqadi — bosing!':language==='ru'?'Появится кнопка — нажмите!':'Confirm button appears — tap it!'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'0.85rem', display:'flex', gap:'0.65rem' }}>
                    <span style={{ fontSize:'1.3rem' }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.88rem' }}>{title}</div>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginTop:2, fontStyle:'italic' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                {lastAI.businesses.map(biz => (
                  <BizMini key={biz._id} biz={biz} language={language} onOpen={b => navigate(`/business/${b._id}`)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ BUSINESS CHAT TAB ════════════════════════════════════════════════ */}
      {activeTab === 'business' && (
        <div style={{ display:'grid', gridTemplateColumns:'270px minmax(0,1fr)', gap:'1.25rem', alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'0.9rem' }}>
              <h3 style={{ marginBottom:'0.75rem', fontSize:'0.9rem' }}>{t('conversations')}</h3>
              {convos.length === 0 && <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{t('noConversations')}</p>}
              {convos.map(c => (
                <button key={c._id} onClick={() => setActiveConvo(c)} style={{
                  width:'100%', textAlign:'left', border:'1px solid var(--border)',
                  background: activeConvo?._id===c._id ? 'var(--primary-light)' : 'var(--bg-card)',
                  borderRadius:'var(--radius-sm)', padding:'0.6rem', marginBottom:'0.35rem', cursor:'pointer',
                }}>
                  <strong style={{ fontSize:'0.85rem' }}>{c.business.name}</strong>
                  <div style={{ color:'var(--text-secondary)', fontSize:'0.75rem', marginTop:2 }}>{c.lastMessage || t('openChat')}</div>
                  {c.unreadCount > 0 && (
                    <span style={{ display:'inline-block', background:'var(--danger)', color:'#fff', borderRadius:999, padding:'0.05rem 0.4rem', fontSize:'0.7rem', fontWeight:700, marginTop:3 }}>
                      {c.unreadCount} {t('newMessages')}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {user.role !== 'owner' && (
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'0.9rem' }}>
                <h3 style={{ marginBottom:'0.75rem', fontSize:'0.9rem' }}>{t('startWith')}</h3>
                <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                  {bizList.slice(0,12).map(b => (
                    <button key={b._id} onClick={() => startConvo(b)} style={{
                      width:'100%', textAlign:'left', border:'1px solid var(--border)',
                      background:'#fff', borderRadius:'var(--radius-sm)', padding:'0.55rem', cursor:'pointer',
                    }}>
                      <strong style={{ fontSize:'0.82rem' }}>{b.name}</strong>
                      <div style={{ color:'var(--text-secondary)', fontSize:'0.73rem' }}>{b.address}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', minHeight:500, display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'0.85rem 1rem', borderBottom:'1px solid var(--border)' }}>
              <strong>{activeConvo?.business?.name || t('selectConversation')}</strong>
            </div>
            <div style={{ flex:1, padding:'1rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.65rem' }}>
              {chatMsgs.map(m => {
                const mine = m.sender._id === user._id;
                return (
                  <div key={m._id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth:'72%' }}>
                    <div style={{ background: mine ? 'var(--primary)' : 'var(--bg)', color: mine ? '#fff' : 'var(--text-primary)', padding:'0.65rem 0.9rem', borderRadius:'var(--radius)' }}>
                      {m.body}
                    </div>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:2 }}>{m.sender.name}</div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={sendChatMsg} style={{ display:'flex', gap:'0.5rem', padding:'0.75rem', borderTop:'1px solid var(--border)' }}>
              <input className="form-input" value={chatText} onChange={e => setChatText(e.target.value)}
                placeholder={t('writeMessage')} disabled={!activeConvo} style={{ borderRadius:999 }} />
              <button className="btn" disabled={!activeConvo||!chatText.trim()} style={{ borderRadius:999 }}>{t('send')}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
