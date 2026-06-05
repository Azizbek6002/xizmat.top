import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';

const LOCALE_MAP = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

const FlashDealCard = ({ deal }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const locale = LOCALE_MAP[language] || 'uz-UZ';

  const endsAt = new Date(deal.flashDealEndsAt);
  const timeStr = endsAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      type="button"
      className="deal-card"
      onClick={() => { navigate(`/business/${deal.business._id}`); window.scrollTo(0, 0); }}
    >
      <div className="deal-card-media">
        <img
          src={deal.business?.photos?.[0] || 'https://placehold.co/400x240'}
          alt={deal.business?.name}
        />
        <span className="deal-badge">-{deal.percentOff}%</span>
      </div>

      <div className="deal-card-body">
        <div className="deal-business">{deal.business?.name}</div>
        <h4>{deal.name}</h4>

        <div className="deal-card-footer">
          <div>
            <div className="deal-old-price">{formatPrice(deal.price)}</div>
            <div className="deal-price">{formatPrice(deal.effectivePrice)}</div>
          </div>
          <div className="deal-time">
            {timeStr} gacha
          </div>
        </div>
      </div>
    </button>
  );
};

export default FlashDealCard;
