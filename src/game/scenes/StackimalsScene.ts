import Phaser from 'phaser';
import type {} from '../testApi';
import { shouldSwapAIAnimal, StackingAI } from '../ai';
import { SeededAnimalQueue, StabilityDetector, resolveFallOutcome } from '../core';
import type { Actor, AnimalId, GameLanguage, MatchPhase, StackBodySnapshot } from '../core';
import {
  ANIMALS,
  WOOD_CONTACT_SLOP,
  WOOD_PLATFORM_PHYSICS,
  WOOD_SLEEP_THRESHOLD,
  getAnimalCopy,
  getAnimalDefinition,
  getPhysicsCollision,
} from '../data';
import type { AnimalDefinition, AnimalRole } from '../data/animals';
import type { GameCommand, GamePauseReason, GamePhase, GameSnapshot } from '../../ui/gameBridge';
import { getAnimalPreview } from '../../ui/gameBridge';
import { GameAudio } from '../audio/GameAudio';
import { fitStageViewport } from '../core/stageViewport';

const GAME_WIDTH = 390;
const GAME_HEIGHT = 620;
const PLATFORM_X = GAME_WIDTH / 2;
const PLATFORM_Y = 548;
const PLATFORM_WIDTH = 294;
const PLATFORM_BODY_HEIGHT = 24;
const AIM_Y = 96;
// Keep tall and rotated animals below the stage status pill as well as inside
// the canvas. The value is in the scene's fixed 390x620 coordinate space.
const AIM_TOP_CLEARANCE = 52;
const DANGER_Y = 151;
const PLAYFIELD_MIN_X = 34;
const PLAYFIELD_MAX_X = GAME_WIDTH - 34;
const FALL_BOUNDARY_Y = GAME_HEIGHT + 75;
const MOVE_SPEED = 150;
const ROTATION_SPEED = 105;
const ROTATION_START_STEP = 1.5;
const ANIMAL_SWAP_LIMIT = 3;
const ASSET_LOAD_TIMEOUT_MS = 15_000;
const AIM_GUIDE_COLORS: Readonly<Record<AnimalRole, number>> = {
  foundation: 0x5f843c,
  bridge: 0xd28a35,
  filler: 0x6bb5c7,
  balancer: 0x8b6fb2,
  challenge: 0xf05d42,
};

type ResultReason = 'fell' | 'unstable' | 'danger';

interface SceneHooks {
  publish(snapshot: GameSnapshot): void;
  ready(scene: StackimalsScene): void;
  stopped(scene: StackimalsScene): void;
  failed(): void;
}

interface StackimalRecord {
  readonly id: string;
  readonly actor: Actor;
  readonly animalId: AnimalId;
  readonly image: Phaser.Physics.Matter.Image;
  readonly body: MatterJS.BodyType;
  readonly isCurrentDrop: boolean;
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
  const originX = definition.display.width / 2;
  const originY = definition.display.height / 2;
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

function maximumVisibleRotationRadius(definition: AnimalDefinition): number {
  const originX = definition.display.width / 2;
  const originY = definition.display.height / 2;
  const { minX, minY, maxX, maxY } = definition.collision.alphaBounds;
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  return Math.max(...corners.map((point) => Math.hypot(
    point.x - originX,
    point.y - originY,
  )));
}

function previewAimY(definition: AnimalDefinition): number {
  return Math.max(AIM_Y, AIM_TOP_CLEARANCE + maximumVisibleRotationRadius(definition));
}

function collisionOriginFromPreviewCenter(
  definition: AnimalDefinition,
  centerX: number,
  centerY: number,
  angleDeg: number,
): { x: number; y: number } {
  const physicsCollision = getPhysicsCollision(definition);
  const radians = Phaser.Math.DegToRad(angleDeg);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const offsetX = physicsCollision.textureOrigin.x * definition.display.width
    - definition.display.width / 2;
  const offsetY = physicsCollision.textureOrigin.y * definition.display.height
    - definition.display.height / 2;

  return {
    x: centerX + offsetX * cosine - offsetY * sine,
    y: centerY + offsetX * sine + offsetY * cosine,
  };
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
  private dangerGuide: Phaser.GameObjects.Graphics | null = null;
  private aimGuide: Phaser.GameObjects.Graphics | null = null;
  private guideLinesEnabled = false;
  private currentAnimal: AnimalId = 'rabbit';
  private actor: Actor = 'player';
  private phase: MatchPhase = 'ready';
  private readonly pauseReasons = new Set<GamePauseReason>();
  private lastDropActor: Actor | undefined;
  private assetLoadFailed = false;
  private round = 1;
  private scorePlayer = 0;
  private scoreAi = 0;
  private swapsPlayer = ANIMAL_SWAP_LIMIT;
  private swapsAi = ANIMAL_SWAP_LIMIT;
  private winner: Actor | null = null;
  private resultReason: ResultReason | null = null;
  private placedAnimalNotice: AnimalId | null = null;
  private swapNotice: { readonly actor: Actor; readonly animalId: AnimalId; readonly remaining: number } | null = null;
  private language: GameLanguage = 'zh';
  private moveLeft = false;
  private moveRight = false;
  private rotateLeft = false;
  private rotateRight = false;
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

  private get paused(): boolean {
    return this.pauseReasons.size > 0;
  }

  preload(): void {
    this.assetLoadFailed = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onAssetLoadError, this);
    for (const animal of ANIMALS) {
      // Phaser's file defaults override the global loader timeout with zero.
      this.load.image(animal.assetKey, animal.texturePath, { responseType: 'blob', timeout: ASSET_LOAD_TIMEOUT_MS });
    }
    this.load.image('platform', '/assets/game/environment/platform.webp', { responseType: 'blob', timeout: ASSET_LOAD_TIMEOUT_MS });
  }

  create(): void {
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onAssetLoadError, this);
    if (this.assetLoadFailed || !this.textures.exists('platform')
      || ANIMALS.some((animal) => !this.textures.exists(animal.assetKey))) {
      this.assetLoadFailed = true;
      this.hooks.failed();
      return;
    }
    this.resetMatchState();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize, this);
    this.fitCameraToStage(this.scale.gameSize.width, this.scale.gameSize.height);
    this.createStage();
    this.bindInput();
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.beginTurn('player');
    this.hooks.ready(this);
    this.exposeTestApi();
  }

  private onAssetLoadError(): void {
    this.assetLoadFailed = true;
  }

  private onScaleResize(gameSize: { width: number; height: number }): void {
    this.fitCameraToStage(gameSize.width, gameSize.height);
  }

  private fitCameraToStage(viewportWidth: number, viewportHeight: number): void {
    const fit = fitStageViewport(
      { width: viewportWidth, height: viewportHeight },
      { width: GAME_WIDTH, height: GAME_HEIGHT },
    );
    this.cameras.main
      .setZoom(fit.zoom)
      .centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  update(_time: number, delta: number): void {
    if (this.assetLoadFailed || this.paused || this.phase === 'game-over' || this.phase === 'ready') {
      return;
    }

    if (this.resolveFalls()) {
      return;
    }

    if (this.phase === 'aiming' && this.actor === 'player' && this.preview !== null) {
      const frameDelta = Math.min(delta, 34);
      const moveDirection = Number(this.moveRight) - Number(this.moveLeft);
      if (moveDirection !== 0) {
        const handling = getAnimalDefinition(this.currentAnimal).gameplay.moveSpeedMultiplier;
        this.setPreviewX(this.preview.x + moveDirection * MOVE_SPEED * handling * frameDelta / 1000);
      }

      const rotationDirection = Number(this.rotateRight) - Number(this.rotateLeft);
      if (rotationDirection !== 0) {
        this.rotatePreview(rotationDirection * ROTATION_SPEED * frameDelta / 1000);
      }
    }

    if (this.phase === 'dropping' || this.phase === 'settling') {
      this.updateResolution();
    }
  }

  handleCommand(command: GameCommand): void {
    if (command.type === 'setGuideLines') {
      this.guideLinesEnabled = command.enabled;
      this.dangerGuide?.setVisible(command.enabled);
      this.drawAimGuide();
      return;
    }

    if (command.type === 'setLanguage') {
      this.language = command.language;
      this.publish();
      return;
    }

    if (command.type === 'restart') {
      this.restartMatch();
      return;
    }

    if (command.type === 'pause') {
      this.pauseMatch(command.reason);
      return;
    }

    if (command.type === 'resume') {
      this.resumeMatch(command.reason);
      return;
    }

    if (this.paused || this.phase !== 'aiming' || this.actor !== 'player') {
      return;
    }

    if (command.type === 'move') {
      const wasActive = command.direction === -1 ? this.moveLeft : this.moveRight;
      if (command.direction === -1) {
        this.moveLeft = command.active;
      } else {
        this.moveRight = command.active;
      }
      if (command.active && !wasActive) {
        this.setPreviewX((this.preview?.x ?? PLATFORM_X) + command.direction * 3);
        this.audio.play('move');
      }
      return;
    }

    if (command.type === 'rotate') {
      const wasActive = command.direction === -1 ? this.rotateLeft : this.rotateRight;
      if (command.direction === -1) {
        this.rotateLeft = command.active;
      } else {
        this.rotateRight = command.active;
      }
      if (command.active && !wasActive) {
        this.rotatePreview(command.direction * ROTATION_START_STEP);
        this.audio.play('rotate');
      }
      return;
    }

    if (command.type === 'drop') {
      this.dropCurrent();
      return;
    }

    if (command.type === 'swap') {
      this.swapCurrentAnimal('player');
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
    this.dangerGuide = null;
    this.aimGuide = null;
    this.actor = 'player';
    this.phase = 'ready';
    this.pauseReasons.clear();
    this.lastDropActor = undefined;
    this.round = 1;
    this.scorePlayer = 0;
    this.scoreAi = 0;
    this.swapsPlayer = ANIMAL_SWAP_LIMIT;
    this.swapsAi = ANIMAL_SWAP_LIMIT;
    this.winner = null;
    this.resultReason = null;
    this.placedAnimalNotice = null;
    this.swapNotice = null;
    this.moveLeft = false;
    this.moveRight = false;
    this.rotateLeft = false;
    this.rotateRight = false;
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
    danger.setVisible(this.guideLinesEnabled);
    this.dangerGuide = danger;

    this.aimGuide = this.add.graphics().setDepth(4);

    // The sprite is a direct side view. Its visible wooden face is aligned to
    // the 24px Matter rectangle so animals read as resting on one flat edge.
    this.add.image(PLATFORM_X, PLATFORM_Y + 2, 'platform')
      .setDisplaySize(330, 138)
      .setDepth(7);

    this.matter.add.rectangle(
      PLATFORM_X,
      PLATFORM_Y,
      PLATFORM_WIDTH,
      PLATFORM_BODY_HEIGHT,
      {
        isStatic: true,
        label: 'stackimals-platform',
        ...WOOD_PLATFORM_PHYSICS,
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
    if (!this.paused && this.phase === 'aiming' && this.actor === 'player'
      && this.dragPointerId === pointer.id && pointer.isDown && this.preview !== null) {
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
    this.swapNotice = null;
    this.replacePreview(actor, PLATFORM_X);
    this.publish();

    if (actor === 'ai') {
      this.scheduleAi();
    }
  }

  private replacePreview(actor: Actor, targetX: number): void {
    this.preview?.destroy();
    const definition = getAnimalDefinition(this.currentAnimal);
    this.preview = this.add.image(PLATFORM_X, previewAimY(definition), definition.assetKey)
      .setScale(definition.displayScale)
      .setOrigin(0.5, 0.5)
      .setDepth(9);
    this.preview.setAlpha(actor === 'player' ? 1 : 0.88);
    this.setPreviewX(targetX);
    this.drawAimGuide();
  }

  private swapCurrentAnimal(actor: Actor): boolean {
    const isPlayersTurn = actor === 'player' && this.actor === 'player' && this.phase === 'aiming';
    const isAiTurn = actor === 'ai' && this.actor === 'ai' && this.phase === 'thinking';
    const remaining = actor === 'player' ? this.swapsPlayer : this.swapsAi;
    if ((!isPlayersTurn && !isAiTurn) || remaining <= 0 || this.preview === null) {
      return false;
    }

    const previousX = this.preview.x;
    const queue = actor === 'player' ? this.playerQueue : this.aiQueue;
    const replacement = queue.exchange(this.currentAnimal);
    if (replacement === this.currentAnimal) {
      return false;
    }

    this.currentAnimal = replacement;
    if (actor === 'player') {
      this.swapsPlayer -= 1;
    } else {
      this.swapsAi -= 1;
    }
    const swapsRemaining = actor === 'player' ? this.swapsPlayer : this.swapsAi;
    this.swapNotice = { actor, animalId: replacement, remaining: swapsRemaining };
    this.moveLeft = false;
    this.moveRight = false;
    this.rotateLeft = false;
    this.rotateRight = false;
    this.dragPointerId = null;
    this.replacePreview(actor, previousX);
    this.audio.play('move');
    this.publish();
    return true;
  }

  private scheduleAi(delay = 520): void {
    const turnGeneration = this.generation;
    this.aiTimer = this.time.delayedCall(delay, () => {
      if (turnGeneration !== this.generation || this.phase !== 'thinking' || this.preview === null) {
        return;
      }

      const placementContext = (animalId: AnimalId) => ({
        animalId,
        bodies: this.records.map((record) => this.toSnapshot(record)),
        platform: { minX: PLATFORM_X - PLATFORM_WIDTH / 2, maxX: PLATFORM_X + PLATFORM_WIDTH / 2 },
        playfield: { minX: PLAYFIELD_MIN_X, maxX: PLAYFIELD_MAX_X },
      });
      let decision = this.ai.choosePlacement(placementContext(this.currentAnimal));
      if (this.swapsAi > 0) {
        const alternativeAnimal = this.aiQueue.preview(1)[0];
        if (alternativeAnimal !== undefined) {
          const alternativeDecision = this.ai.choosePlacement(placementContext(alternativeAnimal));
          if (shouldSwapAIAnimal(decision, alternativeDecision)) {
            const didSwap = this.swapCurrentAnimal('ai');
            decision = didSwap && this.currentAnimal === alternativeAnimal
              ? alternativeDecision
              : this.ai.choosePlacement(placementContext(this.currentAnimal));
          }
        }
      }

      if (turnGeneration !== this.generation || this.phase !== 'thinking' || this.preview === null) {
        return;
      }

      const target = this.preview;
      const definition = getAnimalDefinition(this.currentAnimal);
      this.aiTween = this.tweens.add({
        targets: target,
        x: decision.x,
        y: previewAimY(definition),
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
    this.drawAimGuide();
  }

  private drawAimGuide(): void {
    const guide = this.aimGuide;
    guide?.clear();
    if (
      !this.guideLinesEnabled ||
      guide === null ||
      this.preview === null ||
      this.actor !== 'player' ||
      this.phase !== 'aiming'
    ) {
      return;
    }

    const definition = getAnimalDefinition(this.currentAnimal);
    const bounds = rotatedCollisionXBounds(definition, this.preview.angle);
    const footprintMinX = this.preview.x + bounds.minX;
    const footprintMaxX = this.preview.x + bounds.maxX;
    let landingY = PLATFORM_Y - PLATFORM_BODY_HEIGHT / 2;

    for (const record of this.records) {
      const bodyBounds = record.body.bounds;
      const overlapsFootprint = bodyBounds.max.x >= footprintMinX && bodyBounds.min.x <= footprintMaxX;
      if (overlapsFootprint) {
        landingY = Math.min(landingY, bodyBounds.min.y);
      }
    }

    const color = AIM_GUIDE_COLORS[definition.gameplay.role];
    const lineStartY = this.preview.y + 22;
    guide.lineStyle(2, color, 0.38);
    for (let y = lineStartY; y < landingY - 7; y += 12) {
      guide.lineBetween(this.preview.x, y, this.preview.x, Math.min(y + 6, landingY - 7));
    }
    guide.fillStyle(color, 0.2);
    guide.fillRoundedRect(footprintMinX, landingY - 4, footprintMaxX - footprintMinX, 8, 4);
    guide.lineStyle(2, color, 0.58);
    guide.strokeRoundedRect(footprintMinX, landingY - 4, footprintMaxX - footprintMinX, 8, 4);
  }

  private rotatePreview(deltaAngle: number): void {
    if (this.preview === null) {
      return;
    }
    const angle = normalizeAngle(this.preview.angle + deltaAngle);
    this.preview.setAngle(angle);
    this.setPreviewX(this.preview.x);
  }

  private dropCurrent(): void {
    if (this.preview === null || (this.phase !== 'aiming' && this.phase !== 'thinking')) {
      return;
    }

    this.cancelAiWork();
    this.moveLeft = false;
    this.moveRight = false;
    this.rotateLeft = false;
    this.rotateRight = false;
    const definition = getAnimalDefinition(this.currentAnimal);
    const angle = this.preview.angle;
    const collisionOrigin = collisionOriginFromPreviewCenter(
      definition,
      this.preview.x,
      this.preview.y,
      angle,
    );
    this.preview.destroy();
    this.preview = null;
    this.aimGuide?.clear();
    this.placedAnimalNotice = null;
    const record = this.spawnPhysicsAnimal(
      this.currentAnimal,
      this.actor,
      collisionOrigin.x,
      collisionOrigin.y,
      angle,
    );
    this.records.push(record);
    this.currentDropId = record.id;
    this.lastDropActor = this.actor;
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
    // Keep the render and temporary default Matter body on one uniform scale.
    // The alpha-derived outline body installed below already uses that scale.
    image.setScale(definition.displayScale);

    const body = this.createOutlineBody(definition, x, y, angleDeg);
    image.setExistingBody(body, true);
    const physicsCollision = getPhysicsCollision(definition);
    image.setOrigin(physicsCollision.textureOrigin.x, physicsCollision.textureOrigin.y);
    image.setPosition(x, y);
    image.setAngle(angleDeg);
    image.setFriction(definition.physics.friction, definition.physics.frictionAir, definition.physics.frictionStatic);
    image.setBounce(definition.physics.restitution);
    image.setDensity(definition.physics.density);
    image.setSleepThreshold(WOOD_SLEEP_THRESHOLD);
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
    const outline = getPhysicsCollision(definition).outline.map((point) => ({ x: point.x, y: point.y }));
    const body = this.matter.bodies.fromVertices(x, y, [outline], {
      friction: definition.physics.friction,
      frictionStatic: definition.physics.frictionStatic,
      frictionAir: definition.physics.frictionAir,
      restitution: definition.physics.restitution,
      slop: WOOD_CONTACT_SLOP,
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

  private resolveFalls(): boolean {
    const fallen = this.records.filter((record) => {
      const bounds = record.body.bounds;
      return bounds.min.y > FALL_BOUNDARY_Y
        || bounds.max.x < -70
        || bounds.min.x > GAME_WIDTH + 70;
    });

    const outcome = resolveFallOutcome({
      phase: this.phase,
      actingActor: this.actor,
      lastActingActor: this.lastDropActor,
      fallenBodies: fallen.map((record) => ({
        id: record.id,
        owner: record.actor,
        isCurrentDrop: record.id === this.currentDropId,
      })),
    });
    if (outcome !== null) {
      this.finishMatch(outcome.winner, 'fell');
      return true;
    }
    return false;
  }

  private updateResolution(): void {
    const snapshots = this.records.map((record) => this.toSnapshot(record));
    // Matter's clock advances only when physics steps. Phaser Clock.now keeps
    // advancing during pause, so it cannot measure either settling window.
    const stability = this.stability.sample(this.matter.world.engine.timing.timestamp, snapshots);
    if (!this.settledContact && stability.state !== 'timed-out') {
      return;
    }

    if (stability.state === 'timed-out') {
      this.finishMatch(this.actor === 'player' ? 'ai' : 'player', 'unstable');
      return;
    }

    if (stability.state !== 'stable') {
      return;
    }

    const towerCrossedDanger = this.records.some((record) => record.body.bounds.min.y < DANGER_Y);
    if (towerCrossedDanger) {
      this.finishMatch(this.actor === 'player' ? 'ai' : 'player', 'danger');
      return;
    }

    // The turn resolver already observed the whole tower below the strict
    // quiet thresholds for 850ms. Latch those bodies to Matter sleeping so a
    // residual solver correction cannot remain visible between turns. A later
    // falling animal automatically wakes any sleeping body it hits.
    for (const record of this.records) {
      record.image.setToSleep();
    }

    const placedRecord = this.records.find((record) => record.id === this.currentDropId);
    if (placedRecord !== undefined) {
      this.placedAnimalNotice = placedRecord.animalId;
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

  private finishMatch(winner: Actor, reason: ResultReason): void {
    if (this.phase === 'game-over') {
      return;
    }
    this.phase = 'game-over';
    this.winner = winner;
    this.resultReason = reason;
    this.moveLeft = false;
    this.moveRight = false;
    this.rotateLeft = false;
    this.rotateRight = false;
    this.aimGuide?.clear();
    this.cancelAiWork();
    this.matter.world.pause();
    this.audio.play(winner === 'player' ? 'win' : 'lose');
    this.publish();
  }

  private pauseMatch(reason: GamePauseReason = 'user'): void {
    if (this.pauseReasons.has(reason) || this.phase === 'game-over' || this.phase === 'ready') {
      return;
    }
    this.pauseReasons.add(reason);
    this.moveLeft = false;
    this.moveRight = false;
    this.rotateLeft = false;
    this.rotateRight = false;
    this.dragPointerId = null;
    this.matter.world.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.publish();
  }

  private resumeMatch(reason: GamePauseReason = 'user'): void {
    if (!this.pauseReasons.delete(reason) || this.paused) {
      return;
    }
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
    const animalCopy = getAnimalCopy(this.currentAnimal, this.language);
    let message = '';
    if (this.resultReason !== null && this.winner !== null) {
      const reasonCopy = this.language === 'zh'
        ? {
            fell: '动物从平台上掉下去了',
            unstable: '动物一直没有站稳',
            danger: '动物塔超过了红色危险线',
          }[this.resultReason]
        : {
            fell: 'An animal fell off the platform',
            unstable: 'The animal could not find its balance',
            danger: 'The tower crossed the red danger line',
          }[this.resultReason];
      message = this.language === 'zh'
        ? this.winner === 'player'
          ? `${reasonCopy}，Milo 本回合失败。`
          : `${reasonCopy}，这一回合由 Milo 获胜。`
        : this.winner === 'player'
          ? `${reasonCopy}. Milo loses this round.`
          : `${reasonCopy}. Milo wins this round.`;
    } else {
      if (phase === 'humanAiming') {
        if (this.swapNotice?.actor === 'player') {
          message = this.language === 'zh'
            ? `已换成${animalCopy.name} · 还可换 ${this.swapNotice.remaining} 次`
            : `Swapped to ${animalCopy.name} · ${this.swapNotice.remaining} swaps left`;
        } else {
          message = `${animalCopy.trait} · ${animalCopy.tip}`;
        }
      } else if (phase === 'humanSettling') {
        message = this.language === 'zh'
          ? `${animalCopy.name}正在寻找平衡…`
          : `${animalCopy.name} is finding its balance…`;
      } else if (phase === 'aiThinking') {
        const aiCopy = this.language === 'zh'
          ? 'Milo 正在观察动物塔…'
          : 'Milo is studying the animal tower…';
        if (this.swapNotice?.actor === 'ai') {
          message = this.language === 'zh'
            ? `Milo 换成了${animalCopy.name} · 还可换 ${this.swapNotice.remaining} 次`
            : `Milo swapped to ${animalCopy.name} · ${this.swapNotice.remaining} swaps left`;
        } else if (this.placedAnimalNotice !== null) {
          const placed = getAnimalCopy(this.placedAnimalNotice, this.language);
          message = this.language === 'zh'
            ? `${placed.name}：${placed.settledCopy} · ${aiCopy}`
            : `${placed.name}: ${placed.settledCopy} · ${aiCopy}`;
        } else {
          message = aiCopy;
        }
      } else if (phase === 'aiSettling') {
        message = this.language === 'zh' ? 'Milo 的动物正在落下' : "Milo's animal is falling";
      }
    }

    this.hooks.publish({
      language: this.language,
      phase,
      turn: uiActor,
      round: this.round,
      scoreHuman: this.scorePlayer,
      scoreAi: this.scoreAi,
      swapsHuman: this.swapsPlayer,
      swapsAi: this.swapsAi,
      message,
      currentAnimal: getAnimalPreview(this.currentAnimal, this.language),
      upcomingHuman: this.playerQueue.preview(3).map((id) => getAnimalPreview(id, this.language)),
      upcomingAi: this.aiQueue.preview(3).map((id) => getAnimalPreview(id, this.language)),
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
        swapsHuman: this.swapsPlayer,
        swapsAi: this.swapsAi,
        guideLinesEnabled: this.guideLinesEnabled,
        previewAngle: this.preview?.angle ?? null,
        previewPosition: this.preview === null
          ? null
          : { x: this.preview.x, y: this.preview.y },
        bodies: this.records.map((record) => this.toSnapshot(record)),
      }),
      restart: () => this.restartMatch(),
      swap: () => this.swapCurrentAnimal(this.actor),
      place: (x, angle = 0) => {
        if (this.phase === 'aiming' && this.actor === 'player' && this.preview !== null) {
          this.preview.setAngle(normalizeAngle(angle));
          this.setPreviewX(x);
          this.dropCurrent();
        }
      },
      resolveAiImmediately: () => {
        if (this.phase === 'thinking') {
          this.cancelAiWork();
          this.scheduleAi(0);
        }
      },
      forceFall: (bodyId) => {
        const record = this.records.find((body) => body.id === bodyId);
        if (record !== undefined) {
          record.image.setAwake();
          record.image.setPosition(record.body.position.x, FALL_BOUNDARY_Y + 300);
        }
      },
    };
    this.testApi = testApi;
    window.__STACKIMALS_TEST__ = testApi;
  }

  private handleShutdown(): void {
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onAssetLoadError, this);
    this.cancelAiWork();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize, this);
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
    this.audio.destroy();
  }
}

export const STACKIMALS_GAME_SIZE = { width: GAME_WIDTH, height: GAME_HEIGHT } as const;
