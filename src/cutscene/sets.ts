import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';

// The "sets" for the real-world cutscenes: rooms drawn in code, in flat greys
// with thin black outlines and a few spots of colour. Each function draws one
// camera angle of the same room and hands back the parts a cutscene animates.

export const INK = 0x141414;
export const WALL = 0xb4b4b4;
export const WALL_SIDE = 0xa2a2a2; // side walls are a shade darker, which reads as depth
export const CEILING = 0xc4c4c4;
export const FLOOR = 0xd2d2d2;
export const FURNITURE = 0x8c8c8c;
export const DARK = 0x555555;
export const SCREEN_ON = 0x9be4f2;
export const SCREEN_OFF = 0x2b2f38;

type Point = [number, number];

// Fills and outlines a shape given by its corners.
export function shape(g: Phaser.GameObjects.Graphics, fill: number, corners: Point[], outline = 3) {
  const points = corners.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.fillStyle(fill).fillPoints(points, true);
  if (outline) g.lineStyle(outline, INK).strokePoints(points, true);
}

export function box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, radius = 0) {
  g.fillStyle(fill).lineStyle(3, INK);
  if (radius) g.fillRoundedRect(x, y, w, h, radius).strokeRoundedRect(x, y, w, h, radius);
  else g.fillRect(x, y, w, h).strokeRect(x, y, w, h);
}

// Little scuffs, so flat walls do not look empty.
export function scuffs(g: Phaser.GameObjects.Graphics, spots: Point[]) {
  g.lineStyle(2, 0x8f8f8f);
  for (const [x, y] of spots) {
    g.lineBetween(x, y, x + 16, y - 10).lineBetween(x + 8, y - 5, x + 20, y + 2).lineBetween(x - 10, y + 12, x + 2, y + 6);
  }
}

// ---- Shot 1: the whole room, seen from the front in one-point perspective ----

// The back wall is a small rectangle in the middle of the screen; the floor,
// ceiling and side walls are the four shapes that join it to the screen's
// edges. Lines that run "away from us" all aim at the middle of the back wall,
// and that alone makes a flat drawing look like a box you could walk into.
export const WIDE = {
  back: { left: 340, right: 940, top: 120, bottom: 430 },
  doorX: 470, // centre of the doorway on the back wall
  // How big something standing at floor height `y` should be drawn.
  scaleAt: (y: number) => Phaser.Math.Linear(0.56, 1.3, Phaser.Math.Clamp((y - 430) / (GAME_HEIGHT - 430), 0, 1)),
};

export function drawWideRoom(scene: Phaser.Scene) {
  const { left, right, top, bottom } = WIDE.back;
  const g = scene.add.graphics();

  shape(g, CEILING, [[0, 0], [GAME_WIDTH, 0], [right, top], [left, top]]);
  shape(g, WALL_SIDE, [[0, 0], [left, top], [left, bottom], [0, GAME_HEIGHT]]);
  shape(g, WALL_SIDE, [[GAME_WIDTH, 0], [right, top], [right, bottom], [GAME_WIDTH, GAME_HEIGHT]]);
  shape(g, FLOOR, [[0, GAME_HEIGHT], [left, bottom], [right, bottom], [GAME_WIDTH, GAME_HEIGHT]]);
  shape(g, WALL, [[left, top], [right, top], [right, bottom], [left, bottom]]);
  scuffs(g, [[600, 180], [860, 330], [380, 190], [140, 300], [1160, 240], [700, 380]]);

  // Floorboards running away from us, and a patch of window light on the floor.
  g.lineStyle(2, 0xbcbcbc);
  for (let i = 1; i < 8; i++) g.lineBetween((GAME_WIDTH / 8) * i, GAME_HEIGHT, left + ((right - left) / 8) * i, bottom);
  shape(g, 0xe6e6e6, [[610, 470], [820, 470], [900, 560], [600, 560]], 0);

  // Window on the right-hand wall, squashed by the perspective.
  shape(g, SCREEN_ON, [[1010, 190], [1170, 110], [1170, 350], [1010, 330]], 5);
  g.lineStyle(3, INK).lineBetween(1090, 150, 1090, 340).lineBetween(1010, 260, 1170, 232);

  // Clock and a poster on the back wall.
  g.fillStyle(0xffffff).fillCircle(790, 200, 30);
  g.lineStyle(3, INK).strokeCircle(790, 200, 30).lineBetween(790, 200, 790, 180).lineBetween(790, 200, 804, 208);
  box(g, 600, 170, 90, 120, 0xe6e6e6);
  g.fillStyle(COLORS.red).fillCircle(645, 215, 22);
  g.lineStyle(3, INK).lineBetween(615, 262, 675, 262).lineBetween(622, 274, 668, 274);

  // The doorway is a dark hole; the door is a separate piece hinged on its
  // left edge, so squashing it sideways looks like it swinging open.
  const doorLeft = WIDE.doorX - 55;
  box(g, doorLeft, bottom - 210, 110, 210, 0x3a3d45);
  const door = scene.add.graphics({ x: doorLeft, y: bottom });
  box(door, 0, -210, 110, 210, FURNITURE);
  door.fillStyle(COLORS.yellow).fillCircle(92, -100, 6);
  door.lineStyle(2, INK).strokeCircle(92, -100, 6);

  // Desk, monitor and chair at the front right, close to the camera. These are
  // drawn after the figure (see `front`), because they are nearer than they are.
  const front = scene.add.graphics();
  shape(front, FURNITURE, [[850, 560], [1180, 560], [1280, 640], [900, 640]]); // desk top
  shape(front, DARK, [[900, 640], [1280, 640], [1280, GAME_HEIGHT], [900, GAME_HEIGHT]]); // desk front
  shape(front, DARK, [[850, 560], [900, 640], [900, GAME_HEIGHT], [850, 680]]); // desk side
  shape(front, 0xe6e6e6, [[1010, 410], [1190, 396], [1190, 572], [1010, 566]]); // monitor, seen from behind its screen
  shape(front, SCREEN_OFF, [[1026, 426], [1174, 414], [1174, 552], [1026, 548]]);
  shape(front, DARK, [[1080, 566], [1120, 568], [1120, 590], [1080, 588]]);
  // Chair, seen from behind.
  box(front, 700, 520, 120, 130, FURNITURE, 8);
  box(front, 690, 646, 140, 18, DARK, 4);
  box(front, 752, 664, 16, 56, DARK);

  return { room: g, door, front };
}

// ---- Shot 2: side view at the desk ----

export const DESK = {
  floorY: 600,
  seatX: 470, // where the figure's hips are when sitting
  top: 600 - 122, // height of the desk surface
  mugSpot: { x: 600, y: 600 - 122 }, // where a mug put down by the figure lands
};

export function drawDeskSet(scene: Phaser.Scene, options: { screenOn: boolean; mug: boolean }) {
  const g = scene.add.graphics();
  const floorY = DESK.floorY;
  const wallBottom = floorY - 60; // where the back wall meets the floor
  const deskY = DESK.top;

  g.fillStyle(WALL).fillRect(0, 0, GAME_WIDTH, wallBottom);
  g.fillStyle(FLOOR).fillRect(0, wallBottom, GAME_WIDTH, GAME_HEIGHT - wallBottom);
  g.lineStyle(3, INK).lineBetween(0, wallBottom, GAME_WIDTH, wallBottom);
  scuffs(g, [[120, 330], [330, 90], [620, 250], [905, 420], [1130, 330], [200, 470], [1040, 60]]);

  // Window, and the slanted patch of light it throws on the wall.
  shape(g, 0xc6c6c6, [[900, 280], [1090, 280], [990, 540], [800, 540]], 0);
  box(g, 1000, 100, 190, 150, SCREEN_ON);
  g.lineStyle(5, INK).strokeRect(1000, 100, 190, 150);
  g.lineStyle(3, INK).lineBetween(1095, 100, 1095, 250).lineBetween(1000, 175, 1190, 175);

  // Wall clock.
  g.fillStyle(0xffffff).fillCircle(250, 170, 48);
  g.lineStyle(4, INK).strokeCircle(250, 170, 48);
  g.lineBetween(250, 170, 250, 138).lineBetween(250, 170, 272, 182);

  // Shadows under the furniture.
  g.fillStyle(0x000000, 0.12).fillEllipse(750, floorY + 4, 470, 26);

  // Desk, with the computer tower underneath.
  box(g, 566, deskY + 14, 12, 108, DARK);
  box(g, 922, deskY + 14, 12, 108, DARK);
  box(g, 822, floorY - 96, 62, 96, FURNITURE, 4);
  g.fillStyle(options.screenOn ? COLORS.green : DARK).fillCircle(853, floorY - 76, 5);
  box(g, 540, deskY, 420, 14, FURNITURE);

  // A chunky old monitor on a stand.
  box(g, 735, deskY - 26, 20, 20, DARK);
  box(g, 700, deskY - 8, 90, 8, DARK);
  box(g, 640, deskY - 196, 210, 170, 0xe6e6e6, 14);
  box(g, 658, deskY - 180, 174, 124, options.screenOn ? SCREEN_ON : SCREEN_OFF, 6);
  const labels: Phaser.GameObjects.Text[] = []; // the words on the screen, which a shot must include
  if (options.screenOn) {
    labels[0] = scene.add.text(745, deskY - 150, 'downloading', { fontFamily: PIXEL_FONT, fontSize: '8px', color: hex(INK) }).setOrigin(0.5);
    box(g, 674, deskY - 128, 142, 22, 0xffffff);
    g.fillStyle(COLORS.green).fillRect(678, deskY - 124, 8, 14);
    labels[1] = scene.add.text(745, deskY - 84, '1%', { fontFamily: PIXEL_FONT, fontSize: '14px', color: hex(INK) }).setOrigin(0.5);
  }
  box(g, 640, deskY - 10, 70, 10, 0xe6e6e6, 3); // keyboard

  // The mug is its own piece so a cutscene can make it appear when it is put down.
  const mug = scene.add.graphics({ x: DESK.mugSpot.x, y: DESK.mugSpot.y }).setVisible(options.mug);
  mug.lineStyle(3, INK).beginPath().arc(26, -18, 9, -1.3, 1.3).strokePath();
  box(mug, -6, -36, 30, 36, COLORS.yellow, 4);

  // The chair is separate too, so it can roll.
  const chair = scene.add.graphics();
  chair.fillStyle(0x000000, 0.12).fillEllipse(462, floorY + 4, 170, 18);
  box(chair, 396, floorY - 214, 14, 140, FURNITURE);
  box(chair, 396, floorY - 84, 128, 14, FURNITURE);
  box(chair, 456, floorY - 70, 8, 58, DARK);
  box(chair, 410, floorY - 14, 100, 6, DARK);
  chair.fillStyle(INK).fillCircle(414, floorY - 5, 6).fillCircle(506, floorY - 5, 6); // castors

  // Where the middle of the monitor's screen is, for the camera to dive into.
  const screenCentre = { x: 745, y: deskY - 118 };
  return { room: g, labels, chair, mug, screenCentre };
}
