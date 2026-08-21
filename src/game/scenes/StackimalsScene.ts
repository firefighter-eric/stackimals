import Phaser from 'phaser';
import { StackingAI } from '../ai';
import { SeededAnimalQueue, StabilityDetector, resolveFallOutcome } from '../core';
import type { Actor, AnimalId, MatchPhase, StackBodySnapshot } from '../core';
import { getAnimalDefinition } from '../data';
import type { AnimalDefinition } from '../data/animals';
import type { GameCommand, GamePhase, GameSnapshot } from '../../ui/gameBridge';
import { ANIMALS as UI_ANIMALS } from '../../ui/gameBridge';
import { GameAudio } from '../audio/GameAudio';

const GAME_WIDTH = 390;
const GAME_HEIGHT = 620;
const PLATFORM_X = GAME_WIDTH / 2;
const PLATFORM_Y = 548;
const PLATFORM_WIDTH = 294;
const PLATFORM_BODY_HEIGHT = 24;
const AIM_Y = 96;
const DANGER_Y = 151;
const PLAYFIELD_MIN_X = 34;
const PLAYFIELD_MAX_X = GAME_WIDTH - 34;
const FALL_BOUNDARY_Y = GAME_HEIGHT + 75;
const MOVE_SPEED = 150;
const ROTATION_STEP = 1;

interface SceneHooks {
  publish(snapshot: GameSnapshot): void;
  ready(scene: StackimalsScene): void;
  stopped(scene: StackimalsScene): void;
}

interface StackimalRecord {
  readonly id: string;
  readonly actor: Actor;
  readonly animalId: AnimalId;
  readonly image: Phaser.Physics.Matter.Image;
  readonly body: MatterJS.BodyType;
  readonly isCurrentDrop: boolean;
}

interface TestSnapshot {
  readonly phase: GamePhase;
  readonly turn: 'human' | 'ai';
  readonly round: number;
  readonly winner: 'human' | 'ai' | null;
  readonly bodyCount: number;
  readonly currentAnimal: AnimalId;
  readonly bodies: readonly StackBodySnapshot[];
}

declare global {
  interface Window {
    __STACKIMALS_TEST__?: {
      snapshot(): TestSnapshot;
      restart(): void;
      place(x: number, angle?: number): void;
      resolveAiImmediately(): void;
    };
  }
}

function toUiActor(actor: Actor): 'human' | 'ai' {
  return actor === 'player' ? 'human' : 'ai';
}

function toUiPhase(phase: MatchPhase, actor: Actor, paused: boolean): GamePhase {
  if (paused) {
    return 'paused';
  }

  if (phase === 'game-over') {
    return 'gameOver';
  }

  if (phase === 'thinking') {
    return 'aiThinking';
  }

  if (phase === 'aiming' || phase === 'ready') {
    return actor === 'player' ? 'humanAiming' : 'aiThinking';
  }

  return actor === 'player' ? 'humanSettling' : 'aiSettling';
}

function normalizeAngle(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

function rotatedCollisionXBounds(
  definition: AnimalDefinition,
  angleDeg: number,
): { minX: number; maxX: number } {
  const radians = Phaser.Math.DegToRad(angleDeg);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const originX = definition.collision.textureOrigin.x * definition.display.width;
  const originY = definition.collision.textureOrigin.y * definition.display.height;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  for (const point of definition.collision.outline) {
    const relativeX = point.x - originX;
    const relativeY = point.y - originY;
    const rotatedX = relativeX * cosine - relativeY * sine;
    minX = Math.min(minX, rotatedX);
    maxX = Math.max(maxX, rotatedX);
  }

  return { minX, maxX };
}

export class StackimalsScene extends Phaser.Scene {
  private readonly hooks: SceneHooks;
  private readonly audio = new GameAudio();
  private playerQueue = new SeededAnimalQueue('stackimals-player');
  private aiQueue = new SeededAnimalQueue('stackimals-ai');
  private ai = new StackingAI('stackimals-milo');
  private stability = new StabilityDetector();
  private records: StackimalRecord[] = [];
  private preview: Phaser.GameObjects.Image | null = null;
  private currentAnimal: AnimalId = 'rabbit';
  private actor: Actor = 'player';
  private phase: MatchPhase = 'ready';
  private paused = false;
  private round = 1;
  private scorePlayer = 0;
  private scoreAi = 0;
  private winner: Actor | null = null;
  private resultMessage = '';
  private moveLeft = false;
  private moveRight = false;
  private dragPointerId: number | null = null;
  private currentDropId: string | null = null;
  private bodySerial = 0;
  private generation = 0;
  private aiTimer: Phaser.Time.TimerEvent | null = null;
  private aiTween: Phaser.Tweens.Tween | null = null;
  private settledContact = false;
  private testApi: Window['__STACKIMALS_TEST__'] | null = null;
  private inputPlugin: Phaser.Input.InputPlugin | null = null;

  constructor(hooks: SceneHooks) {
    super({ key: 'stackimals' });
    this.hooks = hooks;
  }

  preload(): void {
    for (const animal of Object.values(UI_ANIMALS)) {
      this.load.image(`animal-${animal.id}`, animal.assetUrl);
    }
    this.load.image('platform', '/assets/game/environment/platform.webp');
  }

  create(): void {
    this.resetMatchState();
    this.createStage();
    this.bindInput();
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.hooks.ready(this);
    this.beginTurn('player');
    this.exposeTestApi();
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.phase === 'game-over') {
      return;
    }

    if (this.phase === 'aiming' && this.actor === 'player' && this.preview !== null) {
      const direction = Number(this.moveRight) - Number(this.moveLeft);
      if (direction !== 0) {
        this.setPreviewX(this.preview.x + direction * MOVE_SPEED * Math.min(delta, 34) / 1000);
      }
    }

    if (this.phase === 'dropping' || this.phase === 'settling') {
      this.updateResolution();
    }
  }

  handleCommand(command: GameCommand): void {
    if (command.type === 'restart') {
      this.restartMatch();
      return;
    }

    if (command.type === 'pause') {
      this.pauseMatch();
      return;
    }

    if (command.type === 'resume') {
      this.resumeMatch();
      return;
    }

    if (this.paused || this.phase !== 'aiming' || this.actor !== 'player') {
      return;
    }

    if (command.type === 'move') {
      if (command.direction === -1) {
        this.moveLeft = command.active;
      } else {
        this.moveRight = command.active;
      }
      if (command.active) {
        this.audio.play('move');
      }
      return;
    }

    if (command.type === 'rotate') {
      this.rotatePreview(command.direction);
      return;
    }

    if (command.type === 'drop') {
      this.dropCurrent();
    }
  }

  private resetMatchState(): void {
    this.generation += 1;
    this.cancelAiWork();
    this.playerQueue = new SeededAnimalQueue(`stackimals-player-${this.generation}`);
    this.aiQueue = new SeededAnimalQueue(`stackimals-ai-${this.generation}`);
    this.ai = new StackingAI(`stackimals-milo-${this.generation}`);
    this.stability = new StabilityDetector();
    this.records = [];
    this.preview = null;
    this.actor = 'player';
    this.phase = 'ready';
    this.paused = false;
    this.round = 1;
    this.scorePlayer = 0;
    this.scoreAi = 0;
    this.winner = null;
    this.resultMessage = '';
    this.moveLeft = false;
    this.moveRight = false;
    this.dragPointerId = null;
    this.currentDropId = null;
    this.bodySerial = 0;
    this.settledContact = false;
  }

  private createStage(): void {
    const danger = this.add.graphics();
    danger.setDepth(2);
    danger.lineStyle(3, 0xf05d42, 0.9);
    for (let x = 12; x < GAME_WIDTH - 12; x += 22) {
      danger.lineBetween(x, DANGER_Y, Math.min(x + 11, GAME_WIDTH - 12), DANGER_Y);
    }

    this.add.image(PLATFORM_X, PLATFORM_Y + 5, 'platform')
      .setDisplaySize(330, 106)
      .setDepth(7);

    this.matter.add.rectangle(
      PLATFORM_X,
      PLATFORM_Y,
      PLATFORM_WIDTH,
      PLATFORM_BODY_HEIGHT,
      {
        isStatic: true,
        label: 'stackimals-platform',
        friction: 0.9,
        frictionStatic: 1,
        restitution: 0.01,
      },
    );
  }

  private bindInput(): void {
    this.inputPlugin = this.input;
    this.inputPlugin.on('pointerdown', this.onPointerDown, this);
    this.inputPlugin.on('pointermove', this.onPointerMove, this);
    this.inputPlugin.on('pointerup', this.onPointerUp, this);
    this.inputPlugin.on('pointerupoutside', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'aiming' || this.actor !== 'player' || this.paused || this.preview === null) {
      return;
    }
    this.audio.unlock();
    this.dragPointerId = pointer.id;
    this.setPreviewX(pointer.worldX);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragPointerId === pointer.id && pointer.isDown && this.preview !== null) {
      this.setPreviewX(pointer.worldX);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.dragPointerId === pointer.id) {
      this.dragPointerId = null;
    }
  }

  private beginTurn(actor: Actor): void {
    if (this.phase === 'game-over') {
      return;
    }

    this.actor = actor;
    this.currentAnimal = actor === 'player' ? this.playerQueue.next() : this.aiQueue.next();
    this.phase = actor === 'player' ? 'aiming' : 'thinking';
    this.currentDropId = null;
    this.settledContact = false;
    this.stability.reset();
    this.preview?.destroy();

    const definition = getAnimalDefinition(this.currentAnimal);
    this.preview = this.add.image(PLATFORM_X, AIM_Y, definition.assetKey)
      .setDisplaySize(definition.display.width, definition.display.height)
      .setOrigin(definition.collision.textureOrigin.x, definition.collision.textureOrigin.y)
      .setDepth(9);
    this.preview.setAlpha(actor === 'player' ? 1 : 0.88);
    this.publish();

    if (actor === 'ai') {
      this.scheduleAi();
    }
  }

  private scheduleAi(delay = 520): void {
    const turnGeneration = this.generation;
    this.aiTimer = this.time.delayedCall(delay, () => {
      if (turnGeneration !== this.generation || this.phase !== 'thinking' || this.preview === null) {
        return;
      }

      const decision = this.ai.choosePlacement({
        animalId: this.currentAnimal,
        bodies: this.records.map((record) => this.toSnapshot(record)),
        platform: { minX: PLATFORM_X - PLATFORM_WIDTH / 2, maxX: PLATFORM_X + PLATFORM_WIDTH / 2 },
        playfield: { minX: PLAYFIELD_MIN_X, maxX: PLAYFIELD_MAX_X },
      });

      const target = this.preview;
      this.aiTween = this.tweens.add({
        targets: target,
        x: decision.x,
        angle: decision.angle,
        duration: 720,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (turnGeneration === this.generation && this.phase === 'thinking') {
            this.dropCurrent();
          }
        },
      });
    });
  }

  private setPreviewX(value: number): void {
    if (this.preview === null) {
      return;
    }
    const definition = getAnimalDefinition(this.currentAnimal);
    const bounds = rotatedCollisionXBounds(definition, this.preview.angle);
    const minimumX = PLAYFIELD_MIN_X - bounds.minX;
    const maximumX = PLAYFIELD_MAX_X - bounds.maxX;
    this.preview.x = minimumX <= maximumX
      ? Phaser.Math.Clamp(value, minimumX, maximumX)
      : PLATFORM_X;
  }

  private rotatePreview(direction: -1 | 1): void {
    if (this.preview === null) {
      return;
    }
    const allowed = getAnimalDefinition(this.currentAnimal).allowedAngles;
    const current = normalizeAngle(this.preview.angle);
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    allowed.forEach((angle, index) => {
      const distance = Math.abs(normalizeAngle(angle - current));
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    const next = (nearest + direction * ROTATION_STEP + allowed.length) % allowed.length;
    this.preview.setAngle(allowed[next] ?? 0);
    this.setPreviewX(this.preview.x);
    this.audio.play('rotate');
  }

  private dropCurrent(): void {
    if (this.preview === null || (this.phase !== 'aiming' && this.phase !== 'thinking')) {
      return;
    }

    this.cancelAiWork();
    const x = this.preview.x;
    const y = this.preview.y;
    const angle = this.preview.angle;
    this.preview.destroy();
    this.preview = null;
    const record = this.spawnPhysicsAnimal(this.currentAnimal, this.actor, x, y, angle);
    this.records.push(record);
    this.currentDropId = record.id;
    this.phase = 'dropping';
    this.stability.reset();
    this.settledContact = false;
    this.audio.play('drop');
    this.publish();
  }

  private spawnPhysicsAnimal(
    animalId: AnimalId,
    actor: Actor,
    x: number,
    y: number,
    angleDeg: number,
  ): StackimalRecord {
    const definition = getAnimalDefinition(animalId);
    const image = this.matter.add.image(x, y, definition.assetKey, undefined, {
      label: `stackimals-${animalId}`,
    });
    image.setDisplaySize(definition.display.width, definition.display.height);

    const body = this.createOutlineBody(definition, x, y, angleDeg);
    image.setExistingBody(body, true);
    image.setOrigin(definition.collision.textureOrigin.x, definition.collision.textureOrigin.y);
    image.setPosition(x, y);
    image.setAngle(angleDeg);
    image.setFriction(definition.physics.friction, definition.physics.frictionAir, definition.physics.frictionStatic);
    image.setBounce(definition.physics.restitution);
    image.setDensity(definition.physics.density);
    image.setSleepThreshold(50);
    image.setDepth(6);

    const id = `animal-${++this.bodySerial}`;
    body.label = id;
    return { id, actor, animalId, image, body, isCurrentDrop: true };
  }

  private createOutlineBody(
    definition: AnimalDefinition,
    x: number,
    y: number,
    angleDeg: number,
  ): MatterJS.BodyType {
    const outline = definition.collision.outline.map((point) => ({ x: point.x, y: point.y }));
    const body = this.matter.bodies.fromVertices(x, y, [outline], {
      friction: definition.physics.friction,
      frictionStatic: definition.physics.frictionStatic,
      frictionAir: definition.physics.frictionAir,
      restitution: definition.physics.restitution,
      slop: 0.01,
      label: `stackimals-${definition.id}`,
    }, true, 0.01, 1);
    this.matter.body.setAngle(body, Phaser.Math.DegToRad(angleDeg));
    return body;
  }

  private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.currentDropId === null) {
      return;
    }
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent ?? pair.bodyA;
      const b = pair.bodyB.parent ?? pair.bodyB;
      if (a.label === this.currentDropId || b.label === this.currentDropId) {
        this.settledContact = true;
        if (this.phase === 'dropping') {
          this.phase = 'settling';
          this.publish();
        }
        break;
      }
    }
  }

  private updateResolution(): void {
    const fallen = this.records.filter((record) => {
      const bounds = record.body.bounds;
      return bounds.min.y > FALL_BOUNDARY_Y
        || bounds.max.x < -70
        || bounds.min.x > GAME_WIDTH + 70;
    });

    const outcome = resolveFallOutcome({
      phase: this.phase,
      actingActor: this.actor,
      fallenBodies: fallen.map((record) => ({
        id: record.id,
        owner: record.actor,
        isCurrentDrop: record.id === this.currentDropId,
      })),
    });
    if (outcome !== null) {
      this.finishMatch(outcome.winner, '动物从平台上掉下去了');
      return;
    }

    const snapshots = this.records.map((record) => this.toSnapshot(record));
    const stability = this.stability.sample(this.time.now, snapshots);
    if (!this.settledContact && stability.state !== 'timed-out') {
      return;
    }

    if (stability.state === 'timed-out') {
      this.finishMatch(this.actor === 'player' ? 'ai' : 'player', '动物一直没有站稳');
      return;
    }

    if (stability.state !== 'stable') {
      return;
    }

    const towerCrossedDanger = this.records.some((record) => record.body.bounds.min.y < DANGER_Y);
    if (towerCrossedDanger) {
      this.finishMatch(this.actor === 'player' ? 'ai' : 'player', '动物塔超过了红色危险线');
      return;
    }

    this.records = this.records.map((record) => ({ ...record, isCurrentDrop: false }));
    if (this.actor === 'player') {
      this.scorePlayer += 1;
      this.audio.play('settle');
      this.beginTurn('ai');
    } else {
      this.scoreAi += 1;
      this.round += 1;
      this.audio.play('settle');
      this.beginTurn('player');
    }
  }

  private toSnapshot(record: StackimalRecord): StackBodySnapshot {
    const { bounds, position, velocity, angle, angularVelocity, isSleeping } = record.body;
    return {
      id: record.id,
      animalId: record.animalId,
      owner: record.actor,
      aabb: {
        minX: bounds.min.x,
        maxX: bounds.max.x,
        minY: bounds.min.y,
        maxY: bounds.max.y,
      },
      position: { x: position.x, y: position.y },
      angle,
      velocity: { x: velocity.x, y: velocity.y },
      angularVelocity,
      isSleeping,
    };
  }

  private finishMatch(winner: Actor, message: string): void {
    if (this.phase === 'game-over') {
      return;
    }
    this.phase = 'game-over';
    this.winner = winner;
    this.resultMessage = winner === 'player'
      ? `${message}，Milo 本回合失败。`
      : `${message}，这一回合由 Milo 获胜。`;
    this.moveLeft = false;
    this.moveRight = false;
    this.cancelAiWork();
    this.matter.world.pause();
    this.audio.play(winner === 'player' ? 'win' : 'lose');
    this.publish();
  }

  private pauseMatch(): void {
    if (this.paused || this.phase === 'game-over' || this.phase === 'ready') {
      return;
    }
    this.paused = true;
    this.moveLeft = false;
    this.moveRight = false;
    this.matter.world.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.publish();
  }

  private resumeMatch(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.time.paused = false;
    this.matter.world.resume();
    this.tweens.resumeAll();
    this.publish();
  }

  private restartMatch(): void {
    this.cancelAiWork();
    this.time.paused = false;
    this.matter.world.resume();
    this.scene.restart();
  }

  private cancelAiWork(): void {
    this.aiTimer?.remove(false);
    this.aiTimer = null;
    this.aiTween?.stop();
    this.aiTween = null;
  }

  private publish(): void {
    const phase = toUiPhase(this.phase, this.actor, this.paused);
    const uiActor = toUiActor(this.actor);
    let message = this.resultMessage;
    if (message.length === 0) {
      if (phase === 'humanAiming') {
        message = '拖动动物选择落点，再旋转或投放';
      } else if (phase === 'humanSettling') {
        message = '稳住，稳住…';
      } else if (phase === 'aiThinking') {
        message = 'Milo 正在观察动物塔…';
      } else if (phase === 'aiSettling') {
        message = 'Milo 的动物正在落下';
      }
    }

    this.hooks.publish({
      phase,
      turn: uiActor,
      round: this.round,
      scoreHuman: this.scorePlayer,
      scoreAi: this.scoreAi,
      message,
      currentAnimal: UI_ANIMALS[this.currentAnimal],
      upcomingHuman: this.playerQueue.preview(3).map((id) => UI_ANIMALS[id]),
      upcomingAi: this.aiQueue.preview(3).map((id) => UI_ANIMALS[id]),
      winner: this.winner === null ? null : toUiActor(this.winner),
    });
  }

  private exposeTestApi(): void {
    if (!import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_API !== 'true') {
      return;
    }
    const testApi: NonNullable<Window['__STACKIMALS_TEST__']> = {
      snapshot: () => ({
        phase: toUiPhase(this.phase, this.actor, this.paused),
        turn: toUiActor(this.actor),
        round: this.round,
        winner: this.winner === null ? null : toUiActor(this.winner),
        bodyCount: this.records.length,
        currentAnimal: this.currentAnimal,
        bodies: this.records.map((record) => this.toSnapshot(record)),
      }),
      restart: () => this.restartMatch(),
      place: (x, angle = 0) => {
        if (this.phase === 'aiming' && this.actor === 'player' && this.preview !== null) {
          this.setPreviewX(x);
          this.preview.setAngle(angle);
          this.dropCurrent();
        }
      },
      resolveAiImmediately: () => {
        if (this.phase === 'thinking') {
          this.cancelAiWork();
          this.scheduleAi(0);
        }
      },
    };
    this.testApi = testApi;
    window.__STACKIMALS_TEST__ = testApi;
  }

  private handleShutdown(): void {
    this.cancelAiWork();
    this.matter?.world?.off('collisionstart', this.onCollisionStart, this);
    this.inputPlugin?.off('pointerdown', this.onPointerDown, this);
    this.inputPlugin?.off('pointermove', this.onPointerMove, this);
    this.inputPlugin?.off('pointerup', this.onPointerUp, this);
    this.inputPlugin?.off('pointerupoutside', this.onPointerUp, this);
    this.inputPlugin = null;
    if (this.testApi !== null && window.__STACKIMALS_TEST__ === this.testApi) {
      delete window.__STACKIMALS_TEST__;
    }
    this.testApi = null;
    this.hooks.stopped(this);
  }
}

export const STACKIMALS_GAME_SIZE = { width: GAME_WIDTH, height: GAME_HEIGHT } as const;
