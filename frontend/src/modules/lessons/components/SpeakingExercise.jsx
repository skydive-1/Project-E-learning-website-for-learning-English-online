import React, { useState } from 'react';
import { 
  FiVolume2, FiMic, FiSquare, FiCheckCircle, 
  FiAlertCircle, FiInfo, FiCpu, FiMessageSquare, 
  FiCheck, FiRefreshCw 
} from 'react-icons/fi';
import { useAudioRecorder } from '../../../hooks/useAudioRecorder';
import AudioVisualizer from '../../../components/ui/AudioVisualizer';
import { askChatbotAudio } from '../../chatbot/services/chatbot.service';

// Dữ liệu mẫu phong phú cho bài tập luyện phát âm theo bài học (Read Aloud)
const SPEAKING_LESSON_DATA = {
  "1": [
    { id: "s1-1", text: "Welcome to the English communication course.", translation: "Chào mừng bạn đến với khóa học tiếng Anh giao tiếp." },
    { id: "s1-2", text: "How can I interact with the AI assistant?", translation: "Làm thế nào tôi có thể tương tác với trợ lý ảo AI?" },
    { id: "s1-3", text: "Active recall is a very effective study method.", translation: "Gợi nhớ chủ động là một phương pháp học tập rất hiệu quả." }
  ],
  "2": [
    { id: "s2-1", text: "I need to stop translating English to Vietnamese in my head.", translation: "Tôi cần dừng việc dịch từ tiếng Anh sang tiếng Việt trong đầu." },
    { id: "s2-2", text: "Don't be afraid of making grammatical mistakes.", translation: "Đừng sợ việc mắc lỗi ngữ pháp." },
    { id: "s2-3", text: "Immersing myself in English is the key to fluency.", translation: "Đắm chìm trong tiếng Anh là chìa khóa dẫn đến sự trôi chảy." }
  ],
  "3": [
    { id: "s3-1", text: "I study English vocabulary every single day.", translation: "Tôi học từ vựng tiếng Anh mỗi một ngày." },
    { id: "s3-2", text: "Yesterday, I practiced speaking with the AI chatbot.", translation: "Hôm qua, tôi đã thực hành nói với chatbot AI." },
    { id: "s3-3", text: "I will speak English fluently in the future.", translation: "Tôi sẽ nói tiếng Anh trôi chảy trong tương lai." }
  ],
  "4": [
    { id: "s4-1", text: "You like learning English, don't you?", translation: "Bạn thích học tiếng Anh phải không?" },
    { id: "s4-2", text: "What is your favorite topic of conversation?", translation: "Chủ đề hội thoại yêu thích của bạn là gì?" },
    { id: "s4-3", text: "Do you prefer drinking coffee or tea?", translation: "Bạn thích uống cà phê hay trà hơn?" }
  ],
  "5": [
    { id: "s5-1", text: "Shadowing means repeating after a speaker immediately.", translation: "Shadowing nghĩa là lặp lại theo người nói ngay lập tức." },
    { id: "s5-2", text: "Listen carefully and mimic the native intonation.", translation: "Hãy nghe cẩn thận và bắt chước ngữ điệu bản xứ." },
    { id: "s5-3", text: "I record my own voice and compare it with the model.", translation: "Tôi ghi âm giọng của chính mình và so sánh với mẫu." }
  ]
};

const DEFAULT_SPEAKING_DATA = [
  { id: "sd-1", text: "I am practicing my English pronunciation with Gemini.", translation: "Tôi đang luyện tập phát âm tiếng Anh của mình với Gemini." },
  { id: "sd-2", text: "Practice makes perfect.", translation: "Luyện tập tạo nên sự hoàn hảo." },
  { id: "sd-3", text: "Learning English is an exciting journey.", translation: "Học tiếng Anh là một hành trình thú vị." }
];

// Dữ liệu mẫu phong phú cho Hỏi & Đáp Phản xạ Nói (Q&A Speaking)
const QA_LESSON_DATA = {
  "1": [
    { id: "q1-1", text: "Introduce yourself in English and tell me your target score.", translation: "Hãy giới thiệu bản thân bằng tiếng Anh và nêu mục tiêu điểm số của bạn." },
    { id: "q1-2", text: "What do you want to learn from this course?", translation: "Bạn muốn học được gì từ khóa học này?" }
  ],
  "2": [
    { id: "q2-1", text: "Describe your biggest challenge when speaking English.", translation: "Hãy mô tả khó khăn lớn nhất của bạn khi nói tiếng Anh." },
    { id: "q2-2", text: "Do you think making mistakes is useful? Why?", translation: "Bạn có nghĩ việc mắc lỗi là hữu ích không? Tại sao?" }
  ],
  "3": [
    { id: "q3-1", text: "What did you do yesterday morning to improve your English?", translation: "Sáng hôm qua bạn đã làm gì để cải thiện tiếng Anh của mình?" },
    { id: "q3-2", text: "What will you do tomorrow if you have free time?", translation: "Bạn sẽ làm gì ngày mai nếu có thời gian rảnh?" }
  ],
  "4": [
    { id: "q4-1", text: "Do you prefer talking to AI or humans? Why?", translation: "Bạn thích nói chuyện với AI hay con người hơn? Tại sao?" },
    { id: "q4-2", text: "Ask me a question about my hometown using tag questions.", translation: "Hãy hỏi tôi một câu về quê hương của tôi dùng câu hỏi đuôi." }
  ],
  "5": [
    { id: "q5-1", text: "Have you tried shadowing before? If yes, did it help?", translation: "Bạn đã từng thử shadowing chưa? Nếu rồi, nó có giúp ích gì không?" },
    { id: "q5-2", text: "What is your favorite method for learning vocabulary?", translation: "Phương pháp học từ vựng yêu thích của bạn là gì?" }
  ]
};

const DEFAULT_QA_DATA = [
  { id: "qd-1", text: "How do you practice English speaking on a daily basis?", translation: "Bạn luyện nói tiếng Anh hàng ngày như thế nào?" },
  { id: "qd-2", text: "Describe a topic you would love to discuss with an AI tutor.", translation: "Hãy mô tả một chủ đề bạn rất muốn thảo luận với gia sư AI." }
];

const SpeakingExercise = ({ lessonId, speakingSentences, speakingQuestions, onComplete }) => {
  const cleanLessonId = String(lessonId).replace('quiz-', '');
  
  // Tab chính: 'pronunciation' (Luyện phát âm theo mẫu) hoặc 'qa' (Hỏi đáp phản xạ)
  const [activeTab, setActiveTab] = useState('pronunciation');

  // Xử lý danh sách câu luyện nói (Read Aloud) từ Giảng viên / Mặc định
  let sentences = DEFAULT_SPEAKING_DATA;
  if (speakingSentences && typeof speakingSentences === 'string' && speakingSentences.trim()) {
    sentences = speakingSentences
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, idx) => {
        let text = line;
        let translation = "Câu phát âm do giảng viên biên soạn";
        if (line.includes('|')) {
          const parts = line.split('|');
          text = parts[0].trim();
          translation = parts.slice(1).join('|').trim() || translation;
        }
        return {
          id: `custom-s-${idx}`,
          text,
          translation
        };
      });
  } else {
    sentences = SPEAKING_LESSON_DATA[cleanLessonId] || DEFAULT_SPEAKING_DATA;
  }

  // Xử lý danh sách câu hỏi Q&A từ Giảng viên / Mặc định
  let qaQuestions = DEFAULT_QA_DATA;
  if (speakingQuestions && typeof speakingQuestions === 'string' && speakingQuestions.trim()) {
    qaQuestions = speakingQuestions
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, idx) => {
        let text = line;
        let translation = "Câu hỏi Q&A do giảng viên biên soạn";
        if (line.includes('|')) {
          const parts = line.split('|');
          text = parts[0].trim();
          translation = parts.slice(1).join('|').trim() || translation;
        }
        return {
          id: `custom-q-${idx}`,
          text,
          translation
        };
      });
  } else {
    qaQuestions = QA_LESSON_DATA[cleanLessonId] || DEFAULT_QA_DATA;
  }

  // States cho Phân hệ 1: Luyện phát âm (Read Aloud)
  const [activeIdx, setActiveIdx] = useState(null);
  const [showTranslation, setShowTranslation] = useState({});
  const [results, setResults] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [errorStates, setErrorStates] = useState({});
  const [activeWordFeedback, setActiveWordFeedback] = useState({});

  // States cho Phân hệ 2: Phản xạ Q&A (Conversational)
  const [activeQAIdx, setActiveQAIdx] = useState(null);
  const [showQATranslation, setShowQATranslation] = useState({});
  const [qaResults, setQaResults] = useState({});
  const [qaLoadingStates, setQaLoadingStates] = useState({});
  const [qaErrorStates, setQaErrorStates] = useState({});
  const [showTextMap, setShowTextMap] = useState({});

  // Hook ghi âm chung
  const { isRecording, recordingTime, startRecording, stopRecording, analyserRef } = useAudioRecorder();

  // Đọc âm thanh mẫu (TTS)
  const handlePlayTTS = (text, e) => {
    e.stopPropagation();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Trình duyệt của bạn không hỗ trợ công cụ Đọc tự động.");
    }
  };

  // ----- HANDLERS CHO LUỒNG LUYỆN PHÁT ÂM (READ ALOUD) -----
  const handleStartRecord = async (index, e) => {
    e.stopPropagation();
    if (isRecording) return;
    setActiveIdx(index);
    try {
      await startRecording();
    } catch (err) {
      setActiveIdx(null);
    }
  };

  const handleStopRecord = async (sentenceId, text, e) => {
    e.stopPropagation();
    const currentDuration = recordingTime;
    const audioBlob = await stopRecording();
    setActiveIdx(null);
    // Kiểm tra kích thước audio tối thiểu
    if (audioBlob.size < 500) {
      alert("Thời gian ghi âm quá ngắn. Vui lòng phát âm đầy đủ câu rồi nhấn Dừng & Chấm điểm.");
      return;
    }

    setLoadingStates(prev => ({ ...prev, [sentenceId]: true }));
    setErrorStates(prev => ({ ...prev, [sentenceId]: null }));
    setActiveWordFeedback(prev => ({ ...prev, [sentenceId]: null }));

    try {
      const evaluation = await askChatbotAudio({
        audioBlob,
        lessonId,
        mode: 'read_aloud',
        targetText: text
      });

      if (evaluation) {
        setResults(prev => ({
          ...prev,
          [sentenceId]: evaluation
        }));
      }
    } catch (error) {
      console.error("Lỗi đánh giá phát âm:", error);
      setErrorStates(prev => ({
        ...prev,
        [sentenceId]: error.message || "Lỗi kết nối máy chủ AI để chấm điểm. Vui lòng thử lại."
      }));
    } finally {
      setLoadingStates(prev => ({ ...prev, [sentenceId]: false }));
    }
  };

  // ----- HANDLERS CHO LUỒNG HỎI ĐÁP PHẢN XẠ (Q&A) -----
  const handleStartQARecord = async (index, e) => {
    e.stopPropagation();
    if (isRecording) return;
    setActiveQAIdx(index);
    try {
      await startRecording();
    } catch (err) {
      setActiveQAIdx(null);
    }
  };

  const handleStopQARecord = async (questionId, e) => {
    e.stopPropagation();
    const audioBlob = await stopRecording();
    setActiveQAIdx(null);
    if (!audioBlob) return;

    // Kiểm tra kích thước audio tối thiểu
    if (audioBlob.size < 500) {
      alert("Thời gian ghi âm quá ngắn. Vui lòng phát âm đầy đủ câu trả lời rồi nhấn Dừng & Nộp.");
      return;
    }

    setQaLoadingStates(prev => ({ ...prev, [questionId]: true }));
    setQaErrorStates(prev => ({ ...prev, [questionId]: null }));

    const questionItem = qaQuestions.find(q => q.id === questionId);
    const questionText = questionItem ? questionItem.text : null;

    try {
      const evaluation = await askChatbotAudio({
        audioBlob,
        lessonId,
        mode: 'qa',
        questionText,
        questionId
      });

      if (evaluation) {
        setQaResults(prev => ({
          ...prev,
          [questionId]: evaluation
        }));
      }
    } catch (error) {
      console.error("Lỗi đánh giá phản xạ giao tiếp Q&A:", error);
      setQaErrorStates(prev => ({
        ...prev,
        [questionId]: error.message || "Lỗi kết nối máy chủ AI để chấm điểm. Vui lòng thử lại."
      }));
    } finally {
      setQaLoadingStates(prev => ({ ...prev, [questionId]: false }));
    }
  };

  return (
    <div className="space-y-5 py-2">
      {/* Sub-tabs header */}
      <div className="flex flex-col sm:flex-row bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-700 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (isRecording) return;
            setActiveTab('pronunciation');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'pronunciation'
              ? 'bg-white dark:bg-slate-800 text-smart-indigo dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-transparent'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250 cursor-pointer'
          }`}
        >
          <FiCheckCircle className="text-[13px] shrink-0" />
          <span>Luyện phát âm (Read Aloud)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isRecording) return;
            setActiveTab('qa');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'qa'
              ? 'bg-white dark:bg-slate-800 text-smart-indigo dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-transparent'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250 cursor-pointer'
          }`}
        >
          <FiMessageSquare className="text-[13px] shrink-0" />
          <span>Phản xạ giao tiếp Q&A</span>
        </button>
      </div>

      {/* Phân hệ 1: Luyện phát âm (Read Aloud) */}
      {activeTab === 'pronunciation' && (
        <div className="space-y-4 animate-fade">
          <div className="flex items-center space-x-2.5 p-3.5 rounded-xl bg-smart-indigo/5 border border-smart-indigo/10 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
            <FiCpu className="text-lg text-smart-indigo animate-pulse shrink-0" />
            <span>
              <strong>Chế độ đọc theo mẫu:</strong> Hãy bấm loa nghe phát âm bản xứ, click <strong>Ghi âm</strong> đọc y hệt câu mẫu. AI sẽ chấm điểm và tô màu từ phát âm sai để bạn sửa đổi.
            </span>
          </div>

          {sentences.map((item, index) => {
            const isCurrentRecording = activeIdx === index && isRecording;
            const isLoading = !!loadingStates[item.id];
            const result = results[item.id];
            const errorMsg = errorStates[item.id];
            const translationVisible = !!showTranslation[item.id];
            const overallScore = result ? (result.overallScore !== undefined ? result.overallScore : result.score || 0) : 0;

            return (
              <div 
                key={item.id}
                className={`border p-5 rounded-2xl transition-all duration-300 relative shadow-sm hover:shadow-md ${
                  isCurrentRecording 
                    ? 'border-red-300 bg-red-50/10 dark:bg-red-950/5 ring-1 ring-red-200' 
                    : errorMsg
                      ? 'border-red-200 bg-red-50/10 dark:bg-red-950/10'
                      : result 
                        ? 'border-emerald-250 dark:border-emerald-900 bg-emerald-50/5 dark:bg-emerald-950/5'
                        : 'border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800'
                }`}
              >
                {/* Header buttons */}
                <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => handlePlayTTS(item.text, e)}
                      className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl transition-all border border-blue-100 dark:border-blue-800/30 flex items-center justify-center cursor-pointer"
                      title="Nghe giọng đọc mẫu"
                    >
                      <FiVolume2 className="text-[15px]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTranslation(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                      }}
                      className="text-[11px] text-slate-500 hover:text-smart-indigo font-bold px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {translationVisible ? "Ẩn nghĩa" : "Dịch câu"}
                    </button>
                  </div>

                  {result && !isLoading && (
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border shadow-xs ${
                      overallScore === 0 
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-200/50' 
                        : overallScore >= 80 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50' 
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/50'
                    }`}>
                      <span className={`text-[11px] font-bold ${
                        overallScore === 0 ? 'text-red-600 dark:text-red-400' : overallScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        Điểm AI tham khảo:
                      </span>
                      <span className={`text-sm font-extrabold ${
                        overallScore === 0 ? 'text-red-600 dark:text-red-400' : overallScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                      }`}>
                        {overallScore}%
                      </span>
                    </div>
                  )}
                </div>

                {/* English Text Display / Token Highlights */}
                <div className="my-3">
                  {result && result.words && result.words.length > 0 && !isLoading ? (
                    <div className="flex flex-wrap items-center gap-1.5 py-1">
                      {result.words.map((wordObj, wIdx) => {
                        const isCorrect = wordObj.textMatch === 'correct_text' && wordObj.acousticStatus === 'correct';
                        const isMispronounced = wordObj.acousticStatus === 'mispronounced';
                        const isMissing = wordObj.textMatch === 'missing';
                        const isExtra = wordObj.textMatch === 'extra';

                        let badgeStyle = "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
                        if (isMispronounced) {
                          badgeStyle = "bg-amber-500/10 text-amber-600 border-amber-500/40 font-bold";
                        } else if (isMissing) {
                          badgeStyle = "bg-red-500/10 text-red-500 border-dashed border-red-300 line-through opacity-70";
                        } else if (isExtra) {
                          badgeStyle = "bg-purple-500/10 text-purple-600 border-purple-300 italic";
                        }

                        return (
                          <span
                            key={wIdx}
                            onClick={() => {
                              setActiveWordFeedback(prev => ({
                                ...prev,
                                [item.id]: wordObj.feedback || (isCorrect ? "Từ phát âm chính xác!" : "Phát âm chưa chuẩn âm vị.")
                              }));
                            }}
                            className={`px-2.5 py-1 text-sm font-semibold rounded-lg border cursor-pointer hover:opacity-85 transition-all flex items-center gap-1 ${badgeStyle}`}
                          >
                            {wordObj.word}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-wide leading-relaxed">
                      {item.text}
                    </p>
                  )}

                  {translationVisible && (
                    <p className="text-xs text-slate-400 dark:text-slate-450 italic mt-2 pl-1.5 border-l-2 border-slate-200 dark:border-slate-650">
                      "{item.translation}"
                    </p>
                  )}
                </div>

                {/* Word Detail explanation */}
                {activeWordFeedback[item.id] && (
                  <div className="my-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start space-x-2 animate-fade">
                    <FiInfo className="text-slate-500 text-sm mt-0.5 shrink-0" />
                    <p className="text-[11.5px] text-slate-600 dark:text-slate-350 leading-relaxed font-semibold">
                      {activeWordFeedback[item.id]}
                    </p>
                  </div>
                )}

                {/* Component Scores for Read Aloud */}
                {result && result.components && !isLoading && (
                  <div className="my-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-450">Điểm thành phần (Rubric):</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10.5px] text-slate-500">Phát âm (35%)</div>
                        <div className="text-sm font-extrabold text-smart-indigo">{result.components.pronunciation || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10.5px] text-slate-500">Khớp nội dung (30%)</div>
                        <div className="text-sm font-extrabold text-blue-600">{result.components.contentAccuracy || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10.5px] text-slate-500">Độ trôi chảy (20%)</div>
                        <div className="text-sm font-extrabold text-emerald-600">{result.components.fluency || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10.5px] text-slate-500">Hoàn thành (15%)</div>
                        <div className="text-sm font-extrabold text-purple-600">{result.components.completeness || 0}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner if API fails */}
                {errorMsg && !isLoading && (
                  <div className="mt-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs flex items-center justify-between animate-fade">
                    <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
                      <FiAlertCircle className="text-base shrink-0" />
                      <span className="font-semibold">{errorMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleStartRecord(index, e)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <FiRefreshCw className="text-xs" />
                      <span>Thử lại</span>
                    </button>
                  </div>
                )}

                {/* General feedback paragraph */}
                {result && !isLoading && (
                  <div className={`mt-4 p-4 rounded-xl border flex items-start space-x-3 text-xs animate-fade ${
                    overallScore === 0 
                      ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/60' 
                      : overallScore >= 80 
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100/50' 
                        : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-100/50'
                  }`}>
                    {overallScore === 0 ? (
                      <FiAlertCircle className="text-red-500 text-base mt-0.5 shrink-0" />
                    ) : (
                      <FiCheckCircle className="text-emerald-500 text-base mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <p className={`font-bold ${
                        overallScore === 0 ? 'text-red-800 dark:text-red-300' : overallScore >= 80 ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
                      }`}>
                        {overallScore === 0 ? "Thông báo từ Trợ lý ảo:" : "Nhận xét chi tiết từ Trợ lý ảo:"}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                        {result.feedback?.general || result.feedback?.pronunciation || result.reply || "Bạn đã hoàn thành bài luyện đọc!"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom trigger row */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  {isLoading ? (
                    <div className="flex items-center space-x-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-150 rounded-xl">
                      <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-smart-indigo rounded-full animate-spin"></div>
                      <span className="text-[11.5px] text-slate-500 font-semibold">AI đang chấm điểm...</span>
                    </div>
                  ) : isCurrentRecording ? (
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-between bg-red-50 dark:bg-red-950/15 p-2 rounded-xl border border-red-100 dark:border-red-900/50 gap-3">
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          Đang nói... {recordingTime}s
                        </span>
                      </div>

                      {/* Visualizer */}
                      <div className="flex-1 w-full max-w-full">
                        <AudioVisualizer analyserRef={analyserRef} color="#4F46E5" />
                      </div>

                      <div className="w-full sm:w-auto flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStopRecord(item.id, item.text, e)}
                          className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm flex items-center space-x-1"
                        >
                          <FiSquare className="text-[11px]" />
                          <span>Dừng & Chấm điểm</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isRecording}
                      onClick={(e) => handleStartRecord(index, e)}
                      className={`flex items-center space-x-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        isRecording 
                          ? 'bg-slate-100 dark:bg-slate-750 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-smart-indigo hover:bg-smart-indigo-hover text-white border-transparent shadow-md'
                      }`}
                    >
                      <FiMic className="text-sm shrink-0" />
                      <span>{result ? "Nói lại câu này" : "Bắt đầu ghi âm"}</span>
                    </button>
                  )}

                  {result && !isLoading && !isCurrentRecording && (
                    <button
                      type="button"
                      onClick={() => {
                        setResults(prev => {
                          const newRes = { ...prev };
                          delete newRes[item.id];
                          return newRes;
                        });
                      }}
                      className="text-xs text-slate-400 hover:text-red-500 font-bold px-2 py-1 transition-colors"
                    >
                      Xóa kết quả
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Phân hệ 2: Phản xạ giao tiếp Q&A */}
      {activeTab === 'qa' && (
        <div className="space-y-4 animate-fade">
          <div className="flex items-center space-x-2.5 p-3.5 rounded-xl bg-smart-indigo/5 border border-smart-indigo/10 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
            <FiCpu className="text-lg text-smart-indigo animate-pulse shrink-0" />
            <span>
              <strong>Chế độ hỏi đáp phản xạ:</strong> Hãy nghe câu hỏi của giảng viên, bấm <strong>Trả lời câu hỏi</strong> để nói suy nghĩ của mình. AI sẽ nhận xét Ngữ pháp, Phát âm và gợi ý câu trả lời tự nhiên hơn cho bạn.
            </span>
          </div>

          {qaQuestions.map((item, index) => {
            const isCurrentRecording = activeQAIdx === index && isRecording;
            const isLoading = !!qaLoadingStates[item.id];
            const result = qaResults[item.id];
            const errorMsg = qaErrorStates[item.id];
            const translationVisible = !!showQATranslation[item.id];
            const showText = !!showTextMap[item.id];
            const overallScore = result ? (result.overallScore !== undefined ? result.overallScore : result.score || 0) : 0;

            return (
              <div 
                key={item.id}
                className={`border p-5 rounded-2xl transition-all duration-300 relative shadow-sm hover:shadow-md ${
                  isCurrentRecording 
                    ? 'border-red-300 bg-red-50/10 dark:bg-red-950/5 ring-1 ring-red-200' 
                    : errorMsg
                      ? 'border-red-200 bg-red-50/10 dark:bg-red-950/10'
                      : result 
                        ? 'border-blue-200 dark:border-blue-900 bg-blue-50/5 dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800'
                }`}
              >
                {/* Header actions */}
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={(e) => handlePlayTTS(item.text, e)}
                      className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs"
                      title="Nghe câu hỏi từ AI"
                    >
                      <FiVolume2 className="text-[14px]" />
                      <span>Nghe AI hỏi</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTextMap(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                      }}
                      className="text-[11px] text-slate-500 hover:text-smart-indigo font-bold px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {showText ? "Ẩn văn bản" : "Xem văn bản"}
                    </button>
                    {(showText || result) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowQATranslation(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                        }}
                        className="text-[11px] text-slate-500 hover:text-smart-indigo font-bold px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        {translationVisible ? "Ẩn dịch" : "Dịch câu hỏi"}
                      </button>
                    )}
                  </div>

                  {result && !isLoading && (
                    <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200/50 shadow-xs">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Điểm AI tham khảo:</span>
                      <span className={`text-sm font-extrabold ${overallScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : overallScore >= 60 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-500'}`}>
                        {overallScore}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Question Text / Listening Placeholder */}
                <div className="my-2">
                  {showText || result ? (
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-wide leading-relaxed">
                      {item.text}
                    </p>
                  ) : (
                    <div className="flex items-center space-x-2.5 py-4 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      <FiVolume2 className="text-blue-500 text-lg animate-pulse shrink-0" />
                      <span className="text-xs font-semibold text-slate-450 dark:text-slate-400">
                        Bấm nút "Nghe AI hỏi" ở trên để nghe câu hỏi bằng âm thanh...
                      </span>
                    </div>
                  )}
                  {translationVisible && (showText || result) && (
                    <p className="text-xs text-slate-400 dark:text-slate-450 italic mt-2 pl-1.5 border-l-2 border-slate-200 dark:border-slate-650">
                      "{item.translation}"
                    </p>
                  )}
                </div>

                {/* Score Cap Callout if applied */}
                {result && result.scoreCapApplied && !isLoading && (
                  <div className="my-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs flex items-start space-x-2 text-amber-800 dark:text-amber-300 animate-fade">
                    <FiAlertCircle className="text-base shrink-0 mt-0.5" />
                    <div className="font-semibold">
                      {result.scoreCapReason || "Điểm tổng bị giới hạn do câu trả lời chưa bám sát trọng tâm câu hỏi."}
                    </div>
                  </div>
                )}

                {/* Component Scores for Q&A */}
                {result && result.components && !isLoading && (
                  <div className="my-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-450">Điểm thành phần Q&A:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500">Trọng tâm (20%)</div>
                        <div className="text-xs font-extrabold text-smart-indigo">{result.components.relevance || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500">Ngữ pháp (20%)</div>
                        <div className="text-xs font-extrabold text-blue-600">{result.components.grammar || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500">Từ vựng (15%)</div>
                        <div className="text-xs font-extrabold text-emerald-600">{result.components.vocabulary || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500">Phát âm (25%)</div>
                        <div className="text-xs font-extrabold text-purple-600">{result.components.pronunciation || 0}%</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500">Trôi chảy (20%)</div>
                        <div className="text-xs font-extrabold text-pink-600">{result.components.fluency || 0}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner if API fails */}
                {errorMsg && !isLoading && (
                  <div className="mt-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs flex items-center justify-between animate-fade">
                    <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
                      <FiAlertCircle className="text-base shrink-0" />
                      <span className="font-semibold">{errorMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleStartQARecord(index, e)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <FiRefreshCw className="text-xs" />
                      <span>Thử lại</span>
                    </button>
                  </div>
                )}

                {/* AI Evaluation result for Q&A */}
                {result && !isLoading && (
                  <div className="mt-4 space-y-3.5 border-t border-slate-100 dark:border-slate-700/60 pt-4 animate-fade">
                    {/* User's transcribed text */}
                    <div className="space-y-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">Giọng nói của bạn (AI nhận diện):</span>
                      <p className="text-sm font-semibold italic text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-900/45 px-3 py-2.5 rounded-xl border border-slate-200/45 dark:border-slate-700/60">
                        "{result.transcription || 'Không có âm thanh nhận diện'}"
                      </p>
                    </div>

                    {/* AI Feedback block */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-700/50 space-y-3">
                      {/* Relevance & Grammar Evaluation */}
                      {result.feedback?.relevance && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-smart-indigo flex items-center gap-1.5">
                            <FiInfo className="text-sm" /> Độ liên quan câu hỏi:
                          </p>
                          <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-350 font-medium pl-5">
                            {result.feedback.relevance}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-450 flex items-center gap-1.5">
                          <FiAlertCircle className="text-sm" /> Nhận xét ngữ pháp & từ vựng:
                        </p>
                        <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-350 font-medium pl-5">
                          {result.feedback?.grammar || result.grammarFeedback || "Cấu trúc câu hoàn chỉnh."}
                        </p>
                      </div>

                      {/* Pronunciation Evaluation */}
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <FiVolume2 className="text-sm" /> Nhận xét phát âm & ngữ điệu:
                        </p>
                        <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-350 font-medium pl-5">
                          {result.feedback?.pronunciation || result.pronunciationFeedback || "Phát âm rõ ràng."}
                        </p>
                      </div>
                    </div>

                    {/* AI suggestion */}
                    {(result.suggestion || result.improvedAnswer) && (
                      <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <FiCheck className="text-emerald-500 text-sm font-bold border border-emerald-400 rounded-full p-0.5" /> 
                            Gợi ý câu trả lời tự nhiên hơn:
                          </p>
                          <button
                            type="button"
                            onClick={(e) => handlePlayTTS(result.suggestion || result.improvedAnswer, e)}
                            className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-300 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                            title="Nghe câu gợi ý mẫu"
                          >
                            <FiVolume2 className="text-xs" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300 pl-5 leading-relaxed tracking-wide">
                          "{result.suggestion || result.improvedAnswer}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom triggers */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  {isLoading ? (
                    <div className="flex items-center space-x-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-150 rounded-xl">
                      <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-smart-indigo rounded-full animate-spin"></div>
                      <span className="text-[11.5px] text-slate-500 font-semibold">AI đang phân tích câu trả lời...</span>
                    </div>
                  ) : isCurrentRecording ? (
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-between bg-red-50 dark:bg-red-950/15 p-2 rounded-xl border border-red-100 dark:border-red-900/50 gap-3">
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          Đang trả lời... {recordingTime}s
                        </span>
                      </div>

                      {/* Visualizer */}
                      <div className="flex-1 w-full max-w-full">
                        <AudioVisualizer analyserRef={analyserRef} color="#4F46E5" />
                      </div>

                      <div className="w-full sm:w-auto flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStopQARecord(item.id, e)}
                          className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm flex items-center space-x-1"
                        >
                          <FiSquare className="text-[11px]" />
                          <span>Dừng & Nộp câu trả lời</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isRecording}
                      onClick={(e) => handleStartQARecord(index, e)}
                      className={`flex items-center space-x-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        isRecording 
                          ? 'bg-slate-100 dark:bg-slate-750 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-smart-indigo hover:bg-smart-indigo-hover text-white border-transparent shadow-md'
                      }`}
                    >
                      <FiMic className="text-sm shrink-0" />
                      <span>{result ? "Trả lời lại" : "Trả lời câu hỏi bằng giọng nói"}</span>
                    </button>
                  )}

                  {result && !isLoading && !isCurrentRecording && (
                    <button
                      type="button"
                      onClick={() => {
                        setQaResults(prev => {
                          const newRes = { ...prev };
                          delete newRes[item.id];
                          return newRes;
                        });
                      }}
                      className="text-xs text-slate-400 hover:text-red-500 font-bold px-2 py-1 transition-colors"
                    >
                      Xóa kết quả
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Button */}
      {onComplete && (
        <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-slate-700/80 flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            className="flex items-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-bold rounded-2xl cursor-pointer shadow-md transition-all"
          >
            <FiCheckCircle className="text-base" />
            <span>Hoàn thành bài luyện nói</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeakingExercise;
