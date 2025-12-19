import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Info } from 'lucide-react';
import './App.css'

const FlashcardApp = () => {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    const loadCards = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/flashcards.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const validCards = data.filter(card => card.question && card.answer);
        setCards(validCards);
      } catch (error) { setLoadError(`로드 실패: ${error.message}`); }
      finally { setIsLoading(false); }
    };
    loadCards();
  }, []);

  const handleNext = () => { if (currentIndex < cards.length - 1) { setCurrentIndex(currentIndex + 1); setIsFlipped(false); setShowExplanation(false); } };
  const handlePrev = () => { if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setIsFlipped(false); setShowExplanation(false); } };
  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowExplanation(false);
  };
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) handleNext();
    if (distance < -minSwipeDistance) handlePrev();
  };

  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;
  if (isLoading || !cards[currentIndex]) return <div style={styles.loadingContainer}>로딩 중...</div>;
  const currentCard = cards[currentIndex];

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* 상단 진행 바 */}
        <div style={styles.progressContainer}>
          <div style={styles.progressInfo}>
            <span>{currentIndex + 1} / {cards.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={styles.progressBarBg}>
            <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
          </div>
        </div>
        {/* 카드 Area */}
        <div style={styles.cardArea}>
          <div style={styles.cardPerspective}>
            <div
              style={{
                ...styles.cardContainer,
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
              onClick={() => setIsFlipped(!isFlipped)}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* 앞면 */}
              <div style={styles.cardFront}>
                <div style={styles.cardContentLayout}>
                  <span style={styles.cardTag}>QUESTION</span>
                  <div style={styles.cardTextContent}>
                    <p style={styles.questionText}>{currentCard.question}</p>
                    {currentCard.options && (
                      <div style={styles.optionsWrapper}>
                        {currentCard.options.map((opt, i) => (
                          <div key={i} style={styles.optionItem}>{opt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={styles.hintText}>탭하여 뒤집기</span>
                </div>
              </div>
              {/* 뒷면 */}
              <div style={styles.cardBack}>
                <div style={styles.cardContentLayout}>
                  <span style={styles.cardTagWhite}>ANSWER</span>
                  <div style={styles.cardTextContent}>
                    <p style={styles.answerText}>{currentCard.answer}</p>
                  </div>
                  <span style={styles.hintTextWhite}>탭하여 뒤집기</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center text-gray-600 text-sm">
            <p>손가락 스와이프</p>
            <p>← →: 이전/다음</p>
          </div>
        </div>
        {/* 하단 컨트롤 */}
        <div style={styles.bottomArea}>
          {isFlipped && currentCard.explanation && (
            <div style={styles.explanationWrapper}>
              <button
                style={styles.explanationBtn}
                onClick={(e) => { e.stopPropagation(); setShowExplanation(!showExplanation); }}
              >
                <Info size={16} /> {showExplanation ? '해설 숨기기' : '해설 보기'}
              </button>
              {showExplanation && (
                <div style={styles.explanationBox}>{currentCard.explanation}</div>
              )}
            </div>
          )}
          <div style={styles.buttonGroup}>
            <button onClick={handlePrev} disabled={currentIndex === 0} style={styles.roundBtn}>
              <ChevronLeft size={24} />
            </button>
            <button onClick={handleReset} style={styles.roundBtn}>
              <RotateCw size={20} />
            </button>
            <button onClick={handleNext} disabled={currentIndex === cards.length - 1} style={styles.roundBtn}>
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100dvh',
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    boxSizing: 'border-box' as const,
  },
  wrapper: {
    width: '100%',
    maxWidth: '470px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
  },
  progressContainer: {
    marginBottom: '16px',
    width: '100%',
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '6px',
    fontWeight: '600',
  },
  progressBarBg: {
    height: '6px',
    backgroundColor: '#e2e8f0',
    borderRadius: '3px',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  cardArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardPerspective: {
    perspective: '1200px', // 원근감 증가
    width: '100%',
    height: '100%',
    maxHeight: '400px', // 카드 최대 높이 제한
    position: 'relative' as const,
  },
  cardContainer: {
    position: 'absolute' as const,
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d' as const,
    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'center center', // 회전 중심 고정
  },
  cardFront: {
    position: 'absolute' as const,
    inset: 0, // top, left, right, bottom 0으로 고정
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    boxSizing: 'border-box' as const,
  },
  cardBack: {
    position: 'absolute' as const,
    inset: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    transform: 'rotateY(180deg)',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    borderRadius: '20px',
    boxSizing: 'border-box' as const,
  },
  cardContentLayout: {
    padding: '24px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
  },
  cardTag: { fontSize: '11px', fontWeight: '800', color: '#3b82f6' },
  cardTagWhite: { fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  cardTextContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    textAlign: 'center' as const,
    overflow: 'hidden',
  },
  questionText: { fontSize: '1.2rem', fontWeight: '700', color: '#1e293b', marginBottom: '12px' },
  answerText: { fontSize: '1.4rem', fontWeight: '700', color: '#fff' },
  optionsWrapper: { textAlign: 'left' as const, fontSize: '0.9rem', color: '#475569', gap: '4px' },
  optionItem: { padding: '2px 0' },
  hintText: { textAlign: 'center' as const, fontSize: '11px', color: '#94a3b8' },
  hintTextWhite: { textAlign: 'center' as const, fontSize: '11px', color: 'rgba(255,255,255,0.5)' },
  bottomArea: { paddingBottom: '20px' },
  explanationWrapper: { marginBottom: '12px' },
  explanationBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  explanationBox: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    fontSize: '12px',
    maxHeight: '70px',
    overflowY: 'auto' as const,
  },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '30px' },
  roundBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#1e293b',
    color: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default FlashcardApp;
