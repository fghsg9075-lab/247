import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  LessonContent, Subject, ClassLevel, Chapter, 
  MCQItem, ContentType, User, SystemSettings 
} from '../types';
import { 
  ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle, 
  XCircle, Trophy, BookOpen, Play, Lock, ChevronRight, 
  ChevronLeft, Save, X, Maximize, RotateCcw, Share2
} from 'lucide-react';
import { CustomConfirm, CustomAlert } from './CustomDialogs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { decodeHtml } from '../utils/htmlDecoder';

interface Props {
  content: LessonContent | null;
  subject: Subject;
  classLevel: ClassLevel;
  chapter: Chapter;
  loading: boolean;
  onBack: () => void;
  onMCQComplete?: (count: number, answers: Record<number, number>, usedData: MCQItem[], timeTaken: number) => void; 
  user?: User;
  onUpdateUser?: (user: User) => void;
  settings?: SystemSettings;
}

export const LessonView: React.FC<Props> = ({ 
  content, 
  subject, 
  classLevel, 
  chapter,
  loading, 
  onBack,
  onMCQComplete,
  user,
  onUpdateUser,
  settings
}) => {
  // ==========================================
  // 1. STATES & INITIALIZATION
  // ==========================================
  const [mcqState, setMcqState] = useState<Record<number, number | null>>({});
  const [showResults, setShowResults] = useState(false);
  const [localMcqData, setLocalMcqData] = useState<MCQItem[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [analysisUnlocked, setAnalysisUnlocked] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const BATCH_SIZE = 50;

  // Refs for UI interactions
  const containerRef = useRef<HTMLDivElement>(null);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean, title: string, message: string, onConfirm: () => void
  }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  // ==========================================
  // 2. EFFECTS (TIMER & FULLSCREEN)
  // ==========================================
  
  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (!showResults && !showSubmitModal && !showResumePrompt) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showResults, showSubmitModal, showResumePrompt]);

  // Fullscreen Handler
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Fullscreen Error:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Prevent back navigation/loss of progress for MCQs
  useEffect(() => {
    if (content?.type.includes('MCQ') && Object.keys(mcqState).length > 0 && !showResults) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [mcqState, content?.type, showResults]);

  // ==========================================
  // 3. LOADING STATE RENDERER
  // ==========================================
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white p-10">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-8 border-slate-100 rounded-full"></div>
          <div className="absolute inset-0 border-8 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h3 className="text-2xl font-black text-slate-800 animate-pulse">Syncing Content...</h3>
        <p className="text-slate-400 mt-2 font-medium">Preparing your learning environment</p>
      </div>
    );
  }

  // ==========================================
  // 4. AI IMAGE/HTML NOTES VIEW (STRICT)
  // ==========================================
  if (content?.type === 'NOTES_IMAGE_AI') {
    const preventAction = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();
    
    if (content.aiHtmlContent) {
      const decodedHtml = decodeHtml(content.aiHtmlContent);
      return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          <header className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">{content.title}</h2>
                <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest">AI Master Notes</p>
              </div>
            </div>
            <button onClick={onBack} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-all"><X size={20} /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 selection:bg-teal-100">
            <div 
              className="prose prose-slate max-w-none prose-img:rounded-3xl prose-img:shadow-2xl prose-headings:font-black [&_a]:pointer-events-none"
              dangerouslySetInnerHTML={{ __html: decodedHtml }}
            />
            <div className="h-20"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col overflow-hidden animate-in fade-in">
        <header className="bg-black/60 backdrop-blur-2xl border-b border-white/5 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 text-white/50 hover:text-white"><ArrowLeft size={20} /></button>
            <h2 className="text-xs font-black text-white/90 uppercase tracking-[0.2em]">{content.title}</h2>
          </div>
          <div className="px-3 py-1 bg-teal-500/20 rounded-full text-teal-400 text-[9px] font-black uppercase tracking-widest">AI Visual Mode</div>
        </header>
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden bg-[#050505] scrollbar-hide"
          onContextMenu={preventAction}
        >
          <div className="w-full flex justify-center py-10">
            <img 
              src={content.content} 
              alt="Study Material" 
              className="w-[160%] max-w-none ml-[-30%] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] rounded-sm"
              loading="lazy"
              draggable={false}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            />
          </div>
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-1 h-20 bg-gradient-to-b from-teal-500/50 to-transparent rounded-full"></div>
            <p className="text-[10px] font-mono text-zinc-800 tracking-[1em] uppercase">End of Canvas</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 5. MCQ SYSTEM (PERSISTENCE & ANALYSIS)
  // ==========================================
  if ((content?.type === 'MCQ_ANALYSIS' || content?.type === 'MCQ_SIMPLE') && content.mcqData) {
    
    // Resume Logic Initialization
    useEffect(() => {
      if (!content.mcqData) return;
      const progressKey = `nst_mcq_progress_${chapter.id}`;
      const savedProgress = localStorage.getItem(progressKey);

      if (content.userAnswers) {
        setMcqState(content.userAnswers as any);
        setShowResults(true);
        setAnalysisUnlocked(true);
        setLocalMcqData(content.mcqData);
        return;
      }

      if (savedProgress) {
        setShowResumePrompt(true);
        setLocalMcqData([...content.mcqData].sort(() => Math.random() - 0.5));
      } else {
        setLocalMcqData([...content.mcqData].sort(() => Math.random() - 0.5));
      }
    }, [content.mcqData, chapter.id, content.userAnswers]);

    // Handle session recovery
    const handleResumeAction = (shouldResume: boolean) => {
      if (shouldResume) {
        const saved = localStorage.getItem(`nst_mcq_progress_${chapter.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setMcqState(parsed.mcqState || {});
          setBatchIndex(parsed.batchIndex || 0);
          if (parsed.localMcqData) setLocalMcqData(parsed.localMcqData);
        }
      } else {
        localStorage.removeItem(`nst_mcq_progress_${chapter.id}`);
        setMcqState({});
        setBatchIndex(0);
        setLocalMcqData([...(content.mcqData || [])].sort(() => Math.random() - 0.5));
      }
      setShowResumePrompt(false);
    };

    const currentBatch = localMcqData.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
    const totalAttempted = Object.keys(mcqState).length;
    const minRequired = Math.min(50, localMcqData.length);
    const isSubmittable = totalAttempted >= minRequired;

    const finalizeTest = () => {
      setShowSubmitModal(false);
      localStorage.removeItem(`nst_mcq_progress_${chapter.id}`);
      const finalScore = Object.keys(mcqState).reduce((acc, k) => {
        const i = parseInt(k);
        return acc + (mcqState[i] === localMcqData[i].correctAnswer ? 1 : 0);
      }, 0);
      if (onMCQComplete) onMCQComplete(finalScore, mcqState as any, localMcqData, sessionTime);
    };

    return (
      <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
        {/* MCQ Modals */}
        {showResumePrompt && !showResults && (
          <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                <Clock size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Resume Session?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">We found unfinished progress. Continue where you left off?</p>
              <div className="space-y-3">
                <button onClick={() => handleResumeAction(true)} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all">RESUME PROGRESS</button>
                <button onClick={() => handleResumeAction(false)} className="w-full py-4 text-slate-400 font-bold hover:text-red-500 transition-colors uppercase text-xs tracking-widest">Discard & Restart</button>
              </div>
            </div>
          </div>
        )}

        {showSubmitModal && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-24 h-24 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={60} className="text-yellow-500 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Submit Test?</h3>
              <p className="text-slate-500 text-sm mb-8">You have attempted {totalAttempted} questions. Confirm submission to view results.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 font-bold rounded-2xl">BACK</button>
                <button onClick={finalizeTest} className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg active:scale-95">YES, SUBMIT</button>
              </div>
            </div>
          </div>
        )}

        {/* MCQ Navbar */}
        <nav className="bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all active:scale-90"><ArrowLeft size={20} /></button>
            <div className="max-w-[140px] sm:max-w-none">
              <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tighter">{chapter.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Quiz Session</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-2xl shadow-lg shadow-blue-100">
            <Clock size={16} className="text-white/80" />
            <span className="text-white font-black font-mono text-sm">
              {Math.floor(sessionTime / 60)}:{String(sessionTime % 60).padStart(2, '0')}
            </span>
          </div>
        </nav>

        {/* MCQ Question Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 mcq-container scroll-smooth pb-40">
          <div className="max-w-3xl mx-auto space-y-6">
            {currentBatch.map((q, lIdx) => {
              const globalIdx = (batchIndex * BATCH_SIZE) + lIdx;
              const ans = mcqState[globalIdx];
              const isSelected = ans !== undefined && ans !== null;

              return (
                <div key={globalIdx} className={`bg-white rounded-[2rem] p-8 border-2 transition-all duration-500 ${isSelected ? 'border-blue-500 shadow-xl shadow-blue-50/50' : 'border-slate-100'}`}>
                  <div className="flex gap-5 mb-8">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-lg shadow-slate-200">{globalIdx + 1}</div>
                    <h4 className="font-bold text-slate-800 text-lg leading-relaxed pt-1 select-none">{q.question}</h4>
                  </div>
                  
                  <div className="grid gap-3">
                    {q.options.map((opt, oIdx) => {
                      let btnClass = "group relative w-full text-left p-5 rounded-2xl border-2 font-black text-sm transition-all duration-300 overflow-hidden ";
                      
                      if (showResults && analysisUnlocked) {
                        if (oIdx === q.correctAnswer) btnClass += "bg-green-50 border-green-500 text-green-700 shadow-inner";
                        else if (ans === oIdx) btnClass += "bg-red-50 border-red-500 text-red-700 shadow-inner";
                        else btnClass += "bg-slate-50 border-slate-100 opacity-40";
                      } else if (isSelected) {
                        if (ans === oIdx) btnClass += "bg-blue-600 border-blue-600 text-white shadow-2xl scale-[1.03] z-10";
                        else btnClass += "bg-slate-50 border-slate-100 opacity-50";
                      } else {
                        btnClass += "bg-white border-slate-100 text-slate-600 hover:border-blue-400 hover:bg-blue-50/50";
                      }

                      return (
                        <button 
                          key={oIdx} 
                          disabled={showResults || isSelected} 
                          onClick={() => setMcqState(p => ({...p, [globalIdx]: oIdx}))}
                          className={btnClass}
                        >
                          <div className="flex items-center justify-between relative z-10">
                            <span className="flex-1 pr-4">{opt}</span>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected && ans === oIdx ? 'bg-white border-white text-blue-600' : 'border-slate-200'}`}>
                              {showResults && oIdx === q.correctAnswer ? <CheckCircle size={16} /> : (ans === oIdx ? <CheckCircle size={16} /> : <div className="w-1.5 h-1.5 rounded-full bg-transparent"></div>)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {showResults && (
                    <div className="mt-8 pt-8 border-t-2 border-slate-50 animate-in slide-in-from-top-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${ans === q.correctAnswer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {ans === q.correctAnswer ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        </div>
                        <h5 className="font-black text-[11px] uppercase tracking-widest text-slate-400">Analysis & Explanation</h5>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 text-sm leading-relaxed italic">
                        {q.explanation || "Detailed logical proof is currently being updated for this concept."}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MCQ Navigation Toolbar */}
        <div className="p-6 bg-white/90 backdrop-blur-2xl border-t border-slate-100 sticky bottom-0 z-40 flex items-center gap-4">
          <div className="flex-1 flex gap-2">
            {batchIndex > 0 && (
              <button 
                onClick={() => { setBatchIndex(p => p - 1); document.querySelector('.mcq-container')?.scrollTo(0,0); }} 
                className="p-5 bg-slate-100 text-slate-800 rounded-2xl font-black active:scale-90 transition-all shadow-sm"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {!showResults ? (
              <button 
                onClick={() => setShowSubmitModal(true)} 
                disabled={!isSubmittable} 
                className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-2xl ${isSubmittable ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                <Trophy size={22} /> SUBMIT QUIZ
              </button>
            ) : (
              <button 
                onClick={onBack} 
                className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-2xl active:scale-95 transition-all"
              >
                EXIT ANALYSIS
              </button>
            )}
            {(batchIndex + 1) * BATCH_SIZE < localMcqData.length && (
              <button 
                onClick={() => { setBatchIndex(p => p + 1); document.querySelector('.mcq-container')?.scrollTo(0,0); }} 
                className="p-5 bg-slate-900 text-white rounded-2xl font-black active:scale-90 transition-all shadow-xl"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion</span>
            <span className="text-xl font-black text-slate-800">{Math.round((totalAttempted / localMcqData.length) * 100)}%</span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 6. VIDEO PLAYER (ULTRA-SECURE OVERLAYS)
  // ==========================================
  if ((content?.type === 'PDF_VIEWER' || content?.type === 'VIDEO_LECTURE') && (content?.content.includes('youtube') || content?.content.includes('youtu.be') || content?.videoPlaylist)) {
    const [activeIdx, setActiveIdx] = useState(0);
    const playlist = content.videoPlaylist?.length ? content.videoPlaylist : [{ title: chapter.title, url: content.content }];
    const video = playlist[activeIdx];
    let src = video.url;
    
    // URL Cleanup and Force Parameters
    if (src.includes('watch?v=')) src = `https://www.youtube.com/embed/${new URL(src).searchParams.get('v')}`;
    else if (src.includes('youtu.be/')) src = `https://www.youtube.com/embed/${src.split('youtu.be/')[1]}`;
    
    // Force Z-Index Fix: modestbranding=1, rel=0, controls=1, disablekb=1
    const secureSrc = `${src}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1&disablekb=1&showinfo=0`;

    return (
      <div className="flex flex-col h-[calc(100vh-80px)] bg-black overflow-hidden animate-in fade-in">
        {/* Header */}
        <header className="p-4 bg-slate-900 border-b border-white/10 flex items-center justify-between relative z-[10000]">
          <button onClick={onBack} className="p-2 text-slate-400 hover:text-white"><ArrowLeft size={24} /></button>
          <div className="text-center">
            <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-tighter truncate max-w-[200px]">{video.title}</h3>
            <p className="text-[9px] text-blue-500 font-black tracking-widest">NSTA SECURE PLAYER</p>
          </div>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* SECURE STAGE */}
          <div ref={containerRef} className="flex-1 bg-black relative overflow-hidden select-none">
            
            {/* 🔴 BLOCKER 1: TOP-RIGHT (SHARE BUTTON BLOCKER) */}
            <div 
              className="absolute bg-transparent pointer-events-auto"
              style={{
                top: 0,
                right: 0,
                width: '150px',
                height: '100px',
                zIndex: 9999, // FORCED ON TOP
              }}
              onContextMenu={e => e.preventDefault()}
            />

            {/* 🔗 BLOCKER 2: BOTTOM-RIGHT (LOGO MASK + REDIRECT LINK) */}
            <a
              href="https://youtube.com/@ehsansir2.0?si=80l2sFqj85RnGulA"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute pointer-events-auto flex flex-col items-center justify-center no-underline border-l border-t border-white/10 transition-colors hover:bg-zinc-900"
              style={{
                bottom: 0,
                right: 0,
                width: '160px', // Wide enough to cover logo
                height: '70px',
                backgroundColor: '#000', // SOLID BLACK to hide logo
                zIndex: 9999, // FORCED ON TOP
                cursor: 'pointer'
              }}
            >
              <span style={{ color: '#60a5fa', fontSize: '10px', fontWeight: '900', letterSpacing: '1.5px' }}>NSTA OFFICIAL</span>
              <span style={{ color: '#94a3b8', fontSize: '8px', fontWeight: '700', marginTop: '2px' }}>@ehsansir2.0</span>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '7px', fontWeight: 'bold' }}>VISIT CHANNEL</span>
              </div>
            </a>

            {/* 🔒 BLOCKER 3: BOTTOM-LEFT (MOBILE SHARE ARROW BLOCKER) */}
            <div 
              className="absolute bg-transparent pointer-events-auto"
              style={{
                bottom: 0,
                left: 0,
                width: '100px',
                height: '80px',
                zIndex: 9999, // FORCED ON TOP
              }}
            />

            {/* 🔘 CUSTOM FULLSCREEN BUTTON (FORCED Z-INDEX) */}
            <button 
              onClick={toggleFullScreen} 
              className="absolute top-6 left-6 bg-black/60 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 hover:bg-black/90 active:scale-95 transition-all shadow-xl"
              style={{ zIndex: 10000 }} // Higher than everything
            >
              <Maximize size={24} />
            </button>

            {/* CORE IFRAME (PUSHED TO BOTTOM) */}
            <iframe 
              key={secureSrc}
              src={secureSrc}
              className="w-full h-full border-0" 
              style={{ position: 'relative', zIndex: 1 }} // Pushed to bottom layer
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              title={video.title}
            />
          </div>

          {/* PLAYLIST SIDEBAR */}
          {playlist.length > 1 && (
            <div className="w-full md:w-[320px] bg-slate-950 border-l border-white/5 overflow-y-auto flex flex-col shadow-2xl z-[50]">
              <div className="p-5 border-b border-white/5 bg-white/5">
                <h4 className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">Up Next in Series</h4>
              </div>
              <div className="flex-1 p-3 space-y-3">
                {playlist.map((item, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveIdx(i)} 
                    className={`w-full p-4 rounded-2xl flex gap-4 text-left transition-all duration-300 border ${i === activeIdx ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-900/20' : 'bg-slate-900/50 border-transparent text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${i === activeIdx ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-600'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate uppercase tracking-tighter">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <div className={`w-1 h-1 rounded-full ${i === activeIdx ? 'bg-white' : 'bg-slate-700'}`}></div>
                         <p className="text-[9px] font-bold opacity-60 uppercase">LECTURE</p>
                      </div>
                    </div>
                    {i === activeIdx && <Play size={14} fill="currentColor" className="mt-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // 7. PDF & HTML MATERIAL VIEW
  // ==========================================
  const isDocument = content?.content.toLowerCase().endsWith('.pdf') || content?.content.includes('drive.google.com');
  const renderedHtml = content ? decodeHtml(content.content) : '';

  if (content?.type.startsWith('PDF') || content?.type.startsWith('NOTES_HTML')) {
    return (
      <div className="bg-white min-h-screen flex flex-col selection:bg-blue-100">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-2xl border-b border-slate-100 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100 transition-all active:scale-90">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-none uppercase tracking-tight">{chapter.title}</h3>
              <p className="text-[9px] text-blue-500 font-bold uppercase mt-1.5 tracking-[0.2em]">Full Material Access</p>
            </div>
          </div>
          <button onClick={toggleFullScreen} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><Maximize size={20} /></button>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="max-w-4xl mx-auto p-4 md:p-12">
            {isDocument ? (
              <div ref={containerRef} className="h-[85vh] w-full bg-white rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden relative border border-slate-100 group">
                <iframe 
                  src={content?.content.replace('/view', '/preview').replace('/edit', '/preview')} 
                  className="w-full h-full border-0" 
                  sandbox="allow-scripts allow-same-origin"
                />
                {/* TOOLBAR MASK: Hides PDF controls from direct interaction */}
                <div className="absolute top-0 right-0 w-32 h-32 z-10 bg-transparent pointer-events-auto" />
                <div className="absolute inset-0 z-0 pointer-events-none border-[12px] border-white rounded-[2.5rem] group-hover:border-slate-50 transition-all"></div>
              </div>
            ) : (
              <div className="bg-white p-10 md:p-20 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[100px] -mr-10 -mt-10"></div>
                <div 
                  className="prose prose-slate max-w-none prose-img:rounded-3xl prose-headings:font-black prose-headings:text-slate-900 prose-a:text-blue-600 [&_a]:pointer-events-none leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: renderedHtml }} 
                />
              </div>
            )}
            
            <footer className="mt-16 text-center space-y-8">
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-12 bg-slate-200"></div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.8em]">End of Unit</p>
                <div className="h-px w-12 bg-slate-200"></div>
              </div>
              <button 
                onClick={onBack} 
                className="group bg-slate-900 text-white py-6 px-16 rounded-[2.5rem] font-black text-xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-3 mx-auto"
              >
                COMPLETE CHAPTER <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </footer>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // 8. MARKDOWN NOTES RENDERER (DEFAULT)
  // ==========================================
  return (
    <div className="bg-white min-h-screen pb-32 animate-in fade-in">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-50 p-5 flex items-center justify-between">
        <button onClick={onBack} className="p-3 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft size={24} /></button>
        <div className="text-center">
          <h3 className="font-black text-slate-900 text-sm uppercase tracking-tighter leading-none">{chapter.title}</h3>
          <p className="text-[9px] text-blue-500 font-bold uppercase mt-2 tracking-[0.3em]">{content?.subtitle || 'Executive Summary'}</p>
        </div>
        <div className="w-12"></div>
      </header>

      <article className="max-w-3xl mx-auto p-6 md:p-14">
        <div className="prose prose-slate prose-lg max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-900">
          <ReactMarkdown 
            remarkPlugins={[remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            components={{
              h1: ({...props}) => <h1 className="text-4xl font-black mb-10 border-b-8 border-slate-50 pb-6 leading-tight" {...props} />,
              h2: ({...props}) => <h2 className="text-2xl font-black mt-16 mb-8 text-blue-700 flex items-center gap-4 before:content-[''] before:w-2 before:h-8 before:bg-blue-600 before:rounded-full" {...props} />,
              blockquote: ({...props}) => (
                <blockquote className="border-l-[12px] border-blue-600 bg-blue-50/40 p-10 rounded-r-[3rem] italic text-blue-900 my-12 shadow-inner font-medium text-xl leading-relaxed" {...props} />
              ),
              ul: ({...props}) => <ul className="list-disc pl-8 space-y-4 my-8" {...props} />,
              li: ({...props}) => <li className="pl-2 marker:text-blue-500 marker:font-black" {...props} />,
              code: ({...props}) => (
                <code className="bg-slate-900 text-pink-400 px-3 py-1 rounded-xl font-mono text-sm font-bold border border-white/10 shadow-lg" {...props} />
              ),
            }}
          >
            {content?.content || 'Initialization required... No content stream detected.'}
          </ReactMarkdown>
        </div>
        
        <div className="mt-24 pt-12 border-t-4 border-slate-50 text-center">
          <button 
            onClick={onBack} 
            className="bg-slate-900 text-white py-6 px-20 rounded-[3rem] font-black text-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all active:scale-95 hover:bg-indigo-600"
          >
            MARK AS LEARNED
          </button>
        </div>
      </article>

      {/* Global Alerts & Confirms */}
      <CustomAlert 
        isOpen={alertConfig.isOpen} 
        message={alertConfig.message} 
        type="ERROR" 
        onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
      />
      <CustomConfirm 
        isOpen={confirmConfig.isOpen} 
        title={confirmConfig.title} 
        message={confirmConfig.message} 
        onConfirm={confirmConfig.onConfirm} 
        onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} 
      />
    </div>
  );
};
