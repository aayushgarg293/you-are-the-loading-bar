import * as Phaser from 'phaser';
import { music, sfx, unlockAudio } from '../audio/sound';
import { COLORS, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { HamsterWheel } from '../objects/HamsterWheel';
import { LoadingBar } from '../objects/LoadingBar';
import { Worker } from '../objects/Worker';

const FLOOR_Y = 520;

// The first thing a player sees: the title, a loading bar that never quite
// finishes, and a START button. The button matters for more than looks:
// browsers only allow sound after a click, so this click is what switches the
// game's audio on before the opening cutscene.
export class TitleScene extends Phaser.Scene {
  private bar!: LoadingBar;

  constructor() {
    super('Title');
  }

  create() {
    music.stop();
    this.cameras.main.setBackgroundColor(COLORS.cream).fadeIn(400, 246, 236, 210);
    const text = (x: number, y: number, value: string, size: number, colour: number) =>
      this.add.text(x, y, value, { fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour), align: 'center' }).setOrigin(0.5);

    text(GAME_WIDTH / 2, 92, 'YOU ARE THE\nLOADING BAR', 58, COLORS.navy).setLineSpacing(18);
    // Little yellow pixels twinkling either side of the title.
    for (const [x, y] of [[150, 60], [186, 96], [140, 132], [1130, 60], [1094, 96], [1140, 132]]) {
      const pixel = this.add.rectangle(x, y, 18, 18, COLORS.yellow);
      this.tweens.add({ targets: pixel, alpha: 0.2, duration: Phaser.Math.Between(400, 900), yoyo: true, repeat: -1 });
    }

    this.startBar();

    // A strip of floor with the cast on it.
    this.add.rectangle(GAME_WIDTH / 2, FLOOR_Y + 3, GAME_WIDTH - 240, 6, COLORS.navy);
    new HamsterWheel(this, 270, FLOOR_Y - HamsterWheel.FEET_OFFSET * 0.42).setScale(0.42).setSpeed(1);
    new Worker(this, 440, FLOOR_Y, { mood: 'work', moustache: true, hatTint: 0x9cc9ff }).setScale(0.42);
    new Worker(this, 840, FLOOR_Y, { mood: 'happy', glasses: true, hatTint: 0xff9d8a }).setScale(0.42);
    new Worker(this, 960, FLOOR_Y, { mood: 'panic', longHair: true }).setScale(0.42);
    new Worker(this, 1060, FLOOR_Y, { mood: 'asleep', hatTint: 0xffd766 }).setScale(0.42);

    this.addStartButton(GAME_WIDTH / 2, FLOOR_Y - 74);

    text(GAME_WIDTH / 2, 600, 'A download is stuck. The little people inside the computer need a boss.', 12, COLORS.navy);
    text(GAME_WIDTH / 2, 668, 'best with sound on   -   M mutes   -   made for desktop', 10, 0x6d7692);
  }

  // The bar fills block by block to 99%, hangs there, and starts again.
  private startBar() {
    this.bar?.destroy();
    this.bar = new LoadingBar(this, GAME_WIDTH / 2, 268).setScale(0.86);
    let filled = 0;
    this.time.addEvent({
      delay: 260,
      repeat: 13,
      callback: () => {
        this.bar.fillNextSlot();
        filled++;
        this.bar.setPercent(filled === 14 ? 99 : (filled / 15) * 100);
        if (filled === 14) this.time.delayedCall(2600, () => this.startBar());
      },
    });
  }

  private addStartButton(x: number, y: number) {
    const width = 260, height = 84;
    const plate = this.add.graphics({ x, y });
    plate.fillStyle(COLORS.navy).fillRoundedRect(-width / 2 - 7, -height / 2 - 7, width + 14, height + 14, 18);
    plate.fillStyle(COLORS.green).fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    const label = this.add.text(x, y + 2, 'START', { fontFamily: PIXEL_FONT, fontSize: '30px', color: hex(COLORS.navy) }).setOrigin(0.5);
    this.tweens.add({ targets: [plate, label], scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
    zone.once('pointerdown', () => {
      // This click is what allows sound; play the jingle as soon as audio is awake.
      unlockAudio().then(() => sfx.start());
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Intro'));
    });
  }
}
