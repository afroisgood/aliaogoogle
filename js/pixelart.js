// 用字元格線畫點陣圖：每個字元對應調色盤的一個顏色，'.' 為透明
export function gridCanvas(rows, palette) {
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map(r => r.length));
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !palette[ch]) return;
    g.fillStyle = palette[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

const DOG_PAL = { k: '#17171b', g: '#3a3a44', w: '#e8e8e8', b: '#8a5a2a', n: '#000000', p: '#e0708a', r: '#c8362e' };
const CAT_PAL = { t: '#8a735a', d: '#3e3228', y: '#c9d23c', p: '#e09a90', w: '#d9cbb5', n: '#000000' };

// 巴福柔（側面，頭朝左）
export const DOG_SIDE = gridCanvas([
  '....gg.......................',
  '...gkkg...................g..',
  '..gkkkkg.................gk..',
  '.gkkkkkkg................kk..',
  '.kkwnkkkkg..............gk...',
  'gkkkkkkkkk..............kk...',
  'nkkkkkkkkkg............gk....',
  'kkkkkkkkkkrgggggggggggggk....',
  '.ppkkkkkkkrkkkkkkkkkkkkkk....',
  '.pp..kkkkkrkkkkkkkkkkkkkk....',
  '......kkkkkkkkkkkkkkkkkkk....',
  '......gkkkkkkkkkkkkkkkkkk....',
  '.......kkkkkkkkkkkkkkkkkk....',
  '.......kkkkgggggggggkkkkk....',
  '.......kkk.kk......kkk.kk....',
  '.......kk..kk......kk..kk....',
  '.......kk..kk......kk..kk....',
  '.......kk..kk......kk..kk....',
  '.......kk..kk......kk..kk....',
  '......gkk.gkk.....gkk.gkk....',
], DOG_PAL);

// 貓（母雞蹲，頭朝左）
export const CAT_LOAF = gridCanvas([
  '..t...t...............',
  '.ttt.ttt..............',
  '.ttttttt...ttdttdtt...',
  '.tyntynt.tdttdttdttdt.',
  '.tttpttttttdttdttdttdt',
  '..ttttttttdttdttdttdtd',
  '..tttttttttdttdttdttdd',
  '.ttttttttttttttttttttd',
  '.twwtttttttttttttwwtd.',
], CAT_PAL);

// 狀態列用的巴福柔大頭照
export const DOG_FACE = gridCanvas([
  '................',
  '..gg........gg..',
  '.gkkg......gkkg.',
  '.kkkkgggggggkkk.',
  '.kkkkkkkkkkkkkk.',
  '.kkkkkkkkkkkkkk.',
  '..kwwkkkkkkwwk..',
  '..kbnkkkkkkbnk..',
  '..kkkkkkkkkkkk..',
  '..kkkggggggkkk..',
  '...kggnnnnggk...',
  '...kgggnngggk...',
  '...kkgnnnngkk...',
  '....kkpppkkk....',
  '.....kpppkk.....',
  '......kkkk......',
], DOG_PAL);
