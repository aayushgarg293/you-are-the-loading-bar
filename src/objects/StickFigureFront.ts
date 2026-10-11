import * as Phaser from 'phaser';
import { INK } from '../cutscene/sets';

const LINE = 5;
const HEAD = 34;
const SHOE = 0x8a5a2b;
const MUG = 0xf7c81e;

// The stick figure seen from the front, shuffling towards the camera with
// slumped shoulders. Like the side-view StickFigure it is redrawn from a few
// numbers every frame. Origin (0, 0) is the ground between the feet.
export class StickFigureFront extends Phaser.GameObjects.Container {
  walking = false;
  holdingMug = true;
  yawn = 0; // 0 = mouth shut, 1 = full yawn (tween this)
  private ink: Phaser.GameObjects.Graphics;
  private step = 0; // where we are in the walk cycle, in radians

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.ink = scene.add.graphics();
    this.add(this.ink);
    scene.add.existing(this);

    const update = (_time: number, delta: number) => {
      if (this.walking) this.step += delta * 0.0085;
      this.redraw();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, update);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, update));
  }

  private redraw() {
    const g = this.ink.clear();
    const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    const swing = this.walking ? Math.sin(this.step) : 0; // -1..1, one full swing per two steps
    const bob = this.walking ? Math.abs(Math.cos(this.step)) * 5 : 0;
    const sway = swing * 5; // the body rocks over whichever foot is down

    const limb = (...joints: Phaser.Math.Vector2[]) => {
      g.lineStyle(LINE, INK);
      new Phaser.Curves.Spline(joints).draw(g, 20);
    };

    g.fillStyle(0x000000, 0.13).fillEllipse(0, 3, 96, 16);

    // Legs: each foot lifts in turn. A raised foot is drawn slightly lower on
    // screen and bigger in a real walk towards the camera; a small lift is enough here.
    const hip = v(sway, -108 + bob);
    const liftLeft = Math.max(0, swing) * 13;
    const liftRight = Math.max(0, -swing) * 13;
    const footLeft = v(-15, -liftLeft);
    const footRight = v(15, -liftRight);
    limb(hip, v(-15 + sway * 0.4, -56 - liftLeft), footLeft);
    limb(hip, v(15 + sway * 0.4, -56 - liftRight), footRight);
    for (const foot of [footLeft, footRight]) {
      g.fillStyle(SHOE).fillEllipse(foot.x, foot.y - 6, 24, 16);
      g.lineStyle(3, INK).strokeEllipse(foot.x, foot.y - 6, 24, 16);
    }

    // A tired curve of a spine, and arms that just hang and swing a little.
    const shoulder = v(sway * 1.4, -184 + bob);
    limb(hip, v(sway + 6, -150 + bob), shoulder);
    const handLeft = v(-30 + sway, -104 + bob + swing * 7);
    const handRight = v(32 + sway, -108 + bob - swing * 4);
    limb(shoulder, v(-27 + sway, -152 + bob), handLeft);
    limb(shoulder, v(29 + sway, -152 + bob), handRight);
    if (this.holdingMug) {
      g.fillStyle(MUG).fillRoundedRect(handRight.x - 10, handRight.y - 6, 22, 28, 3);
      g.lineStyle(3, INK).strokeRoundedRect(handRight.x - 10, handRight.y - 6, 22, 28, 3);
    }
    for (const hand of [handLeft, handRight]) {
      g.fillStyle(0xffffff).fillCircle(hand.x, hand.y, 8);
      g.lineStyle(3, INK).strokeCircle(hand.x, hand.y, 8);
    }

    // The head hangs low, half hiding the shoulders.
    const head = v(sway * 1.6, shoulder.y - 22);
    g.fillStyle(0xffffff).fillCircle(head.x, head.y, HEAD);
    g.lineStyle(LINE, INK).strokeCircle(head.x, head.y, HEAD);
    const stroke = (width: number, ...points: number[]) => {
      g.lineStyle(width, INK);
      const path = [];
      for (let i = 0; i < points.length; i += 2) path.push(v(head.x + points[i], head.y + points[i + 1]));
      new Phaser.Curves.Spline(path).draw(g, 12);
    };
    stroke(3, -10, -HEAD - 1, -6, -HEAD - 12, 4, -HEAD - 12); // hair
    stroke(3, 4, -HEAD, 10, -HEAD - 8, 19, -HEAD - 6);

    if (this.yawn > 0.3) {
      // Eyes squeezed shut, mouth wide open.
      stroke(4, -18, -2, -12, -7, -6, -2);
      stroke(4, 6, -2, 12, -7, 18, -2);
      g.fillStyle(INK).fillEllipse(head.x, head.y + 14, 14 + this.yawn * 6, 8 + this.yawn * 16);
    } else {
      // Half-shut eyes with heavy lids, and a flat little mouth.
      stroke(4, -18, -3, -12, -3, -6, -3);
      stroke(4, 6, -3, 12, -3, 18, -3);
      stroke(3, -17, -11, -11, -10, -6, -8);
      stroke(3, 6, -8, 11, -10, 17, -11);
      stroke(3, -6, 15, 0, 15, 6, 15);
    }
  }
}
