import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { LessonContent, Subject, ClassLevel, Chapter, MCQItem, ContentType, User, SystemSettings } from '../types';
import { 
  ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle, 
  XCircle, Trophy, BookOpen, Play, Lock, ChevronRight, 
  ChevronLeft, Save, X, Maximize 
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
  // --- STATES ---
  const [mcqState, setMcqState] = useState<Record<number, number | null>>({});
  const [showResults, setShowResults] = useState(false);
  const [localMcqData, setLocalMcqData] = useState<MCQItem[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [analysisUnlocked, setAnalysisUnlocked] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const BATCH_SIZE = 50;

  // --- REFS & FULLSCREEN ---
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(e => console.error(e));
    } else {
      document.exitFullscreen();
    }
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval: any;
    if (!showResults && !showSubmitModal && !showResumePrompt) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showResults, showSubmitModal, showResumePrompt]);

  // --- DIALOG CONFIG ---
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  // --- LOADING RENDERER ---
  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h3 className="text-xl font-bold text-slate-800 animate-pulse">Fetching Chapter Data...</h3>
        <p className="text-slate-500 text-sm mt-2">Please wait while we prepare your lesson.</p>
      </div>
    );
  }

  // --- 1. AI IMAGE NOTES VIEWER (STRICT MODE) ---
  if (content?.type === 'NOTES_IMAGE_AI') {
    const preventMenu = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();
    if (content.aiHtmlContent) {
      const decodedContent = decodeHtml(content.aiHtmlContent);
      return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in">
          <header className="bg-white/95 backdrop-blur-md text-slate-800 p-4 sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 shadow-sm">
            <div>
              <h2 className="text-sm font-bold">{content.title}</h2>
              <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest">AI Master Notes</p>
            </div>
            <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
              <X size={20} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto w-full p-6 md:p-12">
            <div 
              className="prose prose-slate max-w-none prose-img:rounded-2xl prose-headings:text-slate-900 [&_a]:pointer-events-none"
              dangerouslySetInnerHTML={{ __html: decodedContent }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col animate-in fade-in" style={{ touchAction: 'none' }}>
        <header className="bg-black/80 backdrop-blur-xl text-white p-4 sticky top-0 z-10 flex items-center justify-between border-b border-white/10">
          <div>
            <h2 className="text-sm font-bold text-white/90">{content.title}</h2>
            <p className="text-[10px] text-teal-400 font-bold tracking-widest">AI IMAGE VIEWER</p>
          </div>
          <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
            <X size={20} />
          </button>
        </header>
        <div 
          className="viewer overflow-y-auto overflow-x-hidden bg-[#0a0a0a]"
          style={{ touchAction: 'pan-y' }}
          onContextMenu={preventMenu}
        >
          <div className="py-10 w-full flex justify-center">
            <img 
              src={content.content} 
              alt="AI Notes" 
              className="w-[150%] max-w-none ml-[-25%] shadow-2xl" 
              loading="lazy"
              onContextMenu={preventMenu}
              draggable={false}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            />
          </div>
          <div className="h-40 flex items-center justify-center text-zinc-700 font-mono text-[10px]">-- END OF NOTES --</div>
        </div>
      </div>
    );
  }

  // --- 2. MCQ RENDERER (FULL LOGIC) ---
  if ((content?.type === 'MCQ_ANALYSIS' || content?.type === 'MCQ_SIMPLE') && content.mcqData) {
    
    // MCQ Initialization & Persistence
    useEffect(() => {
      if (!content.mcqData) return;
      const key = `nst_mcq_progress_${chapter.id}`;
      const saved = localStorage.getItem(key);

      if (content.userAnswers) {
        setMcqState(content.userAnswers as any);
        setShowResults(true);
        setAnalysisUnlocked(true);
        setLocalMcqData(content.mcqData);
        return;
      }

      if (saved) {
        setShowResumePrompt(true);
        setLocalMcqData([...content.mcqData].sort(() => Math.random() - 0.5));
      } else {
        setLocalMcqData([...content.mcqData].sort(() => Math.random() - 0.5));
      }
    }, [content.mcqData, chapter.id, content.userAnswers]);

    // Save progress effect
    useEffect(() => {
      if (!showResults && Object.keys(mcqState).length > 0) {
        localStorage.setItem(`nst_mcq_progress_${chapter.id}`, JSON.stringify({
          mcqState, batchIndex, localMcqData
        }));
      }
    }, [mcqState, batchIndex, chapter.id, localMcqData, showResults]);

    const handleResume = () => {
      const saved = localStorage.getItem(`nst_mcq_progress_${chapter.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMcqState(parsed.mcqState || {});
        setBatchIndex(parsed.batchIndex || 0);
        if (parsed.localMcqData) setLocalMcqData(parsed.localMcqData);
      }
      setShowResumePrompt(false);
    };

    const handleRestart = () => {
      localStorage.removeItem(`nst_mcq_progress_${chapter.id}`);
      setMcqState({});
      setBatchIndex(0);
      setLocalMcqData([...(content.mcqData || [])].sort(() => Math.random() - 0.5));
      setShowResumePrompt(false);
      setShowResults(false);
    };

    const currentBatchData = localMcqData.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
    const attemptedCount = Object.keys(mcqState).length;
    const minRequired = Math.min(50, localMcqData.length);
    const canSubmit = attemptedCount >= minRequired;

    const handleConfirmSubmit = () => {
      setShowSubmitModal(false);
      localStorage.removeItem(`nst_mcq_progress_${chapter.id}`);
      const score = Object.keys(mcqState).reduce((acc, k) => {
        const i = parseInt(k);
        return acc + (mcqState[i] === localMcqData[i].correctAnswer ? 1 : 0);
      }, 0);
      if (onMCQComplete) onMCQComplete(score, mcqState as any, localMcqData, sessionTime);
    };

    return (
      <div className="flex flex-col h-full bg-slate-50 animate-in fade-in relative">
        {/* MCQ Modals */}
        {showResumePrompt && !showResults && (
          <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl scale-in-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Resume Quiz?</h3>
              <p className="text-slate-500 text-sm mb-8">You have a saved session. Would you like to continue or start fresh?</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleResume} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all">Resume Session</button>
                <button onClick={handleRestart} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600">Start Fresh</button>
              </div>
            </div>
          </div>
        )}

        {showSubmitModal && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
              <Trophy size={60} className="mx-auto text-yellow-400 mb-4 animate-bounce" />
              <h3 className="text-2xl font-black text-slate-800 mb-2">Finish Test?</h3>
              <p className="text-slate-500 text-sm mb-8">You answered {attemptedCount} questions. Once submitted, you can view the analysis.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-4 border-2 border-slate-100 text-slate-600 font-bold rounded-2xl">Wait</button>
                <button onClick={handleConfirmSubmit} className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg">Submit Now</button>
              </div>
            </div>
          </div>
        )}

        {/* MCQ Header */}
        <header className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="flex gap-3">
            <button onClick={onBack} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><ArrowLeft size={20} /></button>
            <div>
              <h3 className="font-black text-slate-800 text-sm truncate max-w-[150px]">{chapter.title}</h3>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">MCQ Assessment</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-slate-500 font-mono text-sm bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
              <Clock size={14} className="text-blue-500" />
              {Math.floor(sessionTime / 60)}:{String(sessionTime % 60).padStart(2, '0')}
            </div>
          </div>
        </header>

        {/* MCQ Questions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 mcq-container pb-32">
          {currentBatchData.map((q, lIdx) => {
            const idx = (batchIndex * BATCH_SIZE) + lIdx;
            const userAnswer = mcqState[idx];
            const isAnswered = userAnswer !== undefined && userAnswer !== null;
            const isCorrect = userAnswer === q.correctAnswer;

            return (
              <div key={idx} className={`bg-white p-6 rounded-3xl border-2 transition-all duration-300 ${isAnswered ? 'border-blue-100 shadow-sm' : 'border-slate-50 shadow-none'}`}>
                <div className="flex gap-4 mb-6">
                  <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shrink-0">{idx + 1}</span>
                  <h4 className="font-bold text-slate-800 leading-relaxed pt-1">{q.question}</h4>
                </div>
                <div className="space-y-3">
                  {q.options.map((opt, oIdx) => {
                    let btnStyle = "w-full text-left p-4 rounded-2xl border-2 font-bold text-sm transition-all duration-200 relative overflow-hidden ";
                    if (showResults && analysisUnlocked) {
                      if (oIdx === q.correctAnswer) btnStyle += "bg-green-50 border-green-500 text-green-700";
                      else if (userAnswer === oIdx) btnStyle += "bg-red-50 border-red-500 text-red-700";
                      else btnStyle += "bg-slate-50 border-slate-100 opacity-40";
                    } else if (isAnswered) {
                      if (userAnswer === oIdx) btnStyle += "bg-blue-600 border-blue-600 text-white shadow-blue-200 shadow-lg scale-[1.02]";
                      else btnStyle += "bg-slate-50 border-slate-100 opacity-60";
                    } else {
                      btnStyle += "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/30";
                    }
                    return (
                      <button key={oIdx} disabled={showResults || isAnswered} onClick={() => setMcqState(p => ({...p, [idx]: oIdx}))} className={btnStyle}>
                        <div className="flex items-center justify-between">
                          <span className="flex-1">{opt}</span>
                          {showResults && oIdx === q.correctAnswer && <CheckCircle size={18} />}
                          {isAnswered && !showResults && userAnswer === oIdx && <CheckCircle size={18} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {showResults && (
                  <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 animate-in slide-in-from-top-4">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Answer Explanation</h5>
                    <p className="text-slate-700 text-sm leading-relaxed">{q.explanation || "No detailed explanation provided for this question."}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* MCQ Footer Controls */}
        <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 sticky bottom-0 z-20 flex gap-3">
          {batchIndex > 0 && (
            <button onClick={() => setBatchIndex(p => p - 1)} className="p-4 bg-slate-100 text-slate-800 rounded-2xl font-black active:scale-95 transition-all"><ChevronLeft /></button>
          )}
          {!showResults ? (
            <button 
              onClick={() => setShowSubmitModal(true)} 
              disabled={!canSubmit} 
              className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl flex items-center justify-center gap-3 ${canSubmit ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-200 text-slate-400'}`}
            >
              <Trophy size={20} /> SUBMIT TEST
            </button>
          ) : (
            <button onClick={onBack} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black">EXIT ANALYSIS</button>
          )}
          {(batchIndex + 1) * BATCH_SIZE < localMcqData.length && (
            <button onClick={() => setBatchIndex(p => p + 1)} className="p-4 bg-slate-100 text-slate-800 rounded-2xl font-black active:scale-95 transition-all"><ChevronRight /></button>
          )}
        </div>
      </div>
    );
  }

  // --- 3. VIDEO RENDERER (SMART BLOCKER IMPLEMENTATION) ---
  if ((content?.type === 'PDF_VIEWER' || content?.type === 'VIDEO_LECTURE') && (content?.content.includes('youtube.com') || content?.content.includes('youtu.be') || content?.videoPlaylist)) {
    const [vIdx, setVIdx] = useState(0);
    const playlist = content.videoPlaylist?.length ? content.videoPlaylist : [{ title: chapter.title, url: content.content }];
    const currentVideo = playlist[vIdx];
    let embedUrl = currentVideo.url;
    
    // Convert YouTube URLs
    if (embedUrl.includes('youtube.com/watch')) {
      embedUrl = `https://www.youtube.com/embed/${new URL(embedUrl).searchParams.get('v')}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1`;
    } else if (embedUrl.includes('youtu.be/')) {
      embedUrl = `https://www.youtube.com/embed/${embedUrl.split('youtu.be/')[1]}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1`;
    }

    return (
      <div className="flex flex-col h-[calc(100vh-80px)] bg-[#0f172a] animate-in fade-in">
        {/* Video Header */}
        <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-white transition-colors">
            <ArrowLeft size={20} /> <span className="hidden sm:inline">Back to Syllabus</span>
          </button>
          <div className="text-center">
            <h3 className="text-white font-bold text-sm truncate max-w-[180px]">{currentVideo.title}</h3>
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">NSTA DIGITAL PLAYER</p>
          </div>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Main Player Container */}
          <div ref={containerRef} className="flex-1 bg-black relative group overflow-hidden select-none">
            
            {/* 🔒 1. TOP-RIGHT BLOCKER: Blocks Share/Settings Popups */}
            <div 
              className="absolute z-[70] top-0 right-0 w-[140px] h-[90px] pointer-events-auto bg-transparent" 
              title="Interaction Restricted"
            />

            {/* 🔗 2. BOTTOM-RIGHT CLICKABLE BRANDING: Hides YouTube Logo & Redirects to your Channel */}
            <a
              href="https://youtube.com/@ehsansir2.0?si=80l2sFqj85RnGulA"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute z-[75] bottom-0 right-0 w-[150px] h-[65px] pointer-events-auto bg-[#000] flex flex-col items-center justify-center no-underline border-tl border-white/5 shadow-2xl transition-all hover:bg-zinc-900"
            >
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-blue-400 font-black tracking-widest animate-pulse">NSTA OFFICIAL</span>
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">@ehsansir2.0</span>
              </div>
            </a>

            {/* 🔒 3. BOTTOM-LEFT BLOCKER: Blocks Share Arrow on Mobile devices */}
            <div className="absolute z-[70] bottom-0 left-0 w-[90px] h-[70px] pointer-events-auto bg-transparent" />

            {/* 🔘 CUSTOM FULLSCREEN BUTTON: Stays clickable on top of overlays */}
            <button 
              onClick={toggleFullScreen} 
              className="absolute top-6 left-6 z-[80] bg-black/60 text-white p-3 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-black/90 active:scale-90 transition-all shadow-xl"
            >
              <Maximize size={24} />
            </button>

            {/* 📺 VIDEO IFRAME */}
            <iframe 
              key={embedUrl}
              src={embedUrl}
              className="w-full h-full border-0 pointer-events-auto" 
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              title={currentVideo.title}
            />
          </div>

          {/* Playlist Sidebar */}
          {playlist.length > 1 && (
            <div className="w-full md:w-85 bg-slate-900 border-l border-slate-800 overflow-y-auto flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 tracking-widest">COURSE PLAYLIST</span>
                <span className="text-xs text-blue-500 font-bold">{vIdx + 1}/{playlist.length}</span>
              </div>
              <div className="flex-1 p-2 space-y-2">
                {playlist.map((vid, i) => (
                  <button 
                    key={i} 
                    onClick={() => setVIdx(i)} 
                    className={`w-full p-4 rounded-2xl flex gap-4 text-left transition-all ${i === vIdx ? 'bg-blue-600/10 border border-blue-600/20 text-blue-400' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${i === vIdx ? 'bg-blue-600 text-white' : 'bg-slate-700'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold truncate leading-tight">{vid.title}</p>
                      <p className="text-[9px] opacity-50 mt-1 uppercase">Video Lecture</p>
                    </div>
                    {i === vIdx && <Play size={12} fill="currentColor" className="mt-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 4. PDF & HTML NOTES RENDERER ---
  const isPdf = content?.content.toLowerCase().endsWith('.pdf') || content?.content.includes('drive.google.com');
  const decodedContent = content ? decodeHtml(content.content) : '';

  if (content?.type.startsWith('PDF') || content?.type.startsWith('NOTES_HTML')) {
    return (
      <div className="bg-white min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between shadow-sm">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="text-center">
            <h3 className="font-black text-slate-800 text-sm leading-none">{chapter.title}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Study Material</p>
          </div>
          <button onClick={toggleFullScreen} className="p-2 text-slate-400"><Maximize size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-4xl mx-auto p-4 md:p-8">
            {isPdf ? (
              <div ref={containerRef} className="h-[80vh] w-full bg-white rounded-3xl shadow-xl overflow-hidden relative border border-slate-200">
                <iframe 
                  src={content?.content.replace('/view', '/preview').replace('/edit', '/preview')} 
                  className="w-full h-full border-0" 
                  sandbox="allow-scripts allow-same-origin"
                />
                {/* PDF Toolbar Blocker (Top Right) */}
                <div className="absolute top-0 right-0 w-24 h-24 z-10 bg-transparent" />
              </div>
            ) : (
              <div className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-slate-100">
                <div 
                  className="prose prose-slate max-w-none prose-img:rounded-2xl prose-headings:text-slate-900 prose-a:text-blue-600 [&_a]:pointer-events-none" 
                  dangerouslySetInnerHTML={{ __html: decodedContent }} 
                />
              </div>
            )}
            
            <div className="my-12 text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-6">--- END OF CONTENT ---</p>
              <button 
                onClick={onBack} 
                className="bg-slate-900 text-white py-5 px-12 rounded-3xl font-black text-lg shadow-2xl hover:bg-blue-600 transition-all active:scale-95"
              >
                COMPLETE & CLOSE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 5. DEFAULT NOTES (MARKDOWN) RENDERER ---
  return (
    <div className="bg-white min-h-screen pb-20 animate-in fade-in">
      <header className="sticky top-0 z-20 bg-white/95 border-b border-slate-100 p-4 flex items-center justify-between">
        <button onClick={onBack} className="p-2 text-slate-500"><ArrowLeft size={24} /></button>
        <div className="text-center">
          <h3 className="font-black text-slate-800 text-sm">{chapter.title}</h3>
          <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">{content?.subtitle || 'Chapter Summary'}</p>
        </div>
        <div className="w-10"></div>
      </header>

      <div className="max-w-3xl mx-auto p-6 md:p-12">
        <div className="prose prose-slate prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-900 max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            components={{
              h1: ({...props}) => <h1 className="text-3xl font-black mb-8 border-b-4 border-slate-100 pb-4" {...props} />,
              h2: ({...props}) => <h2 className="text-xl font-black mt-12 mb-6 text-blue-800 flex items-center gap-3" {...props} />,
              blockquote: ({...props}) => <blockquote className="border-l-8 border-blue-500 bg-blue-50/50 p-6 rounded-r-3xl italic text-blue-900 my-8 shadow-sm" {...props} />,
              ul: ({...props}) => <ul className="list-disc pl-6 space-y-3 my-6" {...props} />,
              li: ({...props}) => <li className="pl-2" {...props} />,
              code: ({...props}) => <code className="bg-slate-100 text-pink-600 px-2 py-0.5 rounded-lg font-mono text-sm font-bold border border-slate-200" {...props} />,
            }}
          >
            {content?.content || 'No content provided.'}
          </ReactMarkdown>
        </div>
        
        <div className="mt-20 pt-10 border-t-2 border-slate-100 text-center">
          <button 
            onClick={onBack} 
            className="bg-slate-900 text-white py-5 px-16 rounded-[2rem] font-black text-lg shadow-2xl transition-all active:scale-95"
          >
            I'VE FINISHED STUDYING
          </button>
        </div>
      </div>
    </div>
  );
};
