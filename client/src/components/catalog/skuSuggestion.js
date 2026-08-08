const knownSegments = {
  mouse: 'MOU',
  mice: 'MOU',
  keyboard: 'KEY',
  keyboards: 'KEY',
  black: 'BLK',
  white: 'WHT',
  blue: 'BLU',
  green: 'GRN',
  yellow: 'YLW',
};

function segment(value, length = 3) {
  const clean = String(value || '').trim().toLowerCase();
  if (knownSegments[clean]) return knownSegments[clean];
  return clean.replace(/[^a-z0-9]/g, '').slice(0, length).toUpperCase();
}

export function suggestSku({ category, brand, model, variant }) {
  return [
    segment(category),
    segment(brand),
    segment(model, 8),
    segment(variant),
  ]
    .filter(Boolean)
    .join('-');
}
