import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { BigFace, drawMugInHand, drawPointingHand, drawScreenCloseup, drawShoulderShot, drawTowerCloseup, drawWallBackdrop } from '../cutscene/closeups';
import { DESK, INK, SCREEN_ON, WIDE, drawDeskSet, drawWideRoom } from '../cutscene/sets';
import { StickFigure } from '../objects/StickFigure';
import { StickFigureFront } from '../objects/StickFigureFront';
import { sfx } from '../audio/sound';

type Moment = Phaser.Types.Time.TimelineEventConfig;

// A sound cue: one moment that just plays a sound.
const cue = (at: number, play: () => void): Moment => ({ at, run: () => play() });

// Where the wide shot's walk begins and ends (floor positions on screen).
const WALK_FROM = { x: WIDE.doorX, y: 438 };
const WALK_TO = { x: 730, y: 668 };

// The opening cutscene, about 35 seconds:
//    1 wide: he trudges in through the door, yawning
//    2 at the desk: mug down, drops into the chair, slouches
//    3 close-up: a long sip of coffee
//    4 close-up: a finger presses the power button
//    5 over his shoulder: the screen comes on, he clicks DOWNLOAD
//    6 the screen: the camera slides along the "Downloading ..." line
//    7 the bar: it reaches 1% and stops
//    8 his face, three cuts, each closer and crosser
//    9 at the desk: hours pass
//   10 at the desk: he snaps and shakes the monitor
//   11 the camera dives into the screen, and the game begins
//
// A cutscene is a list of "at this moment, do this"; Phaser's timeline plays
// such a list. Each shot is a Container holding everything in that shot, so a
// cut is just hiding one container and showing another. Every shot method
// returns its moments plus how long it lasts, so shots can be re-timed or
// re-ordered without touching the others.
export class IntroScene extends Phaser.Scene {
  private shots: Phaser.GameObjects.Container[] = [];
  private walker!: StickFigureFront;
  private fixedCamera!: Phaser.Cameras.Scene2D.Camera;
  private diveTarget = { x: 0, y: 0 }; // the middle of the monitor's screen in the last desk shot

  constructor() {
    super('Intro');
  }

  create() {
    this.shots = [];
    this.cameras.main.setBackgroundColor(INK).fadeIn(500, 0, 0, 0);

    const builders = [
      this.wideShot,
      this.sitDownShot,
      this.sipShot,
      this.powerButtonShot,
      this.shoulderShot,
      this.screenShot,
      this.faceShot,
      this.hoursPassShot,
      this.diveShot,
    ];
    const moments: Moment[] = [];
    let start = 0;
    for (const build of builders) {
      const shot = build.call(this, start);
      moments.push(...shot.moments);
      start += shot.length;
    }
    this.add.timeline(moments).play();
    this.addSkipButton();
  }

  update() {
    // Walking towards the camera = moving down the screen and getting bigger.
    this.walker.setScale(WIDE.scaleAt(this.walker.y));
  }

  // Makes a shot: a hidden container holding everything in it.
  private shot(parts: Phaser.GameObjects.GameObject[]) {
    const container = this.add.container(0, 0, parts).setVisible(false);
    this.shots.push(container);
    return container;
  }

  // The cut: show one shot, hide the rest, and put the camera back to normal
  // (or looking wherever `lookAt` says).
  private cutTo(shot: Phaser.GameObjects.Container, lookAt = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }, zoom = 1) {
    for (const other of this.shots) other.setVisible(other === shot);
    const camera = this.cameras.main;
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    camera.setZoom(zoom).centerOn(lookAt.x, lookAt.y);
  }

  // ---- 1: wide ----

  private wideShot(start: number) {
    const { room, door, front } = drawWideRoom(this);
    this.walker = new StickFigureFront(this, WALK_FROM.x, WALK_FROM.y).setVisible(false);
    // Order matters: room, figure, door, then the furniture nearest the camera.
    const shot = this.shot([room, this.walker, door, front]);
    const camera = this.cameras.main;

    const moments: Moment[] = [
      cue(start + 900, sfx.creak),
      { at: start + 1400, run: () => this.time.addEvent({ delay: 370, repeat: 11, callback: sfx.step }) }, // footsteps
      cue(start + 2500, sfx.yawn),
      { at: start, run: () => this.cutTo(shot) },
      { at: start + 900, tween: { targets: door, scaleX: 0.2, duration: 500, ease: 'Quad.easeOut' } },
      {
        at: start + 1400,
        run: () => {
          this.walker.setVisible(true).walking = true;
          this.tweens.add({ targets: this.walker, ...WALK_TO, duration: 4500 });
        },
      },
      { at: start + 2500, tween: { targets: this.walker, yawn: 1, duration: 450, yoyo: true, hold: 500 } },
      // A slow push-in as he nears the desk.
      { at: start + 3300, run: () => camera.pan(716, 402, 2800, 'Sine.easeInOut').zoomTo(1.14, 2800, 'Sine.easeInOut') },
      { at: start + 5900, run: () => (this.walker.walking = false) },
    ];
    return { moments, length: 6300 };
  }

  // ---- 2: at the desk ----

  private sitDownShot(start: number) {
    const { room, chair, mug } = drawDeskSet(this, { screenOn: false, mug: false });
    const figure = new StickFigure(this, DESK.seatX, DESK.floorY).setScale(1.25).setFace('bored').setHoldingMug(true);
    // Standing by the chair, shoulders slumped, mug in hand.
    figure.poseTo({ sit: 0, lean: 10, headTilt: 18, nearX: 20, nearY: -118, farX: -8, farY: -112, slide: 0, kick: 0 }, 0);
    const shot = this.shot([room, chair, figure, mug]);

    const moments: Moment[] = [
      cue(start + 1150, sfx.clink),
      cue(start + 2030, sfx.thump),
      cue(start + 2500, sfx.slide),
      { at: start, run: () => this.cutTo(shot) },
      // He leans over and puts the mug on the desk.
      { at: start + 700, run: () => figure.poseTo({ lean: 24, nearX: 100, nearY: -122 }, 380) },
      {
        at: start + 1150,
        run: () => {
          figure.setHoldingMug(false);
          mug.setVisible(true);
          figure.poseTo({ lean: 8, nearX: 14, nearY: -112 }, 350);
        },
      },
      // He lets himself fall into the chair ...
      { at: start + 1800, run: () => figure.poseTo({ sit: 1, lean: 4, nearX: 30, nearY: -84, farX: 16, farY: -82 }, 230, 'Quad.easeIn') },
      {
        // ... which rolls back a little under the impact.
        at: start + 2030,
        run: () => {
          this.cameras.main.shake(140, 0.006);
          this.tweens.add({ targets: [chair, figure], x: '-=18', duration: 520, ease: 'Quad.easeOut' });
        },
      },
      // And slides down until he is nearly lying in it.
      {
        at: start + 2500,
        run: () => figure.poseTo({ sit: 0.84, lean: -38, headTilt: 46, slide: 34, kick: 42, nearX: 40, nearY: -70, farX: 28, farY: -68 }, 900),
      },
    ];
    return { moments, length: 4100 };
  }

  // ---- 3: the sip ----

  private sipShot(start: number) {
    const face = new BigFace(this, 520, 330);
    const mug = drawMugInHand(this, 760, 900);
    const shot = this.shot([drawWallBackdrop(this), face, mug]);

    const moments: Moment[] = [
      cue(start + 950, sfx.slurp),
      cue(start + 2300, sfx.sigh),
      { at: start, run: () => this.cutTo(shot) },
      { at: start + 300, tween: { targets: mug, x: 690, y: 430, duration: 600, ease: 'Quad.easeOut' } },
      {
        // The mug tips, the eyes close.
        at: start + 950,
        run: () => {
          face.setExpression('sip');
          this.tweens.add({ targets: mug, angle: -24, x: 660, y: 410, duration: 350 });
        },
      },
      {
        at: start + 2200,
        run: () => {
          face.setExpression('sleepy');
          this.tweens.add({ targets: mug, angle: 0, x: 780, y: 900, duration: 600, ease: 'Quad.easeIn' });
          // A contented puff of breath.
          for (let i = 0; i < 3; i++) {
            const puff = this.add.circle(640, 400, 10, 0xffffff, 0.8);
            shot.add(puff);
            this.fixedCamera.ignore(puff); // made after the cameras were set up, so say so now
            this.tweens.add({ targets: puff, x: 760 + i * 46, y: 380 - i * 30, scale: 3 + i, alpha: 0, delay: 250 + i * 110, duration: 800 });
          }
        },
      },
    ];
    return { moments, length: 3400 };
  }

  // ---- 4: the power button ----

  private powerButtonShot(start: number) {
    const tower = drawTowerCloseup(this);
    const hand = drawPointingHand(this, 300, 760);
    const shot = this.shot([tower.backdrop, tower.light, tower.button, hand]);
    const { x, y } = tower.buttonAt;

    const moments: Moment[] = [
      cue(start + 850, sfx.boot),
      { at: start, run: () => this.cutTo(shot) },
      { at: start + 150, tween: { targets: hand, x: x - 14, y: y + 14, duration: 650, ease: 'Sine.easeOut' } },
      {
        // The press: finger and button dip together, and the light comes on.
        at: start + 850,
        run: () => {
          this.tweens.add({ targets: hand, x: x - 4, y: y + 4, duration: 90, yoyo: true });
          this.tweens.add({ targets: tower.button, scale: 0.9, duration: 90, yoyo: true });
          tower.light.setFillStyle(COLORS.green);
          this.tweens.add({ targets: tower.light, scale: 1.5, duration: 160, yoyo: true });
        },
      },
      {
        // The fan spins up: the whole case hums.
        at: start + 1100,
        run: () => {
          this.cameras.main.shake(900, 0.0025);
          this.tweens.add({ targets: hand, x: 260, y: 800, duration: 700, ease: 'Quad.easeIn' });
        },
      },
    ];
    return { moments, length: 2100 };
  }

  // ---- 5: over his shoulder ----

  private shoulderShot(start: number) {
    const view = drawShoulderShot(this);
    view.popup.setScale(0);
    view.cursor.setVisible(false);
    const shot = this.shot([view.backdrop, view.screen, view.popup, view.cursor, view.head]);
    const flicker = (delay: number, on: boolean) => ({ at: start + delay, run: () => (sfx.tick(), view.screen.setFillStyle(on ? SCREEN_ON : 0x2b2f38)) });

    const moments: Moment[] = [
      cue(start + 1300, sfx.pop),
      cue(start + 2850, sfx.click),
      { at: start, run: () => this.cutTo(shot) },
      // An old monitor never comes on cleanly.
      flicker(350, true),
      flicker(430, false),
      flicker(560, true),
      flicker(620, false),
      flicker(760, true),
      { at: start + 800, run: () => this.cameras.main.pan(730, 345, 2600, 'Sine.easeInOut').zoomTo(1.18, 2600, 'Sine.easeInOut') },
      { at: start + 1300, tween: { targets: view.popup, scale: 1, duration: 220, ease: 'Back.easeOut' } },
      {
        // The pointer wanders lazily over to DOWNLOAD and clicks it.
        at: start + 1700,
        run: () => {
          view.cursor.setVisible(true);
          this.tweens.add({ targets: view.cursor, x: view.buttonAt.x - 4, y: view.buttonAt.y - 4, duration: 1000, ease: 'Sine.easeInOut' });
        },
      },
      { at: start + 2850, tween: { targets: view.popup, scale: 0.94, duration: 80, yoyo: true } },
    ];
    return { moments, length: 3300 };
  }

  // ---- 6 and 7: the screen, then the bar ----

  private screenShot(start: number) {
    const screen = drawScreenCloseup(this);
    const shot = this.shot(screen.parts);
    const camera = this.cameras.main;

    const moments: Moment[] = [
      cue(start + 4400, sfx.blip),
      cue(start + 5600, sfx.sadTrombone),
      { at: start, run: () => this.cutTo(shot, screen.textStart, 1.05) },
      // Slide along the words, left to right, like eyes reading them.
      { at: start + 400, run: () => camera.pan(screen.textEnd.x, screen.textEnd.y, 2400, 'Sine.easeInOut') },
      // Then drop to the bar.
      { at: start + 3000, run: () => camera.pan(screen.barCentre.x, screen.barCentre.y, 900, 'Sine.easeInOut').zoomTo(1, 900) },
      {
        // One block. One percent.
        at: start + 4400,
        run: () => {
          screen.firstSlot.setVisible(true).setScale(1.4);
          this.tweens.add({ targets: screen.firstSlot, scale: 1, duration: 220, ease: 'Back.easeOut' });
          screen.percent.setText('1%');
        },
      },
      // ... and nothing more. The stillness is the joke.
      { at: start + 5600, run: () => screen.remaining.setText('Time remaining: 3 years') },
    ];
    return { moments, length: 7000 };
  }

  // ---- 8: his face, three cuts ----

  private faceShot(start: number) {
    const face = new BigFace(this, 560, 360).setExpression('blank');
    const shot = this.shot([drawWallBackdrop(this), face]);

    const moments: Moment[] = [
      cue(start, sfx.drum),
      cue(start + 1000, sfx.drum),
      cue(start + 2000, sfx.drum),
      cue(start + 2050, sfx.growl),
      { at: start, run: () => this.cutTo(shot) },
      {
        // Closer: one eyebrow starts to twitch.
        at: start + 1000,
        run: () => {
          this.cutTo(shot, { x: 600, y: 350 }, 1.3);
          this.tweens.add({ targets: face, browLift: 16, duration: 90, yoyo: true, repeat: 5, repeatDelay: 60 });
        },
      },
      {
        // Closer still: now he is cross.
        at: start + 2000,
        run: () => {
          this.cutTo(shot, { x: 620, y: 340 }, 1.65);
          face.setExpression('annoyed');
          this.cameras.main.shake(160, 0.004);
        },
      },
    ];
    return { moments, length: 3100 };
  }

  // ---- 9 and 10: hours pass, then he snaps ----

  private hoursPassShot(start: number) {
    const set = drawDeskSet(this, { screenOn: true, mug: true });
    const figure = new StickFigure(this, DESK.seatX, DESK.floorY).setScale(1.25).setFace('bored');
    // Face down on the desk, arms flopped out in front.
    figure.poseTo({ sit: 1, lean: 58, headTilt: 30, nearX: 120, nearY: -100, farX: 96, farY: -100, slide: 0, kick: 0 }, 0);

    // The clock's hands are redrawn on top of the painted ones, so they can spin.
    const clock = this.add.graphics({ x: 250, y: 170 });
    clock.fillStyle(0xffffff).fillCircle(0, 0, 44);
    const minuteHand = this.add.rectangle(250, 170, 5, 36, INK).setOrigin(0.5, 1);
    const hourHand = this.add.rectangle(250, 170, 6, 24, INK).setOrigin(0.5, 1).setAngle(120);
    // Evening: the window turns orange and the whole room dims.
    const sunset = this.add.rectangle(1000, 100, 190, 150, 0xf08a3c).setOrigin(0).setAlpha(0);
    const dusk = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a2140).setOrigin(0).setAlpha(0);
    const shot = this.shot([set.room, ...set.labels, sunset, clock, minuteHand, hourHand, set.chair, set.mug, figure, dusk]);
    this.diveTarget = set.screenCentre;

    const moments: Moment[] = [
      cue(start + 300, sfx.clockSpin),
      cue(start + 3000, sfx.growl),
      cue(start + 3900, sfx.rattle),
      { at: start, run: () => this.cutTo(shot) },
      { at: start + 300, tween: { targets: minuteHand, angle: 360 * 6, duration: 2400, ease: 'Sine.easeInOut' } },
      { at: start + 300, tween: { targets: hourHand, angle: 120 + 180, duration: 2400, ease: 'Sine.easeInOut' } },
      { at: start + 300, tween: { targets: sunset, alpha: 0.85, duration: 2400 } },
      { at: start + 300, tween: { targets: dusk, alpha: 0.32, duration: 2400 } },
      // He lifts his head, looks at the screen: still 1%.
      { at: start + 3000, run: () => figure.poseTo({ lean: 20, headTilt: 4, nearX: 84, nearY: -92, farX: 104, farY: -92 }, 400).setFace('annoyed') },
      {
        // That does it.
        at: start + 3900,
        run: () => {
          figure.setMood('furious', 160);
          this.cameras.main.shake(1300, 0.008);
        },
      },
    ];
    return { moments, length: 5300 };
  }


  // ---- 11: into the screen ----

  private diveShot(start: number) {
    const camera = this.cameras.main;
    const moments: Moment[] = [
      cue(start, sfx.dive),
      {
        // No cut this time: the camera rushes at the monitor in the same shot.
        at: start,
        run: () => {
          camera.pan(this.diveTarget.x, this.diveTarget.y, 800, 'Cubic.easeIn').zoomTo(14, 800, 'Cubic.easeIn');
          camera.flash(900, 255, 255, 255, false);
        },
      },
      { at: start + 700, run: () => camera.fadeOut(200, 255, 255, 255) },
      { at: start + 950, run: () => this.scene.start('Factory') },
    ];
    return { moments, length: 1000 };
  }

  // ---- Shared ----

  private addSkipButton() {
    const skip = this.add
      .text(GAME_WIDTH - 36, GAME_HEIGHT - 60, 'SKIP >', { fontFamily: PIXEL_FONT, fontSize: '16px', color: hex(COLORS.cream), stroke: hex(INK), strokeThickness: 6 })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => {
      sfx.click();
      this.scene.start('Factory');
    });

    // The main camera pans and zooms with the story. The button is filmed by
    // a second camera that never moves, so it stays in its corner.
    this.fixedCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.fixedCamera.ignore(this.shots);
    this.cameras.main.ignore(skip);
  }
}
