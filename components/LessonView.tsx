import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  LessonContent, Subject, ClassLevel, Chapter, 
  MCQItem, ContentType, User, SystemSettings 
} from '../types';
import { 
  ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle, 
  XCircle, Trophy, BookOpen, Play, Lock, ChevronRight, 
  ChevronLeft, Save, X, Maximize, RotateCcw, Share2, Youtube
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
  
  // Timer & UI State
  const [sessionTime, setSessionTime] = useState(0); 
  const [batchIndex, setBatchIndex] = useState(0);
  const BATCH_SIZE = 50; 

  // Refs for UI interactions
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dialog States
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean, title: string, message: string, onConfirm: () => void
  }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  // ==========================================
  // 2. EFFECTS (TIMER & FULLSCREEN & SECURITY)
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
              setAlertConfig({ isOpen: true, message: "Fullscreen mode not supported on this device." });
          });
      } else {
          document.exitFullscreen();
      }
  };

  // Prevent accidental back navigation during MCQ
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
          <div className="h-[80vh] flex flex-col items-center justify-center text-center p-8 bg-white/50 backdrop-blur-sm">
              <div className="relative w-24 h-24 mb-8">
                  <div className="absolute inset-0 border-8 border-slate-100 rounded-full"></div>
                  <div className="absolute inset-0 border-8 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen size={24} className="text-blue-600 opacity-50" />
                  </div>
              </div>
              <h3 className="text-2xl font-black text-slate-800 animate-pulse tracking-tight">Syncing Content...</h3>
              <p className="text-slate-400 mt-2 font-medium max-w-xs mx-auto">Please wait while we prepare your high-quality learning materials.</p>
          </div>
      );
  }

  // ==========================================
  // 4. AI IMAGE/HTML NOTES VIEW (STRICT MODE)
  // ==========================================
  if (content?.type === 'NOTES_IMAGE_AI') {
      const preventAction = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();
      
      if (content.aiHtmlContent) {
          const decodedHtml = decodeHtml(content.aiHtmlContent);
          return (
              <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
                  <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 p-4 absolute top-0 left-0 right-0 z-10 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 shadow-sm border border-teal-100">
                              <BookOpen size={20} />
                          </div>
                          <div>
                              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{content.title}</h2>
                              <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest mt-1">AI Master Notes</p>
                          </div>
                      </div>
                      <button onClick={onBack} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-all hover:text-slate-600 active:scale-95"><X size={20} /></button>
                  </header>
                  
                  <div className="flex-1 overflow-y-auto w-full pt-20 pb-10 px-6 md:px-12 selection:bg-teal-100">
                      <div 
                          className="prose prose-slate max-w-none prose-img:rounded-3xl prose-img:shadow-2xl prose-headings:font-black prose-headings:text-slate-900 prose-a:text-blue-600 [&_a]:pointer-events-none [&_a]:cursor-text [&_a]:no-underline [&_iframe]:pointer-events-none prose-blockquote:border-teal-500 prose-blockquote:bg-teal-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg"
                          dangerouslySetInnerHTML={{ __html: decodedHtml }}
                      />
                      <div className="h-20 flex items-center justify-center mt-10 border-t border-slate-100">
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">End of AI Notes</p>
                      </div>
                  </div>
              </div>
          );
      }

      return (
          <div 
              className="fixed inset-0 z-50 bg-[#050505] flex flex-col overflow-hidden animate-in fade-in"
              style={{ width: '100vw', height: '100vh', touchAction: 'none' }}
          >
              <header className="bg-black/60 backdrop-blur-2xl border-b border-white/5 p-4 absolute top-0 left-0 right-0 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <button onClick={onBack} className="p-2 text-white/50 hover:text-white transition-colors bg-white/5 rounded-lg"><ArrowLeft size={20} /></button>
                      <h2 className="text-xs font-black text-white/90 uppercase tracking-[0.2em]">{content.title}</h2>
                  </div>
                  <div className="px-3 py-1 bg-teal-500/20 rounded-full border border-teal-500/30 text-teal-400 text-[9px] font-black uppercase tracking-widest">AI Visual Mode</div>
              </header>
              
              <div 
                  className="viewer w-full h-full overflow-y-auto overflow-x-hidden bg-[#050505] scrollbar-hide"
                  style={{ touchAction: 'pan-y' }}
                  onContextMenu={preventAction}
              >
                  <div className="pt-24 pb-20 w-full min-h-screen flex justify-center">
                      <img 
                          src={content.content} 
                          alt="AI Study Material" 
                          className="w-[160%] max-w-none ml-[-30%] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] rounded-sm"
                          loading="lazy"
                          onContextMenu={preventAction}
                          draggable={false}
                          style={{ 
                              pointerEvents: 'none',
                              userSelect: 'none',
                              WebkitUserSelect: 'none'
                          }}
                      />
                  </div>
                  
                  <div className="h-20 w-full flex flex-col items-center justify-center gap-2 pb-10">
                      <div className="w-1 h-20 bg-gradient-to-b from-teal-500/50 to-transparent rounded-full"></div>
                      <p className="text-[10px] font-mono text-zinc-800 tracking-[1em] uppercase">End of Canvas</p>
                  </div>
              </div>
          </div>
      );
  }

  // ==========================================
  // 5. MCQ SYSTEM (FULL LOGIC)
  // ==========================================
  if ((content?.type === 'MCQ_ANALYSIS' || content?.type === 'MCQ_SIMPLE') && content.mcqData) {
      
      useEffect(() => {
          if (!content.mcqData) return;
          if (content.userAnswers) {
              setMcqState(content.userAnswers as any);
              setShowResults(true);
              setAnalysisUnlocked(true);
              setLocalMcqData(content.mcqData); 
              return;
          }

          const progressKey = `nst_mcq_progress_${chapter.id}`;
          const savedProgress = localStorage.getItem(progressKey);

          if (savedProgress) {
              setShowResumePrompt(true);
              setLocalMcqData([...content.mcqData].sort(() => Math.random() - 0.5));
          } else {
              setLocalMcqData([...content.mcqData].sort(() => Math.random() - 0.5));
          }
      }, [content.mcqData, chapter.id, content.userAnswers]);

      useEffect(() => {
          if (!showResults && Object.keys(mcqState).length > 0) {
              const key = `nst_mcq_progress_${chapter.id}`;
              localStorage.setItem(key, JSON.stringify({
                  mcqState,
                  batchIndex,
                  localMcqData
              }));
          }
      }, [mcqState, batchIndex, chapter.id, localMcqData, showResults]);

      const handleResume = () => {
          const key = `nst_mcq_progress_${chapter.id}`;
          const saved = localStorage.getItem(key);
          if (saved) {
              const parsed = JSON.parse(saved);
              setMcqState(parsed.mcqState || {});
              setBatchIndex(parsed.batchIndex || 0);
              if (parsed.localMcqData) setLocalMcqData(parsed.localMcqData);
          }
          setShowResumePrompt(false);
      };

      const handleRestart = () => {
          const key = `nst_mcq_progress_${chapter.id}`;
          localStorage.removeItem(key);
          setMcqState({});
          setBatchIndex(0);
          setLocalMcqData([...(content.mcqData || [])].sort(() => Math.random() - 0.5));
          setShowResumePrompt(false);
          setAnalysisUnlocked(false);
          setShowResults(false);
      };

      const handleRecreate = () => {
          setConfirmConfig({
              isOpen: true,
              title: "Restart Quiz?",
              message: "This will shuffle questions and reset your current progress. Are you sure?",
              onConfirm: () => {
                  const shuffled = [...(content.mcqData || [])].sort(() => Math.random() - 0.5);
                  setLocalMcqData(shuffled);
                  setMcqState({});
                  setBatchIndex(0);
                  setShowResults(false);
                  setAnalysisUnlocked(false);
                  const key = `nst_mcq_progress_${chapter.id}`;
                  localStorage.removeItem(key);
                  setConfirmConfig(prev => ({...prev, isOpen: false}));
              }
          });
      };

      const currentBatchData = localMcqData.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      const hasMore = (batchIndex + 1) * BATCH_SIZE < localMcqData.length;
      
      const score = Object.keys(mcqState).reduce((acc, key) => {
          const qIdx = parseInt(key);
          return acc + (mcqState[qIdx] === localMcqData[qIdx].correctAnswer ? 1 : 0);
      }, 0);
      const currentCorrect = score;
      const attemptedCount = Object.keys(mcqState).length;
      const minRequired = Math.min(50, localMcqData.length);
      const canSubmit = attemptedCount >= minRequired;

      const handleConfirmSubmit = () => {
          setShowSubmitModal(false);
          const key = `nst_mcq_progress_${chapter.id}`;
          localStorage.removeItem(key);
          if (onMCQComplete) onMCQComplete(score, mcqState as any, localMcqData, sessionTime);
      };

      return (
          <div className="flex flex-col h-full bg-slate-50 animate-in fade-in relative">
               <CustomAlert isOpen={alertConfig.isOpen} message={alertConfig.message} type="ERROR" onClose={() => setAlertConfig({...alertConfig, isOpen: false})} />
               <CustomConfirm isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} onConfirm={confirmConfig.onConfirm} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} />

               {showResumePrompt && !showResults && (
                   <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                       <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl scale-in-center">
                           <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-sm">
                               <Clock size={32} />
                           </div>
                           <h3 className="text-2xl font-black text-slate-800 mb-2">Resume Session?</h3>
                           <p className="text-slate-500 text-sm mb-8 font-medium">We found an unfinished test. Would you like to continue where you left off?</p>
                           <div className="flex flex-col gap-3">
                               <button onClick={handleResume} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all">RESUME PROGRESS</button>
                               <button onClick={handleRestart} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-400 font-bold rounded-2xl hover:bg-slate-50 transition-all">START FRESH</button>
                           </div>
                       </div>
                   </div>
               )}

               {showSubmitModal && (
                   <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-end justify-center sm:items-center p-4">
                       <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in">
                           <div className="w-20 h-20 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                               <Trophy size={40} className="animate-bounce" />
                           </div>
                           <h3 className="text-2xl font-black text-slate-800 mb-2">Submit Test?</h3>
                           <p className="text-slate-500 text-sm mb-8 font-medium">
                               You have answered <span className="text-slate-900 font-black">{attemptedCount}</span> questions. 
                               <br/>Confirm submission to generate your report.
                           </p>
                           <div className="flex gap-3">
                               <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-4 border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50">Not Yet</button>
                               <button onClick={handleConfirmSubmit} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl active:scale-95">Yes, Submit</button>
                           </div>
                       </div>
                   </div>
               )}

               <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                   <div className="flex gap-2">
                       <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold text-sm bg-slate-100 px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors active:scale-95">
                           <ArrowLeft size={18} /> Exit
                       </button>
                       {!showResults && (
                           <button onClick={handleRecreate} className="flex items-center gap-2 text-purple-600 font-bold text-xs bg-purple-50 border border-purple-100 px-4 py-2.5 rounded-xl hover:bg-purple-100 transition-colors active:scale-95">
                               <RotateCcw size={14} /> Re-create
                           </button>
                       )}
                   </div>
                   <div className="text-right">
                       <h3 className="font-black text-slate-800 text-sm uppercase tracking-tighter">MCQ Test</h3>
                       {showResults ? (
                           <span className="text-xs font-bold text-green-600 flex items-center justify-end gap-1"><CheckCircle size={12}/> Analysis Mode</span>
                       ) : (
                           <div className="flex flex-col items-end">
                               <div className="flex gap-3 text-xs font-bold mb-1">
                                   <span className="text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md"><Clock size={12}/> {Math.floor(sessionTime / 60)}:{String(sessionTime % 60).padStart(2, '0')}</span>
                                   <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md"><CheckCircle size={12}/> {currentCorrect}</span>
                               </div>
                               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{attemptedCount}/{localMcqData.length} Attempted</span>
                           </div>
                       )}
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full pb-32 mcq-container scroll-smooth">
                   {currentBatchData.map((q, localIdx) => {
                       const idx = (batchIndex * BATCH_SIZE) + localIdx;
                       const userAnswer = mcqState[idx];
                       const isAnswered = userAnswer !== undefined && userAnswer !== null;
                       const isCorrect = userAnswer === q.correctAnswer;
                       
                       return (
                           <div key={idx} className={`bg-white p-6 rounded-[1.5rem] border-2 transition-all duration-300 ${isAnswered ? 'border-blue-100 shadow-lg shadow-blue-50' : 'border-slate-100 shadow-sm'}`}>
                               <h4 className="font-bold text-slate-800 mb-6 flex gap-4 leading-relaxed text-lg">
                                   <span className="bg-slate-900 text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 font-black mt-0.5 shadow-md">{idx + 1}</span>
                                   {q.question}
                               </h4>
                               <div className="space-y-3">
                                   {q.options.map((opt, oIdx) => {
                                       let btnClass = "w-full text-left p-4 rounded-2xl border-2 transition-all text-sm font-bold relative overflow-hidden ";
                                       
                                       if (showResults && analysisUnlocked) {
                                           if (oIdx === q.correctAnswer) btnClass += "bg-green-50 border-green-500 text-green-700 shadow-sm";
                                           else if (userAnswer === oIdx) btnClass += "bg-red-50 border-red-500 text-red-700 shadow-sm";
                                           else btnClass += "bg-slate-50 border-slate-100 opacity-40";
                                       } 
                                       else if (isAnswered) {
                                            if (userAnswer === oIdx) btnClass += "bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.02] z-10";
                                            else btnClass += "bg-slate-50 border-slate-100 opacity-50 grayscale";
                                       } else {
                                           btnClass += "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300";
                                       }

                                       return (
                                           <button 
                                               key={oIdx}
                                               disabled={isAnswered || showResults} 
                                               onClick={() => setMcqState(prev => ({ ...prev, [idx]: oIdx }))}
                                               className={btnClass}
                                           >
                                               <span className="relative z-10 flex justify-between items-center">
                                                   {opt}
                                                   {showResults && analysisUnlocked && oIdx === q.correctAnswer && <CheckCircle size={18} className="text-green-600" />}
                                                   {showResults && analysisUnlocked && userAnswer === oIdx && userAnswer !== q.correctAnswer && <XCircle size={18} className="text-red-500" />}
                                                   
                                                   {!showResults && isAnswered && userAnswer === oIdx && <CheckCircle size={18} className="text-white" />}
                                               </span>
                                           </button>
                                       );
                                   })}
                               </div>
                               
                               {showResults && analysisUnlocked && (
                                   <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-100 animate-in slide-in-from-top-4">
                                       <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-3 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                           {isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                           {isCorrect ? 'Correct Answer' : 'Incorrect Answer'}
                                       </div>
                                       {q.explanation && q.explanation !== "Answer Key Provided" && (
                                            <div className="text-slate-600 text-sm bg-slate-50 p-5 rounded-2xl border border-slate-100 leading-relaxed">
                                                <span className="font-black text-slate-800 block text-[10px] uppercase mb-2 tracking-widest">Logic & Reasoning:</span>
                                                {q.explanation}
                                            </div>
                                       )}
                                   </div>
                               )}
                           </div>
                       );
                   })}
               </div>

               <div className="p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 sticky bottom-0 z-[60] grid grid-cols-3 gap-3 items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                   <div className="flex justify-start">
                       {batchIndex > 0 && (
                           <button 
                               onClick={() => {
                                   setBatchIndex(prev => prev - 1);
                                   document.querySelector('.mcq-container')?.scrollTo(0,0);
                               }}
                               className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 px-5 rounded-2xl transition-all active:scale-95 flex items-center gap-2"
                           >
                               <ChevronLeft size={20} /> <span className="hidden sm:inline">Prev</span>
                           </button>
                       )}
                   </div>

                   <div className="flex justify-center w-full">
                       {!showResults && (
                           <div className="flex flex-col items-center w-full">
                               <button 
                                   onClick={handleSubmitRequest}
                                   disabled={!canSubmit} 
                                   className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-black py-3.5 px-8 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 w-full shadow-lg shadow-blue-200 disabled:shadow-none"
                               >
                                   <Trophy size={20} /> SUBMIT
                               </button>
                               {!canSubmit && (
                                   <span className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">Min {minRequired} Required</span>
                               )}
                           </div>
                       )}
                   </div>

                   <div className="flex justify-end">
                       {hasMore && (
                           <button 
                               onClick={() => {
                                   setBatchIndex(prev => prev + 1);
                                   document.querySelector('.mcq-container')?.scrollTo(0,0);
                               }}
                               disabled={!showResults && currentBatchData.some((_, i) => mcqState[(batchIndex * BATCH_SIZE) + i] === undefined)}
                               className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 px-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2"
                           >
                               <span className="hidden sm:inline">Next</span> <ChevronRight size={20} />
                           </button>
                       )}
                   </div>
               </div>
          </div>
      );
  }

  // ==========================================
  // 6. VIDEO RENDERER (NUCLEAR EVENT BLOCKING)
  // ==========================================
  if ((content.type === 'PDF_VIEWER' || content.type === 'VIDEO_LECTURE') && (content.content.includes('youtube.com') || content.content.includes('youtu.be') || content.content.includes('drive.google.com/file') || content.content.includes('.mp4') || (content.videoPlaylist && content.videoPlaylist.length > 0))) {
      const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
      const playlist = content.videoPlaylist && content.videoPlaylist.length > 0 
          ? content.videoPlaylist 
          : [{ title: chapter.title, url: content.content }];
      
      const currentVideo = playlist[currentVideoIndex];
      let embedUrl = currentVideo.url;
      
      if (embedUrl.includes('youtube.com/watch')) {
          embedUrl = `https://www.youtube.com/embed/${new URL(embedUrl).searchParams.get('v')}?autoplay=1`;
      } else if (embedUrl.includes('youtu.be/')) {
          embedUrl = `https://www.youtube.com/embed/${embedUrl.split('youtu.be/')[1]}?autoplay=1`;
      }

      // STRICT PARAMETERS FOR YOUTUBE
      const secureSrc = `${embedUrl}&modestbranding=1&rel=0&iv_load_policy=3&controls=1&disablekb=1&showinfo=0&fs=0`;

      // 🔥 EVENT KILLER: Stops EVERYTHING (Click, Touch, ContextMenu)
      const killEvent = (e: any) => {
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent?.stopImmediatePropagation();
          return false;
      };
      
      return (
          <div className="flex flex-col h-[calc(100vh-80px)] bg-[#030712] animate-in fade-in">
              <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-white/10 shadow-lg relative z-[10000]">
                   <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-white transition-colors group">
                       <ArrowLeft size={20} className="group-active:-translate-x-1 transition-transform" /> Back
                   </button>
                   <div className="text-center">
                       <h3 className="font-black text-white text-xs sm:text-sm truncate max-w-[200px] uppercase tracking-tighter">{currentVideo.title}</h3>
                       <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">Secure Player</p>
                   </div>
                   <div className="w-10"></div>
              </div>
              
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                  <div ref={containerRef} className="flex-1 bg-black relative group overflow-hidden select-none isolate">
                      
                      {/* 🔴 1. SHARE BUTTON BLOCKER (TOP RIGHT - INVISIBLE SHIELD) */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '250px', // Wider to catch stray taps
                          height: '100px',
                          zIndex: 2147483647, // Max Layer
                          backgroundColor: 'rgba(255, 255, 255, 0.001)', // MAGIC FIX: Not perfectly transparent
                          touchAction: 'none' // DISALLOWS GESTURES
                        }}
                        // NUCLEAR EVENT HANDLING
                        onClickCapture={killEvent}
                        onTouchStartCapture={killEvent}
                        onMouseDownCapture={killEvent}
                        onContextMenu={killEvent}
                      />

                      {/* 🔗 2. REDIRECT LINK (LOGO MASK - ALLOWS CLICK) */}
                      <a
                         href="https://youtube.com/@ehsansir2.0?si=80l2sFqj85RnGulA"
                         target="_blank"
                         rel="noopener noreferrer"
                         style={{
                           position: 'absolute',
                           bottom: 0,
                           right: 0,
                           width: '180px',
                           height: '80px',
                           zIndex: 2147483647,
                           backgroundColor: 'rgba(255, 255, 255, 0.001)', // Visible to browser, invisible to user
                           cursor: 'pointer',
                           touchAction: 'auto'
                         }}
                         // We do NOT kill events here so the link works
                      />

                      {/* 🔒 3. BOTTOM LEFT CONTROLS BLOCKER */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: '100%', // COVERS ENTIRE BOTTOM STRIP (except where the link sits above)
                          height: '80px',
                          zIndex: 2147483646, // One layer below the link
                          backgroundColor: 'rgba(255, 255, 255, 0.001)',
                          touchAction: 'none'
                        }}
                        onClickCapture={killEvent}
                        onTouchStartCapture={killEvent}
                      />

                      {/* 🔘 FULLSCREEN BUTTON (MOVED TO TOP LEFT & SECURED) */}
                      <button 
                          onClick={toggleFullScreen} 
                          className="absolute top-4 left-4 z-[2147483647] bg-black/60 text-white/90 p-3 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-black hover:text-white transition-all shadow-xl active:scale-90"
                      >
                          <Maximize size={22} />
                      </button>

                      {/* 📺 VIDEO IFRAME */}
                      <iframe 
                           key={secureSrc}
                           src={secureSrc}
                           className="w-full h-full border-0 relative"
                           style={{ zIndex: 1 }}
                           allow="autoplay; fullscreen; picture-in-picture"
                           allowFullScreen
                           sandbox="allow-scripts allow-same-origin allow-presentation"
                           title={currentVideo.title}
                       />
                  </div>
                  
                  {/* Playlist Sidebar */}
                  {playlist.length > 1 && (
                      <div className="w-full md:w-85 bg-slate-950 border-l border-white/5 flex flex-col shadow-2xl z-[50]">
                          <div className="p-4 bg-slate-950 border-b border-white/5"><h4 className="font-black text-slate-500 text-[10px] uppercase tracking-[0.3em]">Course Playlist</h4></div>
                          <div className="flex-1 overflow-y-auto p-3 space-y-3">
                              {playlist.map((vid, idx) => (
                                  <button key={idx} onClick={() => setCurrentVideoIndex(idx)} className={`w-full p-4 rounded-2xl flex gap-4 items-center text-left transition-all duration-300 border ${idx === currentVideoIndex ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-transparent text-slate-500 hover:bg-slate-900'}`}>
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${idx === currentVideoIndex ? 'bg-white/20 text-white' : 'bg-slate-800'}`}>{idx + 1}</div>
                                      <div className="flex-1 min-w-0"><p className="font-bold text-xs truncate uppercase tracking-tight">{vid.title}</p></div>
                                      {idx === currentVideoIndex && <Play size={14} fill="currentColor" />}
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
  // 7. PDF / EXTERNAL LINK RENDERER
  // ==========================================
  if (content.type === 'PDF_VIEWER' || content.type === 'PDF_FREE' || content.type === 'PDF_PREMIUM') {
      const isPdf = content.content.toLowerCase().endsWith('.pdf') || content.content.includes('drive.google.com') || content.content.includes('docs.google.com');
      return (
          <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50">
              <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm">
                   <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-900 transition-colors">
                       <ArrowLeft size={20} />
                   </button>
                   <h3 className="font-black text-slate-800 text-sm truncate max-w-[200px] uppercase tracking-tighter">{chapter.title}</h3>
                   <button onClick={toggleFullScreen} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                       <Maximize size={20} />
                   </button>
              </div>
              <div ref={containerRef} className="flex-1 w-full bg-slate-200/50 p-4 md:p-8 relative overflow-hidden">
                  <div className="w-full h-full bg-white rounded-[2rem] shadow-xl overflow-hidden relative border border-slate-200">
                      {isPdf ? (
                         <div className="relative w-full h-full group">
                            <iframe src={content.content.replace('/view', '/preview').replace('/edit', '/preview')} className="w-full h-full border-0" allowFullScreen sandbox="allow-scripts allow-same-origin" title="PDF Viewer" />
                            <div className="absolute top-0 right-0 w-32 h-24 z-10 bg-transparent pointer-events-auto"></div>
                         </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white"><ExternalLink size={48} className="text-slate-400 mb-4" /><h3 className="text-2xl font-black text-slate-800 mb-2">External Content</h3><p className="text-slate-500 mb-8 max-w-md">This content is hosted securely on an external platform.</p><a href={content.content} target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white font-bold py-4 px-8 rounded-2xl shadow-lg">Open in Browser</a></div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // ==========================================
  // 8. HTML NOTES RENDERER
  // ==========================================
  if (content.type === 'NOTES_HTML_FREE' || content.type === 'NOTES_HTML_PREMIUM') {
      const decodedContent = decodeHtml(content.content);
      return (
        <div className="bg-white min-h-screen pb-20 animate-in fade-in">
           <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm">
               <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-slate-900"><ArrowLeft size={20} /></button>
               <div className="text-center"><h3 className="font-black text-slate-800 text-sm leading-tight">{chapter.title}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{content.type === 'NOTES_HTML_PREMIUM' ? 'Premium Notes' : 'Free Notes'}</p></div>
               <div className="w-8"></div>
           </div>
           <div className="max-w-4xl mx-auto p-6 md:p-12">
               <div className="prose prose-slate max-w-none prose-img:rounded-3xl prose-headings:text-slate-900 prose-headings:font-black" dangerouslySetInnerHTML={{ __html: decodedContent }} />
               <div className="mt-16 pt-10 border-t border-slate-100 text-center"><button onClick={onBack} className="bg-slate-900 text-white font-bold py-4 px-12 rounded-[2rem] shadow-2xl">Complete & Close</button></div>
           </div>
        </div>
      );
  }

  // ==========================================
  // 9. DEFAULT MARKDOWN RENDERER
  // ==========================================
  return (
    <div className="bg-white min-h-screen pb-32 animate-in fade-in">
       <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-4 flex items-center justify-between shadow-sm">
           <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-slate-900"><ArrowLeft size={22} /></button>
           <div className="text-center"><h3 className="font-black text-slate-800 text-sm leading-tight uppercase tracking-tight">{chapter.title}</h3><p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1">{content.subtitle || 'Study Material'}</p></div>
           <div className="w-8"></div>
       </div>
       <div className="max-w-3xl mx-auto p-6 md:p-14">
           <div className="prose prose-slate prose-lg max-w-none">
               <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                       h1: ({node, ...props}) => <h1 className="text-4xl font-black mb-8 pb-4 border-b-4 border-slate-100" {...props} />,
                       blockquote: ({node, ...props}) => <blockquote className="border-l-[6px] border-blue-500 pl-6 py-4 my-8 bg-blue-50/50 rounded-r-2xl italic" {...props} />,
                   }}>{content.content}</ReactMarkdown>
           </div>
           <div className="mt-20 pt-12 border-t border-slate-100 text-center"><button onClick={onBack} className="bg-slate-900 text-white font-black py-5 px-16 rounded-[2.5rem] shadow-2xl">MARK AS COMPLETE</button></div>
       </div>
    </div>
  );
};
