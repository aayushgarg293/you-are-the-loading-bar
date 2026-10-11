import * as Phaser from 'phaser';
import { COLORS, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { sfx } from '../audio/sound';

const STARS = 5;
const REAL_SONG = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// The last screen: thanks, a star rating, and buttons to share or play again.
// The rating is only remembered in this browser; nothing is sent anywhere.
export class EndScreenScene extends Phaser.Scene {
  private stars: Phaser.GameObjects.Star[] = [];
  private thanks!: Phaser.GameObjects.Text;

  constructor() {
    super('EndScreen');
  }

  create() {
    this.stars = [];
    this.cameras.main.setBackgroundColor(COLORS.navy).fadeIn(500, 0, 0, 0);
    const text = (y: number, value: string, size: number, colour: number) =>
      this.add.text(GAME_WIDTH / 2, y, value, { fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour), align: 'center' }).setOrigin(0.5);

    text(96, 'THE END', 20, COLORS.green);
    text(170, 'YOU ARE THE\nLOADING BAR', 44, COLORS.cream).setLineSpacing(16);
    text(292, 'Thanks for keeping the download alive.', 12, COLORS.cream);

    text(366, 'RATE THE GAME', 14, COLORS.yellow);
    for (let i = 0; i < STARS; i++) {
      // A star shape: 5 points, inner radius 16, outer radius 34.
      const star = this.add.star(GAME_WIDTH / 2 + (i - (STARS - 1) / 2) * 84, 430, 5, 16, 34, 0x2c365e).setStrokeStyle(4, COLORS.cream);
      star.setInteractive({ useHandCursor: true });
      star.on('pointerover', () => this.showRating(i + 1));
      star.on('pointerout', () => this.showRating(this.savedRating));
      star.on('pointerdown', () => this.rate(i + 1));
      this.stars.push(star);
    }
    this.thanks = text(490, '', 12, COLORS.green);
    this.showRating(this.savedRating);

    this.addButton(GAME_WIDTH / 2 - 290, 580, 'PLAY AGAIN', COLORS.green, () => this.scene.start('Title'));
    this.addButton(GAME_WIDTH / 2, 580, 'SHARE', COLORS.yellow, (label) => this.share(label));
    this.addButton(GAME_WIDTH / 2 + 290, 580, 'THE REAL SONG', COLORS.cream, () => window.open(REAL_SONG, '_blank', 'noopener'));
  }

  // ---- Rating ----

  // Browser storage can be switched off (private windows), so every use is guarded.
  private get savedRating() {
    try {
      return Number(window.localStorage.getItem('loading-bar-rating') ?? 0);
    } catch {
      return 0;
    }
  }

  private showRating(count: number) {
    this.stars.forEach((star, i) => star.setFillStyle(i < count ? COLORS.yellow : 0x2c365e));
  }

  private rate(count: number) {
    try {
      window.localStorage.setItem('loading-bar-rating', String(count));
    } catch {
      // Not saved; the stars still light up for this visit.
    }
    sfx.star(count);
    this.showRating(count);
    this.thanks.setText(count >= 4 ? 'Thank you! The hamster is thrilled.' : 'Thanks. The hamster will try harder.');
    this.tweens.add({ targets: this.stars.slice(0, count), scale: 1.25, duration: 120, yoyo: true, delay: this.tweens.stagger(50, {}) });
  }

  // ---- Buttons ----

  private addButton(x: number, y: number, label: string, colour: number, onClick: (label: Phaser.GameObjects.Text) => void) {
    const width = 250, height = 62;
    const plate = this.add.graphics({ x, y });
    plate.fillStyle(COLORS.cream).fillRoundedRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10, 12);
    plate.fillStyle(colour).fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    const caption = this.add.text(x, y + 1, label, { fontFamily: PIXEL_FONT, fontSize: '14px', color: hex(COLORS.navy) }).setOrigin(0.5);
    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => plate.setScale(1.06));
    zone.on('pointerout', () => plate.setScale(1));
    zone.on('pointerdown', () => {
      sfx.click();
      onClick(caption);
    });
  }

  // Copies the game's address so it can be pasted to a friend.
  private async share(label: Phaser.GameObjects.Text) {
    const address = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(address);
      label.setText('LINK COPIED!');
    } catch {
      label.setText('COPY FAILED');
    }
    this.time.delayedCall(1800, () => label.setText('SHARE'));
  }
}
