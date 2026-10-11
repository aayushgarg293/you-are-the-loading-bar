import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { BigFace, drawShoulderShot, drawWallBackdrop } from '../cutscene/closeups';
import { DESK, INK, SCREEN_ON, drawDeskSet } from '../cutscene/sets';
import { VideoHandle, playYouTube, preloadYouTube } from '../cutscene/video';
import { debugText } from '../debug';
import { StickFigure } from '../objects/StickFigure';
import { Worker } from '../objects/Worker';
import { music, sfx } from '../audio/sound';

type Moment = Phaser.Types.Time.TimelineEventConfig;

// A sound cue: one moment that just plays a sound.
const cue = (at: number, play: () => void): Moment => ({ at, run: () => play() });

const RICKROLL = 'dQw4w9WgXcQ'; // the official "Never Gonna Give You Up" video on YouTube

// The ending cutscene:
//   1 the camera pulls back out of the monitor: 100%, download complete
//   2 he notices, leaps out of the chair, and we cut to his delighted face
//   3 over his shoulder: the file is ready. The PLAYER clicks OPEN.
//   4 it is not the song. A real YouTube video plays on his monitor; if that
//     cannot start (no internet, blocked, an advert first), the crew from
//     inside the computer do the dance themselves instead
//   5 his face: stunned, then a shout that is cut off mid-word
//   6 black, and on to the end screen
//
// It is built like the intro (shots are Containers, a timeline fires the
// moments), in two halves, because the middle waits for a click. That click
// matters: browsers only let a page start sound in response to one.
export class EndingScene extends Phaser.Scene {
  private shots: Phaser.GameObjects.Container[] = [];
  private video?: VideoHandle;

  constructor() {
    super('Ending');
  }

  create() {
    this.shots = [];
    this.video = undefined;
    this.cameras.main.setBackgroundColor(0x000000);
    preloadYouTube();
    // If the scene ends for any reason, the video must not be left behind on the page.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.video?.destroy();
      music.stop();
    });

    const face = new BigFace(this, 560, 360);
    const faceShot = this.shot([drawWallBackdrop(this), face]);
    const firstHalf = [...this.pullOutShot(face, faceShot), ...this.openFileShot(face, faceShot)];
    this.add.timeline(firstHalf).play();
  }

  private shot(parts: Phaser.GameObjects.GameObject[]) {
    const container = this.add.container(0, 0, parts).setVisible(false);
    this.shots.push(container);
    return container;
  }

  private cutTo(shot: Phaser.GameObjects.Container | null, lookAt = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }, zoom = 1) {
    for (const other of this.shots) other.setVisible(other === shot);
    const camera = this.cameras.main;
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    camera.setZoom(zoom).centerOn(lookAt.x, lookAt.y);
  }

  // ---- 1 and 2: out of the screen, and joy ----

  private pullOutShot(face: BigFace, faceShot: Phaser.GameObjects.Container): Moment[] {
    const set = drawDeskSet(this, { screenOn: true, mug: true });
    set.labels[0].setText('complete!');
    set.labels[1].setText('100%');
    const fullBar = this.add.rectangle(678, DESK.top - 124, 134, 14, COLORS.green).setOrigin(0);
    const figure = new StickFigure(this, DESK.seatX, DESK.floorY).setScale(1.25).setFace('bored');
    // Where the intro left him hours ago: face down on the desk.
    figure.poseTo({ sit: 1, lean: 58, headTilt: 30, nearX: 120, nearY: -100, farX: 96, farY: -100, slide: 0, kick: 0 }, 0);
    const dusk = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a2140, 0.32).setOrigin(0);
    const shot = this.shot([set.room, ...set.labels, fullBar, set.chair, set.mug, figure, dusk]);
    const camera = this.cameras.main;

    return [
      cue(0, sfx.pullOut),
      cue(1900, sfx.gasp),
      cue(2900, sfx.cheer),
      cue(4500, sfx.cheer),
      {
        // The intro's dive, backwards: start deep inside the monitor and pull out.
        at: 0,
        run: () => {
          this.cutTo(shot, set.screenCentre, 14);
          camera.fadeIn(400, 255, 255, 255);
          camera.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1300, 'Cubic.easeOut').zoomTo(1, 1300, 'Cubic.easeOut');
        },
      },
      // One eye opens ...
      { at: 1900, run: () => figure.poseTo({ lean: 22, headTilt: 0, nearX: 84, nearY: -92, farX: 104, farY: -92 }, 350).setFace('stunned') },
      {
        // ... and he is on his feet.
        at: 2900,
        run: () => {
          figure.setMood('overjoyed', 180);
          camera.shake(200, 0.006);
          this.tweens.add({ targets: dusk, alpha: 0.12, duration: 400 });
        },
      },
      { at: 4500, run: () => this.cutTo(faceShot, { x: 600, y: 350 }, 1.25) },
      { at: 4500, run: () => face.setExpression('joy') },
      { at: 4500, tween: { targets: face, y: 340, duration: 130, yoyo: true, repeat: 4 } },
    ];
  }

  // ---- 3 and 4: open the file ----

  private openFileShot(face: BigFace, faceShot: Phaser.GameObjects.Container): Moment[] {
    const view = drawShoulderShot(this);
    view.screen.setFillStyle(SCREEN_ON);
    view.button.setText('OPEN');
    view.cursor.setPosition(view.buttonAt.x + 150, view.buttonAt.y + 90);
    const prompt = this.add
      .text(view.buttonAt.x, view.buttonAt.y + 76, 'click OPEN', { fontFamily: PIXEL_FONT, fontSize: '14px', color: hex(INK) })
      .setOrigin(0.5)
      .setVisible(false);
    const dance = this.buildCrewDance(view.screenRect);
    const shot = this.shot([view.backdrop, view.screen, view.popup, prompt, dance, view.cursor, view.head]);

    const open = () => {
      sfx.click();
      prompt.destroy();
      view.popup.setVisible(false);
      view.cursor.setVisible(false);
      const startSecondHalf = () => this.add.timeline(this.reactionMoments(face, faceShot)).play();
      const playOurs = () => {
        this.video?.destroy();
        this.video = undefined;
        dance.setVisible(true);
        music.play('dance');
        startSecondHalf();
      };
      // ?novideo=1 is a test switch that skips YouTube and shows our own version.
      if (debugText('novideo')) playOurs();
      else this.video = playYouTube(this, view.screenRect, RICKROLL, startSecondHalf, playOurs);
    };

    return [
      { at: 6000, run: () => this.cutTo(shot) },
      cue(6000, sfx.pop),
      { at: 6300, tween: { targets: view.cursor, x: view.buttonAt.x + 34, y: view.buttonAt.y + 12, duration: 700, ease: 'Sine.easeOut' } },
      {
        at: 7000,
        run: () => {
          prompt.setVisible(true);
          this.tweens.add({ targets: prompt, alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });
          const zone = this.add.zone(view.buttonAt.x, view.buttonAt.y, 380, 220).setInteractive({ useHandCursor: true });
          zone.once('pointerdown', () => {
            zone.destroy();
            open();
          });
        },
      },
    ];
  }

  // Our own version of the famous video, for when the real one cannot play:
  // three of the crew swaying side to side on his screen.
  private buildCrewDance(screen: { x: number; y: number; width: number; height: number }) {
    const centreX = screen.x + screen.width / 2;
    const floor = screen.y + screen.height - 40;
    const stage = this.add.rectangle(screen.x, screen.y, screen.width, screen.height, 0x2b1d4a).setOrigin(0);
    const spotlight = this.add.ellipse(centreX, floor - 10, 460, 70, 0xffffff, 0.12);
    const title = this.add
      .text(centreX, screen.y + 44, 'NEVER GONNA\nLOAD YOU UP', { fontFamily: PIXEL_FONT, fontSize: '22px', color: hex(COLORS.yellow), align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);
    const tints = [0xff9d8a, undefined, 0x9cc9ff];
    const dancers = [-150, 0, 150].map((offset, i) => {
      const dancer = new Worker(this, centreX + offset, floor, { mood: 'happy', hatTint: tints[i], glasses: i === 1 }).setScale(i === 1 ? 0.5 : 0.42);
      this.tweens.add({ targets: dancer, x: dancer.x + 26, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 60 });
      return dancer;
    });
    return this.add.container(0, 0, [stage, spotlight, title, dancers[0], dancers[2], dancers[1]]).setVisible(false);
  }

  // ---- 5 and 6: the reaction, cut short ----

  private reactionMoments(face: BigFace, faceShot: Phaser.GameObjects.Container): Moment[] {
    const shout = this.add
      .text(700, 150, 'N', { fontFamily: PIXEL_FONT, fontSize: '50px', color: hex(COLORS.red), stroke: hex(INK), strokeThickness: 10 })
      .setOrigin(0, 0.5)
      .setVisible(false);
    faceShot.add(shout);
    const camera = this.cameras.main;

    return [
      cue(4200, sfx.drum),
      cue(5400, sfx.drum),
      cue(6400, () => sfx.shout(0.65)), // 0.65 s later the cut to black lands
      // Let the video play just long enough to sink in, then cut to his face.
      {
        at: 4200,
        run: () => {
          this.video?.hide(); // the music carries on over his face
          face.setExpression('stunned').setY(360);
          this.cutTo(faceShot, { x: 600, y: 350 }, 1.2);
        },
      },
      { at: 5400, run: () => this.cutTo(faceShot, { x: 620, y: 340 }, 1.6) },
      {
        // The shout builds: N... NO... NOO...
        at: 6400,
        run: () => {
          face.setExpression('shout');
          this.tweens.add({ targets: face, mouthOpen: 1, duration: 500 });
          camera.shake(700, 0.01);
          shout.setVisible(true);
          this.time.addEvent({ delay: 110, repeat: 4, callback: () => shout.setText(`${shout.text}O`) });
        },
      },
      {
        // ... and is chopped off. Sudden black and silence is the punchline.
        at: 7050,
        run: () => {
          this.video?.destroy();
          this.video = undefined;
          music.stop();
          this.cutTo(null);
        },
      },
      { at: 8000, run: () => this.scene.start('EndScreen') },
    ];
  }
}
