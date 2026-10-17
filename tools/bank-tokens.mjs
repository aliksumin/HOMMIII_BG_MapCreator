// Plain hex tokens for the Creature Banks: the bank's name on a dark hex with a
// gold rim, 150 x 150 like the community map editor's token pictures.
// tools/import-assets.mjs draws all of them this way until the editor has art
// for every bank (issue #14).

const SIZE = 150;
const C = SIZE / 2;
const FONT = "'Liberation Serif', Georgia, 'Times New Roman', serif";

/** Corners of a pointy-top hex of radius r around the centre. */
function hex(r) {
  return [-90, -30, 30, 90, 150, 210]
    .map((a) => `${(C + r * Math.cos((a * Math.PI) / 180)).toFixed(1)},${(C + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`)
    .join(" ");
}

/** Words packed into lines of at most `width` characters. */
function wrap(text, width) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= width) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * SVG source of a token. `desc` is the bank's name, e.g. "Dragon Fly Hive";
 * "Random (Near)" and "Random (Far)" draw a face-down token instead.
 */
export function bankTokenSvg(desc) {
  const random = /^Random \((Near|Far)\)$/.exec(desc);
  let body;
  if (random) {
    body = [
      `<text x="${C}" y="${C + 18}" font-size="44" text-anchor="middle">?</text>`,
      `<text x="${C}" y="${C + 38}" font-size="13" letter-spacing="2" text-anchor="middle">${random[1].toUpperCase()}</text>`,
    ].join("");
  } else {
    const lines = wrap(desc.toUpperCase(), 10);
    const longest = Math.max(...lines.map((l) => l.length));
    const size = Math.min(19, Math.floor(92 / (longest * 0.72)));
    const step = size * 1.15;
    const top = C + 8 - ((lines.length - 1) * step) / 2;
    body = lines
      .map((l, i) => `<text x="${C}" y="${(top + i * step).toFixed(1)}" font-size="${size}" text-anchor="middle">${escape(l)}</text>`)
      .join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<title>${escape(desc)}</title>
<defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#5a4630"/><stop offset="1" stop-color="#1a120a"/></radialGradient></defs>
<polygon points="${hex(72)}" fill="#c9a85a" stroke="#5c4a22" stroke-width="2"/>
<polygon points="${hex(65)}" fill="url(#g)"/>
<polygon points="${hex(59)}" fill="none" stroke="#dbca86" stroke-opacity="0.55" stroke-width="1.2"/>
<text x="${C}" y="${C - 25}" font-family="${FONT}" font-size="7" letter-spacing="0.8" text-anchor="middle" fill="#b09e69">CREATURE BANK</text>
<g font-family="${FONT}" font-weight="700" fill="#f2e3bd">${body}</g>
</svg>
`;
}
