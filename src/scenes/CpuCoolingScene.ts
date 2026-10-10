import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { CpuChip } from '../objects/CpuChip';
import { SideWorker } from '../objects/SideWorker';
import { MinigameScene } from './MinigameScene';

const FAN_SPIN_UP = 1.5; // how fast the fan gains speed while cranked (per second)
const FAN_SPIN_DOWN = 0.8; // how fast it loses speed when let go
const FAN_COOLING = 0.62; // temperature removed per second by a fan at full speed
const SECONDS_IN_GREEN_TO_WIN = 14;
const GOAL_SLOTS = 14;
const OUT_OF_GREEN_PENALTY = 0.025; // extra patience lost per second outside the green
const SECONDS_BEFORE_REFRESH = 55;

// What the computer is busy with, and how much heat that makes per second.
const WORKLOADS = [
  { name: 'a screensaver', heat: 0.15 },
  { name: 'one spreadsheet', heat: 0.22 },
  { name: '47 browser tabs', heat: 0.33 },
  { name: 'a video call', heat: 0.4 },
  { name: 'a game on ULTRA', heat: 0.47 },
];

const CPU = { x: 450, y: 400 };
const FAN = { x: 930, y: 300 };
const CRANK = { x: 930, y: 540 };

// Minigame "cpu.exe": the processor is overheating. Hold the mouse button (or
// Space) to crank the cooling fan, and let go to rest it. Too little fan and
// the CPU cooks; too much and the computer freezes. Keep the needle in the
// green while the workload keeps changing.
export class CpuCoolingScene extends MinigameScene {
  private chip!: CpuChip;
  private fan!: Phaser.GameObjects.Image;
  private crank!: Phaser.GameObjects.Image;
  private worker!: SideWorker;
  private statusText!: Phaser.GameObjects.Text;
  private workloadText!: Phaser.GameObjects.Text;
  private holdHint?: Phaser.GameObjects.Text;
  private goalSlots: Phaser.GameObjects.Image[] = [];
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private temperature = 0;
  private fanSpeed = 0;
  private heat = 0;
  private secondsInGreen = 0;
  private nextWorkloadAt = 0;
  private clock = 0;

  constructor() {
    super('CpuCooling');
  }

  create() {
    this.goalSlots = [];
    this.temperature = 0.8; // it starts out overheating: that is the problem
    this.fanSpeed = 0;
    this.heat = WORKLOADS[1].heat;
    this.secondsInGreen = 0;
    this.nextWorkloadAt = 5000;
    this.clock = 0;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.68).setOrigin(0);

    // Goal meter: one slot for each second the needle spends in the green.
    const slotsLeft = GAME_WIDTH / 2 - ((GOAL_SLOTS - 1) * 40) / 2;
    for (let i = 0; i < GOAL_SLOTS; i++) {
      this.goalSlots.push(this.add.image(slotsLeft + i * 40, 112, 'ui', 'blockGrey').setScale(0.36));
    }

    this.chip = new CpuChip(this, CPU.x, CPU.y);
    this.buildFan();

    const label = (size: number, colour: number) => ({ fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour), stroke: hex(COLORS.navy), strokeThickness: 6 });
    this.statusText = this.add.text(CPU.x, CPU.y + 200, '', label(18, COLORS.red)).setOrigin(0.5);
    this.workloadText = this.add.text(CPU.x, CPU.y - 238, '', label(10, COLORS.cream)).setOrigin(0.5);
    this.holdHint = this.add.text(CRANK.x + 10, CRANK.y - 110, 'HOLD!', label(20, COLORS.yellow)).setOrigin(0.5);
    this.tweens.add({ targets: this.holdHint, scale: 1.2, duration: 300, yoyo: true, repeat: -1 });

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.openWindow('cpu.exe', 'Hold the mouse button to crank the fan, let go to rest it. Keep the needle in the green');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
    this.showWorkload();
  }

  private buildFan() {
    // A drive belt from the crank up to the fan.
    const belt = this.add.graphics();
    belt.lineStyle(14, COLORS.navy).lineBetween(FAN.x, FAN.y, CRANK.x, CRANK.y);
    belt.lineStyle(6, 0x8d7a66).lineBetween(FAN.x, FAN.y, CRANK.x, CRANK.y);

    this.fan = this.add.image(FAN.x, FAN.y, 'cpu', 'fan').setScale(1.05);
    // The crank turns about its hub, which is near the top-left of its picture.
    this.crank = this.add.image(CRANK.x, CRANK.y, 'cpu', 'crank').setOrigin(0.15, 0.18).setScale(0.75);
    this.worker = new SideWorker(this, CRANK.x - 92, 668, 0xffd766).setScale(0.52);
  }

  private get cranking() {
    return this.input.activePointer.isDown || this.spaceKey.isDown;
  }

  private showWorkload() {
    const workload = WORKLOADS.find((item) => item.heat === this.heat)!;
    this.workloadText.setText(`RUNNING: ${workload.name}`);
    this.tweens.add({ targets: this.workloadText, scale: { from: 1.3, to: 1 }, duration: 220 });
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.finished) return;
    const seconds = delta / 1000;
    this.clock += delta;

    if (this.cranking && this.holdHint) {
      this.holdHint.destroy();
      this.holdHint = undefined;
    }

    // Every few seconds the computer starts doing something else, which
    // changes how much heat the fan has to carry away.
    if (this.clock >= this.nextWorkloadAt) {
      this.nextWorkloadAt = this.clock + Phaser.Math.Between(3500, 5500);
      this.heat = Phaser.Utils.Array.GetRandom(WORKLOADS.filter((item) => item.heat !== this.heat)).heat;
      this.showWorkload();
    }

    // The fan speeds up while cranked and coasts down when let go. The
    // temperature is a tug of war between the workload's heat and the fan.
    this.fanSpeed = Phaser.Math.Clamp(this.fanSpeed + (this.cranking ? FAN_SPIN_UP : -FAN_SPIN_DOWN) * seconds, 0, 1);
    this.temperature = Phaser.Math.Clamp(this.temperature + (this.heat - FAN_COOLING * this.fanSpeed) * seconds, 0, 1);

    const inGreen = CpuChip.inGreen(this.temperature);
    if (inGreen) this.secondsInGreen += seconds;
    else this.addFrustration(OUT_OF_GREEN_PENALTY * seconds, false); // a steady drain, so no bounce

    this.draw(delta);
    if (this.secondsInGreen >= SECONDS_IN_GREEN_TO_WIN) this.celebrate();
  }

  private draw(delta: number) {
    const state = this.chip.setTemperature(this.temperature);
    this.fan.angle += this.fanSpeed * delta * 1.1;
    this.crank.angle += this.fanSpeed * delta * 0.55;
    // The worker's arm follows the crank handle round.
    this.worker.reach(40 + Math.sin(Phaser.Math.DegToRad(this.crank.angle)) * 32);
    this.worker.setMood(state === 'hot' ? 'ouch' : 'run');

    if (state === 'cool') this.statusText.setText('COOL').setColor(hex(COLORS.green));
    else if (state === 'hot') this.statusText.setText('OVERHEATING!').setColor(hex(COLORS.red));
    else this.statusText.setText('FROZEN!').setColor(hex(CpuChip.FROZEN_BLUE));

    const lit = Math.floor((this.secondsInGreen / SECONDS_IN_GREEN_TO_WIN) * GOAL_SLOTS);
    this.goalSlots.forEach((slot, i) => slot.setFrame(i < lit ? 'blockGreen' : 'blockGrey'));
  }

  private celebrate() {
    this.goalSlots.forEach((slot) => slot.setFrame('blockGreen'));
    this.statusText.setText('COOL').setColor(hex(COLORS.green));
    this.worker.setMood('happy');
    this.tweens.add({ targets: this.worker, y: this.worker.y - 36, duration: 200, yoyo: true, repeat: 3, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.fan, angle: '+=720', duration: 1500, ease: 'Cubic.easeOut' });
    this.win();
  }
}
