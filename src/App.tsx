import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import './App.css';

type Card = {
  question: string;
  subQuestion?: string;
  answer: string;
  explanation?: string;
  options?: string[];
};

export default function FlashcardApp() {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [disableFlipAnim, setDisableFlipAnim] = useState(false);

  // swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // end modal
  const [, setShowEndModal] = useState(false);

  const [, setGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState('');

  useEffect(() => {
    const loadCards = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('./flashcards.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const valid = (data as Card[]).filter((c) => c?.question && c?.answer);
        setCards(valid);
      } catch (e: any) {
        setLoadError(`로드 실패: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadCards();
  }, []);

  const total = cards.length;
  const isLast = total > 0 && currentIndex === total - 1;
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  const resetViewState = () => {
    setIsFlipped(false);
    setShowExplanation(false);
  };

  const closeGoto = () => {
    setGotoOpen(false);
    setGotoValue('');
  };

  const goToIndexInstantFront = (nextIndex: number) => {
    setDisableFlipAnim(true);

    setIsFlipped(false);
    setShowExplanation(false);
    setCurrentIndex(nextIndex);

    requestAnimationFrame(() => {
      setDisableFlipAnim(false);
    });
  };

  const requestNext = () => {
    if (total <= 0) return;

    if (isLast) {
      setShowEndModal(true);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (isFlipped) {
      goToIndexInstantFront(nextIndex);
      closeGoto();
      return;
    }

    setCurrentIndex(nextIndex);
    resetViewState();
    closeGoto();
  };

  const requestPrev = () => {
    if (currentIndex <= 0) return;

    const prevIndex = currentIndex - 1;

    if (isFlipped) {
      goToIndexInstantFront(prevIndex);
      closeGoto();
      return;
    }

    setCurrentIndex(prevIndex);
    resetViewState();
    closeGoto();
  };


  const requestReset = () => {
    setCurrentIndex(0);
    resetViewState();
    closeGoto();
    setShowEndModal(false);
  };

  const handleGotoCommit = () => {
    if (total <= 0) return;

    const n = Number(gotoValue);
    if (!Number.isFinite(n)) return;

    const target = Math.min(Math.max(Math.trunc(n), 1), total) - 1;
    setCurrentIndex(target);
    resetViewState();
    closeGoto();
  };

  // swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) requestNext(); // swipe left => next
    if (distance < -minSwipeDistance) requestPrev(); // swipe right => prev
  };

  if (isLoading) return <div className="fc-loading">로딩 중...</div>;
  if (loadError) return <div className="fc-loading">{loadError}</div>;
  if (!cards[currentIndex]) return <div className="fc-loading">카드가 없습니다.</div>;

  const card = cards[currentIndex];

  return (
    <div className="fc-page">
      <div className="fc-wrap">
        {/* 진행 바 */}
        <div className="fc-progress">
          <div className="fc-progress-info">
            <span>{Math.round(progress)}%</span>
            <span className="fc-sub">스와이프: 이전/다음 · 탭: 뒤집기</span>
          </div>
          <div className="fc-progress-bar-bg">
            <div className="fc-progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {/* 카드 */}
        <div className="fc-card-area">
          <div className="fc-card-perspective">
            <div
              className={`fc-card ${isFlipped ? 'is-flipped' : ''} ${disableFlipAnim ? 'no-flip-anim' : ''}`}
              onClick={() => setIsFlipped((v) => !v)}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              role="button"
              tabIndex={0}
            >
              {/* FRONT */}
              <div className="fc-face fc-front">
                <div className="fc-face-layout">
                  <span className="fc-tag fc-tag--q">QUESTION {currentIndex + 1}</span>
                  <div className="fc-text" style={{ justifyContent: 'flex-start' }}>
                    <p className="fc-q">{card.question}</p>
                    {card.subQuestion && (
                      <p className="fc-sub-q">{card.subQuestion}</p>
                    )}
                    {card.options && (
                      <div className="fc-options">
                        {card.options.map((opt, i) => (
                          <div key={i} className="fc-option">
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="fc-hint fc-hint--front">탭하여 뒤집기</span>
                </div>
              </div>
              {/* BACK */}
              <div className="fc-face fc-back">
                <div className="fc-face-layout">
                  <span className="fc-tag fc-tag--a">ANSWER</span>
                  <div className="fc-text" style={{ justifyContent: 'center' }}>
                    <p className="fc-a">{card.answer}</p>
                  </div>
                  <span className="fc-hint fc-hint--back">탭하여 뒤집기</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 하단: 컨트롤 + goto (버튼 아래) */}
        <div className="fc-bottom">
          {/* 해설 */}
          {isFlipped && card.explanation && (
            <div className="fc-explain">
              <button
                className="fc-explain-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplanation((v) => !v);
                }}
              >
                {showExplanation ? '해설 숨기기' : '해설 보기'}
              </button>
              {showExplanation && <div className="fc-explain-box">{card.explanation}</div>}
            </div>
          )}
          {/* 버튼 3개 */}
          <div className="fc-controls">
            <button
              onClick={requestPrev}
              disabled={currentIndex === 0}
              className="fc-round-btn"
              type="button"
              aria-label="Previous"
            >
              <ChevronLeft size={24} />
            </button>
            <button onClick={requestReset} className="fc-round-btn" type="button" aria-label="Reset">
              <RotateCw size={20} />
            </button>
            <button
              onClick={requestNext}
              disabled={currentIndex === total - 1}
              className="fc-round-btn"
              type="button"
              aria-label="Next"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          {/* goto row (버튼 아래) */}
          <div className="fc-goto-row">
            <div className="fc-goto-left">
              <span className="fc-goto-count">
                <span className="fc-goto-now">[{currentIndex + 1}]</span>/{total}
              </span>
            </div>
            <div className="fc-goto-right">
              <div className="fc-goto-edit">
                <input
                  className="fc-goto-input"
                  type="number"
                  min={1}
                  max={total}
                  value={gotoValue}
                  onChange={(e) => setGotoValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGotoCommit();
                  }}
                  placeholder=""
                  aria-label="Go to card number"
                  autoFocus
                />
                <button className="fc-goto-go" type="button" onClick={handleGotoCommit} aria-label="Go">
                  ➜
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
