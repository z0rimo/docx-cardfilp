import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Info } from 'lucide-react';

type Flashcard = {
  question: string;
  options?: string[];
  answer: string;
  explanation?: string | null;
};

const FlashcardApp = () => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const res = await fetch('/flashcards.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as unknown;

        if (!Array.isArray(data)) {
          throw new Error('JSON 최상단은 배열([])이어야 합니다.');
        }

        // 최소 유효성 검사 + 정규화
        const normalized: Flashcard[] = data
          .map((x: any) => ({
            question: String(x?.question ?? '').trim(),
            options: Array.isArray(x?.options) ? x.options.map((v: any) => String(v)) : undefined,
            answer: String(x?.answer ?? '').trim(),
            explanation: x?.explanation == null ? null : String(x.explanation),
          }))
          .filter(c => c.question && c.answer);

        if (!normalized.length) {
          throw new Error('유효한 카드가 없습니다. (question/answer 필수)');
        }

        if (!cancelled) {
          setCards(normalized);
          setCurrentIndex(0);
          setIsFlipped(false);
          setShowExplanation(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(`JSON 로드 실패: ${e?.message ?? String(e)}`);
          setCards([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNext = () => {
    setCurrentIndex(prev => {
      const next = Math.min(prev + 1, cards.length - 1);
      return next;
    });
    setIsFlipped(false);
    setShowExplanation(false);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
    setIsFlipped(false);
    setShowExplanation(false);
  };

  const handleReset = () => {
    setIsFlipped(false);
    setShowExplanation(false);
  };

  const handleFlip = () => {
    setIsFlipped(v => !v);
  };

  // 키보드 단축키 (cards.length 등 최신 상태를 참조하도록 deps 포함)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(v => !v);
      } else if (e.code === 'ArrowLeft') {
        if (currentIndex > 0) handlePrev();
      } else if (e.code === 'ArrowRight') {
        if (currentIndex < cards.length - 1) handleNext();
      } else if (e.code === 'KeyR') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, cards.length]);

  const progress = useMemo(() => {
    return cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;
  }, [cards.length, currentIndex]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-700 text-2xl">카드를 로딩중...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">로드 오류</h2>
          <p className="text-gray-700 mb-4">{loadError}</p>
          <div className="text-sm text-gray-600 space-y-2">
            <div>✅ 확인 1) 파일 위치: <b>public/flashcards.json</b></div>
            <div>✅ 확인 2) 브라우저에서 <b>/flashcards.json</b> 직접 열었을 때 JSON이 보여야 함</div>
            <div>✅ 확인 3) 최상단은 배열([])이고, 각 항목은 question/answer 포함</div>
          </div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-700 text-2xl">카드가 없습니다.</div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">네이버 클라우드 플랫폼</h1>
          <p className="text-gray-600">기출문제 학습 카드</p>
        </div>

        {/* 진행률 바 */}
        <div className="mb-6">
          <div className="flex justify-between text-gray-700 text-sm mb-2">
            <span>{currentIndex + 1} / {cards.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 카드 */}
        <div className="perspective-1000 mb-6">
          <div
            className="relative w-full h-96 transition-transform duration-500 transform-style-3d cursor-pointer"
            onClick={handleFlip}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* 앞면 - 문제 */}
            <div
              className="absolute w-full h-full bg-white rounded-2xl shadow-2xl p-8 backface-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="flex flex-col h-full">
                <div className="text-sm text-indigo-600 font-semibold mb-4">문제</div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-2xl font-medium text-gray-800 text-center leading-relaxed">
                    {currentCard.question}
                  </p>
                </div>

                {currentCard.options?.length ? (
                  <div className="space-y-2 mt-6">
                    {currentCard.options.map((option, idx) => (
                      <div key={idx} className="text-gray-700 text-lg">
                        {option}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="text-center text-gray-400 text-sm mt-4">
                  클릭 또는 스페이스바로 뒤집기
                </div>
              </div>
            </div>

            {/* 뒷면 - 정답 */}
            <div
              className="absolute w-full h-full bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-2xl p-8 backface-hidden"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <div className="flex flex-col h-full">
                <div className="text-sm text-white font-semibold mb-4">정답</div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-3xl font-bold text-white text-center leading-relaxed">
                    {currentCard.answer}
                  </p>
                </div>
                <div className="text-center text-white/80 text-sm mt-4">
                  클릭 또는 스페이스바로 뒤집기
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 해설 버튼 */}
        {isFlipped && currentCard.explanation ? (
          <div className="mb-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowExplanation(v => !v);
              }}
              className="w-full bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Info size={20} />
              {showExplanation ? '해설 숨기기' : '해설 보기'}
            </button>

            {showExplanation && (
              <div className="mt-4 bg-white rounded-lg p-6 shadow-lg border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">📝 해설</h3>
                <p className="text-gray-700 leading-relaxed">{currentCard.explanation}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* 컨트롤 버튼 */}
        <div className="flex gap-4 justify-center items-center">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <button
            onClick={handleReset}
            className="bg-gray-700 hover:bg-gray-800 text-white p-4 rounded-full transition-colors"
            title="카드 초기화 (R)"
          >
            <RotateCw size={24} />
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-full transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* 키보드 단축키 안내 */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          <p className="mb-1">⌨️ 키보드 단축키</p>
          <p>Space: 카드 뒤집기 | ← →: 이전/다음 | R: 초기화</p>
        </div>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
      `}</style>
    </div>
  );
};

export default FlashcardApp;
