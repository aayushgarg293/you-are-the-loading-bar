import * as Phaser from 'phaser';
import { COLORS, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { PROBLEMS, Problem } from '../data/problems';
import { debugNumber } from '../debug';
import { CrewMember, Point, carrierJob, sleeperJob, stationJob, wandererJob } from '../factory/crew';
import { ErrorDialog } from '../objects/ErrorDialog';
import { HamsterWheel } from '../objects/HamsterWheel';
import { LoadingBar } from '../objects/LoadingBar';
import { NetworkStatus } from '../objects/NetworkStatus';
import { Worker } from '../objects/Worker';

const FLOOR_Y = 606; // where the wheel's stand and the generator touch the floor
const BELT_Y = 428; // top surface of the data bus (the conveyor) painted in the background
const FAN = { x: 63, y: 296 }; // hub of the CPU fan painted on the wall
const BELT_START_X = 400;
const BELT_END_X = 1180;
const BELT_SPEED = 0.05; // pixels per millisecond
const PERCENT_PER_SECOND = 1.6;

// The walkable floor runs from the back wall to the front edge of the screen.
// Workers further back are drawn smaller, which fakes depth.
const FLOOR_BACK_Y = 548;
const FLOOR_FRONT_Y = 700;
const scaleAt = (y: number) => Phaser.Math.Linear(0.32, 0.5, Phaser.Math.Clamp((y - FLOOR_BACK_Y) / (FLOOR_FRONT_Y - FLOOR_BACK_Y), 0, 1));

const PILE: Point = { x: 1130, y: 688 };
const WANDER_SPOTS: Point[] = [
  { x: 640, y: 646 },
  { x: 740, y: 692 },
  { x: 840, y: 620 },
  { x: 960, y: 690 },
  { x: 620, y: 590 },
  { x: 1000, y: 600 },
];
const REPORTER_POST: Point = { x: 408, y: 630 }; // beside the generator
const REPORTER_ALERT: Point = { x: 474, y: 696 }; // where they run to raise the alarm

// Helmet colours. The helmet art is white, so a tint becomes its colour.
const HELMET = { red: 0xff9d8a, yellow: 0xffd766, green: 0x9be7a8, blue: 0x9cc9ff };

// The main screen: the motherboard, where little threads keep the download
// moving. It owns the loading bar and decides when the line is running and
// when it is stuck on a problem.
export class FactoryScene extends Phaser.Scene {
  private bar!: LoadingBar;
  private wheel!: HamsterWheel;
  private generatorGlow!: Phaser.GameObjects.Image;
  private fan!: Phaser.GameObjects.Image;
  private network!: NetworkStatus;
  private powered = false;
  private nameTags: { worker: Worker; tag: Phaser.GameObjects.Container }[] = [];
  private crew: CrewMember[] = [];
  private reporter!: Worker;
  private dialog!: ErrorDialog;
  private alertZone!: Phaser.GameObjects.Zone;
  private beltBlocks: Phaser.GameObjects.Image[] = [];
  private droppedBlocks: Phaser.GameObjects.Image[] = [];
  private progress = 0;
  private problemIndex = 0;
  private running = false;

  constructor() {
    super('Factory');
  }

  create() {
    this.crew = [];
    this.nameTags = [];
    this.beltBlocks = [];
    this.droppedBlocks = [];
    this.problemIndex = 0;
    this.running = false;

    this.add.image(0, 0, 'factory-bg').setOrigin(0);
    // A copy of the painted fan's blades sits exactly on top of it, so it can spin.
    this.fan = this.add.image(FAN.x, FAN.y, 'fan', 'blades');

    this.bar = new LoadingBar(this, GAME_WIDTH / 2, 88).setScale(0.94);
    this.network = new NetworkStatus(this, 70, 1212, 88);
    this.add
      .text(GAME_WIDTH / 2, 14, 'DOWNLOADING  favourite_song.mp3', { fontFamily: PIXEL_FONT, fontSize: '10px', color: hex(COLORS.cream), stroke: hex(COLORS.navy), strokeThickness: 4 })
      .setOrigin(0.5);

    this.addSign(FAN.x, 366, 'CPU FAN');
    this.addSign(178, 630, 'POWER SUPPLY');
    this.addSign(640, 474, 'DATA BUS');
    this.addSign(1190, 392, 'ROUTER');
    this.addSign(PILE.x + 62, 560, 'CACHE');

    // The power supply: hamster wheel plus the generator it drives.
    this.wheel = new HamsterWheel(this, 178, FLOOR_Y - HamsterWheel.FEET_OFFSET * 0.56).setScale(0.56);
    const generator = this.add.image(340, FLOOR_Y + 4, 'wheel', 'generator').setOrigin(0.5, 1).setScale(0.52);
    this.generatorGlow = this.add
      .image(generator.x, generator.y, 'wheel', 'generator')
      .setOrigin(0.5, 1)
      .setScale(0.52)
      .setTint(COLORS.yellow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);

    this.buildPile();
    this.buildCrew();
    this.buildReporter();

    // When a minigame closes it resumes this scene and passes the result here.
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: unknown, result?: { problemId: string; won: boolean }) => {
      this.cameras.main.fadeIn(250, 22, 30, 60);
      if (result?.won) this.onProblemSolved();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME));

    // Test switch: ?progress=17 starts mid-game, with every earlier problem solved.
    const startAt = debugNumber('progress');
    if (startAt !== null) {
      this.problemIndex = PROBLEMS.findIndex((problem) => problem.stallAt > startAt);
      this.setProgress(startAt);
      this.setRunning(true);
    } else {
      this.setProgress(PROBLEMS[0].stallAt);
      this.setRunning(false);
    }
  }

  private get problem(): Problem | undefined {
    return PROBLEMS[this.problemIndex];
  }

  // ---- Building the scene ----

  // A small plaque naming a part of the computer.
  private addSign(x: number, y: number, label: string) {
    const text = this.add.text(0, 1, label, { fontFamily: PIXEL_FONT, fontSize: '8px', color: hex(COLORS.cream) }).setOrigin(0.5);
    const plate = this.add.graphics();
    plate.fillStyle(COLORS.navy, 0.85).fillRoundedRect(-text.width / 2 - 7, -9, text.width + 14, 18, 4);
    return this.add.container(x, y, [plate, text]);
  }

  // A name tag that floats over a worker's head (see updateCrew).
  private addNameTag(worker: Worker, name: string) {
    this.nameTags.push({ worker, tag: this.addSign(worker.x, worker.y, name) });
    return worker;
  }

  // The cache: a heap of downloaded blocks waiting to be carried to the data bus.
  private buildPile() {
    const rows = [3, 2, 1];
    rows.forEach((count, row) => {
      for (let i = 0; i < count; i++) {
        const x = PILE.x + 62 + (i - (count - 1) / 2) * 44;
        this.add.image(x, PILE.y + 14 - row * 40, 'ui', 'blockGreen').setOrigin(0.5, 1).setScale(0.42).setDepth(PILE.y + 14);
      }
    });
  }

  private buildCrew() {
    const hire = (name: string, at: Point, look = {}) => this.addNameTag(new Worker(this, at.x, at.y, look), name);

    // Two stations along the back wall. When the line stops they blame each other.
    const tenderSpot = { x: 700, y: 550 };
    const operatorSpot = { x: 850, y: 552 };
    this.crew.push(
      stationJob(hire('thread_01', tenderSpot, { moustache: true }), 'angry', operatorSpot),
      stationJob(hire('thread_02', operatorSpot, { glasses: true, hatTint: HELMET.red }), 'angry', tenderSpot),
      // A daemon is a program that sits in the background; ours sleeps there.
      sleeperJob(hire('daemon', { x: 1212, y: 556 }, { moustache: true, hatTint: HELMET.yellow })),
      // A zombie process has finished but never left. It just wanders about.
      wandererJob(this, hire('zombie', WANDER_SPOTS[0], { longHair: true }), WANDER_SPOTS, 'dizzy'),
      wandererJob(this, hire('idle.exe', WANDER_SPOTS[3], { glasses: true, hatTint: HELMET.green }), WANDER_SPOTS, 'tired'),
    );

    // Two carriers on slightly different routes so they don't walk in lockstep.
    const routes = [
      { pile: { x: PILE.x - 20, y: PILE.y }, drop: { x: 452, y: 556 } },
      { pile: { x: PILE.x - 70, y: PILE.y - 40 }, drop: { x: 520, y: 566 } },
    ];
    const starts = [{ x: 1050, y: 636 }, { x: 830, y: 700 }];
    routes.forEach((route, i) => {
      const worker = hire(`thread_0${i + 3}`, starts[i], i === 0 ? { toolBelt: true, hatTint: HELMET.blue } : { toolBelt: true, hatTint: HELMET.red });
      this.crew.push(
        carrierJob(
          this,
          worker,
          route,
          i === 0 ? 'panic' : 'dizzy',
          (from) => this.throwOntoBelt(from),
          (at) => this.dropOnFloor(at),
        ),
      );
    });
  }

  // The scheduler decides what the computer does next, so they are the one
  // who runs up to report each problem, holding an error dialog.
  private buildReporter() {
    this.reporter = this.addNameTag(new Worker(this, REPORTER_POST.x, REPORTER_POST.y), 'scheduler');
    this.dialog = new ErrorDialog(this, REPORTER_ALERT.x + 150, REPORTER_ALERT.y - 310).setDepth(2000);
    this.dialog.on('pointerdown', () => this.openMinigame());
    this.dialog.on('pointerover', () => this.dialog.setScale(1.06));
    this.dialog.on('pointerout', () => this.dialog.setScale(1));

    // Clicking the scheduler works too.
    this.alertZone = this.add.zone(REPORTER_ALERT.x, REPORTER_ALERT.y - 90, 130, 200).setInteractive({ useHandCursor: true });
    this.alertZone.on('pointerdown', () => this.openMinigame());
  }

  // ---- Running and stalling ----

  // Switches the whole factory between "line running" and "stuck".
  private setRunning(running: boolean) {
    this.running = running;
    const needsPlayer = !running && !!this.problem?.scene;

    // Only some problems cut the power; otherwise the hamster keeps running.
    const powered = (this.powered = running || !this.problem?.powerOut);
    this.network.setOnline(running);
    this.wheel.setSpeed(powered ? 1 : 0);
    this.wheel.hamster.setMood(powered ? 'run' : 'tired');
    this.tweens.killTweensOf(this.generatorGlow);
    this.generatorGlow.setAlpha(0);
    if (powered) this.tweens.add({ targets: this.generatorGlow, alpha: 0.75, duration: 240, yoyo: true, repeat: -1 });

    for (const member of this.crew) member.setRunning(running);

    // Some problems put the whole crew in one mood (for example, all asleep).
    const crewMood = running ? undefined : this.problem?.crewMood;
    if (crewMood) {
      for (const member of this.crew) {
        member.stareAt = undefined;
        if (member.worker.mood !== crewMood) member.worker.setMood(crewMood);
      }
    }

    // The error dialog says what is wrong.
    if (this.problem?.error) this.dialog.show(this.problem.error);

    if (running) {
      // Blocks dropped in the panic are quietly tidied away.
      for (const block of this.droppedBlocks) this.tweens.add({ targets: block, alpha: 0, duration: 400, onComplete: () => block.destroy() });
      this.droppedBlocks = [];
    }

    // The reporter runs to the front to raise the alarm, or back to the wheel.
    this.showAlert(false);
    this.reporter.setMood(running ? 'idle' : 'panic');
    const goal = needsPlayer ? REPORTER_ALERT : REPORTER_POST;
    this.reporter.walkTo(goal.x, goal.y, 260, () => {
      if (this.running !== running) return; // the state flipped again while walking
      this.reporter.setMood(needsPlayer ? 'panic' : running ? 'happy' : 'tired');
      this.showAlert(needsPlayer);
    });
  }

  // Shows or hides the error dialog, and switches its click targets with it.
  private showAlert(visible: boolean) {
    this.dialog.setVisible(visible).setScale(1);
    if (visible) {
      this.dialog.setInteractive({ useHandCursor: true });
      this.alertZone.setInteractive({ useHandCursor: true });
    } else {
      this.dialog.disableInteractive();
      this.alertZone.disableInteractive();
    }
  }

  private openMinigame() {
    const problem = this.problem;
    if (this.running || !problem?.scene || this.scene.isActive(problem.scene)) return;
    this.showAlert(false);
    this.cameras.main.fadeOut(200, 22, 30, 60);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.launch(problem.scene!, { problemId: problem.id });
      this.scene.pause();
    });
  }

  private onProblemSolved() {
    this.problemIndex++;
    // Everyone cheers for a moment, then gets back to work.
    this.showAlert(false);
    for (const { worker } of this.crew) {
      worker.stopWalking();
      if (worker.mood !== 'asleep') worker.setMood('cheer');
    }
    this.reporter.setMood('cheer');
    this.time.delayedCall(1500, () => this.setRunning(true));
  }

  // ---- Blocks ----

  // A carrier lobs a block up onto the start of the conveyor.
  private throwOntoBelt(from: Point) {
    const block = this.add.image(from.x, from.y, 'ui', 'blockGreen').setOrigin(0.5, 1).setScale(0.36).setDepth(BELT_Y);
    this.tweens.add({ targets: block, x: BELT_START_X, duration: 420, ease: 'Linear' });
    this.tweens.add({
      targets: block,
      y: BELT_Y,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => this.beltBlocks.push(block),
    });
  }

  // A startled carrier lets go of their block.
  private dropOnFloor(at: Point) {
    const block = this.add.image(at.x, at.y - 60, 'ui', 'blockGreen').setOrigin(0.5, 1).setScale(0.36).setDepth(at.y);
    this.tweens.add({ targets: block, y: at.y, angle: 18, duration: 320, ease: 'Bounce.easeOut' });
    this.droppedBlocks.push(block);
  }

  private setProgress(percent: number) {
    this.progress = percent;
    this.bar.setPercent(percent);
    while (this.bar.filledSlots < LoadingBar.slotsFor(percent)) this.deliverBlock();
  }

  // A block leaves the end of the conveyor and flies up into the next slot.
  private deliverBlock() {
    const target = this.bar.slotPosition(this.bar.filledSlots);
    this.bar.fillNextSlot();
    const flyer = this.add.image(BELT_END_X, BELT_Y - 20, 'ui', 'blockGreen').setScale(0.36).setDepth(3000);
    this.tweens.add({ targets: flyer, x: target.x, y: target.y, scale: 0.47, duration: 420, ease: 'Cubic.easeIn', onComplete: () => flyer.destroy() });
  }

  // ---- Every frame ----

  update(_time: number, delta: number) {
    this.updateCrew();
    if (this.powered) this.fan.angle += delta * 0.7;
    if (!this.running) return;

    for (const block of this.beltBlocks) block.x += delta * BELT_SPEED;
    const arrived = this.beltBlocks.filter((block) => block.x > BELT_END_X);
    for (const block of arrived) block.destroy();
    if (arrived.length) this.beltBlocks = this.beltBlocks.filter((block) => block.x <= BELT_END_X);

    const limit = this.problem?.stallAt ?? 100;
    this.setProgress(Math.min(limit, this.progress + (PERCENT_PER_SECOND * delta) / 1000));
    if (this.progress >= limit) {
      this.setRunning(false);
      if (!this.problem?.scene) this.showToBeContinued();
    }
  }

  // Keeps every worker the right size and layer for where they stand, and
  // makes anyone standing still watch the cursor (their boss).
  private updateCrew() {
    const pointer = this.input.activePointer;
    const workers = [...this.crew.map((member) => member.worker), this.reporter];
    workers.forEach((worker, i) => {
      worker.setScale(scaleAt(worker.y)).setDepth(worker.y);
      if (worker.isWalking) return;
      const stare = this.crew[i]?.stareAt;
      if (stare) worker.lookToward(stare.x, stare.y);
      else worker.lookToward(pointer.x, pointer.y);
    });
    // Name tags ride just above each helmet.
    for (const { worker, tag } of this.nameTags) tag.setPosition(worker.x, worker.y - 438 * worker.scaleY).setDepth(worker.depth);
  }

  private showToBeContinued() {
    const banner = this.add
      .text(GAME_WIDTH / 2, 250, 'TO BE CONTINUED...', {
        fontFamily: PIXEL_FONT,
        fontSize: '36px',
        color: hex(COLORS.cream),
        stroke: hex(COLORS.navy),
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(4000)
      .setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 400, ease: 'Back.easeOut' });
  }
}
