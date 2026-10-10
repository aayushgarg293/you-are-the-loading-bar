import * as Phaser from 'phaser';
import { Hamster } from './Hamster';

const WHEEL_RADIUS = 219; // half the wheel picture's width, in atlas pixels

// The wheel on its stand with the hamster inside. Origin (0, 0) is the hub.
export class HamsterWheel extends Phaser.GameObjects.Container {
  readonly hamster: Hamster;
  private wheel: Phaser.GameObjects.Image;
  private speed = 0;

  // How far below the hub the stand's feet touch the floor (before scaling).
  static readonly FEET_OFFSET = 228;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    // The stand's hub is 21% of the way down its picture; pin that to the hub.
    const stand = scene.add.image(0, 0, 'wheel', 'stand').setOrigin(0.5, 0.21);
    this.wheel = scene.add.image(0, 0, 'wheel', 'wheel');
    this.hamster = new Hamster(scene, -6, WHEEL_RADIUS * 0.8).setScale(0.6);
    this.add([stand, this.wheel, this.hamster]);
    scene.add.existing(this);

    // Spin the wheel a little every frame, in step with the hamster's speed.
    const spin = (_time: number, delta: number) => {
      this.wheel.angle += this.speed * delta * 0.28;
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, spin);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, spin));
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.hamster.setSpeed(speed);
    return this;
  }

  // Where the hamster's mouth is, in scene coordinates (for dropping food).
  get mouthPosition() {
    return {
      x: this.x + (this.hamster.x + 105 * this.hamster.scaleX) * this.scaleX,
      y: this.y + (this.hamster.y - 95 * this.hamster.scaleY) * this.scaleY,
    };
  }
}
