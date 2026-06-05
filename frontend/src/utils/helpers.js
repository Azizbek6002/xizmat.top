// ============================================================
// HizmatTop shared utility functions
// ============================================================

const CATEGORY_META = {
  barbershop: { icon: '💈', label: 'Sartaroshxona', badge: 'badge-barbershop', color: '#E17055' },
  game_club:  { icon: '🎮', label: 'O\'yin klubi', badge: 'badge-game_club', color: '#6C5CE7' },
  restaurant: { icon: '🍽️', label: 'Restoran', badge: 'badge-restaurant', color: '#FDCB6E' },
  salon:      { icon: '💅', label: 'Go\'zallik saloni', badge: 'badge-salon', color: '#A29BFE' },
  car_wash:   { icon: '🚗', label: 'Avtoyuvish', badge: 'badge-car_wash', color: '#74B9FF' },
  gym:        { icon: '💪', label: 'Fitnes', badge: 'badge-gym', color: '#00B894' },
  other:      { icon: '📍', label: 'Xizmat', badge: 'badge-other', color: '#B2BEC3' },
};

const CATEGORIES_LIST = [
  { key: 'barbershop', icon: '💈', label: 'Sartaroshxonalar' },
  { key: 'game_club', icon: '🎮', label: 'O\'yin klublari' },
  { key: 'restaurant', icon: '🍽️', label: 'Restoranlar' },
  { key: 'salon', icon: '💅', label: 'Salonlar' },
  { key: 'car_wash', icon: '🚗', label: 'Avtoyuvish' },
  { key: 'gym', icon: '💪', label: 'Fitnes' },
];

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_NAMES = { monday: 'Du', tuesday: 'Se', wednesday: 'Chor', thursday: 'Pay', friday: 'Ju', saturday: 'Shan', sunday: 'Yak' };

const STATUS_MAP = {
  pending:   { cls: 'status-pending',   label: '⏳ Kutilyapti',    color: '#E17055' },
  confirmed: { cls: 'status-confirmed', label: '✅ Tasdiqlandi', color: '#00B894' },
  rejected:  { cls: 'status-rejected',  label: 'Rad etildi', color: '#D63031' },
  cancelled: { cls: 'status-cancelled', label: '❌ Bekor qilindi',     color: '#636E72' },
  completed: { cls: 'status-completed', label: '✔️ Yakunlandi',    color: '#0984E3' },
};

/**
 * Check if a business is currently open based on its workingHours
 */
export function isOpenNow(workingHours) {
  if (!workingHours) return null; // unknown
  const now = new Date();
  const dayIdx = now.getDay(); // 0=Sun
  const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayKey = dayMap[dayIdx];
  const today = workingHours[todayKey];
  if (!today || today.closed) return false;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return hhmm >= today.open && hhmm < today.close;
}

/**
 * Format price with thousands separator
 */
export function formatPrice(price) {
  if (!price || price === 0) return 'Bepul';
  return price.toLocaleString('ru-RU') + ' so\'m';
}

/**
 * Get category metadata
 */
export function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.other;
}

/**
 * Generate a placeholder image URL for a business
 */
export function getBusinessPhoto(business) {
  if (business.photos && business.photos.length > 0 && business.photos[0]) {
    return business.photos[0];
  }
  const meta = getCategoryMeta(business.category);
  const gradients = {
    barbershop: ['#8B4513', '#D2691E'],
    game_club:  ['#6C5CE7', '#A29BFE'],
    restaurant: ['#E17055', '#FDCB6E'],
    salon:      ['#A29BFE', '#FD79A8'],
    car_wash:   ['#0984E3', '#74B9FF'],
    gym:        ['#00B894', '#55EFC4'],
    other:      ['#636E72', '#B2BEC3'],
  };
  const g = gradients[business.category] || gradients.other;
  const name = business.name.length > 20 ? business.name.substring(0, 20) + '...' : business.name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${g[0]}"/><stop offset="100%" stop-color="${g[1]}"/></linearGradient></defs>
    <rect width="600" height="300" fill="url(#g)"/>
    <text x="300" y="130" text-anchor="middle" font-size="64" fill="white" opacity="0.9">${meta.icon}</text>
    <text x="300" y="190" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="white">${name}</text>
    <text x="300" y="225" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="white" opacity="0.7">${meta.label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Get a "smart" badge for a business
 */
export function getSmartBadge(business) {
  if (business.rating >= 4.8 && business.reviewCount >= 30) return { label: '🏆 Eng yaxshi tanlov', cls: 'smart-badge-top' };
  if (business.rating >= 4.5 && business.reviewCount >= 15) return { label: '⭐ Ommabop', cls: 'smart-badge-popular' };
  if (business.minPrice > 0 && business.minPrice <= 30000) return { label: '💰 Eng yaxshi narx', cls: 'smart-badge-price' };
  const created = new Date(business.createdAt);
  const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 30) return { label: '✨ Yangi', cls: 'smart-badge-new' };
  return null;
}

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export { CATEGORY_META, CATEGORIES_LIST, DAY_KEYS, DAY_NAMES, STATUS_MAP };
