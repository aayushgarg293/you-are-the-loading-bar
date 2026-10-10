import * as Phaser from 'phaser';
import { COLORS, PIXEL_FONT, hex } from '../config';

const WIDTH = 320;
const HEIGHT = 150;
const TITLE_BAR = 30;

export interface ErrorMessage {
  title: string; // the "program" that has gone wrong, shown in the title bar
  message: string;
  icon: { texture: string; frame: string };
}

// The pop-up a computer shows when something goes wrong: red title bar, an
// icon, a short message and a FIX button. Origin is its centre. The whole
// dialog is one big button; listen for 'pointerdown' on it.
export class ErrorDialog extends Phaser.GameObjects.Container {
  private titleText: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const left = -WIDTH / 2;
    const top = -HEIGHT / 2;

    const frame = scene.add.graphics();
    frame.fillStyle(COLORS.navy).fillRoundedRect(left - 5, top - 5, WIDTH + 10, HEIGHT + 10, 10);
    frame.fillTriangle(left + 30, top + HEIGHT, left + 70, top + HEIGHT, left + 16, top + HEIGHT + 34); // tail pointing at whoever raised it
    frame.fillStyle(COLORS.cream).fillRect(left, top, WIDTH, HEIGHT);
    frame.fillStyle(COLORS.red).fillRect(left, top, WIDTH, TITLE_BAR);
    // The close button in the corner (just for show).
    frame.fillStyle(COLORS.cream).fillRect(left + WIDTH - 25, top + 6, 18, 18);
    frame.lineStyle(3, COLORS.navy).lineBetween(left + WIDTH - 21, top + 10, left + WIDTH - 11, top + 20).lineBetween(left + WIDTH - 11, top + 10, left + WIDTH - 21, top + 20);
    // The FIX button.
    frame.fillStyle(COLORS.navy).fillRoundedRect(left + WIDTH - 108, top + HEIGHT - 44, 96, 34, 6);
    frame.fillStyle(COLORS.green).fillRoundedRect(left + WIDTH - 105, top + HEIGHT - 41, 90, 28, 4);

    const text = (size: number, color: number) => ({ fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(color), lineSpacing: 6 });
    this.titleText = scene.add.text(left + 10, top + TITLE_BAR / 2 + 1, '', text(10, COLORS.cream)).setOrigin(0, 0.5);
    this.messageText = scene.add.text(left + 98, top + TITLE_BAR + 14, '', text(10, COLORS.navy));
    this.icon = scene.add.image(left + 50, top + TITLE_BAR + 50, 'feeding', 'seed');
    const fix = scene.add.text(left + WIDTH - 60, top + HEIGHT - 26, 'FIX', text(12, COLORS.navy)).setOrigin(0.5);

    this.add([frame, this.titleText, this.messageText, this.icon, fix]);
    this.setSize(WIDTH, HEIGHT);
    scene.add.existing(this);

    // It bobs gently and the icon rocks, so the eye is drawn to it.
    scene.tweens.add({ targets: this, y: y - 8, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.icon, angle: { from: -8, to: 8 }, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  show(error: ErrorMessage) {
    this.titleText.setText(error.title);
    this.messageText.setText(error.message);
    this.icon.setTexture(error.icon.texture, error.icon.frame);
    this.icon.setScale(68 / Math.max(this.icon.width, this.icon.height));
    return this;
  }
}
