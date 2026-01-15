
import React, { useState, useRef, useEffect } from 'react';
import { TestData, TestStatus, UserAnswer, QuestionType, TopicType, TestPart, TestAnalytics, PlaybackEvent, LevelType } from './types';
import { generateTestContent, generateFullAudio } from './services/geminiService';
import { generatePDFReport } from './services/pdfService';
import QuestionField from './components/QuestionField';

type PresentationView = 'questions' | 'script';

const PART_1_TOPICS: TopicType[] = [
  'Booking & Reservations',
  'Memberships & Enrolment',
  'Service Inquiries',
  'Accommodation & Housing',
  'Lost or Damaged Items',
  'Volunteering & Charities',
  'Surveys & Interviews',
  'Random'
];

const PART_2_TOPICS: TopicType[] = [
  'Local Facilities & Community Services',
  'Tourist Attractions & Site Tours',
  'Events & Festivals',
  'Improvements & Renovations',
  'Random'
];

const PART_3_TOPICS: TopicType[] = [
  'The Assignment Discussion',
  'The Tutor Tutorial',
  'Research Project Planning',
  'Course Feedback or Selection',
  'Random'
];

const PART_4_TOPICS: TopicType[] = [
  'The Natural World & Biology',
  'History and Archaeology',
  'Business and Management',
  'Psychology and Human Behavior',
  'Physical Sciences & Technology',
  'Random'
];

const App: React.FC = () => {
  const [status, setStatus] = useState<TestStatus>(TestStatus.IDLE);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [selectedType, setSelectedType] = useState<QuestionType>('NOTE');
  const [selectedPart, setSelectedPart] = useState<TestPart>('PART_1');
  const [selectedLevel, setSelectedLevel] = useState<LevelType>('OFFICIAL');
  const [selectedTopic, setSelectedTopic] = useState<TopicType>('Random');
  const [userName, setUserName] = useState('');
  const [testNumber, setTestNumber] = useState('');
  
  const [analytics, setAnalytics] = useState<TestAnalytics>({
    replays: 0,
    events: [],
    questionAssistance: {}
  });

  const [fullAudio, setFullAudio] = useState<{ buffer: AudioBuffer } | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isHintActive, setIsHintActive] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationView, setPresentationView] = useState<PresentationView>('questions');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedTopic('Random');
  }, [selectedPart]);

  const initTest = async () => {
    try {
      stopSource();
      setStatus(TestStatus.LOADING);
      setError(null);
      setFullAudio(null);
      setPausedAt(0);
      setPlaybackTime(0);
      setIsHintActive(false);
      setShowScript(false);
      setAnalytics({
        replays: 0,
        events: [],
        questionAssistance: {}
      });
      
      const content = await generateTestContent(selectedType, selectedTopic, selectedPart, selectedLevel);
      setTestData(content);
      setUserAnswers(content.questions.map(q => ({ questionId: q.id, value: '' })));
      
      const audio = await generateFullAudio(content);
      setFullAudio(audio);
      setStatus(TestStatus.READY);
    } catch (err: any) {
      console.error(err);
      setError("Unable to initialize test. Check your connection.");
      setStatus(TestStatus.IDLE);
    }
  };

  const handleDownloadPDF = () => {
    if (testData) {
      generatePDFReport(testData, userAnswers, userName || "Lazizjon Isomiddinov", testNumber || "1", analytics);
    }
  };

  const logEvent = (type: PlaybackEvent['type'], audioTime: number) => {
    setAnalytics(prev => ({
      ...prev,
      events: [...prev.events, { type, audioTime, time: Date.now() }]
    }));
  };

  const startPlayback = (offsetSeconds: number, duration?: number) => {
    if (!fullAudio) return;
    stopSource();

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = fullAudio.buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setStatus(TestStatus.READY);
        if (!duration) {
          setPausedAt(0);
          setPlaybackTime(0);
        }
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    source.start(0, offsetSeconds, duration);
    sourceNodeRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime - offsetSeconds;
    setStatus(TestStatus.PLAYING);

    if (offsetSeconds < 1) {
      setAnalytics(prev => ({ ...prev, replays: prev.replays + 1 }));
      logEvent('replay', 0);
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (audioContextRef.current) {
        const current = (audioContextRef.current.currentTime - startTimeRef.current);
        if (current >= fullAudio.buffer.duration) {
          setPlaybackTime(fullAudio.buffer.duration);
          clearInterval(timerRef.current!);
        } else {
          setPlaybackTime(current);
        }
      }
    }, 50);
  };

  const pausePlayback = () => {
    if (sourceNodeRef.current && audioContextRef.current) {
      const elapsedSinceStart = (audioContextRef.current.currentTime - startTimeRef.current);
      setPausedAt(elapsedSinceStart);
      stopSource();
      setStatus(TestStatus.READY);
      logEvent('pause', elapsedSinceStart);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopSource = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
  };

  const togglePlayback = () => {
    if (status === TestStatus.PLAYING) {
      pausePlayback();
    } else {
      startPlayback(pausedAt);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const prevTime = playbackTime;
    const type = newTime > prevTime ? 'seek_forward' : 'seek_backward';
    
    setPlaybackTime(newTime);
    setPausedAt(newTime);
    logEvent(type, newTime);

    if (status === TestStatus.PLAYING) {
      startPlayback(newTime);
    }
  };

  const handleAssistanceUsed = (qId: number, type: 'lifeline' | 'script') => {
    setAnalytics(prev => {
      const existing = prev.questionAssistance[qId] || { lifeline: false, script: false };
      return {
        ...prev,
        questionAssistance: {
          ...prev.questionAssistance,
          [qId]: {
            ...existing,
            [type]: true
          }
        }
      };
    });
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = fullAudio ? (playbackTime / fullAudio.buffer.duration) * 100 : 0;

  const isViewingScript = presentationMode ? (presentationView === 'script') : showScript;
  const isViewingQuestions = presentationMode ? (presentationView === 'questions') : true;

  const getTopicList = () => {
    switch(selectedPart) {
      case 'PART_1': return PART_1_TOPICS;
      case 'PART_2': return PART_2_TOPICS;
      case 'PART_3': return PART_3_TOPICS;
      case 'PART_4': return PART_4_TOPICS;
      default: return PART_1_TOPICS;
    }
  };

  const currentTopicList = getTopicList();

  return (
    <div className={`min-h-screen transition-colors duration-500 overflow-x-hidden ${presentationMode ? 'bg-white' : 'bg-gray-50'}`}>
      
      {testData && (status === TestStatus.READY || status === TestStatus.PLAYING || status === TestStatus.SUBMITTED) && (
        <div className={`fixed top-0 left-0 right-0 z-[100] bg-[#003366] text-white shadow-xl flex flex-col transition-all duration-500 ${presentationMode ? 'h-48' : 'h-24'}`}>
          <div className="flex-1 max-w-[1600px] mx-auto w-full px-8 flex items-center gap-8">
            <button 
              onClick={togglePlayback}
              className={`shrink-0 bg-white text-[#003366] rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${presentationMode ? 'w-24 h-24' : 'w-12 h-12'}`}
            >
              {status === TestStatus.PLAYING ? (
                <svg className={presentationMode ? 'w-10 h-10' : 'w-5 h-5'} fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className={presentationMode ? 'w-10 h-10 ml-1' : 'w-5 h-5 ml-1'} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-blue-300 uppercase tracking-widest ${presentationMode ? 'text-base' : 'text-[9px]'}`}>
                      {testData.part.replace('_', ' ')} • {selectedLevel} {userName && `• ${userName}`} {testNumber && `• Test #${testNumber}`}
                    </span>
                  </div>
                  {presentationMode && <h2 className="text-3xl font-black uppercase tracking-tight text-white">{testData.title}</h2>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-mono font-black ${presentationMode ? 'text-5xl' : 'text-xl'}`}>{formatTime(playbackTime)}</span>
                  <span className={`font-mono font-bold text-blue-400 ${presentationMode ? 'text-xl' : 'text-xs'}`}>/ {fullAudio ? formatTime(fullAudio.buffer.duration) : '0:00'}</span>
                </div>
              </div>
              <div className="relative flex items-center">
                <input 
                  type="range" min="0" max={fullAudio?.buffer.duration || 0} step="0.1" value={playbackTime} onChange={handleSeek}
                  className={`w-full bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-400 relative z-10 ${presentationMode ? 'h-8' : 'h-2'}`} 
                />
                <div 
                  className={`absolute bg-blue-400 rounded-full pointer-events-none z-10 ${presentationMode ? 'h-8 top-0 shadow-lg' : 'h-2 top-0'}`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>

                {isHintActive && fullAudio && testData.questions.map((q) => {
                  const left = (q.proofStart / fullAudio.buffer.duration) * 100;
                  const isPast = playbackTime >= q.proofStart;
                  return (
                    <div key={q.id} className="absolute pointer-events-none flex flex-col items-center" style={{ left: `${left}%`, transform: 'translateX(-50%)', top: presentationMode ? '35px' : '10px' }}>
                      <div className={`transition-all ${presentationMode ? 'w-1.5 h-6' : 'w-1 h-3'} ${isPast ? 'bg-orange-500' : 'bg-orange-500/20'}`}></div>
                      <span className={`font-black transition-all mt-1 ${presentationMode ? 'text-2xl' : 'text-[10px]'} ${isPast ? 'text-orange-500 scale-125' : 'text-orange-500/40'}`}>{q.id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {testData && (status === TestStatus.READY || status === TestStatus.PLAYING || status === TestStatus.SUBMITTED) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] flex items-center bg-white border border-gray-200 rounded-full p-2 shadow-2xl gap-2 scale-110 sm:scale-125">
          {presentationMode ? (
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full mr-1">
              <button 
                onClick={() => setPresentationView('questions')}
                className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition-all ${presentationView === 'questions' ? 'bg-[#003366] text-white shadow-md' : 'text-gray-500'}`}
              >Questions</button>
              <button 
                onClick={() => setPresentationView('script')}
                className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition-all ${presentationView === 'script' ? 'bg-[#003366] text-white shadow-md' : 'text-gray-500'}`}
              >Script</button>
            </div>
          ) : (
            <button 
              onClick={() => setShowScript(!showScript)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full font-black uppercase text-[10px] transition-all ${showScript ? 'bg-[#003366] text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
            >📄 Script</button>
          )}

          <button 
            onClick={() => setIsHintActive(!isHintActive)}
            className={`flex items-center gap-2 px-5 py-3 rounded-full font-black uppercase text-[10px] transition-all ${isHintActive ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
          >📍 Markers</button>

          <div className="w-px h-6 bg-gray-200 mx-1"></div>

          <button 
            onClick={() => setPresentationMode(!presentationMode)}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-[10px] uppercase transition-all text-white ${presentationMode ? 'bg-red-600' : 'bg-[#003366]'}`}
          >
            {presentationMode ? '❌ Exit' : '📺 Presentation'}
          </button>
        </div>
      )}

      <main className={`transition-all duration-700 mx-auto ${presentationMode ? 'max-w-[1700px] px-8 pt-64 pb-48' : 'max-w-6xl px-6 pt-10 pb-32'}`}>
        
        {status === TestStatus.IDLE && (
          <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-[2.5rem] p-12 text-center border border-gray-100 mt-8 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-[#003366] rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-6 shadow-md">I</div>
            <h1 className="text-4xl font-black text-[#003366] mb-2">IELTS Listening Tutor</h1>
            <p className="text-gray-500 mb-8 text-lg font-medium">Professional IELTS Listening Simulation.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-2 ml-4">Student Name</label>
                <input 
                  type="text" value={userName} onChange={(e) => setUserName(e.target.value)}
                  placeholder="Lazizjon Isomiddinov"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-[#003366] font-bold text-gray-700 transition-all"
                />
              </div>
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-2 ml-4">Test Practice #</label>
                <input 
                  type="text" value={testNumber} onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-[#003366] font-bold text-gray-700 transition-all"
                />
              </div>
            </div>

            <div className="mb-6 text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-4 ml-4">Complexity Level</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(['A1-A2', 'B1-B2', 'C1-C2', 'OFFICIAL'] as LevelType[]).map(l => (
                  <button 
                    key={l} onClick={() => setSelectedLevel(l)}
                    className={`py-4 rounded-2xl font-black border-2 transition-all uppercase ${selectedLevel === l ? 'bg-orange-500 text-white border-orange-500 shadow-md scale-[1.02]' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
                  >
                    {l === 'OFFICIAL' ? 'Official IELTS' : l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6 text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-4 ml-4">Select Practice Part</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(['PART_1', 'PART_2', 'PART_3', 'PART_4'] as TestPart[]).map(p => (
                  <button 
                    key={p} onClick={() => setSelectedPart(p)}
                    className={`py-4 rounded-2xl font-black border-2 transition-all uppercase ${selectedPart === p ? 'bg-[#003366] text-white border-[#003366] shadow-md scale-[1.02]' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
                  >
                    Part {p.split('_')[1]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6 text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-2 ml-4">
                Practice Topic Part {selectedPart.split('_')[1]}
              </label>
              <div className="relative">
                <select 
                  value={selectedTopic} 
                  onChange={(e) => setSelectedTopic(e.target.value as TopicType)}
                  className="w-full appearance-none bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-[#003366] font-black text-[#003366] transition-all cursor-pointer pr-12 shadow-sm"
                >
                  {currentTopicList.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#003366]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mb-10 text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-2 ml-4">Question Category</label>
              <div className="relative">
                <select 
                  value={selectedType} 
                  onChange={(e) => setSelectedType(e.target.value as QuestionType)}
                  className="w-full appearance-none bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-[#003366] font-black text-[#003366] transition-all cursor-pointer pr-12 shadow-sm"
                >
                  <option value="SENTENCE">Sentence Completion</option>
                  <option value="NOTE">Note/Form Completion</option>
                  <option value="MCQ">MCQ (with ABCD options)</option>
                  <option value="MIXED">Mixed (all 3 types)</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#003366]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <button onClick={initTest} className="w-full bg-[#003366] text-white font-black py-7 rounded-2xl text-2xl shadow-xl hover:bg-black hover:-translate-y-1 transition-all">Start Practice Session</button>
          </div>
        )}

        {status === TestStatus.LOADING && (
          <div className="flex flex-col items-center justify-center py-56 gap-8">
            <div className="w-16 h-16 border-[8px] border-blue-50 border-t-[#003366] rounded-full animate-spin"></div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[#003366] font-black uppercase tracking-[0.3em] text-xs">Simulating {selectedPart.replace('_', ' ')}...</p>
              <p className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Complexity: {selectedLevel}</p>
            </div>
          </div>
        )}

        {testData && (
          <div className={`transition-all duration-700 flex flex-col gap-12`}>
            {isViewingQuestions && (
              <div className={`bg-white rounded-[2rem] border border-gray-100 shadow-2xl transition-all mx-auto ${presentationMode ? 'max-w-6xl p-20' : 'p-10 max-w-4xl'}`}>
                <div className="mb-12 border-b-2 border-gray-50 pb-8">
                  <h2 className={`font-black text-[#003366] mb-4 ${presentationMode ? 'text-6xl' : 'text-3xl'}`}>{testData.title}</h2>
                  <p className={`font-bold text-gray-500 mb-6 ${presentationMode ? 'text-3xl' : 'text-lg'}`}>Questions 1-10</p>
                  
                  {/* WORD COUNT INSTRUCTION BOX */}
                  <div className="bg-[#003366]/5 border-l-[6px] border-[#003366] p-6 rounded-r-2xl mb-8 shadow-inner">
                    <p className={`font-black text-[#003366] uppercase leading-relaxed ${presentationMode ? 'text-3xl' : 'text-sm'}`}>
                      {testData.instruction || "Answer the questions below."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {testData.questions.map((q, idx) => {
                    const prevQ = testData.questions[idx - 1];
                    const showHeader = q.type === 'NOTE' && (!prevQ || prevQ.label !== q.label);

                    return (
                      <QuestionField
                        key={q.id}
                        question={q}
                        presentationMode={presentationMode}
                        value={userAnswers.find(a => a.questionId === q.id)?.value || ''}
                        onChange={(id, val) => setUserAnswers(prev => prev.map(a => a.questionId === id ? { ...a, value: val } : a))}
                        onAssistanceUsed={handleAssistanceUsed}
                        isSubmitted={status === TestStatus.SUBMITTED}
                        isCorrect={userAnswers.find(a => a.questionId === q.id)?.value.toLowerCase().trim() === q.answer.toLowerCase().trim()}
                        showSectionHeader={showHeader}
                      />
                    );
                  })}
                </div>

                <div className="mt-20 pt-12 border-t-2 border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-10">
                  <div className="font-black text-gray-300 italic uppercase">
                    <p className={presentationMode ? 'text-2xl' : 'text-sm'}>IELTS Listening End</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {status !== TestStatus.SUBMITTED ? (
                      <button 
                        onClick={() => { pausePlayback(); setStatus(TestStatus.SUBMITTED); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                        className={`bg-[#003366] text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all ${presentationMode ? 'px-24 py-10 text-4xl' : 'px-14 py-6 text-lg'}`}
                      >Finish Session</button>
                    ) : (
                      <>
                        <button 
                          onClick={handleDownloadPDF} 
                          className={`bg-orange-500 text-white font-black rounded-2xl shadow-xl hover:bg-orange-600 transition-all ${presentationMode ? 'px-20 py-8 text-3xl' : 'px-12 py-5 text-base'}`}
                        >Download PDF Report</button>
                        <button onClick={initTest} className={`bg-gray-50 text-[#003366] border-2 border-gray-100 font-black rounded-2xl hover:bg-white transition-all ${presentationMode ? 'px-20 py-8 text-3xl' : 'px-12 py-5 text-base'}`}>New Test</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isViewingScript && (
              <div className={`bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col transition-all mx-auto ${presentationMode ? 'max-w-5xl h-[75vh]' : 'sticky top-[120px] max-h-[70vh]'}`}>
                <div className="bg-[#003366] px-10 py-6 text-white">
                  <h3 className={`font-black uppercase tracking-widest ${presentationMode ? 'text-3xl' : 'text-xs'}`}>Full Transcript</h3>
                </div>
                <div className={`flex-1 overflow-y-auto p-12 space-y-12 font-serif leading-relaxed text-gray-700 ${presentationMode ? 'text-4xl' : 'text-lg'}`}>
                  {testData.scriptSegments.map((seg, i) => (
                    <div key={i} className="pl-6 border-l-4 border-gray-100">
                      <span className={`font-black uppercase block mb-3 text-[#003366] opacity-30 ${presentationMode ? 'text-xl' : 'text-[10px]'}`}>{seg.speakerName}</span>
                      <p>{seg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className={`mt-12 text-center pb-12 transition-all duration-700 ${presentationMode ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}>
              <div className="flex flex-col items-center justify-center gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 flex items-center gap-3">
                  <span>MALE VOICE: SADACHBIA</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                  <span>FEMALE VOICE: ACHERNAR</span>
                </p>
                <div className="h-px w-12 bg-gray-200"></div>
                <p className="text-[9px] font-bold text-gray-200 uppercase tracking-widest italic">Simulated Professional IELTS Environment • Complexity: {selectedLevel}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
