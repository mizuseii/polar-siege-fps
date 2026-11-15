// The look plan, in one place. Polar Siege at blue hour: deep night blue,
// snow white and ice cyan for AURORA, signal crimson for BLIZZARD, warm
// amber for the station lamps. The same names are the CSS custom
// properties in index.html.
export const PALETTE = {
  canvas: '#0a1220',
  surface: '#131c2c',
  hairline: '#26334a',
  ink: '#e8eef7',
  muted: '#93a5bd',
  accent: '#7fd4ff',
  warm: '#ffb45c',
  danger: '#ff5a4a',
  snow: '#dfe9f5',
  ice: '#8fc7e8',
  steel: '#5a6b80',
  concrete: '#7d8896',
  rust: '#7a4a34',
};

export function shade(name) {
  return PALETTE[name];
}
