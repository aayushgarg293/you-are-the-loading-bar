import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { debugNumber } from '../debug';
import { HamsterWheel } from '../objects/HamsterWheel';
import { Worker } from '../objects/Worker';
import { MinigameScene } from './MinigameScene';

const ENERGY_PER_SEED = 13;
const ENERGY_DRAIN_PER_SECOND = 5.5;
const BATTERY_CELLS = 8;
const SECONDS_BEFORE_REFRESH = 32;
const MOUTH_REACH = 135; // how close to the mouth a seed must be dropped

// Minigame "power.exe": the battery is flat because the hamster that charges
// it is starving. Drag seeds from the sack to its mouth. The battery drains
// while you fetch the next seed, so you have to keep feeding until it is full.
export class FeedHamsterScene extends MinigameScene {
  private wheel!: HamsterWheel;
  private worker!: Worker;
  private sack!: Phaser.GameObjects.Image;
  private cells: Phaser.GameObjects.Rectangle[] = [];
  private chargeText!: Phaser.GameObjects.Text;
  private heldSeed?: Phaser.GameObjects.Image;
  private hint?: Phaser.GameObjects.Image;
  private energy = 0;
  private hasFed = false;
  private chewingUntil = 0;

  constructor() {
    super('FeedHamster');
  }

  create() {
    this.energy = debugNumber('energy') ?? 0;
    this.hasFed = false;
    this.chewingUntil = 0;
    this.heldSeed = undefined;
    this.cells = [];

    // A zoomed-in, dimmed corner of the factory as the backdrop.
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.35).setOrigin(0);

    const floorY = 628;
    this.wheel = new HamsterWheel(this, 430, floorY - HamsterWheel.FEET_OFFSET);
    this.wheel.hamster.setMood('tired');
    this.wheel.setSpeed(0);

    this.sack = this.add.image(985, floorY + 30, 'feeding', 'sack').setOrigin(0.5, 1).setScale(1.15);
    this.sack.setInteractive({ useHandCursor: true });
    this.worker = new Worker(this, 1185, floorY + 56, { mood: 'panic' }).setScale(0.6);

    // Battery meter, drawn in code: a case, a nub on the end, and cells that light up.
    const meterX = 250;
    const meterY = 132;
    const battery = this.add.graphics();
    battery.fillStyle(COLORS.navy).fillRoundedRect(meterX - 30, meterY - 32, BATTERY_CELLS * 40 + 20, 64, 10);
    battery.fillRoundedRect(meterX + BATTERY_CELLS * 40 - 14, meterY - 14, 20, 28, 5);
    battery.fillStyle(COLORS.cream).fillRoundedRect(meterX - 24, meterY - 26, BATTERY_CELLS * 40 + 8, 52, 6);
    for (let i = 0; i < BATTERY_CELLS; i++) {
      this.cells.push(this.add.rectangle(meterX + i * 40, meterY, 32, 40, COLORS.green));
    }
    this.chargeText = this.add
      .text(meterX + BATTERY_CELLS * 40 + 24, meterY, '', { fontFamily: PIXEL_FONT, fontSize: '20px', color: hex(COLORS.cream), stroke: hex(COLORS.navy), strokeThickness: 6 })
      .setOrigin(0, 0.5);

    // A ghost seed gliding from sack to hamster shows what to do, until the
    // player picks up their first seed.
    const mouth = this.wheel.mouthPosition;
    this.hint = this.add.image(this.sack.x, this.sack.y - 210, 'feeding', 'seed').setScale(0.42).setAlpha(0.55);
    this.tweens.add({ targets: this.hint, x: mouth.x, y: mouth.y, duration: 1300, ease: 'Sine.easeInOut', repeat: -1, repeatDelay: 350 });

    this.sack.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.grabSeed(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.heldSeed?.setPosition(pointer.x, pointer.y));
    this.input.on('pointerup', () => this.releaseSeed());

    this.openWindow('power.exe', 'Drag seeds to the hamster to charge the battery');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
    this.showEnergy();
  }

  private grabSeed(pointer: Phaser.Input.Pointer) {
    if (this.finished || this.heldSeed) return;
    this.hint?.destroy();
    this.hint = undefined;
    this.heldSeed = this.add.image(pointer.x, pointer.y, 'feeding', 'seed').setScale(0.42).setDepth(10);
    this.tweens.add({ targets: this.sack, scaleY: 1.05, duration: 80, yoyo: true });
  }

  private releaseSeed() {
    const seed = this.heldSeed;
    if (!seed) return;
    this.heldSeed = undefined;

    const mouth = this.wheel.mouthPosition;
    const reachedMouth = Phaser.Math.Distance.Between(seed.x, seed.y, mouth.x, mouth.y) < MOUTH_REACH;
    if (reachedMouth && !this.finished) {
      // Seed zips into the mouth and shrinks away.
      this.tweens.add({ targets: seed, x: mouth.x, y: mouth.y, scale: 0, duration: 120, onComplete: () => seed.destroy() });
      this.feed();
    } else {
      // Missed: the seed drops to the floor and fades.
      this.tweens.add({ targets: seed, y: 660, angle: 200, alpha: 0, duration: 450, ease: 'Quad.easeIn', onComplete: () => seed.destroy() });
    }
  }

  private feed() {
    this.hasFed = true;
    this.energy = Math.min(100, this.energy + ENERGY_PER_SEED);
    this.chewingUntil = this.time.now + 380;
    this.wheel.hamster.gulp();
    if (this.energy >= 100) this.celebrate();
  }

  private celebrate() {
    this.wheel.hamster.setMood('run');
    this.wheel.setSpeed(1.7);
    this.worker.setMood('cheer');
    this.showEnergy();
    this.tweens.add({ targets: this.cells, scaleY: 1.2, duration: 160, yoyo: true, repeat: 3 });
    this.win();
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.finished) return;

    // Energy only starts draining after the first seed, so nobody loses
    // ground while still working out what to do.
    if (this.hasFed) this.energy = Math.max(0, this.energy - (ENERGY_DRAIN_PER_SECOND * delta) / 1000);

    const speed = this.energy / 100;
    this.wheel.setSpeed(speed);
    const chewing = time < this.chewingUntil;
    this.wheel.hamster.setMood(chewing ? 'chew' : speed < 0.3 ? 'tired' : 'run');
    this.showEnergy();
  }

  private showEnergy() {
    // Like a real battery icon: red when nearly flat, yellow in the middle, green when healthy.
    const lit = Math.round((this.energy / 100) * BATTERY_CELLS);
    const colour = this.energy < 30 ? COLORS.red : this.energy < 65 ? COLORS.yellow : COLORS.green;
    this.cells.forEach((cell, i) => cell.setFillStyle(i < lit ? colour : 0xcfc6ad));
    this.chargeText.setText(`${Math.round(this.energy)}%`);
  }
}
