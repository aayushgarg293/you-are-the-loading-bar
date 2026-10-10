import * as Phaser from 'phaser';

export type HamsterMood = 'run' | 'tired' | 'chew' | 'asleep';

const HEADS: Record<HamsterMood, string> = {
  run: 'headHappy',
  tired: 'headTired',
  chew: 'headChew',
  asleep: 'headAsleep',
};

// The hamster is a side-view puppet facing right. Its origin (0, 0) is the
// ground under its belly. Legs swing with tweens; `setSpeed` makes the same
// tweens play faster or slower instead of creating new ones.
export class Hamster extends Phaser.GameObjects.Container {
  private head: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private runTweens: Phaser.Tweens.Tween[] = [];
  private currentMood: HamsterMood = 'run';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const part = (name: string) => scene.add.image(0, 0, 'hamster', name);

    // Far-side legs sit behind the body, near-side legs in front.
    const farBack = part('legBackA').setOrigin(0.72, 0.35).setPosition(-58, -52).setTint(0xd9d9d9);
    const farFront = part('legFrontA').setOrigin(0.2, 0.4).setPosition(48, -52).setTint(0xd9d9d9);
    const tail = part('tail').setOrigin(0.85, 0.5).setPosition(-104, -98);
    this.torso = part('body').setOrigin(0.5, 1).setPosition(0, -22);
    const nearBack = part('legBackB').setOrigin(0.5, 0.3).setPosition(-66, -50);
    const nearFront = part('legFrontB').setOrigin(0.3, 0.35).setPosition(58, -46);
    this.head = part('headHappy').setOrigin(0.3, 0.6).setPosition(52, -106);

    this.add([farBack, farFront, tail, this.torso, nearBack, nearFront, this.head]);
    scene.add.existing(this);

    const swing = (target: Phaser.GameObjects.Image, from: number, to: number) => {
      target.setAngle(from);
      this.runTweens.push(
        scene.tweens.add({ targets: target, angle: to, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      );
    };
    // Diagonal pairs move together, like a real trot.
    swing(nearFront, -30, 32);
    swing(farBack, -24, 30);
    swing(nearBack, 30, -26);
    swing(farFront, 26, -30);
    this.runTweens.push(
      scene.tweens.add({ targets: this.torso, y: this.torso.y - 5, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      scene.tweens.add({ targets: this.head, y: this.head.y - 6, angle: 4, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      scene.tweens.add({ targets: tail, angle: { from: -14, to: 14 }, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    );
  }

  get mood() {
    return this.currentMood;
  }

  setMood(mood: HamsterMood) {
    this.currentMood = mood;
    this.head.setFrame(HEADS[mood]);
    return this;
  }

  // 0 = standing still, 1 = normal run, above 1 = sprint.
  setSpeed(speed: number) {
    for (const tween of this.runTweens) {
      tween.timeScale = Math.max(speed, 0.0001);
      if (speed <= 0.02) tween.pause();
      else if (tween.isPaused()) tween.resume();
    }
    return this;
  }

  // A quick squash, used when the hamster swallows a seed.
  gulp() {
    this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 1.12, scaleX: this.scaleX * 0.94, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }
}
