import type { GameActor, GameSnapshot } from './gameBridge';
import { RestartIcon, SparkleIcon } from './icons';

interface GameModalProps {
  snapshot: GameSnapshot;
  restartConfirmationOpen: boolean;
  onResume: () => void;
  onRequestRestart: () => void;
  onCancelRestart: () => void;
  onConfirmRestart: () => void;
}

function winnerCopy(winner: GameActor | null) {
  if (winner === 'human') {
    return {
      eyebrow: 'TOWER MASTER',
      title: '你赢了！',
      body: 'Milo 的动物掉下去了。你的动物塔稳稳站住！',
    };
  }

  return {
    eyebrow: 'GOOD TRY',
    title: 'Milo 赢了',
    body: '就差一点！换个落点，再挑战一次吧。',
  };
}

export function GameModal({
  snapshot,
  restartConfirmationOpen,
  onResume,
  onRequestRestart,
  onCancelRestart,
  onConfirmRestart,
}: GameModalProps) {
  const modalOpen =
    restartConfirmationOpen ||
    snapshot.phase === 'paused' ||
    snapshot.phase === 'gameOver' ||
    snapshot.phase === 'error';

  if (!modalOpen) {
    return null;
  }

  if (restartConfirmationOpen) {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="game-modal" role="alertdialog" aria-modal="true" aria-labelledby="restart-title">
          <span className="game-modal__icon game-modal__icon--restart" aria-hidden="true">
            <RestartIcon />
          </span>
          <p className="game-modal__eyebrow">重新开局</p>
          <h2 id="restart-title">确定要重新开始？</h2>
          <p>当前的动物塔和本局分数都会清空。</p>
          <div className="game-modal__actions">
            <button type="button" className="modal-button modal-button--secondary" onClick={onCancelRestart}>
              返回
            </button>
            <button type="button" className="modal-button modal-button--danger" onClick={onConfirmRestart}>
              重新开始
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (snapshot.phase === 'paused') {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <span className="game-modal__pause-mark" aria-hidden="true"><i /><i /></span>
          <p className="game-modal__eyebrow">休息一下</p>
          <h2 id="pause-title">游戏已暂停</h2>
          <p>动物们会在这里等你回来。</p>
          <div className="game-modal__actions game-modal__actions--stacked">
            <button type="button" className="modal-button modal-button--primary" onClick={onResume} autoFocus>
              继续游戏
            </button>
            <button type="button" className="modal-button modal-button--secondary" onClick={onRequestRestart}>
              重新开始
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (snapshot.phase === 'error') {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="game-modal" role="alertdialog" aria-modal="true" aria-labelledby="error-title">
          <p className="game-modal__eyebrow">加载失败</p>
          <h2 id="error-title">动物们迷路了</h2>
          <p>{snapshot.message || '请重新开始游戏。'}</p>
          <button type="button" className="modal-button modal-button--primary" onClick={onConfirmRestart}>
            再试一次
          </button>
        </section>
      </div>
    );
  }

  const copy = winnerCopy(snapshot.winner);

  return (
    <div className="modal-backdrop modal-backdrop--celebration" role="presentation">
      <section className="game-modal game-modal--result" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <span className="game-modal__icon" aria-hidden="true">
          <SparkleIcon />
        </span>
        <p className="game-modal__eyebrow">{copy.eyebrow}</p>
        <h2 id="result-title">{copy.title}</h2>
        <p>{snapshot.message || copy.body}</p>
        <div className="result-score" aria-label={`比分 ${snapshot.scoreHuman} 比 ${snapshot.scoreAi}`}>
          <span><small>YOU</small><strong>{snapshot.scoreHuman}</strong></span>
          <i>—</i>
          <span><small>MILO</small><strong>{snapshot.scoreAi}</strong></span>
        </div>
        <button type="button" className="modal-button modal-button--primary" onClick={onConfirmRestart} autoFocus>
          再来一局
        </button>
      </section>
    </div>
  );
}
