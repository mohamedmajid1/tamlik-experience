// Download the ready-made assets the film uses. Everything is public domain (CC0 / Public Domain Mark),
// free for commercial use with no attribution needed:
//   textures and models: Poly Haven (polyhaven.com)
//   music: "Cosmic Waves" by HoliznaCC0 (archive.org/details/holizna-cc-0-cosmic-waves), CC0
//   field recordings (Radio Aporee, Public Domain Mark): beach with waves and gulls near Lisbon by Felix Blume;
//   Tunis city at night from a hotel roof by Frank Schulte
// Needs ffmpeg for the music excerpt.
//   node tools/fetch-assets.mjs        (skips files already present)
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const TEXTURES = {                       // name -> maps (1k jpg)
  marble_01: ['Diffuse', 'nor_gl', 'Rough'],            // penthouse floor
  walnut_veneer: ['Diffuse', 'nor_gl', 'Rough'],        // logo wall
  clay_plaster: ['Diffuse', 'nor_gl', 'Rough'],         // fort walls (sarooj-style plaster)
  rocky_terrain_02: ['Diffuse', 'nor_gl'],              // mountains and headland
  coast_sand_01: ['Diffuse', 'nor_gl'],                 // beach
  concrete_pavers: ['Diffuse', 'nor_gl', 'Rough'],      // tower plaza
  asphalt_02: ['Diffuse', 'nor_gl', 'Rough'],           // boulevard
  rough_concrete: ['Diffuse', 'nor_gl'],                // building-site frames
  white_plaster_rough_01: ['Diffuse', 'nor_gl'],        // city facades (detail)
};
const MODELS = ['Sofa_01', 'mid_century_lounge_chair', 'side_table_01', 'potted_plant_02', 'potted_plant_01', 'brass_vase_01', 'antique_ceramic_vase_01'];
const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const save = async (path, url) => { if (existsSync(path)) return; mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, await get(url)); console.log('  ', path.slice(root.length + 1)); };
for (const [name, maps] of Object.entries(TEXTURES)) {
  const f = await (await fetch(`https://api.polyhaven.com/files/${name}`)).json();
  for (const m of maps) await save(join(root, 'tex', name, `${m.toLowerCase()}.jpg`), f[m]['1k'].jpg.url);
}
for (const name of MODELS) {
  const g = (await (await fetch(`https://api.polyhaven.com/files/${name}`)).json()).gltf['1k'].gltf;
  await save(join(root, 'models', name, `${name}.gltf`), g.url);
  for (const [rel, v] of Object.entries(g.include || {})) await save(join(root, 'models', name, rel), v.url);
}
// audio sources (the music is cut straight from the long original: 75 s from 6'40")
const IA = 'https://archive.org/download';
const AUDIO = {
  'beach.ogg': `${IA}/aporee_44160_50230/MervaguemouettesvoixplageprocheLisbonnePT19050203.ogg`,
  'city.ogg': `${IA}/aporee_13544_15798/TunisHotelRoofNightCityAmbience.ogg`,
};
for (const [name, url] of Object.entries(AUDIO)) await save(join(root, 'audio', 'src', name), url);
const music = join(root, 'audio', 'src', 'music.m4a');
if (!existsSync(music)) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '400', '-t', '75', '-i', `${IA}/holizna-cc-0-cosmic-waves/HoliznaCC0%20-%20Cosmic%20Waves.mp3`, '-ac', '2', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', music]);
  console.log('   audio/src/music.m4a');
}
console.log('assets ready');
