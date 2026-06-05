import React, { useEffect, useState } from 'react';
import './HeroBackground.css';

const HeroBackground = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth) * 2 - 1;
          const y = (e.clientY / window.innerHeight) * 2 - 1;
          setMousePos({ x, y });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="hero-bg-container">
      {/* 1. Map Layer with slight parallax */}
      <div 
        className="hero-map-layer" 
        style={{ 
          transform: `scale(1.05) translate(${mousePos.x * -15}px, ${mousePos.y * -15}px)` 
        }}
      ></div>

      {/* 2. Color/Gradient Overlay */}
      <div className="hero-gradient-overlay"></div>

      {/* 3. Pulsating Points & Lines */}
      <div className="hero-nodes-layer"
           style={{ 
             transform: `translate(${mousePos.x * -5}px, ${mousePos.y * -5}px)` 
           }}>
        
        {/* SVG Flow Lines */}
        <svg className="hero-svg-lines" viewBox="0 0 1000 500" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2"/>
              <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="var(--success)" stopOpacity="0.2"/>
            </linearGradient>
          </defs>
          <path d="M200,150 C300,200 350,250 400,300 C500,400 550,250 650,200 C700,180 750,250 800,350" className="hero-line"/>
          <path d="M100,400 C200,350 300,350 400,300 C450,250 500,250 550,400" className="hero-line hero-line-alt"/>
          <path d="M800,350 C825,250 850,200 900,150" className="hero-line hero-line-alt2"/>
        </svg>

        {/* Action Nodes */}
        <div className="hero-node" style={{ top: '30%', left: '20%' }}>
          <div className="hero-pulse"></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '60%', left: '40%', animationDelay: '1s' }}>
          <div className="hero-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '40%', left: '65%', animationDelay: '0.5s' }}>
          <div className="hero-pulse" style={{ animationDelay: '0.5s' }}></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '70%', left: '80%', animationDelay: '2s' }}>
          <div className="hero-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '80%', left: '55%', animationDelay: '1.5s' }}>
          <div className="hero-pulse" style={{ animationDelay: '1.5s' }}></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '30%', left: '85%', animationDelay: '0.3s' }}>
          <div className="hero-pulse" style={{ animationDelay: '0.3s' }}></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '80%', left: '10%', animationDelay: '0.8s' }}>
          <div className="hero-pulse" style={{ animationDelay: '0.8s' }}></div>
          <div className="hero-dot"></div>
        </div>
        <div className="hero-node" style={{ top: '20%', left: '50%', animationDelay: '1.2s' }}>
          <div className="hero-pulse" style={{ animationDelay: '1.2s' }}></div>
          <div className="hero-dot"></div>
        </div>
      </div>
    </div>
  );
};

export default HeroBackground;
