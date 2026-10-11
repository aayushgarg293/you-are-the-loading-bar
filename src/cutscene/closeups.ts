import * as Phaser from 'phaser';
import { COLORS, DOWNLOAD_FILE, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { DARK, FURNITURE, INK, SCREEN_OFF, SCREEN_ON, WALL, box, scuffs, shape } from './sets';

// Close-up shots for the cutscenes. Close-ups are what make a cartoon feel
// "filmed": the same few shapes as the wide shots, drawn big.

export type Expression = 'sleepy' | 'sip' | 'blank' | 'annoyed' | 'joy' | 'stunned' | 'shout';

const HEAD = 170;

// The stick figure's head, filling a good part of the screen, turned a little
// to the right. `browLift` raises one eyebrow (tween it for a twitch) and
// `mouthOpen` (0 to 1) is how wide the shouting mouth is.
export class BigFace extends Phaser.GameObjects.Container {
  browLift = 0;
  mouthOpen = 0;
  private ink: Phaser.GameObjects.Graphics;
  private expression: Expression = 'sleepy';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.ink = scene.add.graphics();
    this.add(this.ink);
    scene.add.existing(this);
    const redraw = () => this.redraw();
    scene.events.on(Phaser.Scenes.Events.UPDATE, redraw);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, redraw));
  }

  setExpression(expression: Expression) {
    this.expression = expression;
    return this;
  }

  private redraw() {
    const g = this.ink.clear();
    const stroke = (width: number, ...points: number[]) => {
      const path = [];
      for (let i = 0; i < points.length; i += 2) path.push(new Phaser.Math.Vector2(points[i], points[i + 1]));
      g.lineStyle(width, INK);
      new Phaser.Curves.Spline(path).draw(g, 16);
    };

    // Neck and shoulders, heading off the bottom of the screen.
    stroke(12, -30, HEAD - 10, -60, HEAD + 120, -80, HEAD + 300);
    g.fillStyle(0xffffff).fillCircle(0, 0, HEAD);
    g.lineStyle(12, INK).strokeCircle(0, 0, HEAD);
    stroke(8, -50, -HEAD - 4, -30, -HEAD - 50, 30, -HEAD - 56);
    stroke(8, 20, -HEAD - 2, 50, -HEAD - 38, 100, -HEAD - 30);

    const left = 30, right = 108, eyeY = -24;
    switch (this.expression) {
      case 'sleepy':
        stroke(11, left - 24, eyeY, left + 24, eyeY);
        stroke(11, right - 24, eyeY, right + 24, eyeY);
        stroke(7, left - 28, eyeY - 30, left, eyeY - 26, left + 26, eyeY - 18); // heavy lids
        stroke(7, right - 26, eyeY - 18, right, eyeY - 26, right + 28, eyeY - 30);
        stroke(8, 44, 74, 96, 74);
        break;
      case 'sip':
        stroke(11, left - 24, eyeY + 6, left, eyeY - 10, left + 24, eyeY + 6); // eyes shut in bliss
        stroke(11, right - 24, eyeY + 6, right, eyeY - 10, right + 24, eyeY + 6);
        break;
      case 'blank':
        stroke(14, left, eyeY - 20, left, eyeY + 20);
        stroke(14, right, eyeY - 20, right, eyeY + 20);
        stroke(8, left - 28, eyeY - 52, left + 26, eyeY - 52);
        stroke(8, right - 26, eyeY - 52 - this.browLift, right + 28, eyeY - 58 - this.browLift * 1.6);
        stroke(8, 44, 78, 96, 78);
        break;
      case 'annoyed':
        stroke(14, left, eyeY - 14, left, eyeY + 18);
        stroke(14, right, eyeY - 14, right, eyeY + 18);
        stroke(11, left - 34, eyeY - 58, left + 30, eyeY - 30); // brows crashing together
        stroke(11, right + 34, eyeY - 58, right - 30, eyeY - 30);
        stroke(8, 40, 88, 70, 72, 100, 86);
        break;
      case 'joy':
        stroke(12, left - 26, eyeY + 8, left, eyeY - 14, left + 26, eyeY + 8);
        stroke(12, right - 26, eyeY + 8, right, eyeY - 14, right + 26, eyeY + 8);
        g.fillStyle(INK).fillEllipse(70, 82, 96, 76); // a huge open grin
        g.fillStyle(COLORS.red).fillEllipse(70, 98, 60, 34);
        break;
      case 'stunned':
        for (const x of [left, right]) {
          g.fillStyle(0xffffff).fillCircle(x, eyeY, 30);
          g.lineStyle(8, INK).strokeCircle(x, eyeY, 30);
          g.fillStyle(INK).fillCircle(x + 4, eyeY, 7); // tiny pupils
        }
        g.fillStyle(INK).fillCircle(72, 84, 12);
        break;
      case 'shout':
        stroke(12, left - 30, eyeY - 6, left, eyeY - 22, left + 30, eyeY - 6); // eyes screwed shut
        stroke(12, right - 30, eyeY - 6, right, eyeY - 22, right + 30, eyeY - 6);
        stroke(11, left - 34, eyeY - 40, left + 30, eyeY - 62);
        stroke(11, right + 34, eyeY - 40, right - 30, eyeY - 62);
        g.fillStyle(INK).fillEllipse(70, 88, 70 + this.mouthOpen * 60, 40 + this.mouthOpen * 110);
        g.fillStyle(COLORS.red).fillEllipse(70, 96 + this.mouthOpen * 30, 40 + this.mouthOpen * 30, 20 + this.mouthOpen * 40);
        break;
    }
  }
}

// A plain stretch of wall to put behind a close-up.
export function drawWallBackdrop(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(WALL).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  scuffs(g, [[160, 140], [980, 110], [1120, 520], [240, 600], [820, 330]]);
  return g;
}

// A big coffee mug with the hand that holds it. Origin is the mug's centre.
export function drawMugInHand(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics();
  g.lineStyle(10, INK).beginPath().arc(84, 0, 44, -1.4, 1.4).strokePath();
  g.fillStyle(COLORS.yellow).fillRoundedRect(-80, -96, 160, 192, 16);
  g.lineStyle(9, INK).strokeRoundedRect(-80, -96, 160, 192, 16);
  // The arm comes up from below; the hand wraps the mug.
  g.lineStyle(12, INK);
  new Phaser.Curves.Spline([new Phaser.Math.Vector2(10, 50), new Phaser.Math.Vector2(70, 260), new Phaser.Math.Vector2(60, 520)]).draw(g, 16);
  g.fillStyle(0xffffff).fillCircle(0, 40, 50);
  g.lineStyle(9, INK).strokeCircle(0, 40, 50);
  g.lineStyle(6, INK).lineBetween(-34, 22, 20, 12).lineBetween(-38, 44, 22, 36).lineBetween(-32, 66, 18, 60);
  return scene.add.container(x, y, [g]);
}

// The front of the computer tower, with its power button and light.
export function drawTowerCloseup(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x6f6f6f).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); // the shadow under the desk
  box(g, 360, 40, 560, 760, FURNITURE, 18);
  box(g, 420, 100, 440, 60, DARK, 6); // disc drive
  g.lineStyle(3, INK).lineBetween(440, 130, 840, 130);
  for (let y = 520; y < 700; y += 26) g.lineStyle(5, DARK).lineBetween(440, y, 840, y); // vents
  const button = { x: 640, y: 320 };
  const light = scene.add.circle(640, 440, 14, DARK).setStrokeStyle(4, INK);
  const face = scene.add.graphics({ x: button.x, y: button.y });
  face.fillStyle(0xe6e6e6).fillCircle(0, 0, 56);
  face.lineStyle(6, INK).strokeCircle(0, 0, 56);
  face.lineStyle(7, INK).beginPath().arc(0, 2, 24, -1.0, Math.PI + 1.0).strokePath().lineBetween(0, -30, 0, -6); // the power symbol
  return { backdrop: g, light, button: face, buttonAt: button };
}

// A hand with one finger out, pointing up and to the right. Origin is the fingertip.
export function drawPointingHand(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics();
  g.lineStyle(14, INK);
  new Phaser.Curves.Spline([new Phaser.Math.Vector2(-150, 150), new Phaser.Math.Vector2(-330, 330), new Phaser.Math.Vector2(-420, 560)]).draw(g, 16);
  g.lineStyle(44, INK).lineBetween(-20, 20, -120, 116); // finger outline ...
  g.fillStyle(INK).fillCircle(-14, 14, 22);
  g.lineStyle(28, 0xffffff).lineBetween(-20, 20, -120, 116); // ... and its white inside
  g.fillStyle(0xffffff).fillCircle(-14, 14, 14);
  g.fillStyle(0xffffff).fillCircle(-150, 150, 62);
  g.lineStyle(9, INK).strokeCircle(-150, 150, 62);
  return scene.add.container(x, y, [g]);
}

// Looking past the back of his head at the monitor.
export function drawShoulderShot(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(WALL).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  scuffs(g, [[120, 120], [460, 60], [1200, 300]]);
  shape(g, FURNITURE, [[380, 600], [1280, 600], [1280, GAME_HEIGHT], [300, GAME_HEIGHT]]); // desk top, tilted towards us
  box(g, 800, 560, 70, 44, DARK);
  box(g, 730, 598, 210, 16, DARK, 6);
  box(g, 500, 70, 680, 500, 0xe6e6e6, 26); // monitor
  const screen = scene.add.rectangle(840, 310, 600, 400, SCREEN_OFF).setStrokeStyle(5, INK);

  // The back of his head and shoulders, big and close, in the bottom-left corner.
  const head = scene.add.graphics();
  head.lineStyle(14, INK);
  new Phaser.Curves.Spline([new Phaser.Math.Vector2(40, 760), new Phaser.Math.Vector2(250, 640), new Phaser.Math.Vector2(470, 760)]).draw(head, 16);
  head.fillStyle(0xffffff).fillCircle(260, 500, 180);
  head.lineStyle(12, INK).strokeCircle(260, 500, 180);
  head.lineStyle(8, INK);
  new Phaser.Curves.Spline([new Phaser.Math.Vector2(220, 322), new Phaser.Math.Vector2(240, 276), new Phaser.Math.Vector2(300, 270)]).draw(head, 12);
  new Phaser.Curves.Spline([new Phaser.Math.Vector2(290, 324), new Phaser.Math.Vector2(320, 288), new Phaser.Math.Vector2(370, 296)]).draw(head, 12);

  // The download window that pops up on the screen.
  const win = scene.add.graphics();
  box(win, -190, -110, 380, 220, 0xffffff);
  box(win, -190, -110, 380, 34, 0x2f6fdb);
  box(win, -70, 40, 140, 44, COLORS.green, 6);
  const button = scene.add.text(0, 62, 'DOWNLOAD', { fontFamily: PIXEL_FONT, fontSize: '12px', color: hex(INK) }).setOrigin(0.5);
  const label = (y: number, text: string, size: number, colour: number) => scene.add.text(0, y, text, { fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour) }).setOrigin(0.5);
  const popup = scene.add.container(840, 300, [win, label(-93, 'downloads', 10, 0xffffff), label(-30, DOWNLOAD_FILE, 11, INK), button]);

  // A mouse pointer, drawn the classic way.
  const cursor = scene.add.graphics({ x: 1020, y: 470 });
  const arrow = [0, 0, 0, 34, 9, 26, 15, 40, 22, 37, 16, 24, 28, 24];
  const points = [];
  for (let i = 0; i < arrow.length; i += 2) points.push(new Phaser.Math.Vector2(arrow[i], arrow[i + 1]));
  cursor.fillStyle(0xffffff).fillPoints(points, true).lineStyle(3, INK).strokePoints(points, true);

  return { backdrop: g, screen, popup, button, cursor, head, buttonAt: { x: 840, y: 362 }, screenRect: { x: 540, y: 110, width: 600, height: 400 } };
}

// The monitor's screen filling the whole frame, and wider than the frame, so
// the camera can slide along it. Returns where the camera should look.
export function drawScreenCloseup(scene: Phaser.Scene) {
  const width = 2100;
  const g = scene.add.graphics();
  g.fillStyle(SCREEN_ON).fillRect(-200, -200, width + 400, GAME_HEIGHT + 400);
  box(g, 120, 90, width - 240, 560, 0xffffff);
  box(g, 120, 90, width - 240, 70, 0x2f6fdb);
  const text = (x: number, y: number, value: string, size: number, colour: number) => scene.add.text(x, y, value, { fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour) });
  const title = text(150, 108, 'downloads', 30, 0xffffff);
  const headline = text(190, 248, `Downloading ${DOWNLOAD_FILE}`, 44, INK);

  // The loading bar: the same fifteen slots as the bar inside the computer.
  const bar = { x: width / 2 - 450, y: 420, slot: 60 };
  box(g, bar.x - 14, bar.y - 14, 15 * bar.slot + 20, bar.slot + 20, 0x2b2f38, 10);
  for (let i = 0; i < 15; i++) box(g, bar.x + i * bar.slot, bar.y, bar.slot - 8, bar.slot - 8, 0xb9b9b9, 4);
  const firstSlot = scene.add.rectangle(bar.x, bar.y, bar.slot - 8, bar.slot - 8, COLORS.green).setOrigin(0).setStrokeStyle(3, INK).setVisible(false);
  const percent = text(bar.x + 15 * bar.slot + 40, bar.y + 4, '0%', 44, INK);
  const remaining = text(bar.x, bar.y + 110, 'Time remaining: calculating...', 26, 0x555555);

  return {
    parts: [g, title, headline, firstSlot, percent, remaining],
    firstSlot,
    percent,
    remaining,
    textStart: { x: 190 + GAME_WIDTH / 2 - 120, y: 330 },
    textEnd: { x: headline.x + headline.width - GAME_WIDTH / 2 + 120, y: 330 },
    barCentre: { x: width / 2 + 60, y: 430 },
  };
}
