import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { Worker, WorkerLook } from '../objects/Worker';
import { MinigameScene } from './MinigameScene';

const STATION_XS = [250, 430, 610, 790, 970];
const WORKER_Y = 600;
const BELT_TOP = 357; // top of the conveyor in the zoomed backdrop
const EXIT_X = 1140;
const BLOCK_SPEED = 150; // pixels per second
const BLOCK_GAP = 58; // closest two blocks can sit
const SPAWN_EVERY = 1150; // milliseconds between new blocks
const BLOCKS_TO_WIN = 14;
const MAX_ASLEEP = 3;
const WIGGLE_TO_WAKE = 420; // pixels of mouse movement over a sleeper that wakes them
const JAM_PENALTY = 0.05; // patience lost each time a new block has no room
const SECONDS_BEFORE_REFRESH = 48;

const LOOKS: WorkerLook[] = [
  { moustache: true },
  { glasses: true, hatTint: 0xff9d8a },
  { toolBelt: true, hatTint: 0x9cc9ff },
  { longHair: true, hatTint: 0x9be7a8 },
  { moustache: true, glasses: true, hatTint: 0xffd766 },
];

interface Station {
  x: number;
  worker: Worker;
  asleep: boolean;
  dozeAt: number; // the moment (on this scene's clock) they next nod off
  wiggle: number; // how far the mouse has been wiggled over them since they dozed off
  notice: Phaser.GameObjects.Container; // the "Not Responding" label over their head
  noticeFill: Phaser.GameObjects.Rectangle; // fills up as they are wiggled awake
}

interface Block {
  image: Phaser.GameObjects.Image;
  passed: number; // how many stations it has got past
}

// Minigame "threads.exe": the computer keeps going to sleep. Five threads pass
// blocks along the data bus, but they keep freezing ("Not Responding"). A block
// cannot get past a frozen thread, so the bus backs up behind them. Wiggle the
// mouse over a sleeper to wake them, just as you would wake a real computer.
// Deliver 14 blocks.
export class WakeWorkersScene extends MinigameScene {
  private stations: Station[] = [];
  private blocks: Block[] = [];
  private goalSlots: Phaser.GameObjects.Image[] = [];
  private hint?: Phaser.GameObjects.Graphics;
  private clock = 0; // milliseconds since this round started
  private nextSpawn = 0;
  private nextAlarm = 0;
  private delivered = 0;

  constructor() {
    super('WakeWorkers');
  }

  create() {
    this.stations = [];
    this.blocks = [];
    this.goalSlots = [];
    this.hint = undefined;
    this.clock = 0;
    this.nextSpawn = 300;
    this.nextAlarm = 11000;
    this.delivered = 0;

    // The same zoomed, dimmed factory backdrop as the other minigames.
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.35).setOrigin(0);

    // Goal meter: one slot per block that has to reach the end of the belt.
    const slotsLeft = GAME_WIDTH / 2 - ((BLOCKS_TO_WIN - 1) * 40) / 2;
    for (let i = 0; i < BLOCKS_TO_WIN; i++) {
      this.goalSlots.push(this.add.image(slotsLeft + i * 40, 112, 'ui', 'blockGrey').setScale(0.36));
    }

    STATION_XS.forEach((x, i) => {
      const worker = new Worker(this, x, WORKER_Y, { ...LOOKS[i], mood: 'work' }).setScale(0.5).setDepth(10);
      const { notice, noticeFill } = this.buildNotice(x);
      this.stations.push({ x, worker, asleep: false, dozeAt: Phaser.Math.Between(3200, 7500), wiggle: 0, notice, noticeFill });
    });
    // The second worker nods off almost at once, so the player meets the problem early.
    this.stations[1].dozeAt = 1300;

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.wiggled(pointer));

    this.openWindow('threads.exe', 'Wiggle the mouse over sleeping threads to wake them up');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
  }

  // ---- Player actions ----

  // Any mouse movement over a sleeping thread counts towards waking them.
  private wiggled(pointer: Phaser.Input.Pointer) {
    if (this.finished) return;
    const station = this.stations.find((s) => s.asleep && Math.abs(pointer.x - s.x) < 80 && pointer.y > WORKER_Y - 250 && pointer.y < WORKER_Y + 20);
    if (!station) return;
    station.wiggle += Phaser.Math.Distance.Between(pointer.x, pointer.y, pointer.prevPosition.x, pointer.prevPosition.y);
    station.noticeFill.setScale(Math.min(1, station.wiggle / WIGGLE_TO_WAKE), 1);
    station.worker.setAngle(Phaser.Math.Between(-4, 4)); // they stir
    if (station.wiggle >= WIGGLE_TO_WAKE) this.wake(station);
  }

  // The label a frozen program gets, with a bar that fills as it wakes.
  private buildNotice(x: number) {
    const text = this.add.text(0, -4, 'Not Responding', { fontFamily: PIXEL_FONT, fontSize: '8px', color: hex(COLORS.navy) }).setOrigin(0.5);
    const plate = this.add.graphics();
    plate.fillStyle(COLORS.navy).fillRoundedRect(-68, -18, 136, 38, 5);
    plate.fillStyle(COLORS.cream).fillRoundedRect(-65, -15, 130, 32, 3);
    plate.fillStyle(0xcfc6ad).fillRect(-58, 5, 116, 7);
    const noticeFill = this.add.rectangle(-58, 5, 116, 7, COLORS.green).setOrigin(0, 0).setScale(0, 1);
    const notice = this.add.container(x, WORKER_Y - 240, [plate, text, noticeFill]).setDepth(20).setVisible(false);
    return { notice, noticeFill };
  }

  private wake(station: Station, bonusAwakeTime = 0) {
    if (this.finished || !station.asleep) return;
    station.asleep = false;
    station.notice.setVisible(false);
    station.worker.setAlpha(1).setAngle(0);
    station.dozeAt = this.clock + this.awakeTime() + bonusAwakeTime;
    this.hint?.destroy();
    this.hint = undefined;

    // A jolt of panic, then back to work.
    station.worker.setMood('panic');
    this.time.delayedCall(380, () => {
      if (!station.asleep && !this.finished) station.worker.setMood('work');
    });
  }

  // How long a worker stays awake. It shrinks as the round goes on.
  private awakeTime() {
    const progress = this.delivered / BLOCKS_TO_WIN;
    return Phaser.Math.Between(Phaser.Math.Linear(3400, 1900, progress), Phaser.Math.Linear(7000, 4200, progress));
  }

  // ---- The round, frame by frame ----

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.finished) return;
    this.clock += delta;

    this.updateSleep();
    this.updateSpawning();
    this.updateBlocks(delta);
    this.updateAlarmClock();
  }

  private updateSleep() {
    let asleepCount = this.stations.filter((station) => station.asleep).length;
    for (const station of this.stations) {
      if (station.asleep || this.clock < station.dozeAt) continue;
      if (asleepCount >= MAX_ASLEEP) {
        station.dozeAt = this.clock + 800; // too many asleep already; try again shortly
        continue;
      }
      station.asleep = true;
      asleepCount++;
      station.wiggle = 0;
      station.noticeFill.setScale(0, 1);
      station.notice.setVisible(true);
      // Faded, like a frozen window.
      station.worker.setAlpha(0.6).setMood('asleep');

      // The very first sleeper gets a ghost cursor wiggling over them, to show what to do.
      if (this.delivered === 0 && !this.hint && station === this.stations[1]) {
        this.hint = this.add.graphics({ x: station.x - 45, y: WORKER_Y - 120 }).setDepth(20);
        this.hint.fillStyle(0xffffff).lineStyle(4, COLORS.navy);
        const arrow = [0, 0, 0, 34, 9, 26, 15, 40, 22, 37, 16, 24, 28, 24].map((n, i, all) => (i % 2 ? null : new Phaser.Math.Vector2(n, all[i + 1]))).filter((point) => point !== null);
        this.hint.fillPoints(arrow, true).strokePoints(arrow, true);
        this.tweens.add({ targets: this.hint, x: station.x + 30, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
  }

  private updateSpawning() {
    if (this.clock < this.nextSpawn) return;
    this.nextSpawn = this.clock + SPAWN_EVERY;

    const last = this.blocks[this.blocks.length - 1];
    const spawnX = -30;
    if (last && last.image.x < spawnX + BLOCK_GAP) {
      // No room: the belt has backed up all the way to the start.
      this.addFrustration(JAM_PENALTY);
      this.cameras.main.shake(120, 0.004);
      const warning = this.add.image(50, BELT_TOP - 30, 'props', 'zap').setScale(0.3).setDepth(20);
      this.tweens.add({ targets: warning, scale: 0.8, alpha: 0, duration: 500, onComplete: () => warning.destroy() });
      return;
    }
    const image = this.add.image(spawnX, BELT_TOP, 'ui', 'blockGreen').setOrigin(0.5, 1).setScale(0.5);
    this.blocks.push({ image, passed: 0 });
  }

  private updateBlocks(delta: number) {
    // Blocks are kept in order, front of the queue first. Each one moves as far
    // as it can without passing a sleeping worker or bumping the block ahead.
    let aheadX = Infinity;
    for (const block of this.blocks) {
      let limit = aheadX - BLOCK_GAP;
      const station = this.stations[block.passed];
      if (station?.asleep) limit = Math.min(limit, station.x);
      block.image.x = Math.max(block.image.x, Math.min(block.image.x + (BLOCK_SPEED * delta) / 1000, limit));

      while (this.stations[block.passed] && !this.stations[block.passed].asleep && block.image.x >= this.stations[block.passed].x) {
        block.passed++;
      }
      aheadX = block.image.x;
    }

    while (this.blocks.length && this.blocks[0].image.x >= EXIT_X) this.deliver(this.blocks.shift()!);
  }

  private deliver(block: Block) {
    const slot = this.goalSlots[this.delivered++];
    block.image.setDepth(50);
    this.tweens.add({
      targets: block.image,
      x: slot.x,
      y: slot.y + 19,
      scale: 0.36,
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        block.image.destroy();
        slot.setFrame('blockGreen').setScale(0.5);
        this.tweens.add({ targets: slot, scale: 0.36, duration: 220, ease: 'Back.easeOut' });
      },
    });
    if (this.delivered >= BLOCKS_TO_WIN) this.celebrate();
  }

  // Now and then an alarm clock drops in. Clicking it wakes everybody at once.
  private updateAlarmClock() {
    if (this.clock < this.nextAlarm) return;
    this.nextAlarm = this.clock + Phaser.Math.Between(11000, 15000);

    const clock = this.add.image(Phaser.Math.Between(320, 980), 652, 'props', 'clock').setScale(0).setDepth(30).setInteractive();
    this.tweens.add({ targets: clock, scale: 0.42, duration: 250, ease: 'Back.easeOut' });
    const ringing = this.tweens.add({ targets: clock, angle: { from: -12, to: 12 }, duration: 70, yoyo: true, repeat: -1 });
    const remove = () => {
      ringing.remove();
      this.tweens.add({ targets: clock, scale: 0, duration: 160, onComplete: () => clock.destroy() });
    };
    clock.once('pointerdown', () => {
      for (const station of this.stations) this.wake(station, 2500);
      this.cameras.main.flash(120, 247, 200, 30);
      remove();
    });
    this.time.delayedCall(3600, () => {
      if (clock.active && clock.scale > 0.4) remove();
    });
  }

  private celebrate() {
    for (const station of this.stations) {
      station.asleep = false;
      station.notice.setVisible(false);
      station.worker.setAlpha(1).setAngle(0).setMood('cheer');
    }
    this.win();
  }
}
