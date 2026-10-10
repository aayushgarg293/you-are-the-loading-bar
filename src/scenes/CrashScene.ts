import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { CpuChip } from '../objects/CpuChip';
import { HamsterWheel } from '../objects/HamsterWheel';
import { SideWorker } from '../objects/SideWorker';
import { Worker } from '../objects/Worker';
import { MinigameScene } from './MinigameScene';

const ROUND_SECONDS = 6;
const FAIL_PENALTY = 0.2; // patience lost for each round that is not finished in time
const SECONDS_BEFORE_CRASH = 100; // the blue screen also creeps up slowly by itself
const BLUE = 0x0a5fd8;
const FLOOR_Y = 640;

interface Round {
  prompt: string;
  instruction: string;
  build: () => void;
}

// Minigame "system.exe", the finale: everything breaks at once. Seven tiny
// versions of the earlier minigames come one after another, about six seconds
// each. A blue screen creeps up from the bottom as patience runs out; if it
// covers the screen the computer crashes and the round starts again.
//
// Each round builds its own props and listeners, registers them with keep()
// and listen(), and calls pass() or fail(). Clearing a round destroys
// everything it registered, so rounds cannot leak into each other.
export class CrashScene extends MinigameScene {
  private rounds: Round[] = [];
  private roundIndex = 0;
  private timeLeft = 0; // milliseconds left in this round
  private between = false; // true during the short pause between rounds
  private props: Phaser.GameObjects.GameObject[] = [];
  private cleanups: (() => void)[] = [];
  private roundUpdate?: (seconds: number) => void;
  private promptText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private blueScreen!: Phaser.GameObjects.Rectangle;
  private blueLabel!: Phaser.GameObjects.Text;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Crash');
  }

  create() {
    this.props = [];
    this.cleanups = [];
    this.roundUpdate = undefined;
    this.between = false;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.7).setOrigin(0);

    const text = (size: number, colour: number) => ({ fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour), stroke: hex(COLORS.navy), strokeThickness: 8 });
    this.promptText = this.add.text(GAME_WIDTH / 2, 150, '', text(34, COLORS.yellow)).setOrigin(0.5).setDepth(700);
    this.counterText = this.add.text(GAME_WIDTH - 40, 64, '', text(12, COLORS.cream)).setOrigin(1, 0.5).setDepth(700);
    this.add.rectangle(GAME_WIDTH / 2, 102, 426, 16, COLORS.navy).setDepth(700);
    this.timerBar = this.add.rectangle(GAME_WIDTH / 2 - 210, 102, 420, 10, COLORS.yellow).setOrigin(0, 0.5).setDepth(700);

    // The blue screen is a rectangle anchored to the bottom edge that grows upwards.
    this.blueScreen = this.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, GAME_HEIGHT, BLUE, 0.6).setOrigin(0, 1).setScale(1, 0).setDepth(800);
    this.blueLabel = this.add.text(20, GAME_HEIGHT, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffffff' }).setOrigin(0, 1).setDepth(801);

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.rounds = [
      { prompt: 'FEED!', instruction: 'Drag 2 seeds to the hamster', build: () => this.buildFeed() },
      { prompt: 'WAKE UP!', instruction: 'Wiggle the mouse over the sleeping threads', build: () => this.buildWake() },
      { prompt: 'CONNECT!', instruction: 'Click tiles until the trace runs straight across', build: () => this.buildConnect() },
      { prompt: 'DELETE!', instruction: 'Click every virus', build: () => this.buildDelete() },
      { prompt: 'DODGE!', instruction: 'Up and Down arrow keys: dodge the junk', build: () => this.buildDodge() },
      { prompt: 'COOL DOWN!', instruction: 'Hold the mouse button, then feather it to rest the needle in the green', build: () => this.buildCool() },
      { prompt: 'ZIP!', instruction: 'Tap the Left and Right arrow keys in turn', build: () => this.buildZip() },
    ];

    this.openWindow('system.exe', '');
    this.startFrustration(SECONDS_BEFORE_CRASH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
    this.startRound(0);
  }

  // ---- Running the rounds ----

  // Registers a prop so it is destroyed when the round ends.
  private keep<T extends Phaser.GameObjects.GameObject>(prop: T) {
    this.props.push(prop);
    return prop;
  }

  // Adds an event listener that is removed again when the round ends.
  private listen(emitter: Phaser.Events.EventEmitter, event: string, handler: (...args: any[]) => void) {
    emitter.on(event, handler);
    this.cleanups.push(() => emitter.off(event, handler));
  }

  private clearRound() {
    // Stop tweens on a prop and on everything inside it (puppets are containers of parts).
    const stopTweens = (object: Phaser.GameObjects.GameObject) => {
      this.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(stopTweens);
    };
    for (const prop of this.props) {
      stopTweens(prop);
      prop.destroy();
    }
    for (const cleanup of this.cleanups) cleanup();
    this.props = [];
    this.cleanups = [];
    this.roundUpdate = undefined;
  }

  private startRound(index: number) {
    this.clearRound();
    if (index >= this.rounds.length) return this.celebrate();
    const round = this.rounds[index];
    this.roundIndex = index;
    this.between = false;
    this.timeLeft = ROUND_SECONDS * 1000;
    this.promptText.setText(round.prompt).setColor(hex(COLORS.yellow));
    this.tweens.add({ targets: this.promptText, scale: { from: 1.6, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.counterText.setText(`${index + 1}/${this.rounds.length}`);
    this.setInstruction(round.instruction);
    round.build();
  }

  private pass() {
    this.endRound('OK!', COLORS.green);
  }

  private fail(message = 'TOO SLOW!') {
    if (this.between || this.finished) return;
    this.addFrustration(FAIL_PENALTY);
    this.cameras.main.shake(200, 0.01);
    this.endRound(message, COLORS.red);
  }

  // Freezes the round for a moment with a verdict, then moves on.
  private endRound(verdict: string, colour: number) {
    if (this.between || this.finished) return;
    this.between = true;
    this.roundUpdate = undefined;
    this.promptText.setText(verdict).setColor(hex(colour));
    this.time.delayedCall(550, () => {
      if (!this.finished) this.startRound(this.roundIndex + 1);
    });
  }

  update(time: number, delta: number) {
    // The blue screen is as tall as the patience meter is full.
    this.blueScreen.setScale(1, this.finished ? this.blueScreen.scaleY : this.patienceLost);
    this.blueLabel.setY(GAME_HEIGHT - this.blueScreen.scaleY * GAME_HEIGHT - 6).setText(this.patienceLost > 0.08 ? `:(  CRASHING... ${Math.floor(this.patienceLost * 100)}%` : '');

    super.update(time, delta);
    if (this.finished || this.between) return;

    this.timeLeft -= delta;
    this.timerBar.setScale(Math.max(0, this.timeLeft / (ROUND_SECONDS * 1000)), 1);
    this.roundUpdate?.(delta / 1000);
    if (this.timeLeft <= 0) this.fail();
  }

  // Replaces the usual REFRESH stamp: the full blue screen of death, a fake
  // restart counter, and then the finale starts again.
  protected outOfPatience() {
    this.finished = true;
    this.clearRound();
    this.cameras.main.shake(300, 0.015);
    const white = (size: number) => ({ fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: '#ffffff', lineSpacing: 12 });
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, BLUE).setOrigin(0).setDepth(1000);
    this.add.text(150, 150, ':(', white(110)).setDepth(1001);
    this.add.text(150, 340, 'Your download ran into a problem\nand needs to restart.', white(20)).setDepth(1001);
    const percent = this.add.text(150, 450, '0% complete', white(20)).setDepth(1001);
    this.add.text(150, 540, 'Stop code: TOO_MANY_THINGS_BROKE_AT_ONCE', white(10)).setDepth(1001);
    this.tweens.addCounter({ from: 0, to: 100, duration: 2400, onUpdate: (tween) => percent.setText(`${Math.floor(tween.getValue() ?? 0)}% complete`) });
    this.time.delayedCall(3000, () => this.scene.restart({ problemId: this.problemId }));
  }

  private celebrate() {
    this.promptText.setText('CRASH AVERTED!').setColor(hex(COLORS.green));
    this.setInstruction('Phew.');
    this.timerBar.setVisible(false);
    this.win(); // sets `finished`, which freezes the blue screen where it is ...
    this.tweens.add({ targets: this.blueScreen, scaleY: 0, duration: 500, ease: 'Quad.easeIn' }); // ... so it can drain away
  }

  // A key cap with an arrow pointing in direction (dx, dy).
  private keyCap(x: number, y: number, dx: number, dy: number) {
    const cap = this.keep(this.add.graphics({ x, y }));
    cap.fillStyle(COLORS.navy).fillRoundedRect(-30, -30, 60, 60, 10);
    cap.fillStyle(COLORS.cream).fillRoundedRect(-25, -27, 50, 48, 7);
    cap.fillStyle(COLORS.navy).fillTriangle(dx * 13, dy * 13, -dx * 9 - dy * 12, -dy * 9 - dx * 12, -dx * 9 + dy * 12, -dy * 9 + dx * 12);
    return cap;
  }

  // ---- The seven rounds ----

  // 1. power.exe: drag two seeds from the sack to the hamster.
  private buildFeed() {
    const wheel = this.keep(new HamsterWheel(this, 420, FLOOR_Y - HamsterWheel.FEET_OFFSET * 0.8).setScale(0.8));
    wheel.hamster.setMood('tired');
    wheel.setSpeed(0);
    const sack = this.keep(this.add.image(900, FLOOR_Y + 20, 'feeding', 'sack').setOrigin(0.5, 1)).setInteractive({ useHandCursor: true });
    let held: Phaser.GameObjects.Image | undefined;
    let fed = 0;

    sack.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!held && !this.between) held = this.keep(this.add.image(pointer.x, pointer.y, 'feeding', 'seed').setScale(0.42).setDepth(10));
    });
    this.listen(this.input, 'pointermove', (pointer: Phaser.Input.Pointer) => held?.setPosition(pointer.x, pointer.y));
    this.listen(this.input, 'pointerup', () => {
      if (!held) return;
      const mouth = wheel.mouthPosition;
      const reached = Phaser.Math.Distance.Between(held.x, held.y, mouth.x, mouth.y) < 140;
      held.destroy();
      held = undefined;
      if (!reached) return;
      wheel.hamster.gulp();
      if (++fed >= 2) {
        wheel.hamster.setMood('run');
        wheel.setSpeed(1.6);
        this.pass();
      }
    });
  }

  // 2. threads.exe: wiggle the mouse over three frozen threads.
  private buildWake() {
    const tints = [0x9cc9ff, 0xff9d8a, 0xffd766];
    const sleepers = [400, 640, 880].map((x, i) => ({
      x,
      wiggle: 0,
      awake: false,
      worker: this.keep(new Worker(this, x, FLOOR_Y, { mood: 'asleep', hatTint: tints[i] }).setScale(0.55).setAlpha(0.6)),
    }));
    this.listen(this.input, 'pointermove', (pointer: Phaser.Input.Pointer) => {
      const sleeper = sleepers.find((s) => !s.awake && Math.abs(pointer.x - s.x) < 90 && pointer.y > FLOOR_Y - 270);
      if (!sleeper || this.between) return;
      sleeper.wiggle += Phaser.Math.Distance.Between(pointer.x, pointer.y, pointer.prevPosition.x, pointer.prevPosition.y);
      if (sleeper.wiggle < 260) return;
      sleeper.awake = true;
      sleeper.worker.setAlpha(1).setMood('happy');
      if (sleepers.every((s) => s.awake)) this.pass();
    });
  }

  // 3. network.exe: four straight tiles; click the ones lying the wrong way.
  private buildConnect() {
    const size = 120;
    const y = 420;
    const left = GAME_WIDTH / 2 - size * 2;
    this.keep(this.add.image(left - 130, y - 26, 'connection', 'router').setScale(0.7));
    this.keep(this.add.image(left + size * 4 + 110, y, 'connection', 'port').setScale(0.7));

    const turns = Phaser.Utils.Array.Shuffle([1, 1, Phaser.Math.Between(0, 1), Phaser.Math.Between(0, 1)]);
    const tiles = turns.map((turn, i) => {
      const panel = this.add.image(0, 0, 'connection', 'tile').setDisplaySize(size - 6, size - 6).setTint(0x9fd9ab).setInteractive({ useHandCursor: true });
      const trace = this.add.graphics();
      const view = this.keep(this.add.container(left + i * size + size / 2, y, [panel, trace])).setAngle(turn * 90);
      return { panel, trace, view, turn };
    });

    // The signal runs from the left until it meets a tile lying the wrong way.
    const redraw = () => {
      let live = true;
      for (const tile of tiles) {
        live = live && tile.turn % 2 === 0;
        tile.trace.clear().lineStyle(26, COLORS.navy).lineBetween(-size / 2, 0, size / 2, 0);
        tile.trace.lineStyle(14, live ? COLORS.yellow : 0x7a6a3c).lineBetween(-size / 2, 0, size / 2, 0);
      }
      return live;
    };
    for (const tile of tiles) {
      tile.panel.on('pointerdown', () => {
        if (this.between) return;
        tile.view.setAngle(++tile.turn * 90);
        if (redraw()) this.pass();
      });
    }
    redraw();
  }

  // 4. antivirus.exe: click four scuttling viruses.
  private buildDelete() {
    this.keep(this.add.image(GAME_WIDTH / 2, FLOOR_Y + 30, 'antivirus', 'recycleBin').setOrigin(0.5, 1).setScale(0.6));
    const spot = () => ({ x: Phaser.Math.Between(240, 1040), y: Phaser.Math.Between(250, 520) });
    let left = 4;
    for (let i = 0; i < left; i++) {
      const virus = this.keep(this.add.image(spot().x, spot().y, 'antivirus', 'virus')).setDisplaySize(104, 100).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: virus, ...spot(), duration: Phaser.Math.Between(700, 1100), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      virus.once('pointerdown', () => {
        if (this.between) return;
        virus.disableInteractive();
        this.tweens.killTweensOf(virus);
        this.tweens.add({ targets: virus, x: GAME_WIDTH / 2, y: FLOOR_Y - 110, scale: 0, angle: 300, duration: 260 });
        if (--left === 0) this.pass();
      });
    }
  }

  // 5. packets.exe: three waves of junk, each leaving one cable clear.
  private buildDodge() {
    const lanes = [330, 460, 590];
    const speed = 560;
    const runnerX = 250;
    for (const y of lanes) {
      for (let x = 0; x < GAME_WIDTH; x += 162) this.keep(this.add.image(x, y - 8, 'packets', 'cable').setOrigin(0, 0));
    }
    let lane = 1;
    const runner = this.keep(new SideWorker(this, runnerX, lanes[lane], 0x9cc9ff).setScale(0.38).setDepth(30));
    runner.carry('ui', 'blockGreen', 92).setRunning(true);
    this.keyCap(runnerX + 130, lanes[0] - 60, 0, -1);
    this.keyCap(runnerX + 130, lanes[0] - 0, 0, 1);

    const junk: { image: Phaser.GameObjects.Image; lane: number }[] = [];
    let clear = 1;
    for (let wave = 0; wave < 3; wave++) {
      clear = Phaser.Utils.Array.GetRandom([0, 1, 2].filter((l) => l !== clear)); // never the lane that was clear last time
      for (const l of [0, 1, 2].filter((other) => other !== clear)) {
        const frame = Phaser.Utils.Array.GetRandom(['popup', 'spam', 'cookie', 'sign404']);
        const image = this.keep(this.add.image(GAME_WIDTH + 150 + wave * 620, lanes[l] + 4, 'packets', frame).setOrigin(0.5, 1).setDepth(20 + l));
        junk.push({ image: image.setScale(88 / image.height), lane: l });
      }
    }

    const move = (step: number) => {
      if (this.between) return;
      lane = Phaser.Math.Clamp(lane + step, 0, 2);
      runner.setY(lanes[lane]);
    };
    const keyboard = this.input.keyboard!;
    this.listen(keyboard, 'keydown-UP', () => move(-1));
    this.listen(keyboard, 'keydown-W', () => move(-1));
    this.listen(keyboard, 'keydown-DOWN', () => move(1));
    this.listen(keyboard, 'keydown-S', () => move(1));

    this.roundUpdate = (seconds) => {
      for (const item of junk) item.image.x -= speed * seconds;
      if (junk.some((item) => item.lane === lane && Math.abs(item.image.x - (runnerX + 50)) < 60)) {
        runner.setMood('ouch').setRunning(false);
        this.fail('OUCH!');
      } else if (junk.every((item) => item.image.x < runnerX - 80)) {
        runner.setMood('happy');
        this.pass();
      }
    };
  }

  // 6. cpu.exe: bring the needle down into the green and keep it there a moment.
  private buildCool() {
    const chip = this.keep(new CpuChip(this, GAME_WIDTH / 2, 440).setScale(0.9));
    const fan = this.keep(this.add.image(1000, 420, 'cpu', 'fan'));
    let temperature = 0.95;
    let inGreen = 0;
    this.roundUpdate = (seconds) => {
      const cranking = this.input.activePointer.isDown || this.spaceKey.isDown;
      temperature = Phaser.Math.Clamp(temperature + (cranking ? -0.45 : 0.3) * seconds, 0, 1);
      chip.setTemperature(temperature);
      if (cranking) fan.angle += seconds * 700;
      if (CpuChip.inGreen(temperature)) inGreen += seconds;
      if (inGreen >= 1.3) this.pass();
    };
  }

  // 7. zip.exe: twelve alternating taps squash the folder shut.
  private buildZip() {
    const taps = 12;
    const folder = this.keep(this.add.image(GAME_WIDTH / 2, FLOOR_Y, 'zip', 'folderFull').setOrigin(0.5, 1).setScale(1.3));
    const keys = { left: this.keyCap(GAME_WIDTH / 2 - 300, 520, -1, 0), right: this.keyCap(GAME_WIDTH / 2 + 300, 520, 1, 0) };
    let next: 'left' | 'right' = 'left';
    let count = 0;
    const showNext = () => {
      keys.left.setAlpha(next === 'left' ? 1 : 0.35);
      keys.right.setAlpha(next === 'right' ? 1 : 0.35);
    };
    const press = (side: 'left' | 'right') => {
      if (this.between || side !== next) return;
      next = side === 'left' ? 'right' : 'left';
      showNext();
      folder.setScale(1.3, 1.3 * Phaser.Math.Linear(1, 0.62, ++count / taps));
      if (count < taps) return;
      folder.setTexture('zip', 'folderZipped').setScale(1.3);
      this.pass();
    };
    const keyboard = this.input.keyboard!;
    this.listen(keyboard, 'keydown-LEFT', () => press('left'));
    this.listen(keyboard, 'keydown-A', () => press('left'));
    this.listen(keyboard, 'keydown-RIGHT', () => press('right'));
    this.listen(keyboard, 'keydown-D', () => press('right'));
    showNext();
  }
}
