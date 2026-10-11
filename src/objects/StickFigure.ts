import * as Phaser from 'phaser';
import { COLORS } from '../config';

const INK = 0x141414; // the real world is drawn in thin black line, not the game's navy
const SHOE = 0x8a5a2b;
const MUG = 0xf7c81e;

export type StickMood = 'bored' | 'annoyed' | 'furious' | 'overjoyed' | 'stunned';
export const STICK_MOODS: StickMood[] = ['bored', 'annoyed', 'furious', 'overjoyed', 'stunned'];

const LINE = 5; // thickness of every stroke
const HEAD = 34; // head radius
const NECK = 8;
const TORSO = 88;
const UPPER_ARM = 46;
const FOREARM = 46;
const THIGH = 56;
const SHIN = 56;

// Everything that can move, as plain numbers, so tweens can animate any of it.
// Positions are measured from the figure's origin: the ground under the hips.
interface Pose {
  sit: number; // 1 = sitting (thighs level), 0 = standing
  lean: number; // degrees the body tips forward (towards the desk)
  headTilt: number; // extra degrees the head tips forward
  lift: number; // how far off the ground (for jumping)
  nearX: number; // where the near hand is ...
  nearY: number;
  farX: number; // ... and the far hand
  farY: number;
  tap: number; // degrees the near foot swings (for tapping)
  slide: number; // how far the hips have slid forward (for slouching)
  kick: number; // degrees both shins swing forward (legs stretched out)
}

// A pose with nothing unusual in it; each mood only lists what differs.
const NEUTRAL = { lift: 0, tap: 0, slide: 0, kick: 0 };

const POSES: Record<StickMood, Pose> = {
  // Chin propped on one hand, the other hand drumming on the desk.
  bored: { sit: 1, lean: 16, headTilt: 14, ...NEUTRAL, nearX: 78, nearY: -152, farX: 96, farY: -92 },
  // Leaning in, both hands flat on the desk, foot tapping.
  annoyed: { sit: 1, lean: 26, headTilt: 6, ...NEUTRAL, nearX: 84, nearY: -92, farX: 104, farY: -92 },
  // Half out of the chair, both hands gripping the monitor.
  furious: { sit: 0.35, lean: 34, headTilt: -4, ...NEUTRAL, nearX: 134, nearY: -196, farX: 136, farY: -150 },
  // On their feet, arms in the air.
  overjoyed: { sit: 0, lean: -6, headTilt: -14, ...NEUTRAL, nearX: 44, nearY: -282, farX: -52, farY: -278 },
  // Standing stock still, arms hanging.
  stunned: { sit: 0, lean: -8, headTilt: -6, ...NEUTRAL, nearX: 10, nearY: -116, farX: -22, farY: -116 },
};

// The person outside the computer: a stick figure seen from the side, facing
// right, in the thin-line, white-headed style of classic stick-figure
// animations. Unlike the workers it uses no pictures at all. A `pose` (a handful of
// numbers) says where the joints are, and `redraw()` draws lines between them.
// Animating the figure just means tweening those numbers and redrawing.
export class StickFigure extends Phaser.GameObjects.Container {
  private ink: Phaser.GameObjects.Graphics;
  private pose: Pose = { ...POSES.bored };
  private currentMood: StickMood = 'bored';
  private face: StickMood = 'bored';
  private holdingMug = false;
  private tweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, mood: StickMood = 'bored') {
    super(scene, x, y);
    this.ink = scene.add.graphics();
    this.add(this.ink);
    scene.add.existing(this);

    // Redraw every frame, because some tween is nearly always moving the pose.
    const redraw = () => this.redraw();
    scene.events.on(Phaser.Scenes.Events.UPDATE, redraw);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, redraw);
      for (const tween of this.tweens) tween.remove();
    });
    this.setMood(mood, 0);
  }

  get mood() {
    return this.currentMood;
  }

  // Glides into the mood's pose, then starts the small looping movements that
  // keep it alive.
  setMood(mood: StickMood, glide = 260) {
    this.currentMood = mood;
    this.face = mood;
    this.stopTweens();
    const pose = this.pose;
    const loop = (config: object) => this.tweens.push(this.scene.tweens.add({ targets: pose, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', ...config }));

    this.tweens.push(
      this.scene.tweens.add({
        targets: pose,
        ...POSES[mood],
        duration: glide,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (mood === 'bored') {
            loop({ farY: pose.farY - 9, duration: 110, repeatDelay: 60 }); // drumming fingers
            loop({ headTilt: pose.headTilt + 5, duration: 1600 });
          } else if (mood === 'annoyed') {
            loop({ tap: 24, duration: 130 });
            loop({ lean: pose.lean + 3, duration: 400 });
          } else if (mood === 'furious') {
            loop({ lean: pose.lean + 7, nearX: pose.nearX + 9, farX: pose.farX + 9, duration: 70 }); // shaking the monitor
            loop({ headTilt: pose.headTilt + 8, duration: 90 });
          } else if (mood === 'overjoyed') {
            loop({ lift: 46, duration: 210, ease: 'Quad.easeOut' });
            loop({ nearX: pose.nearX + 16, farX: pose.farX - 16, duration: 210 });
          } else {
            loop({ lean: pose.lean - 1.5, duration: 45 }); // a faint tremble
          }
        },
      }),
    );
    return this;
  }

  private stopTweens() {
    for (const tween of this.tweens) tween.remove();
    this.tweens = [];
  }

  // ---- For cutscenes: direct control instead of a ready-made mood ----

  // Moves any part of the pose to new values over `duration` milliseconds.
  // Whatever the current mood was doing stops.
  poseTo(changes: Partial<Pose>, duration: number, ease = 'Quad.easeInOut') {
    this.stopTweens();
    if (duration <= 0) Object.assign(this.pose, changes);
    else this.tweens.push(this.scene.tweens.add({ targets: this.pose, ...changes, duration, ease }));
    return this;
  }

  // Changes the expression without changing the pose.
  setFace(face: StickMood) {
    this.face = face;
    return this;
  }

  setHoldingMug(holding: boolean) {
    this.holdingMug = holding;
    return this;
  }

  private redraw() {
    const { pose } = this;
    const g = this.ink.clear();
    const point = (from: Phaser.Math.Vector2, degreesFromDown: number, length: number) => {
      const angle = Phaser.Math.DegToRad(degreesFromDown);
      return new Phaser.Math.Vector2(from.x + Math.sin(angle) * length, from.y + Math.cos(angle) * length);
    };

    // Work out the joints, from the hips outwards.
    const thighAngle = 90 * pose.sit;
    const hip = new Phaser.Math.Vector2(pose.slide, -(Math.cos(Phaser.Math.DegToRad(thighAngle)) * THIGH + SHIN) - pose.lift);
    const shoulder = point(hip, 180 - pose.lean, TORSO);
    const headCentre = point(shoulder, 180 - pose.lean - pose.headTilt, NECK + HEAD);
    // Standing, the legs part slightly so both can be seen; sitting, the far
    // foot is tucked back under the chair.
    const spread = 7 * (1 - pose.sit);
    const kneeNear = point(hip, thighAngle + spread, THIGH);
    const kneeFar = point(hip, thighAngle - spread, THIGH);
    const footNear = point(kneeNear, pose.tap + pose.kick, SHIN);
    const footFar = point(kneeFar, (pose.kick ? pose.kick - 8 : -18 * pose.sit) - spread, SHIN);
    // A hand goes where the pose says, unless that is further than the arm can stretch.
    const reachFor = (x: number, y: number) => {
      const offset = new Phaser.Math.Vector2(x, y - pose.lift).subtract(shoulder);
      return offset.limit(UPPER_ARM + FOREARM - 1).add(shoulder);
    };
    const handNear = reachFor(pose.nearX, pose.nearY);
    const handFar = reachFor(pose.farX, pose.farY);

    // A soft shadow on the floor helps the figure sit in the room.
    g.fillStyle(0x000000, 0.13).fillEllipse(pose.slide + 12, 3, 110, 16);

    // A limb is one smooth curve through its joints, so elbows and knees bend
    // softly instead of at a sharp corner.
    const limb = (...joints: Phaser.Math.Vector2[]) => {
      g.lineStyle(LINE, INK);
      new Phaser.Curves.Spline(joints).draw(g, 20);
    };
    const hand = (at: Phaser.Math.Vector2) => {
      g.fillStyle(0xffffff).fillCircle(at.x, at.y, 8);
      g.lineStyle(3, INK).strokeCircle(at.x, at.y, 8);
    };
    const shoe = (at: Phaser.Math.Vector2) => {
      g.fillStyle(SHOE).fillEllipse(at.x + 9, at.y - 5, 34, 16);
      g.lineStyle(3, INK).strokeEllipse(at.x + 9, at.y - 5, 34, 16);
    };

    // Far-side arm and leg first, so the body and near limbs are drawn over them.
    limb(hip, kneeFar, footFar);
    shoe(footFar);
    limb(shoulder, this.elbow(shoulder, handFar), handFar);
    hand(handFar);
    limb(hip, shoulder);
    limb(hip, kneeNear, footNear);
    shoe(footNear);

    const turn = Phaser.Math.DegToRad(-pose.lean - pose.headTilt);
    g.fillStyle(0xffffff).fillCircle(headCentre.x, headCentre.y, HEAD);
    g.lineStyle(LINE, INK).strokeCircle(headCentre.x, headCentre.y, HEAD);
    this.drawFace(g, headCentre, turn);

    // The near arm goes over the head, so a hand can prop up the chin.
    limb(shoulder, this.elbow(shoulder, handNear), handNear);
    if (this.holdingMug) {
      g.fillStyle(MUG).fillRoundedRect(handNear.x - 4, handNear.y - 22, 22, 28, 3);
      g.lineStyle(3, INK).strokeRoundedRect(handNear.x - 4, handNear.y - 22, 22, 28, 3);
    }
    hand(handNear);
  }

  // Two-bone reach: given the shoulder and where the hand should be, find
  // where the elbow has to go. The three points form a triangle whose sides
  // are known, so the law of cosines gives the angle at the shoulder.
  private elbow(shoulder: Phaser.Math.Vector2, hand: Phaser.Math.Vector2) {
    const reach = Phaser.Math.Clamp(shoulder.distance(hand), Math.abs(UPPER_ARM - FOREARM) + 1, UPPER_ARM + FOREARM - 1);
    const towardsHand = Math.atan2(hand.y - shoulder.y, hand.x - shoulder.x);
    const bend = Math.acos((UPPER_ARM * UPPER_ARM + reach * reach - FOREARM * FOREARM) / (2 * UPPER_ARM * reach));
    const angle = towardsHand + bend; // + bends the elbow downwards and back
    return new Phaser.Math.Vector2(shoulder.x + Math.cos(angle) * UPPER_ARM, shoulder.y + Math.sin(angle) * UPPER_ARM);
  }

  // The face is a few strokes placed relative to the head, and turned with
  // it. Both eyes show, as if the head were turned a little towards us.
  private drawFace(g: Phaser.GameObjects.Graphics, centre: Phaser.Math.Vector2, turn: number) {
    const at = (x: number, y: number) => new Phaser.Math.Vector2(x, y).rotate(-turn).add(centre);
    const stroke = (points: number[], width = 4) => {
      const path: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < points.length; i += 2) path.push(at(points[i], points[i + 1]));
      g.lineStyle(width, INK);
      if (path.length === 2) g.lineBetween(path[0].x, path[0].y, path[1].x, path[1].y);
      else new Phaser.Curves.Spline(path).draw(g, 12);
    };
    const dot = (x: number, y: number, radius: number, colour: number = INK) => {
      const p = at(x, y);
      g.fillStyle(colour).fillCircle(p.x, p.y, radius);
    };

    // Two wisps of hair.
    stroke([-8, -HEAD - 2, -4, -HEAD - 12, 6, -HEAD - 13], 3);
    stroke([6, -HEAD - 1, 12, -HEAD - 9, 21, -HEAD - 7], 3);

    const eyes = (height: number) => {
      stroke([8, -6 - height / 2, 8, -6 + height / 2], 5);
      stroke([21, -6 - height / 2, 21, -6 + height / 2], 5);
    };

    switch (this.face) {
      case 'bored':
        stroke([3, -6, 13, -6]); // half-shut eyes
        stroke([16, -6, 26, -6]);
        stroke([10, 13, 22, 13], 3);
        break;
      case 'annoyed':
        eyes(8);
        stroke([1, -17, 13, -12]); // lowered brows
        stroke([27, -17, 17, -12]);
        stroke([8, 15, 15, 11, 23, 14], 3);
        break;
      case 'furious':
        eyes(8);
        stroke([0, -19, 13, -11], 5);
        stroke([29, -19, 17, -11], 5);
        dot(15, 15, 9); // shouting mouth
        dot(15, 17, 4.5, COLORS.red);
        break;
      case 'overjoyed':
        stroke([3, -4, 8, -10, 13, -4]); // eyes squeezed into happy arcs
        stroke([17, -4, 22, -10, 27, -4]);
        dot(15, 13, 10);
        dot(15, 16, 5, COLORS.red);
        break;
      case 'stunned':
        dot(8, -7, 7);
        dot(8, -7, 4.5, 0xffffff);
        dot(22, -7, 7);
        dot(22, -7, 4.5, 0xffffff);
        dot(8, -7, 1.8);
        dot(22, -7, 1.8);
        dot(16, 14, 3.5);
        break;
    }
  }
}
