import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { music, sfx } from '../audio/sound';

const METER_WIDTH = 420;
const TITLE_BAR = 32;
const STATUS_BAR = 26;
const WINDOW_BLUE = 0x2f6fdb;
const CHROME_DEPTH = 900; // the window frame sits above the game, below the REFRESH stamp
const GLITCH_FROM = 0.65; // how full the meter is before the picture starts to glitch
const GLITCH_COLOURS = [0x00e5ff, 0xff3df2, 0xffffff];

// Every minigame extends this. It supplies the shared rules:
//   - a window frame, as if the minigame were a program on the computer
//   - a frustration meter (the person outside the computer losing patience)
//   - win(): celebrate, then hand control back to the factory
//   - the picture glitches as patience runs out
//   - if the meter fills, they hit REFRESH and the minigame starts over
// A minigame only has to build its own screen and call win() when solved.
export abstract class MinigameScene extends Phaser.Scene {
  protected problemId = '';
  protected finished = false;
  private frustration = 0;
  private frustrationPerSecond = 0;
  private meterFill?: Phaser.GameObjects.Rectangle;
  private meterFace?: Phaser.GameObjects.Container;
  private instructionText?: Phaser.GameObjects.Text;

  init(data: { problemId?: string }) {
    this.problemId = data?.problemId ?? '';
    this.finished = false;
    this.frustration = 0;
    this.frustrationPerSecond = 0;
  }

  // Frames the screen as a program window: a title bar across the top with the
  // program's name, and a status bar along the bottom saying what to do.
  protected openWindow(title: string, instruction: string) {
    music.play('hurry');
    const frame = this.add.graphics().setDepth(CHROME_DEPTH);
    frame.fillStyle(COLORS.navy).fillRect(0, 0, GAME_WIDTH, TITLE_BAR + 4);
    frame.fillStyle(WINDOW_BLUE).fillRect(4, 4, GAME_WIDTH - 8, TITLE_BAR - 4);
    frame.fillStyle(COLORS.navy).fillRect(0, GAME_HEIGHT - STATUS_BAR - 4, GAME_WIDTH, STATUS_BAR + 4);
    frame.fillStyle(COLORS.cream).fillRect(4, GAME_HEIGHT - STATUS_BAR, GAME_WIDTH - 8, STATUS_BAR - 4);
    frame.fillStyle(COLORS.navy).fillRect(0, 0, 4, GAME_HEIGHT).fillRect(GAME_WIDTH - 4, 0, 4, GAME_HEIGHT);

    // Minimise, maximise and close buttons (just for show).
    const symbols = ['_', 'o', 'x'];
    symbols.forEach((symbol, i) => {
      const x = GAME_WIDTH - 26 - (symbols.length - 1 - i) * 28;
      frame.fillStyle(COLORS.navy).fillRect(x - 12, 7, 24, 22);
      frame.fillStyle(symbol === 'x' ? COLORS.red : COLORS.cream).fillRect(x - 10, 9, 20, 18);
      this.add.text(x + 1, symbol === '_' ? 15 : 18, symbol, { fontFamily: PIXEL_FONT, fontSize: '10px', color: hex(COLORS.navy) }).setOrigin(0.5).setDepth(CHROME_DEPTH);
    });

    this.add.text(16, TITLE_BAR / 2 + 3, title, { fontFamily: PIXEL_FONT, fontSize: '12px', color: hex(COLORS.cream) }).setOrigin(0, 0.5).setDepth(CHROME_DEPTH);
    this.instructionText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - STATUS_BAR / 2 - 1, instruction, { fontFamily: PIXEL_FONT, fontSize: '10px', color: hex(COLORS.navy) })
      .setOrigin(0.5)
      .setDepth(CHROME_DEPTH);
  }

  // Changes the line in the status bar.
  protected setInstruction(instruction: string) {
    this.instructionText?.setText(instruction);
  }

  // How much patience has gone, from 0 (calm) to 1 (about to refresh).
  protected get patienceLost() {
    return this.frustration;
  }

  // Draws the meter and starts it filling. It is full after `seconds`.
  protected startFrustration(seconds: number) {
    const x = GAME_WIDTH / 2 - METER_WIDTH / 2;
    const y = 64;
    this.add.rectangle(x - 6, y, METER_WIDTH + 12, 34, COLORS.navy).setOrigin(0, 0.5).setDepth(CHROME_DEPTH);
    this.add.rectangle(x, y, METER_WIDTH, 22, 0x2c365e).setOrigin(0, 0.5).setDepth(CHROME_DEPTH);
    this.meterFill = this.add.rectangle(x, y, METER_WIDTH, 22, COLORS.red).setOrigin(0, 0.5).setScale(0, 1).setDepth(CHROME_DEPTH);

    // A tiny angry face riding the end of the meter.
    this.meterFace = this.add.container(x, y, [
      this.add.circle(0, 0, 26, COLORS.skin).setStrokeStyle(4, COLORS.navy),
      this.add.image(0, -5, 'faces', 'eyesAngry').setScale(0.5),
      this.add.image(0, 12, 'faces', 'mouthFrown').setScale(0.45),
    ]);
    this.meterFace.setDepth(CHROME_DEPTH);
    this.frustrationPerSecond = 1 / seconds;
  }

  // A mistake costs patience: `fraction` of the whole meter at once. The face
  // on the meter jumps, unless `bounce` is false (for a slow, steady drain).
  protected addFrustration(fraction: number, bounce = true) {
    this.frustration = Math.min(1, this.frustration + fraction);
    if (bounce) sfx.ouch();
    if (bounce && this.meterFace) this.tweens.add({ targets: this.meterFace, scale: 1.5, duration: 90, yoyo: true });
  }

  update(_time: number, delta: number) {
    if (this.finished || !this.meterFill || !this.meterFace) return;
    this.frustration = Math.min(1, this.frustration + (this.frustrationPerSecond * delta) / 1000);
    this.meterFill.setScale(this.frustration, 1);
    this.meterFace.x = this.meterFill.x + METER_WIDTH * this.frustration;
    // The face shakes harder as patience runs out.
    this.meterFace.angle = Math.sin(this.time.now / 40) * 12 * this.frustration;
    if (this.frustration > GLITCH_FROM && Math.random() < (this.frustration - GLITCH_FROM) * 0.5) this.glitch();
    if (this.frustration >= 1) this.outOfPatience();
  }

  // One torn strip of picture, gone again a moment later.
  private glitch() {
    sfx.glitch();
    const strip = this.add
      .rectangle(Phaser.Math.Between(-80, 80), Phaser.Math.Between(TITLE_BAR, GAME_HEIGHT - STATUS_BAR), GAME_WIDTH, Phaser.Math.Between(3, 16), Phaser.Utils.Array.GetRandom(GLITCH_COLOURS), 0.4)
      .setOrigin(0, 0.5)
      .setDepth(CHROME_DEPTH - 1);
    this.time.delayedCall(Phaser.Math.Between(40, 90), () => strip.destroy());
  }

  protected win() {
    if (this.finished) return;
    this.finished = true;
    music.stop();
    sfx.win();
    this.cameras.main.flash(250, 74, 222, 128);
    this.time.delayedCall(1700, () => {
      this.cameras.main.fadeOut(250, 22, 30, 60);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop();
        if (this.scene.isPaused('Factory')) this.scene.resume('Factory', { problemId: this.problemId, won: true });
        else this.scene.start('Factory');
      });
    });
  }

  // The meter is full: stamp REFRESH across the screen and start the minigame
  // again. A minigame can replace this with its own way of failing.
  protected outOfPatience() {
    this.finished = true;
    music.stop();
    sfx.refresh();
    this.cameras.main.shake(350, 0.012);
    const stamp = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'REFRESH!', {
        fontFamily: PIXEL_FONT,
        fontSize: '84px',
        color: hex(COLORS.red),
        stroke: hex(COLORS.navy),
        strokeThickness: 14,
      })
      .setOrigin(0.5)
      .setAngle(-8)
      .setScale(2.4)
      .setDepth(1000);
    this.tweens.add({ targets: stamp, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.time.delayedCall(1300, () => this.scene.restart({ problemId: this.problemId }));
  }
}
