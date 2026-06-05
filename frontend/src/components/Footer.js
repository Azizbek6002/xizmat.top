import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">

          {/* Brand column */}
          <div className="footer-brand-col">
            <h2>HizmatTop</h2>
            <p>
              Shahringizda eng yaxshi xizmatlarni toping — sartaroshxonalar,
              salonlar, restoranlar va ko'plab boshqa xizmatlar.
            </p>
            <div className="footer-social">
              <a href="https://t.me/hizmattop" className="footer-social-btn" aria-label="Telegram" target="_blank" rel="noreferrer">✈️</a>
              <a href="https://instagram.com/hizmattop" className="footer-social-btn" aria-label="Instagram" target="_blank" rel="noreferrer">📸</a>
              <a href="https://youtube.com/@hizmattop" className="footer-social-btn" aria-label="YouTube" target="_blank" rel="noreferrer">▶️</a>
            </div>
          </div>

          {/* Platform links */}
          <div className="footer-col">
            <h4>Platform</h4>
            <ul className="footer-links">
              <li><Link to="/">🏠 {t('navHome')}</Link></li>
              <li><Link to="/chat?tab=ai">🤖 AI Assistant <span className="footer-badge">New</span></Link></li>
              <li><Link to="/chat">💬 Business Chat</Link></li>
              <li><Link to="/register">📝 {t('register')}</Link></li>
              <li><Link to="/login">🔑 {t('login')}</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div className="footer-col">
            <h4>Kategoriyalar</h4>
            <ul className="footer-links">
              <li><Link to="/?category=barbershop">💈 Sartaroshxona</Link></li>
              <li><Link to="/?category=salon">💅 Go'zallik saloni</Link></li>
              <li><Link to="/?category=restaurant">🍽️ Restoran</Link></li>
              <li><Link to="/?category=gym">💪 Fitnes</Link></li>
              <li><Link to="/?category=car_wash">🚗 Avtoyuvish</Link></li>
              <li><Link to="/?category=game_club">🎮 O'yin klubi</Link></li>
            </ul>
          </div>

          {/* Business owners */}
          <div className="footer-col">
            <h4>Biznes egalari</h4>
            <ul className="footer-links">
              <li><Link to="/register">🚀 Biznesingizni qo'shing</Link></li>
              <li><Link to="/dashboard">📊 Dashboard</Link></li>
              <li><a href="mailto:support@hizmattop.uz">📧 Aloqa</a></li>
              <li><a href="#">📖 Qo'llanma</a></li>
              <li><a href="#">❓ FAQ</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <span>© {year} HizmatTop. Barcha huquqlar himoyalangan.</span>
          <div className="footer-bottom-links">
            <a href="#">Maxfiylik siyosati</a>
            <a href="#">Foydalanish shartlari</a>
            <a href="#">Hamkorlik</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
