import React, { useMemo, useState } from 'react';
import { Download, FileText, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';

type Flashcard = {
  question: string;
  options: string[];
  answer: string;
  explanation: string | null;
};

const DocxToJsonConverter = () => {
  const [jsonData, setJsonData] = useState<Flashcard[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A. / A) / A． 등 변형 허용
  const isOptionLine = (s: string) => /^[A-D][\.\)．]\s*/.test(s);
  const isAnswerLine = (s: string) => /^[A-D][\.\)．]\s*/.test(s);

  // "정답: C", "답: A,B" 같은 표기 지원
  const extractInlineAnswer = (s: string): string | null => {
    const m = /^(?:정답|답|Answer)\s*[:：]?\s*([A-D](?:\s*[,/]\s*[A-D])*)\s*$/i.exec(s.trim());
    if (!m) return null;
    const letters = m[1]
      .split(/[,/]/)
      .map(v => v.trim())
      .filter(Boolean)
      .join(', ');
    return letters || null;
  };

  // 불필요한 잡음(페이지 번호/구분선 등) 제거용 (필요 시 확장)
  const isNoiseLine = (s: string) => {
    const t = s.trim();
    if (!t) return true;
    if (t === 'I' || t === 'II' || t === 'III' || t === 'IV') return true; // DOCX에서 종종 튀어나옴
    if (/^[-_=]{3,}$/.test(t)) return true;
    return false;
  };

  const normalizeMcqText = (raw: string) => {
    let t = raw.replace(/\r/g, '').replace(/\u00A0/g, ' ');

    // 1) " ...A. ..." 처럼 같은 줄에 붙은 선택지를 줄 시작으로 내리기
    //    (줄 시작이 아닌 곳에서 A./B./C./D.가 나오면 앞에 '\n' 삽입)
    t = t.replace(/([^\n])\s*([A-D][\.\)．]\s*)/g, '$1\n$2');

    // 2) 선택지 사이가 공백으로만 이어진 경우도 잘 끊기게 한번 더 정리
    t = t.replace(/\n{3,}/g, '\n\n');

    // 3) "정답: C" 같은 inline 정답이 문장 중간에 붙으면 줄로 분리
    t = t.replace(/([^\n])\s*((?:정답|답|Answer)\s*[:：]\s*[A-D](?:\s*[,/]\s*[A-D])*)/gi, '$1\n$2');

    return t;
  };

  const parseDocxContent = (rawText: string) => {
    // NBSP 정리 + 줄 단위 분해
    const lines = rawText
      .replace(/\r/g, '')
      .split('\n')
      .map(l => l.replace(/\u00A0/g, ' ').trimEnd());

    const cards: Flashcard[] = [];

    let i = 0;

    while (i < lines.length) {
      // 공백/잡음 스킵
      while (i < lines.length && isNoiseLine(lines[i])) i++;
      if (i >= lines.length) break;

      // 1) 문제 수집: "A."가 나오기 전까지 여러 줄을 question으로 합치기
      const qLines: string[] = [];
      let j = i;

      while (j < lines.length) {
        const cur = lines[j].trim();
        if (isNoiseLine(cur)) {
          j++;
          continue;
        }
        if (isOptionLine(cur)) break; // 옵션 시작

        qLines.push(cur);
        j++;

        // 다음 유효 라인이 옵션이면 문제 종료
        let k = j;
        while (k < lines.length && isNoiseLine(lines[k])) k++;
        if (k < lines.length && isOptionLine(lines[k].trim())) {
          j = k;
          break;
        }
      }

      // 옵션이 없으면 다음 줄로
      if (j >= lines.length || !isOptionLine(lines[j].trim())) {
        i = Math.max(i + 1, j);
        continue;
      }

      const question = qLines.join(' ').trim();
      if (!question) {
        i = j + 1;
        continue;
      }

      // 2) 옵션 수집: 최대 4개(필요하면 5개로 늘릴 수 있음)
      const options: string[] = [];
      while (j < lines.length) {
        const cur = lines[j].trim();
        if (isNoiseLine(cur)) {
          j++;
          continue;
        }
        if (!isOptionLine(cur)) break;

        // 옵션이 다음 줄로 이어지는 경우 이어붙이기
        let opt = cur;
        let k = j + 1;
        while (k < lines.length) {
          const nxt = lines[k].trim();
          if (isNoiseLine(nxt)) {
            k++;
            continue;
          }
          if (isOptionLine(nxt)) break; // 다음 옵션
          // 옵션 설명이 줄바꿈으로 이어지는 경우
          opt += ' ' + nxt;
          k++;
        }

        options.push(opt);
        j = k;

        if (options.length >= 4) break;
      }

      if (options.length < 2) {
        i = j + 1;
        continue;
      }

      // 3) 정답 수집: 다음 문제(질문 + 곧 A.)가 시작되기 전까지
      const answers: string[] = [];
      let a = j;

      // 정답 후보 시작점(공백/잡음 스킵)
      while (a < lines.length && isNoiseLine(lines[a])) a++;

      // 핵심 버그 수정 포인트:
      // - "다음 문제 시작"을 감지한 시점의 라인은 소비하지 않고
      // - i를 그 라인으로 되돌려 다음 루프에서 질문으로 처리하게 함
      while (a < lines.length) {
        const cur = lines[a].trim();
        if (isNoiseLine(cur)) {
          a++;
          continue;
        }

        // (a) "정답: C" 같은 inline 정답 처리
        const inline = extractInlineAnswer(cur);
        if (inline) {
          answers.push(inline);
          a++;
          // inline 정답은 보통 한 줄로 끝나므로 다음 문제로 넘어가도 됨
          break;
        }

        // (b) 다음 문제 시작 감지: 현재 라인이 옵션이 아니고,
        //     다음 유효 라인이 A.로 시작하면 "cur"은 다음 문제의 질문 라인
        if (!isAnswerLine(cur) && !isOptionLine(cur)) {
          let k = a + 1;
          while (k < lines.length && isNoiseLine(lines[k])) k++;
          if (k < lines.length && isOptionLine(lines[k].trim())) {
            // ✅ 여기서 break하면 cur(질문)를 소비하지 않음
            break;
          }
        }

        if (isAnswerLine(cur)) {
          answers.push(cur);
        } else if (answers.length > 0) {
          // 정답 설명이 줄바꿈으로 이어지는 경우
          answers[answers.length - 1] += ' ' + cur;
        } else {
          // 정답이 아예 없고 바로 다음 문제로 넘어가는 자료도 있을 수 있으니
          // 여기서는 무리하게 answers에 넣지 않음
        }

        a++;
      }

      const answer = answers.join('\n').trim();

      // 정답이 없으면 카드로 넣지 말지(엄격) / 넣을지(관대) 선택 가능
      // 여기서는 관대하게: 정답이 없으면 "UNKNOWN" 처리
      cards.push({
        question,
        options,
        answer: answer || 'UNKNOWN',
        explanation: null
      });

      // ✅ 다음 루프 시작점:
      // - 다음 문제 질문 라인에서 멈췄다면 i = a (질문부터 다시 읽어야 함)
      // - 끝까지 갔다면 i = a
      i = a;
    }

    return cards;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      const normalized = normalizeMcqText(text);
      const cards = parseDocxContent(normalized);

      console.log('파싱된 카드 수:', cards.length);
      console.log('첫 카드 샘플:', cards[0]);

      console.log('원본 A. 개수:', (text.match(/A[\.\)．]\s/g) ?? []).length);
      console.log('정규화 후 A. 개수:', (normalized.match(/\nA[\.\)．]\s/g) ?? []).length);
      console.log('카드 수:', cards.length);


      if (cards.length === 0) {
        setError('문제를 찾을 수 없습니다. 파일 형식을 확인해주세요.');
        setJsonData(null);
      } else {
        setJsonData(cards);
      }
    } catch (err: any) {
      setError('파일 처리 중 오류가 발생했습니다: ' + (err?.message ?? String(err)));
      setJsonData(null);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadJson = () => {
    if (!jsonData) return;

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const preview = useMemo(() => (jsonData ? jsonData.slice(0, 5) : []), [jsonData]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">DOCX to JSON 변환기</h1>
          <p className="text-gray-600 mb-8">DOCX 기출문제 파일을 플래시카드 JSON으로 변환</p>

          {/* 파일 업로드 */}
          <div className="mb-8">
            <label className="block mb-2 text-sm font-medium text-gray-700">DOCX 파일 선택</label>
            <div className="flex items-center gap-4">
              <label className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-blue-50 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <FileText className="text-blue-500" size={24} />
                <span className="text-blue-600 font-medium">
                  {isProcessing ? '처리중...' : '파일 선택 또는 드래그'}
                </span>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing}
                />
              </label>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* 결과 */}
          {jsonData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">변환 완료!</p>
                    <p className="text-sm text-gray-600">{jsonData.length}개의 카드가 생성되었습니다</p>
                  </div>
                </div>
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download size={18} />
                  JSON 다운로드
                </button>
              </div>

              {/* 미리보기 */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">미리보기 (처음 5개)</h3>
                <div className="space-y-3">
                  {preview.map((card, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="font-medium text-gray-800 mb-2">
                        Q{idx + 1}: {card.question}
                      </p>
                      <div className="text-sm text-gray-600 mb-2 space-y-1 pl-4">
                        {card.options.map((opt, i) => (
                          <div key={i}>{opt}</div>
                        ))}
                      </div>
                      <p className="text-sm text-green-700 font-medium bg-green-50 p-2 rounded">
                        ✓ {card.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* JSON 전체 보기 */}
              <details className="mt-4">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                  전체 JSON 보기 (클릭하여 펼치기)
                </summary>
                <pre className="mt-3 p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* 사용 안내 */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">📝 파일 형식 안내</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p className="font-medium">권장 형식:</p>
              <pre className="bg-white p-3 rounded border border-blue-200 text-xs">
                {`문제 내용 (물음표 없어도 OK)
A. 선택지 1
B. 선택지 2
C. 선택지 3
D. 선택지 4

정답: C  (또는)
C. 선택지 3`}
              </pre>
              <p className="text-xs text-gray-500 mt-2">
                💡 문제는 여러 줄이어도 되고, 정답은 “정답: C” 또는 “C. …” 둘 다 지원합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocxToJsonConverter;
