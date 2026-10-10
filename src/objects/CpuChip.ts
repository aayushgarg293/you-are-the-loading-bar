import * as Phaser from 'phaser';
import { COLORS } from '../config';

const GAUGE_RADIUS = 70;
const GAUGE_START = 150; // needle angle (degrees) at temperature 0 ...
const GAUGE_SWEEP = 240; // ... and how far it swings to reach temperature 1
const FROZEN_BLUE = 0x6fb7ff;

// The processor with a temperature gauge on its face. Temperature runs from
// 0 (ice cold) to 1 (melting); the needle should sit between GREEN_FROM and
// GREEN_TO. Origin is the centre of the chip.
//
// The chip is three pictures stacked: the normal one, a red-hot one and a
// blue-tinted one. Fading the top two in and out shows the temperature.
export class CpuChip extends Phaser.GameObjects.Container {
  static readonly GREEN_FROM = 0.4;
  static readonly GREEN_TO = 0.66;
  static readonly FROZEN_BLUE = FROZEN_BLUE;

  private hotChip: Phaser.GameObjects.Image;
  private coldChip: Phaser.GameObjects.Image;
  private steam: Phaser.GameObjects.Image;
  private needle: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const chip = scene.add.image(0, 0, 'cpu', 'chip');
    this.coldChip = scene.add.image(0, 0, 'cpu', 'chip').setTint(FROZEN_BLUE).setAlpha(0);
    this.hotChip = scene.add.image(0, 0, 'cpu', 'chipHot').setAlpha(0);
    this.steam = scene.add.image(0, -196, 'cpu', 'steam').setAlpha(0);
    scene.tweens.add({ targets: this.steam, y: this.steam.y - 10, scaleY: 1.15, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // The gauge face is blank in the art; the coloured zones and needle are drawn here.
    const angleAt = (temperature: number) => Phaser.Math.DegToRad(GAUGE_START + GAUGE_SWEEP * temperature);
    const dial = scene.add.graphics();
    const zones: [number, number, number][] = [
      [0, CpuChip.GREEN_FROM, FROZEN_BLUE],
      [CpuChip.GREEN_FROM, CpuChip.GREEN_TO, COLORS.green],
      [CpuChip.GREEN_TO, 1, COLORS.red],
    ];
    for (const [from, to, colour] of zones) {
      dial.lineStyle(18, colour).beginPath().arc(0, 0, GAUGE_RADIUS, angleAt(from), angleAt(to)).strokePath();
    }
    dial.lineStyle(3, COLORS.navy);
    for (const mark of [0, CpuChip.GREEN_FROM, CpuChip.GREEN_TO, 1]) {
      const angle = angleAt(mark);
      dial.lineBetween(Math.cos(angle) * (GAUGE_RADIUS - 11), Math.sin(angle) * (GAUGE_RADIUS - 11), Math.cos(angle) * (GAUGE_RADIUS + 11), Math.sin(angle) * (GAUGE_RADIUS + 11));
    }

    // The needle is drawn pointing right, then simply rotated to the reading.
    this.needle = scene.add.graphics();
    this.needle.fillStyle(COLORS.navy).fillTriangle(-12, -7, -12, 7, GAUGE_RADIUS + 4, 0).fillCircle(0, 0, 11);
    this.needle.fillStyle(COLORS.cream).fillCircle(0, 0, 4);

    this.add([chip, this.coldChip, this.hotChip, this.steam, dial, this.needle]);
    scene.add.existing(this);
  }

  static inGreen(temperature: number) {
    return temperature >= CpuChip.GREEN_FROM && temperature <= CpuChip.GREEN_TO;
  }

  // Moves the needle and shows the matching look. Returns how the chip is
  // doing, so a scene can print a status.
  setTemperature(temperature: number): 'cool' | 'hot' | 'frozen' {
    this.needle.setAngle(GAUGE_START + GAUGE_SWEEP * temperature);
    const tooHot = Phaser.Math.Clamp((temperature - CpuChip.GREEN_TO) / (1 - CpuChip.GREEN_TO), 0, 1);
    const tooCold = Phaser.Math.Clamp((CpuChip.GREEN_FROM - temperature) / CpuChip.GREEN_FROM, 0, 1);
    this.hotChip.setAlpha(tooHot);
    this.steam.setAlpha(tooHot);
    this.coldChip.setAlpha(tooCold * 0.85);
    return CpuChip.inGreen(temperature) ? 'cool' : tooHot ? 'hot' : 'frozen';
  }
}
