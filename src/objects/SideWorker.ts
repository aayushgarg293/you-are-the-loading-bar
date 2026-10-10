import * as Phaser from 'phaser';

export type SideMood = 'run' | 'ouch' | 'happy';

const FACES: Record<SideMood, { eye: string; mouth: string }> = {
  run: { eye: 'eyeOpen', mouth: 'mouthSmile' },
  ouch: { eye: 'eyeDizzy', mouth: 'mouthShout' },
  happy: { eye: 'eyeHappy', mouth: 'mouthShout' },
};

const STEP = 120; // milliseconds per footstep

// The same thread worker seen from the side, facing right. Used wherever a
// worker has to run, push or pull. Like the front-view Worker it is a paper
// puppet, and its origin (0, 0) is the ground under its feet.
//
//   SideWorker
//   └─ rig
//      ├─ back leg, front leg      (pivot at the hip)
//      └─ upper                    (everything above the hips)
//         ├─ torso
//         ├─ head                  (skull, eye, mouth, helmet)
//         ├─ carried item
//         └─ arm → forearm         (pivot at the shoulder, then the elbow)
export class SideWorker extends Phaser.GameObjects.Container {
  private rig: Phaser.GameObjects.Container;
  private upper: Phaser.GameObjects.Container;
  private head: Phaser.GameObjects.Container;
  private arm: Phaser.GameObjects.Container;
  private legBack: Phaser.GameObjects.Image;
  private legFront: Phaser.GameObjects.Image;
  private eye: Phaser.GameObjects.Image;
  private mouth: Phaser.GameObjects.Image;
  private carried?: Phaser.GameObjects.Image;
  private runTweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, hatTint?: number) {
    super(scene, x, y);
    const part = (name: string) => scene.add.image(0, 0, 'side', name);

    // The far leg is drawn first and a little darker, so the two read as a pair.
    this.legBack = part('legBack').setOrigin(0.38, 0.08).setPosition(-8, -128).setTint(0xb9c4cf);
    this.legFront = part('legFront').setOrigin(0.38, 0.08).setPosition(6, -128);

    const torso = part('torso').setOrigin(0.5, 1);

    const skull = part('head').setOrigin(0.56, 0.96);
    this.eye = scene.add.image(36, -72, 'faces-side', 'eyeOpen').setScale(0.8);
    this.mouth = scene.add.image(44, -32, 'faces-side', 'mouthSmile').setScale(0.8);
    const helmet = part('hat').setOrigin(0.5, 1).setPosition(-2, -84);
    if (hatTint !== undefined) helmet.setTint(hatTint);
    this.head = scene.add.container(14, -138, [skull, this.eye, this.mouth, helmet]);

    // The arm art lies flat, pointing right: angle 0 reaches forward, 90 hangs down.
    const upperArm = part('armUpper').setOrigin(0.2, 0.5);
    const forearm = part('forearm').setOrigin(0.12, 0.5).setPosition(68, 0);
    this.arm = scene.add.container(-20, -100, [upperArm, forearm]).setAngle(80);

    this.upper = scene.add.container(0, -108, [torso, this.head, this.arm]);
    this.rig = scene.add.container(0, 0, [this.legBack, this.legFront, this.upper]);
    this.add(this.rig);
    scene.add.existing(this);
  }

  setMood(mood: SideMood) {
    this.eye.setFrame(FACES[mood].eye);
    this.mouth.setFrame(FACES[mood].mouth);
    return this;
  }

  // Holds something out in front, arm stretched forward underneath it.
  carry(texture: string, frame: string, size: number) {
    this.carried?.destroy();
    this.carried = this.scene.add.image(92, -78, texture, frame).setDisplaySize(size, size);
    this.upper.addAt(this.carried, 2); // in front of the body, behind the arm
    this.arm.setAngle(18);
    return this;
  }

  // Points the arm: 0 reaches straight ahead, 90 hangs straight down.
  reach(angle: number) {
    this.arm.setAngle(angle);
    return this;
  }

  // Starts or stops the run cycle: legs scissor, the body bobs and leans in.
  setRunning(running: boolean) {
    for (const tween of this.runTweens) tween.remove();
    this.runTweens = [];
    this.legBack.setAngle(0);
    this.legFront.setAngle(0);
    this.rig.setY(0);
    this.upper.setAngle(running ? 6 : 0);
    if (!running) return this;

    const swing = (config: Phaser.Types.Tweens.TweenBuilderConfig) =>
      this.runTweens.push(this.scene.tweens.add({ yoyo: true, repeat: -1, ease: 'Sine.easeInOut', duration: STEP, ...config }));
    swing({ targets: this.legFront, angle: { from: -38, to: 38 } });
    swing({ targets: this.legBack, angle: { from: 38, to: -38 } });
    swing({ targets: this.rig, y: -7, duration: STEP / 2 });
    swing({ targets: this.head, angle: { from: -3, to: 3 } });
    if (!this.carried) swing({ targets: this.arm, angle: { from: 40, to: 130 } });
    return this;
  }
}
