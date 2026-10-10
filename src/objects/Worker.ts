import * as Phaser from 'phaser';

export type Mood = 'idle' | 'happy' | 'panic' | 'angry' | 'dizzy' | 'tired' | 'cheer' | 'work' | 'asleep';

export const MOODS: Mood[] = ['idle', 'happy', 'panic', 'angry', 'dizzy', 'tired', 'cheer', 'work', 'asleep'];

// Which eyes and mouth each mood wears. Names match the parts in the faces atlas.
const FACES: Record<Mood, { eyes: string; mouth: string }> = {
  idle: { eyes: 'eyesOpen', mouth: 'mouthSmile' },
  happy: { eyes: 'eyesHappy', mouth: 'mouthSmile' },
  panic: { eyes: 'eyesWide', mouth: 'mouthShout' },
  angry: { eyes: 'eyesAngry', mouth: 'mouthFrown' },
  dizzy: { eyes: 'eyesDizzy', mouth: 'mouthFlat' },
  tired: { eyes: 'eyesOpen', mouth: 'mouthTongue' },
  cheer: { eyes: 'eyesHappy', mouth: 'mouthShout' },
  work: { eyes: 'eyesOpen', mouth: 'mouthSmile' },
  asleep: { eyes: 'eyesHappy', mouth: 'mouthFlat' }, // the happy arcs, flipped, read as shut eyes
};

// Eyes and mouths are drawn a little large on the parts sheet.
const FACE_SCALE = 0.86;
const EYES_Y = -82;
const MOUTH_Y = -36;
const HAT_Y = -92;

// The status light on the helmet: green when all is well, red when something
// is wrong, dark when the thread is asleep.
const LIGHT_OK = 0x4ade80;
const LIGHT_TROUBLE = 0xe5483a;
const LIGHT_OFF = 0x4a5578;
const TROUBLED: Mood[] = ['panic', 'angry', 'dizzy', 'tired'];

// What makes one worker look different from the next.
export interface WorkerLook {
  hatTint?: number;
  moustache?: boolean;
  glasses?: boolean;
  toolBelt?: boolean;
  longHair?: boolean;
}

export interface WorkerOptions extends WorkerLook {
  mood?: Mood;
}

// A worker is one of the computer's threads, built as a paper puppet: separate body parts pinned together at joints.
// The container's origin (0, 0) is the ground between the feet, so placing a
// worker at y = floor makes them stand on the floor.
//
//   Worker
//   └─ rig            (bounces and rocks without moving the worker itself)
//      ├─ legs
//      └─ upper       (everything above the hips)
//         ├─ arms, torso, tool belt
//         ├─ hold     (whatever the worker is carrying, plus two fists)
//         └─ head     (skull, eyes, mouth, accessories, helmet, snore bubble)
export class Worker extends Phaser.GameObjects.Container {
  private rig: Phaser.GameObjects.Container;
  private upper: Phaser.GameObjects.Container;
  private head: Phaser.GameObjects.Container;
  private armL: Phaser.GameObjects.Container;
  private armR: Phaser.GameObjects.Container;
  private legL: Phaser.GameObjects.Image;
  private legR: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image;
  private mouth: Phaser.GameObjects.Image;
  private hat: Phaser.GameObjects.Container;
  private light: Phaser.GameObjects.Arc;
  private snore: Phaser.GameObjects.Image;
  private hold: Phaser.GameObjects.Container;
  private heldItem?: Phaser.GameObjects.Image;
  private moodTweens: Phaser.Tweens.Tween[] = [];
  private walkTweens: Phaser.Tweens.Tween[] = [];
  private currentMood: Mood = 'idle';
  private gaze = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, options: WorkerOptions = {}) {
    super(scene, x, y);
    const part = (name: string) => scene.add.image(0, 0, 'worker', name);
    const face = (name: string) => scene.add.image(0, 0, 'faces', name);
    const extra = (name: string) => scene.add.image(0, 0, 'extras', name);

    // Legs pivot at the hip (top centre) so they can swing.
    this.legL = part('legL').setOrigin(0.5, 0).setPosition(-34, -98).setScale(0.7);
    this.legR = part('legR').setOrigin(0.5, 0).setPosition(34, -98).setScale(0.7);

    // Arms pivot at the shoulder. Each arm is its own small container so the
    // upper arm and forearm move as one piece.
    this.armL = this.buildArm('L');
    this.armR = this.buildArm('R');

    const torso = part('torso').setOrigin(0.5, 1).setPosition(0, 0);

    // The head pivots at the neck so it can tilt and bob.
    const skull = part('head').setOrigin(0.5, 1);
    this.eyes = face('eyesOpen').setPosition(0, EYES_Y).setScale(FACE_SCALE);
    this.mouth = face('mouthSmile').setPosition(0, MOUTH_Y).setScale(FACE_SCALE);

    // The helmet is white, so tinting it gives each thread its own colour.
    // Its status light is drawn in code on top, so it can change colour.
    const helmet = part('hat').setOrigin(0.5, 1);
    if (options.hatTint !== undefined) helmet.setTint(options.hatTint);
    this.light = scene.add.circle(1, -94, 9, LIGHT_OK).setStrokeStyle(3, 0x161e3c);
    const glint = scene.add.circle(-2, -97, 2.5, 0xffffff, 0.8);
    this.hat = scene.add.container(0, HAT_Y, [helmet, this.light, glint]);
    this.snore = extra('snoreBubble').setOrigin(0.05, 0.75).setPosition(12, -44).setVisible(false);

    // Order matters: later items are drawn on top of earlier ones.
    const headParts: Phaser.GameObjects.GameObject[] = [];
    if (options.longHair) headParts.push(extra('longHair').setOrigin(0.5, 0).setPosition(0, -182).setScale(1.68, 1.8));
    headParts.push(skull, this.eyes, this.mouth);
    if (options.moustache) headParts.push(extra('moustache').setPosition(0, -50).setScale(0.6));
    if (options.glasses) headParts.push(extra('glasses').setPosition(0, EYES_Y + 2).setScale(0.86));
    headParts.push(this.hat, this.snore);
    this.head = scene.add.container(0, -148, headParts);

    // Carried items sit in front of the chest with a fist on either side.
    this.hold = scene.add.container(0, -78, [
      scene.add.image(-70, 6, 'hands', 'fistL').setScale(0.44),
      scene.add.image(70, 6, 'hands', 'fistR').setScale(0.44),
    ]);
    this.hold.setVisible(false);

    const upperParts: Phaser.GameObjects.GameObject[] = [this.armL, this.armR, torso];
    if (options.toolBelt) upperParts.push(extra('toolBelt').setPosition(0, -44).setScale(0.84));
    upperParts.push(this.hold, this.head);
    this.upper = scene.add.container(0, -52, upperParts);

    this.rig = scene.add.container(0, 0, [this.legL, this.legR, this.upper]);
    this.add(this.rig);

    scene.add.existing(this);
    this.setMood(options.mood ?? 'idle');
  }

  private buildArm(side: 'L' | 'R') {
    const sign = side === 'L' ? -1 : 1;
    const upper = this.scene.add.image(0, 0, 'worker', `armUpper${side}`);
    const forearm = this.scene.add.image(0, 0, 'worker', `forearm${side}`);
    // Origins are the joint positions inside each picture (0..1 across, 0..1 down).
    upper.setOrigin(side === 'L' ? 0.72 : 0.28, 0.18);
    forearm.setOrigin(side === 'L' ? 0.72 : 0.28, 0.2).setPosition(sign * 26, 46);
    // The forearm is drawn over the upper arm, so the glove end hides the elbow joint.
    const arm = this.scene.add.container(sign * 58, -128, [upper, forearm]);
    arm.setScale(0.72);
    return arm;
  }

  get mood() {
    return this.currentMood;
  }

  get isWalking() {
    return this.walkTweens.length > 0;
  }

  get isCarrying() {
    return this.heldItem !== undefined;
  }

  // ---- Moods: a face, a pose, and looping tweens that keep it alive ----

  setMood(mood: Mood) {
    this.currentMood = mood;
    this.resetPose();

    const face = FACES[mood];
    this.eyes.setFrame(face.eyes);
    this.mouth.setFrame(face.mouth);
    this.light.setFillStyle(mood === 'asleep' ? LIGHT_OFF : TROUBLED.includes(mood) ? LIGHT_TROUBLE : LIGHT_OK);

    const loop = (config: Phaser.Types.Tweens.TweenBuilderConfig) => {
      this.moodTweens.push(this.scene.tweens.add({ yoyo: true, repeat: -1, ease: 'Sine.easeInOut', ...config }));
    };

    switch (mood) {
      case 'idle':
        // Gentle breathing.
        loop({ targets: this.upper, scaleY: 1.03, duration: 900 });
        loop({ targets: this.head, angle: { from: -2, to: 2 }, duration: 1400 });
        break;

      case 'happy':
        // Head bobs side to side while one arm waves.
        loop({ targets: this.head, angle: { from: -8, to: 8 }, duration: 350 });
        loop({ targets: this.upper, y: this.upper.y - 6, duration: 175 });
        this.armR.setAngle(-100);
        loop({ targets: this.armR, angle: { from: -112, to: -84 }, duration: 180 });
        break;

      case 'panic':
        // Arms in the air, whole body shaking.
        this.armL.setAngle(100);
        this.armR.setAngle(-100);
        loop({ targets: this.armL, angle: { from: 92, to: 114 }, duration: 90 });
        loop({ targets: this.armR, angle: { from: -114, to: -92 }, duration: 90 });
        loop({ targets: this.upper, x: { from: -3, to: 3 }, duration: 60, ease: 'Linear' });
        loop({ targets: this.head, angle: { from: -4, to: 4 }, duration: 110 });
        break;

      case 'angry':
        // Leaning forward, tapping one foot.
        this.head.setAngle(-4);
        this.armL.setAngle(-18);
        this.armR.setAngle(18);
        loop({ targets: this.legR, angle: { from: 0, to: -16 }, duration: 140, ease: 'Quad.easeOut' });
        loop({ targets: this.upper, scaleY: 0.98, duration: 140 });
        break;

      case 'dizzy':
        // Slow sway, as if about to fall over.
        loop({ targets: this.upper, angle: { from: -7, to: 7 }, duration: 1100 });
        loop({ targets: this.head, angle: { from: 10, to: -10 }, duration: 800 });
        loop({ targets: this.eyes, angle: 360, duration: 1200, yoyo: false, ease: 'Linear' });
        break;

      case 'tired':
        // Slumped, breathing heavily.
        this.eyes.setScale(FACE_SCALE, FACE_SCALE * 0.45);
        this.head.setAngle(10).setY(this.head.y + 6);
        this.armL.setAngle(-14);
        this.armR.setAngle(14);
        loop({ targets: this.upper, scaleY: 0.94, duration: 500 });
        break;

      case 'cheer':
        // Jumping with both arms up, squashing a little on landing.
        this.armL.setAngle(108);
        this.armR.setAngle(-108);
        loop({ targets: this.rig, y: -34, duration: 220, ease: 'Quad.easeOut' });
        loop({ targets: this.upper, scaleY: { from: 0.92, to: 1.06 }, duration: 220 });
        loop({ targets: [this.legL, this.legR], scaleY: { from: 0.62, to: 0.74 }, duration: 220 });
        break;

      case 'work':
        // Arms pumping up and down in turn, like working two levers.
        this.armL.setAngle(20);
        this.armR.setAngle(-75);
        loop({ targets: this.armL, angle: { from: 20, to: 75 }, duration: 240 });
        loop({ targets: this.armR, angle: { from: -75, to: -20 }, duration: 240 });
        loop({ targets: this.upper, y: this.upper.y + 4, duration: 240 });
        break;

      case 'asleep':
        // Standing up asleep: helmet tipped forward, a snore bubble growing and popping.
        this.eyes.setFlipY(true).setPosition(0, EYES_Y + 6);
        this.mouth.setScale(FACE_SCALE * 0.4, FACE_SCALE);
        this.head.setAngle(12).setY(this.head.y + 8);
        this.hat.setAngle(-9).setY(HAT_Y + 12);
        this.snore.setVisible(true).setScale(0.1);
        loop({ targets: this.snore, scale: 0.62, duration: 1700, yoyo: false, ease: 'Sine.easeOut' });
        loop({ targets: this.upper, scaleY: 1.05, duration: 1700 });
        break;
    }

    if (this.heldItem) this.tuckArms();
  }

  // Stops the current mood's animation and puts every part back to neutral.
  private resetPose() {
    for (const tween of this.moodTweens) tween.remove();
    this.moodTweens = [];

    this.rig.setY(0);
    this.upper.setPosition(0, -52).setAngle(0).setScale(1);
    this.head.setPosition(0, -148).setAngle(0);
    this.armL.setAngle(0);
    this.armR.setAngle(0);
    this.legL.setAngle(0).setScale(0.7);
    this.legR.setAngle(0).setScale(0.7);
    this.eyes.setAngle(0).setScale(FACE_SCALE).setFlipY(false);
    this.mouth.setScale(FACE_SCALE);
    this.hat.setAngle(0).setY(HAT_Y);
    this.snore.setVisible(false);
    this.applyGaze();
  }

  // ---- Looking: slide the eyes and mouth a few pixels towards a point ----

  lookToward(x: number, y: number) {
    if (this.currentMood === 'asleep') return;
    const headY = this.y - 290 * this.scaleY;
    this.gaze.x = Phaser.Math.Clamp((x - this.x) / 220, -1, 1) * 9;
    this.gaze.y = Phaser.Math.Clamp((y - headY) / 220, -1, 1) * 4;
    this.applyGaze();
  }

  private applyGaze() {
    if (this.currentMood === 'asleep') return;
    this.eyes.setPosition(this.gaze.x, EYES_Y + this.gaze.y);
    this.mouth.setPosition(this.gaze.x * 0.6, MOUTH_Y + this.gaze.y * 0.6);
  }

  // ---- Walking: slide to a point while the legs swing and the body rocks ----

  walkTo(x: number, y: number, pixelsPerSecond: number, onArrive?: () => void) {
    this.stopWalking();
    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    const step = 150; // milliseconds per footstep
    const swing = (config: Phaser.Types.Tweens.TweenBuilderConfig) =>
      this.scene.tweens.add({ yoyo: true, repeat: -1, ease: 'Sine.easeInOut', duration: step, ...config });

    // Look where we're going.
    this.gaze.x = x < this.x ? -9 : 9;
    this.gaze.y = 0;
    this.applyGaze();

    this.walkTweens = [
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        duration: (distance / pixelsPerSecond) * 1000,
        onComplete: () => {
          this.stopWalking();
          onArrive?.();
        },
      }),
      swing({ targets: this.legL, angle: { from: -16, to: 16 } }),
      swing({ targets: this.legR, angle: { from: 16, to: -16 } }),
      swing({ targets: this.rig, angle: { from: -4, to: 4 } }), // the waddle
    ];
  }

  stopWalking() {
    for (const tween of this.walkTweens) tween.remove();
    this.walkTweens = [];
    this.rig.setAngle(0);
    if (this.currentMood !== 'angry') {
      this.legL.setAngle(0);
      this.legR.setAngle(0);
    }
  }

  // ---- Carrying: hug an item against the chest ----

  pickUp(texture: string, frame: string, scale = 1.25) {
    this.putDown();
    this.heldItem = this.scene.add.image(0, 0, texture, frame).setScale(scale);
    this.hold.addAt(this.heldItem, 0); // behind the fists
    this.hold.setVisible(true);
    this.tuckArms();
  }

  putDown() {
    this.heldItem?.destroy();
    this.heldItem = undefined;
    this.hold.setVisible(false);
  }

  // Arms swing inwards so the hands disappear behind whatever is being held.
  private tuckArms() {
    this.armL.setAngle(-26);
    this.armR.setAngle(26);
  }
}
