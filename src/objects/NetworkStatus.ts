import * as Phaser from 'phaser';
import { COLORS, PIXEL_FONT, hex } from '../config';

const BARS = 4;

// The slow-internet readouts beside the loading bar: Wi-Fi signal bars on the
// left and a download speed on the right. `setOnline(false)` drops the signal
// to nothing and the speed to zero.
export class NetworkStatus {
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private cross: Phaser.GameObjects.Text;
  private speed: Phaser.GameObjects.Text;
  private online = false;

  constructor(scene: Phaser.Scene, wifiX: number, speedX: number, y: number) {
    for (let i = 0; i < BARS; i++) {
      const height = 14 + i * 11;
      this.bars.push(scene.add.rectangle(wifiX - 27 + i * 18, y + 24, 12, height, COLORS.green).setOrigin(0.5, 1).setStrokeStyle(3, COLORS.navy));
    }
    const text = (size: number, color: number) => ({ fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(color), stroke: hex(COLORS.navy), strokeThickness: 5, align: 'center', lineSpacing: 4 });
    this.cross = scene.add.text(wifiX + 18, y - 12, 'x', text(20, COLORS.red)).setOrigin(0.5);
    this.speed = scene.add.text(speedX, y, '', text(12, COLORS.cream)).setOrigin(0.5);

    // The speed flickers between pitiful values, the way a bad connection does.
    scene.time.addEvent({ delay: 650, loop: true, callback: () => this.refresh() });
    this.refresh();
  }

  setOnline(online: boolean) {
    this.online = online;
    this.refresh();
  }

  private refresh() {
    const signal = this.online ? Phaser.Math.Between(1, 3) : 0;
    this.bars.forEach((bar, i) => bar.setFillStyle(i < signal ? COLORS.green : 0x2c365e));
    this.cross.setVisible(!this.online);
    const rate = this.online ? (Phaser.Math.Between(3, 42) / 10).toFixed(1) : '0.0';
    this.speed.setText(`${rate}\nKB/s`).setColor(hex(this.online ? COLORS.cream : COLORS.red));
  }
}
