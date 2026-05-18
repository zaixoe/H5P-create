/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  Play, 
  Edit3, 
  Download, 
  Upload, 
  Image as ImageIcon, 
  Type, 
  CheckSquare, 
  MousePointer2,
  FileText,
  Eye,
  Settings,
  Check,
  X,
  RotateCcw,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Slide, SlideElement, Project, ElementType, InteractionConfig, cn, VideoCheckpoint } from './types';

// --- Constants ---
const CANVAS_ASPECT_RATIO = 16 / 9;

const getYouTubeId = (url: string) => {
  if (!url) return null;
  
  // Clean the URL first
  const cleanUrl = url.trim();

  // 1. Try patterns for common formats including shorts
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct ID
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1].length === 11) {
      return match[1];
    }
  }

  // 2. Try URL parser as fallback for complex URLs
  try {
    const urlObj = new URL(cleanUrl);
    if (urlObj.hostname.includes('youtube.com')) {
      const v = urlObj.searchParams.get('v');
      if (v && v.length === 11) return v;

      const pathParts = urlObj.pathname.split('/');
      if (urlObj.pathname.includes('/embed/') || urlObj.pathname.includes('/v/') || urlObj.pathname.includes('/shorts/')) {
        const id = pathParts[pathParts.length - 1];
        if (id && id.length === 11) return id;
      }
    }
    if (urlObj.hostname.includes('youtu.be')) {
      const id = urlObj.pathname.slice(1).split(/[?&]/)[0];
      if (id && id.length === 11) return id;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  return null;
};

// --- Mock Initial Data ---
const createEmptySlide = (): Slide => ({
  id: Math.random().toString(36).substr(2, 9),
  elements: []
});

// Interactive Drag Words Component
const InteractiveDragWords = ({ content, options, onSuccess }: { content: string, options: string[], onSuccess?: () => void }) => {
  const [placedWords, setPlacedWords] = useState<Record<number, string>>({});
  const [availableWords, setAvailableWords] = useState<string[]>(options);
  const [draggingWord, setDraggingWord] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');

  const parts = content.split(/(\*[^*]+\*)/g);
  const targetAnswers = parts.filter(p => p.startsWith('*') && p.endsWith('*')).map(p => p.slice(1, -1));
  let blankIndex = 0;

  const handleWordDrop = (index: number) => {
    if (draggingWord) {
      if (status !== 'idle') setStatus('idle');
      const oldWord = placedWords[index];
      setPlacedWords(prev => ({ ...prev, [index]: draggingWord }));
      setAvailableWords(prev => {
        const next = prev.filter(w => w !== draggingWord);
        if (oldWord) next.push(oldWord);
        return next;
      });
      setDraggingWord(null);
    }
  };

  const handleCheck = () => {
    const isAllPlaced = Object.keys(placedWords).length === targetAnswers.length;
    if (!isAllPlaced) {
      alert("Please place all words first!");
      return;
    }

    const isCorrect = targetAnswers.every((target, idx) => placedWords[idx] === target);
    if (isCorrect) {
      setStatus('correct');
      if (onSuccess) onSuccess();
    } else {
      setStatus('incorrect');
      // Briefly show error then reset is often better for learning or just show error and let them manually reset
      // The user asked: "bila salah maka reset dan user harus mengulang"
      setTimeout(() => {
        reset();
      }, 1500);
    }
  };

  const reset = () => {
    setPlacedWords({});
    setAvailableWords(options);
    setStatus('idle');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[60px]">
        {availableWords.map((word, i) => (
          <motion.div
            key={`${word}-${i}`}
            draggable
            onDragStart={() => setDraggingWord(word)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing text-sm font-bold text-slate-700"
          >
            {word}
          </motion.div>
        ))}
      </div>

      <motion.div 
        animate={status === 'incorrect' ? { x: [-10, 10, -10, 10, 0] } : {}}
        className={cn(
          "p-8 bg-white rounded-2xl border-2 transition-colors leading-relaxed text-xl text-slate-700",
          status === 'correct' ? "border-green-200 bg-green-50/30" : "border-slate-100",
          status === 'incorrect' ? "border-red-200 bg-red-50/30" : ""
        )}
      >
        {parts.map((part, i) => {
          if (part.startsWith('*') && part.endsWith('*')) {
            const currentIdx = blankIndex++;
            const placed = placedWords[currentIdx];
            return (
              <span
                key={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleWordDrop(currentIdx)}
                onClick={() => {
                  if (status === 'correct') return;
                  if (placed) {
                    setPlacedWords(prev => {
                      const next = { ...prev };
                      delete next[currentIdx];
                      return next;
                    });
                    setAvailableWords(prev => [...prev, placed]);
                  }
                }}
                className={cn(
                  "inline-flex items-center justify-center min-w-[100px] h-10 mx-2 rounded-lg border-2 transition-all cursor-pointer",
                  placed 
                    ? (status === 'correct' ? "bg-green-100 border-green-300 text-green-700" : "bg-indigo-50 border-indigo-200 text-indigo-700") 
                    : "bg-slate-50 border-dashed border-slate-200 text-transparent",
                  status === 'incorrect' && placed && "bg-red-100 border-red-300 text-red-700"
                )}
              >
                {placed || "____"}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </motion.div>

      <div className="flex gap-4">
        {status === 'idle' ? (
          <button 
            onClick={handleCheck}
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-lg font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            Check Answer
          </button>
        ) : (
          <div className={cn(
            "flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg border-2",
            status === 'correct' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
          )}>
            {status === 'correct' ? (
              <><span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</span> Correct!</>
            ) : (
              <><span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">✕</span> Incorrect. Retrying...</>
            )}
          </div>
        )}
        <button 
          onClick={reset}
          className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

/**
 * VideoPlayer Component
 * Moved outside App to prevent component re-definition on every render
 */
const VideoPlayer = ({ 
  element, 
  onCheckpointReached, 
  completedCheckpoints,
  setPlayerRefs,
  setSelectedQuizOption,
  setFillBlanksAnswers,
  setInteractionStatus,
  activeCheckpointId // Added prop
}: { 
  element: SlideElement, 
  onCheckpointReached: (cp: VideoCheckpoint) => void,
  completedCheckpoints: Set<string>,
  setPlayerRefs: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  setSelectedQuizOption: React.Dispatch<React.SetStateAction<string | null>>,
  setFillBlanksAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  setInteractionStatus: React.Dispatch<React.SetStateAction<'idle' | 'correct' | 'incorrect'>>,
  activeCheckpointId: string | null // Added type
}) => {
  const videoId = getYouTubeId(element.config?.videoUrl || "");
  const playerRef = useRef<any>(null);
  const onCheckpointReachedRef = useRef(onCheckpointReached);
  const maxTimeReached = useRef(0);

  // Keep the ref updated with the latest callback
  useEffect(() => {
    onCheckpointReachedRef.current = onCheckpointReached;
  }, [onCheckpointReached]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const time = playerRef.current.getCurrentTime();

          // Prevent seeking forward
          if (time > maxTimeReached.current + 2) {
            playerRef.current.seekTo(maxTimeReached.current, true);
          } else if (time > maxTimeReached.current) {
            maxTimeReached.current = time;
          }

          // Don't trigger if already showing a checkpoint
          if (activeCheckpointId) return;

          const checkpoint = element.config?.checkpoints?.find(cp => 
            !completedCheckpoints.has(cp.id) && 
            Math.abs(time - cp.time) < 0.5
          );

          if (checkpoint) {
            playerRef.current.pauseVideo();
            setSelectedQuizOption(null);
            setFillBlanksAnswers({});
            setInteractionStatus('idle');
            onCheckpointReachedRef.current(checkpoint);
          }
        } catch (e) {
          // Ignore potential API errors
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [element.config?.checkpoints, completedCheckpoints, setSelectedQuizOption, setFillBlanksAnswers, setInteractionStatus, activeCheckpointId]);

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden rounded-lg min-h-[150px]">
      {videoId ? (
        <YouTube
          key={videoId}
          videoId={videoId}
          onReady={(event) => {
            playerRef.current = event.target;
            setPlayerRefs(prev => ({ ...prev, [element.id]: event.target }));
          }}
          opts={{
            height: '100%',
            width: '100%',
            playerVars: {
              autoplay: 0,
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
          }}
          className="w-full h-full border-none"
          containerClassName="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-white text-xs p-4 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <Video className="w-6 h-6 text-slate-400" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-200 uppercase tracking-widest text-[10px]">YouTube Player</p>
            <p className="text-[10px] text-slate-500 max-w-[180px]">Paste a YouTube link in settings to activate video playback.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [project, setProject] = useState<Project>({
    id: 'project-1',
    title: 'New Interactive Module',
    slides: [createEmptySlide()]
  });
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [dragState, setDragState] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [activePopupElementId, setActivePopupElementId] = useState<string | null>(null);
  const [activeCheckpoint, setActiveCheckpoint] = useState<VideoCheckpoint | null>(null);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<Set<string>>(new Set());
  const [playerRefs, setPlayerRefs] = useState<Record<string, any>>({});
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [fillBlanksAnswers, setFillBlanksAnswers] = useState<Record<number, string>>({});
  const [interactionStatus, setInteractionStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');

  const openPopup = (id: string) => {
    setActivePopupElementId(id);
    setSelectedQuizOption(null);
    setFillBlanksAnswers({});
    setInteractionStatus('idle');
  };

  const closePopup = () => {
    setActivePopupElementId(null);
    setActiveCheckpoint(null);
    setSelectedQuizOption(null);
    setFillBlanksAnswers({});
    setInteractionStatus('idle');
  };

  const handleCheckpointSuccess = () => {
    if (activeCheckpoint) {
      setCompletedCheckpoints(prev => new Set(prev).add(activeCheckpoint.id));
      
      // Resume all video players
      Object.values(playerRefs).forEach((player: any) => {
        if (player && typeof player.playVideo === 'function') {
          player.playVideo();
        }
      });
      
      setInteractionStatus('correct');
      setTimeout(() => {
        closePopup();
      }, 1000);
    }
  };
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeSlide = project.slides[activeSlideIndex];
  const selectedElement = activeSlide?.elements.find(el => el.id === selectedElementId);

  // --- Handlers ---
  const addSlide = () => {
    const newSlide = createEmptySlide();
    setProject(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide]
    }));
    setActiveSlideIndex(project.slides.length);
  };

  const deleteSlide = (index: number) => {
    if (project.slides.length <= 1) return;
    const newSlides = project.slides.filter((_, i) => i !== index);
    setProject(prev => ({ ...prev, slides: newSlides }));
    setActiveSlideIndex(Math.max(0, index - 1));
  };

  const duplicateSlide = (index: number) => {
    const slideToCopy = project.slides[index];
    const newSlide = {
      ...slideToCopy,
      id: Math.random().toString(36).substr(2, 9),
      elements: slideToCopy.elements.map(el => ({ ...el, id: Math.random().toString(36).substr(2, 9) }))
    };
    const newSlides = [...project.slides];
    newSlides.splice(index + 1, 0, newSlide);
    setProject(prev => ({ ...prev, slides: newSlides }));
    setActiveSlideIndex(index + 1);
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === project.slides.length - 1)) return;
    const newSlides = [...project.slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    setProject(prev => ({ ...prev, slides: newSlides }));
    setActiveSlideIndex(targetIndex);
  };

  const addCheckpoint = (elementId: string) => {
    const el = activeSlide.elements.find(e => e.id === elementId);
    if (!el || el.type !== 'video') return;
    
    const newCheckpoint: VideoCheckpoint = {
      id: Math.random().toString(36).substr(2, 9),
      time: 10,
      type: 'quiz',
      question: 'New Question',
      content: '', // For drag/blanks
      options: ['Option A', 'Option B'],
      correctAnswer: 'Option A'
    };
    
    updateElement(elementId, {
      config: {
        ...el.config!,
        checkpoints: [...(el.config?.checkpoints || []), newCheckpoint]
      }
    });
  };

  const updateCheckpoint = (elementId: string, checkpointId: string, updates: Partial<VideoCheckpoint>) => {
    const el = activeSlide.elements.find(e => e.id === elementId);
    if (!el || !el.config?.checkpoints) return;
    
    const newCheckpoints = el.config.checkpoints.map(cp => {
      if (cp.id === checkpointId) {
        // Smart defaults when type changes
        if (updates.type && updates.type !== cp.type) {
          const nextType = updates.type;
          const defaults: Partial<VideoCheckpoint> = {};
          
          if (nextType === 'quiz') {
            defaults.question = 'Enter your question here?';
            defaults.options = ['Option A', 'Option B', 'Option C'];
            defaults.correctAnswer = 'Option A';
          } else if (nextType === 'true-false') {
            defaults.question = 'Is this statement true?';
            defaults.options = [];
            defaults.correctAnswer = 'True';
          } else if (nextType === 'drag-words') {
            defaults.question = 'Drag words into the gaps:';
            defaults.content = 'The *sky* is *blue* during the day.';
            defaults.options = ['sky', 'blue'];
          } else if (nextType === 'fill-blanks') {
            defaults.question = 'Type the correct answers:';
            defaults.content = 'React is a *JavaScript* library used for UI.';
          }
          
          return { ...cp, ...updates, ...defaults };
        }
        return { ...cp, ...updates };
      }
      return cp;
    });
    
    updateElement(elementId, {
      config: { ...el.config, checkpoints: newCheckpoints }
    });
  };

  const deleteCheckpoint = (elementId: string, checkpointId: string) => {
    const el = activeSlide.elements.find(e => e.id === elementId);
    if (!el || !el.config?.checkpoints) return;
    
    updateElement(elementId, {
      config: { ...el.config, checkpoints: el.config.checkpoints.filter(cp => cp.id !== checkpointId) }
    });
  };

  const addElement = (type: ElementType) => {
    let config: InteractionConfig | undefined;
    let content = '';

    if (type === 'text') {
      content = 'Double click to edit';
    } else if (type === 'quiz') {
      config = {
        question: 'What is the capital of France?',
        options: ['Paris', 'Berlin', 'London'],
        correctAnswer: 'Paris',
        showAsIcon: true
      };
    } else if (type === 'drag-words') {
      config = {
        question: 'Complete the sentence:',
        options: ['sky', 'blue', 'sun'],
        showAsIcon: true
      };
      content = 'The *sky* is *blue* when the *sun* shines.';
    } else if (type === 'fill-blanks') {
      config = {
        question: 'Fill in the blanks:',
        showAsIcon: true
      };
      content = 'React was created by *Meta*. It is a *JavaScript* library.';
    } else if (type === 'true-false') {
      config = {
        question: 'Is the earth flat?',
        correctAnswer: 'False',
        showAsIcon: true
      };
    } else if (type === 'video') {
      config = {
        videoUrl: 'https://www.youtube.com/watch?v=LXb3EKWsInQ',
        showAsIcon: false,
        checkpoints: []
      };
    }

    const newElement: SlideElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 50, // Center X
      y: 50, // Center Y
      width: type === 'text' ? 30 : 40,
      height: type === 'text' ? 10 : 25,
      content,
      config
    };
    
    updateActiveSlide({
      elements: [...activeSlide.elements, newElement]
    });
    setSelectedElementId(newElement.id);
  };

  const updateActiveSlide = (updates: Partial<Slide>) => {
    const newSlides = [...project.slides];
    newSlides[activeSlideIndex] = { ...activeSlide, ...updates };
    setProject(prev => ({ ...prev, slides: newSlides }));
  };

  const updateElement = (id: string, updates: Partial<SlideElement>) => {
    const newElements = activeSlide.elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    );
    updateActiveSlide({ elements: newElements });
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isPreview) return;
    e.stopPropagation();
    setSelectedElementId(id);
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const element = activeSlide.elements.find(el => el.id === id);
    if (!element) return;

    // Calculate mouse position in percentage relative to canvas
    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const yPercent = ((clientY - rect.top) / rect.height) * 100;

    // Store offset from element's current position
    setDragState({ 
      id, 
      offsetX: xPercent - element.x, 
      offsetY: yPercent - element.y 
    });
  };

  const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
    if (!dragState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    let xPercent = ((clientX - rect.left) / rect.width) * 100;
    let yPercent = ((clientY - rect.top) / rect.height) * 100;

    // Apply offset and clamp
    const newX = Math.max(0, Math.min(100, xPercent - dragState.offsetX));
    const newY = Math.max(0, Math.min(100, yPercent - dragState.offsetY));

    updateElement(dragState.id, { x: newX, y: newY });
  };

  const handleGlobalUp = () => {
    setDragState(null);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [dragState]);

  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newSlides: Slide[] = [];

    try {
      // Process all files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.name.endsWith('.pptx')) {
          try {
            const zip = await JSZip.loadAsync(file);
            const slideFiles = Object.keys(zip.files)
              .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
              .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
              });
            
            for (const slidePath of slideFiles) {
              const content = await zip.file(slidePath)?.async('string');
              if (!content) continue;

              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(content, "text/xml");
              
              // More robust text extraction (handles different namespaces)
              const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t')).length > 0 
                ? Array.from(xmlDoc.getElementsByTagName('a:t'))
                : Array.from(xmlDoc.getElementsByTagName('t'));
              
              const slideText = textNodes.map(node => node.textContent).join(' ').trim();

              // Check for images in this slide's relationships
              let slideImage = '';
              const relsPath = `ppt/slides/_rels/${slidePath.split('/').pop()}.rels`;
              const relsFile = zip.file(relsPath);
              
              if (relsFile) {
                const relsContent = await relsFile.async('string');
                const relsDoc = parser.parseFromString(relsContent, "text/xml");
                const relationships = Array.from(relsDoc.querySelectorAll('Relationship'));
                
                // Find the first image relationship
                const imgRel = relationships.find(rel => 
                  rel.getAttribute('Type')?.includes('image')
                );
                
                if (imgRel) {
                  const target = imgRel.getAttribute('Target');
                  if (target) {
                    // Resolve path (usually ../media/image1.png)
                    const mediaPath = 'ppt/' + target.replace('../', '');
                    const mediaFile = zip.file(mediaPath);
                    if (mediaFile) {
                      const imgData = await mediaFile.async('base64');
                      const ext = mediaPath.split('.').pop()?.toLowerCase();
                      slideImage = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imgData}`;
                    }
                  }
                }
              }

              // Create slide even if empty to ensure all slides appear
              const elements: SlideElement[] = [];
              
              if (slideImage) {
                elements.push({
                  id: Math.random().toString(36).substring(2, 11),
                  type: 'image',
                  x: 50,
                  y: 50,
                  width: 100,
                  height: 100,
                  content: slideImage,
                  isBackground: true
                });
              }

              if (slideText) {
                elements.push({
                  id: Math.random().toString(36).substring(2, 11),
                  type: 'text',
                  x: 50,
                  y: slideImage ? 85 : 50, // Move to bottom if there is an image
                  width: 80,
                  height: 20,
                  content: slideText.length > 300 ? slideText.substring(0, 300) + '...' : slideText
                });
              }

              // Fallback for empty slides
              if (elements.length === 0) {
                elements.push({
                  id: Math.random().toString(36).substring(2, 11),
                  type: 'text',
                  x: 50,
                  y: 50,
                  width: 50,
                  height: 10,
                  content: 'Empty Slide'
                });
              }

              newSlides.push({
                id: Math.random().toString(36).substring(2, 11),
                elements
              });
            }
          } catch (err) {
            console.error("PPTX Error:", err);
          }
        } else if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.readAsDataURL(file);
          });

          newSlides.push({
            id: Math.random().toString(36).substring(2, 11),
            elements: [{
              id: Math.random().toString(36).substring(2, 11),
              type: 'image',
              x: 50,
              y: 50,
              width: 100,
              height: 100,
              content: base64,
              isBackground: true
            }]
          });
        }
      }

      if (newSlides.length > 0) {
        const startIdx = project.slides.length;
        setProject(prev => ({
          ...prev,
          slides: [...prev.slides, ...newSlides]
        }));
        setActiveSlideIndex(startIdx);
      } else {
        alert("No readable content or images found in the selected files.");
      }
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const exportH5P = async (forceMode?: 'video' | 'presentation') => {
    const zip = new JSZip();
    
    const generateUuid = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    // Determine mode
    const mainVideoElement = project.slides[0]?.elements.find(el => el.type === 'video');
    const isInteractiveVideo = forceMode === 'video' || (!forceMode && !!mainVideoElement && project.slides.length === 1);

    // Simplified dependencies to let Moodle resolve sub-libraries from its own internal cache
    const preloadedDependencies = isInteractiveVideo 
      ? [{ machineName: 'H5P.InteractiveVideo', majorVersion: 1, minorVersion: 27 }]
      : [{ machineName: 'H5P.CoursePresentation', majorVersion: 1, minorVersion: 26 }];

    const h5pJson = {
      title: project.title || 'Learning Module',
      language: 'en',
      mainLibrary: isInteractiveVideo ? 'H5P.InteractiveVideo' : 'H5P.CoursePresentation',
      embedTypes: ['iframe'],
      license: 'U',
      author: 'Interactive Maker',
      preloadedDependencies: preloadedDependencies
    };

    // Use flat file paths to avoid explicit directory entries that fail strict H5P validation
    zip.file('h5p.json', JSON.stringify(h5pJson, null, 2));

    let contentJson: any = {};

    if (isInteractiveVideo && mainVideoElement) {
      // Interactive Video Logic
      contentJson = {
        interactiveVideo: {
          video: {
            files: [{
              path: mainVideoElement.config?.videoUrl || '',
              mime: 'video/YouTube'
            }],
            startScreenOptions: {
              title: project.title || 'Interactive Video',
              hideStartTitle: false,
              shortStartDescription: ''
            }
          },
          assets: {
            interactions: (mainVideoElement.config?.checkpoints || []).map(cp => {
              let library = '';
              let params: any = {};

                  if (cp.type === 'quiz') {
                    library = 'H5P.MultiChoice 1.16';
                    params = {
                      question: `<p>${cp.question}</p>`,
                      answers: cp.options.map(opt => ({
                        text: `<div>${opt}</div>`,
                        correct: opt === cp.correctAnswer,
                        tipsAndFeedback: { tip: '', chosenFeedback: '', notChosenFeedback: '' }
                      })),
                      behaviour: { 
                        enableRetry: true, 
                        enableSolutionsButton: true, 
                        singlePoint: true, 
                        randomAnswers: true,
                        showSolutionsRequiresInput: true
                      },
                      UI: {
                        checkAnswerButton: 'Check',
                        showSolutionButton: 'Show solution',
                        tryAgainButton: 'Retry',
                        tipsLabel: 'Show tip',
                        scoreBarLabel: 'You got :num out of :total points',
                        tipAvailable: 'Tip available',
                        feedbackAvailable: 'Feedback available',
                        readFeedback: 'Read feedback',
                        wrongAnswer: 'Wrong answer',
                        correctAnswer: 'Correct answer',
                        shouldCheck: 'Should have been checked',
                        shouldNotCheck: 'Should not have been checked',
                        noInput: 'Please answer before viewing the solution',
                        multiChoice: 'Multiple choice question: :question',
                        multiChoiceOption: 'Option: :option'
                      }
                    };
                  } else if (cp.type === 'true-false') {
                    library = 'H5P.TrueFalse 1.8';
                    params = {
                      question: `<p>${cp.question}</p>`,
                      correctAnswer: cp.correctAnswer === 'True',
                      behaviour: { enableRetry: true, enableSolutionsButton: true },
                      l10n: {
                        trueText: 'True',
                        falseText: 'False',
                        checkAnswer: 'Check',
                        tryAgain: 'Retry',
                        showSolution: 'Show solution',
                        wrongAnswerText: 'Wrong answer',
                        correctAnswerText: 'Correct answer',
                        scoreBarLabel: 'You got :num out of :total points'
                      }
                    };
                  }

              return {
                x: 10,
                y: 10,
                width: 15, // Icon size
                height: 15,
                duration: { from: cp.time, to: cp.time + 10 },
                action: {
                  library: library,
                  params: params,
                  subContentId: generateUuid()
                },
                pause: true,
                displayType: 'button',
                buttonOnMobile: true,
                label: `<p>${cp.type === 'quiz' ? 'Quiz' : 'True/False'}</p>`
              };
            })
          },
          summary: {
            task: {
              library: 'H5P.Summary 1.10',
              params: {
                intro: '<p>Lengkapi ringkasan berikut</p>',
                summaries: [{
                  summary: ['Video selesai.', 'Video belum selesai.'],
                  subContentId: generateUuid()
                }]
              },
              subContentId: generateUuid()
            },
            displayAt: 3
          }
        },
        override: {
          preventSkippingMode: 'mandatory'
        }
      };
    } else {
      // Course Presentation Logic
      contentJson = {
        presentation: {
          slides: project.slides.map(slide => {
            const backgroundEl = slide.elements.find(el => el.isBackground);
            let bgConfig = {};
            
            if (backgroundEl && backgroundEl.content.startsWith('data:image')) {
              const parts = backgroundEl.content.split(',');
              const header = parts[0];
              const base64Data = parts[1];
              const extensionMatch = header.match(/image\/(\w+)/);
              const extension = extensionMatch ? extensionMatch[1] : 'png';
              const fileName = `bg-${slide.id}.${extension}`;
              zip.file(`content/images/${fileName}`, base64Data, { base64: true, createFolders: false });
              
              bgConfig = {
                imageSlideBackground: {
                  path: `images/${fileName}`,
                  mime: `image/${extension}`,
                  width: 1600,
                  height: 900
                }
              };
            }

            return {
              elements: slide.elements.filter(el => !el.isBackground).map(el => {
                let library = 'H5P.AdvancedText 1.1';
                let params: any = {};

                if (el.type === 'text') {
                  library = 'H5P.AdvancedText 1.1';
                  params = { text: `<div>${el.content}</div>` };
                } else if (el.type === 'image') {
                  library = 'H5P.Image 1.1';
                  if (el.content && el.content.startsWith('data:image')) {
                    const parts = el.content.split(',');
                    const header = parts[0];
                    const base64Data = parts[1];
                    const extensionMatch = header.match(/image\/(\w+)/);
                    const extension = extensionMatch ? extensionMatch[1] : 'png';
                    const fileName = `${el.id}.${extension}`;
                    zip.file(`content/images/${fileName}`, base64Data, { base64: true, createFolders: false });
                    params = {
                      file: {
                        path: `images/${fileName}`,
                        mime: `image/${extension}`,
                        width: 1000,
                        height: 1000
                      },
                      alt: 'Slide Image'
                    };
                  }
                } else if (el.type === 'video') {
                  library = 'H5P.Video 1.6';
                  params = {
                    sources: [{
                      path: el.config?.videoUrl || '',
                      mime: 'video/YouTube'
                    }],
                    visuals: { fit: true, controls: true }
                  };
                } else if (el.type === 'quiz' || el.type === 'true-false' || el.type === 'drag-words' || el.type === 'fill-blanks') {
                  if (el.type === 'quiz') {
                    library = 'H5P.MultiChoice 1.16';
                    params = {
                      question: `<p>${el.config?.question || ''}</p>`,
                      answers: (el.config?.options || []).map(opt => ({
                        text: `<div>${opt}</div>`,
                        correct: opt === el.config?.correctAnswer,
                        tipsAndFeedback: { tip: '', chosenFeedback: '', notChosenFeedback: '' }
                      })),
                      behaviour: { 
                        enableRetry: true, 
                        enableSolutionsButton: true, 
                        singlePoint: true, 
                        randomAnswers: true,
                        showSolutionsRequiresInput: true
                      },
                      UI: {
                        checkAnswerButton: 'Check',
                        showSolutionButton: 'Show solution',
                        tryAgainButton: 'Retry',
                        tipsLabel: 'Show tip',
                        scoreBarLabel: 'You got :num out of :total points',
                        tipAvailable: 'Tip available',
                        feedbackAvailable: 'Feedback available',
                        readFeedback: 'Read feedback',
                        wrongAnswer: 'Wrong answer',
                        correctAnswer: 'Correct answer',
                        shouldCheck: 'Should have been checked',
                        shouldNotCheck: 'Should not have been checked',
                        noInput: 'Please answer before viewing the solution',
                        multiChoice: 'Multiple choice question: :question',
                        multiChoiceOption: 'Option: :option'
                      }
                    };
                  } else if (el.type === 'true-false') {
                    library = 'H5P.TrueFalse 1.8';
                    params = {
                      question: `<p>${el.config?.question || ''}</p>`,
                      correctAnswer: el.config?.correctAnswer === 'True',
                      behaviour: { enableRetry: true, enableSolutionsButton: true },
                      l10n: {
                        trueText: 'True',
                        falseText: 'False',
                        checkAnswer: 'Check',
                        tryAgain: 'Retry',
                        showSolution: 'Show solution',
                        wrongAnswerText: 'Wrong answer',
                        correctAnswerText: 'Correct answer',
                        scoreBarLabel: 'You got :num out of :total points'
                      }
                    };
                  } else if (el.type === 'drag-words') {
                    library = 'H5P.DragText 1.10';
                    params = {
                      taskDescription: `<p>${el.config?.question || 'Lengkapi kalimat:'}</p>`,
                      textField: el.content || '',
                      behaviour: { enableRetry: true, enableSolutionsButton: true }
                    };
                  } else if (el.type === 'fill-blanks') {
                    library = 'H5P.Blanks 1.14';
                    params = {
                      text: `<div>${el.config?.question || 'Isi titik-titik berikut:'}</div>`,
                      questions: [`<div>${el.content || ''}</div>`],
                      behaviour: { enableRetry: true, enableSolutionsButton: true }
                    };
                  }
                }

                const isButtonType = el.type === 'quiz' || el.type === 'true-false' || el.type === 'drag-words' || el.type === 'fill-blanks';

                return {
                  x: parseFloat((el.x - el.width / 2).toFixed(4)),
                  y: parseFloat((el.y - el.height / 2).toFixed(4)),
                  width: isButtonType ? 10 : parseFloat(el.width.toFixed(4)),
                  height: isButtonType ? 10 : parseFloat(el.height.toFixed(4)),
                  action: {
                    library: library,
                    params: params,
                    subContentId: generateUuid()
                  },
                  alwaysDisplayComments: false,
                  backgroundOpacity: 100,
                  displayAsButton: isButtonType,
                  goToSlideType: 'specified',
                  invisible: false,
                  solution: '',
                  buttonSize: 'big'
                };
              }),
              slideBackgroundSelector: bgConfig
            };
          })
        },
        l10n: {
          slide: 'Slide',
          score: 'Score',
          yourScore: 'Your Score',
          maxScore: 'Max Score',
          total: 'Total',
          result: 'Result',
          retry: 'Retry',
          check: 'Check'
        },
        override: {
          showSolutionButton: 'on',
          retryButton: 'on',
          enablePrintButton: false,
          showSummarySlide: true
        }
      };
    }

    // Use flat file paths with createFolders: false to avoid explicit directory entries that fail strict H5P validation
    zip.file('content/content.json', JSON.stringify(contentJson, null, 2), { createFolders: false });
    
    const blob = await zip.generateAsync({ 
      type: 'blob',
      mimeType: 'application/x-h5p',
      compression: 'DEFLATE'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project.title || 'Module').replace(/[<>:"/\\|?*\s]+/g, '_')}.h5p`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F9FAFB] text-slate-900">
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <p className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1">Importing Assets</p>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">We're processing your presentation files. This might take a few moments depending on the file size.</p>
            </div>
          </div>
        </div>
      )}

      {/* Interaction Popup Modal */}
      <AnimatePresence>
        {activePopupElementId && isPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
            onClick={closePopup}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    {activeCheckpoint ? (
                      activeCheckpoint.type === 'quiz' ? <CheckSquare className="w-5 h-5" /> :
                      activeCheckpoint.type === 'true-false' ? <Check className="w-5 h-5" /> :
                      <MousePointer2 className="w-5 h-5" />
                    ) : (
                      <>
                        {activeSlide.elements.find(el => el.id === activePopupElementId)?.type === 'quiz' && <CheckSquare className="w-5 h-5" />}
                        {activeSlide.elements.find(el => el.id === activePopupElementId)?.type === 'true-false' && <Check className="w-5 h-5" />}
                        {activeSlide.elements.find(el => el.id === activePopupElementId)?.type === 'drag-words' && <MousePointer2 className="w-5 h-5" />}
                        {activeSlide.elements.find(el => el.id === activePopupElementId)?.type === 'fill-blanks' && <FileText className="w-5 h-5" />}
                        {activeSlide.elements.find(el => el.id === activePopupElementId)?.type === 'video' && <Video className="w-5 h-5" />}
                      </>
                    )}
                  </span>
                  {activeCheckpoint ? (
                    <span>Checkpoint <span className="text-slate-400 font-normal">at {activeCheckpoint.time}s</span></span>
                  ) : `Interactive ${(() => {
                    const type = activeSlide.elements.find(el => el.id === activePopupElementId)?.type;
                    if (type === 'quiz') return 'Quiz';
                    if (type === 'true-false') return 'True/False';
                    if (type === 'drag-words') return 'Drag & Drop';
                    if (type === 'fill-blanks') return 'Fill in the Blanks';
                    if (type === 'video') return 'Video Content';
                    return 'Task';
                  })()}`}
                </h3>
                <button 
                  onClick={closePopup}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto">
                {(() => {
                  const el = activeSlide.elements.find(e => e.id === activePopupElementId);
                  
                  // Normal element interaction or checkpoint interaction
                  const type = activeCheckpoint ? activeCheckpoint.type : el?.type;
                  const question = activeCheckpoint ? activeCheckpoint.question : el?.config?.question;
                  const options = activeCheckpoint ? activeCheckpoint.options : el?.config?.options;
                  const correctAnswer = activeCheckpoint ? activeCheckpoint.correctAnswer : el?.config?.correctAnswer;
                  const content = activeCheckpoint ? (activeCheckpoint.content || activeCheckpoint.question) : el?.content;

                  if (!activeCheckpoint && !el) return null;
                  
                  return (
                    <div className="space-y-8">
                      <div className="flex items-center gap-5 border-b border-slate-100 pb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-inner">
                          {type === 'quiz' && <CheckSquare className="w-7 h-7 text-indigo-600" />}
                          {type === 'true-false' && <Check className="w-7 h-7 text-indigo-600" />}
                          {type === 'drag-words' && <MousePointer2 className="w-7 h-7 text-indigo-600" />}
                          {type === 'fill-blanks' && <FileText className="w-7 h-7 text-indigo-600" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-2xl text-slate-800 tracking-tight">{activeCheckpoint ? 'Video Challenge' : (type || 'Interaction').toUpperCase()}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                              {activeCheckpoint ? `Time: ${activeCheckpoint.time}s` : 'Activity'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">• Interactive Module</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xl text-slate-700 font-semibold leading-relaxed">
                          {question}
                        </h4>
                      </div>
                      
                      {type === 'quiz' && (
                        <div className="grid grid-cols-1 gap-3">
                          {options?.map(opt => (
                            <button 
                              key={opt} 
                              onClick={() => {
                                if (interactionStatus === 'correct') return;
                                setSelectedQuizOption(opt);
                                setInteractionStatus('idle');
                              }}
                              className={cn(
                                "w-full text-left p-4 rounded-2xl border-2 transition-all font-medium",
                                selectedQuizOption === opt 
                                  ? (interactionStatus === 'correct' ? "bg-green-50 border-green-300 text-green-700" : (interactionStatus === 'incorrect' ? "bg-red-50 border-red-300 text-red-700" : "bg-indigo-50 border-indigo-300 text-indigo-700"))
                                  : "bg-slate-50 border-transparent hover:border-slate-200"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span>{opt}</span>
                                {selectedQuizOption === opt && interactionStatus === 'correct' && <Check className="w-5 h-5 text-green-500" />}
                                {selectedQuizOption === opt && interactionStatus === 'incorrect' && <X className="w-5 h-5 text-red-500" />}
                              </div>
                            </button>
                          ))}
                          
                          <div className="mt-6 flex gap-3">
                            <button 
                              onClick={() => {
                                if (!selectedQuizOption) return;
                                const isCorrect = selectedQuizOption === correctAnswer;
                                if (isCorrect) {
                                  if (activeCheckpoint) {
                                    handleCheckpointSuccess();
                                  } else {
                                    setInteractionStatus('correct');
                                  }
                                } else {
                                  setInteractionStatus('incorrect');
                                  setTimeout(() => {
                                    setSelectedQuizOption(null);
                                    setInteractionStatus('idle');
                                  }, 1500);
                                }
                              }}
                              disabled={!selectedQuizOption || interactionStatus === 'correct'}
                              className={cn(
                                "flex-1 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all",
                                interactionStatus === 'correct' 
                                  ? "bg-green-100 text-green-700 cursor-default" 
                                  : (selectedQuizOption ? "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700" : "bg-slate-100 text-slate-400 cursor-not-allowed")
                              )}
                            >
                              {interactionStatus === 'correct' ? 'Correct!' : (interactionStatus === 'incorrect' ? 'Incorrect. Retrying...' : 'Check Answer')}
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedQuizOption(null);
                                setInteractionStatus('idle');
                              }}
                              className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-colors"
                            >
                              <RotateCcw className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      )}

                      {type === 'true-false' && (
                        <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                              {['True', 'False'].map(opt => (
                                <button 
                                  key={opt}
                                  onClick={() => {
                                    if (interactionStatus === 'correct') return;
                                    setSelectedQuizOption(opt);
                                    setInteractionStatus('idle');
                                  }}
                                  className={cn(
                                    "p-8 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all",
                                    selectedQuizOption === opt 
                                      ? (interactionStatus === 'correct' ? "bg-green-100 border-green-300 text-green-700" : (interactionStatus === 'incorrect' ? "bg-red-100 border-red-300 text-red-700" : "bg-indigo-100 border-indigo-300 text-indigo-700"))
                                      : "bg-slate-50 border-transparent hover:border-slate-200"
                                  )}
                                >
                                  {opt === 'True' ? <Check className="w-12 h-12" /> : <X className="w-12 h-12" />}
                                  <span className="font-bold text-xl uppercase tracking-widest">{opt}</span>
                                </button>
                              ))}
                           </div>

                           <div className="mt-6 flex gap-3">
                            <button 
                              onClick={() => {
                                if (!selectedQuizOption) return;
                                const isCorrect = selectedQuizOption === correctAnswer;
                                if (isCorrect) {
                                  if (activeCheckpoint) {
                                    handleCheckpointSuccess();
                                  } else {
                                    setInteractionStatus('correct');
                                  }
                                } else {
                                  setInteractionStatus('incorrect');
                                  setTimeout(() => {
                                    setSelectedQuizOption(null);
                                    setInteractionStatus('idle');
                                  }, 1500);
                                }
                              }}
                              disabled={!selectedQuizOption || interactionStatus === 'correct'}
                              className={cn(
                                "flex-1 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all",
                                interactionStatus === 'correct' 
                                  ? "bg-green-100 text-green-700 cursor-default" 
                                  : (selectedQuizOption ? "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700" : "bg-slate-100 text-slate-400 cursor-not-allowed")
                              )}
                            >
                              {interactionStatus === 'correct' ? 'Correct!' : (interactionStatus === 'incorrect' ? 'Incorrect. Retrying...' : 'Check Answer')}
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedQuizOption(null);
                                setInteractionStatus('idle');
                              }}
                              className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-colors"
                            >
                              <RotateCcw className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      )}

                      {type === 'drag-words' && (
                        <InteractiveDragWords 
                          content={content || ""} 
                          options={options || []} 
                          onSuccess={activeCheckpoint ? handleCheckpointSuccess : undefined}
                        />
                      )}

                      {type === 'fill-blanks' && (
                        <div className="space-y-6">
                          <motion.div 
                            animate={interactionStatus === 'incorrect' ? { x: [-10, 10, -10, 10, 0] } : {}}
                            className={cn(
                              "p-8 bg-slate-50 rounded-2xl border-2 transition-colors text-lg leading-relaxed text-slate-700",
                              interactionStatus === 'correct' ? "border-green-200 bg-green-50/50" : "border-slate-100",
                              interactionStatus === 'incorrect' ? "border-red-200 bg-red-50/50" : ""
                            )}
                          >
                            {(content || "").split(/(\*[^*]+\*)/g).map((part, i) => {
                              if (part.startsWith('*') && part.endsWith('*')) {
                                const blankIdx = Math.floor(i / 2);
                                return (
                                  <input 
                                    key={i}
                                    type="text" 
                                    value={fillBlanksAnswers[blankIdx] || ''}
                                    onChange={(e) => {
                                      if (interactionStatus === 'correct') return;
                                      setFillBlanksAnswers(prev => ({ ...prev, [blankIdx]: e.target.value }));
                                      setInteractionStatus('idle');
                                    }}
                                    className={cn(
                                      "mx-2 px-3 py-1 bg-white border-b-4 outline-none w-32 text-center rounded-t-lg font-bold transition-colors",
                                      interactionStatus === 'correct' ? "border-green-400 text-green-700" : "border-indigo-200 text-indigo-700 focus:border-indigo-500",
                                      interactionStatus === 'incorrect' && "border-red-400 text-red-700"
                                    )}
                                    placeholder="..."
                                  />
                                );
                              }
                              return <span key={i}>{part}</span>;
                            })}
                          </motion.div>
                          
                          <div className="flex gap-4">
                            <button 
                              onClick={() => {
                                const parts = (content || "").split(/(\*[^*]+\*)/g) || [];
                                const targets = parts.filter(p => p.startsWith('*') && p.endsWith('*')).map(p => p.slice(1, -1));
                                const isCorrect = targets.every((t, idx) => fillBlanksAnswers[idx]?.toLowerCase().trim() === t.toLowerCase().trim());
                                
                                if (isCorrect) {
                                  if (activeCheckpoint) {
                                    handleCheckpointSuccess();
                                  } else {
                                    setInteractionStatus('correct');
                                  }
                                } else {
                                  setInteractionStatus('incorrect');
                                  setTimeout(() => {
                                    setFillBlanksAnswers({});
                                    setInteractionStatus('idle');
                                  }, 1500);
                                }
                              }}
                              disabled={interactionStatus === 'correct'}
                              className={cn(
                                "flex-1 py-4 rounded-2xl text-lg font-bold shadow-lg transition-all",
                                interactionStatus === 'correct' 
                                  ? "bg-green-100 text-green-700 font-bold" 
                                  : "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700"
                              )}
                            >
                              {interactionStatus === 'correct' ? 'Correct!' : (interactionStatus === 'incorrect' ? 'Incorrect. Retrying...' : 'Check Answer')}
                            </button>
                            <button 
                              onClick={() => {
                                setFillBlanksAnswers({});
                                setInteractionStatus('idle');
                              }}
                              className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-colors"
                            >
                              <RotateCcw className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Video element in popup should not render VideoPlayer again if it's already a checkpoint */}
                      {el.type === 'video' && !activeCheckpoint && (
                        <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 shadow-2xl">
                          <VideoPlayer 
                            element={el}
                            onCheckpointReached={(cp) => {
                              setActiveCheckpoint(cp);
                              setActivePopupElementId(el.id);
                            }}
                            completedCheckpoints={completedCheckpoints}
                            setPlayerRefs={setPlayerRefs}
                            setSelectedQuizOption={setSelectedQuizOption}
                            setFillBlanksAnswers={setFillBlanksAnswers}
                            setInteractionStatus={setInteractionStatus}
                            activeCheckpointId={activeCheckpoint?.id || null}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg flex items-center justify-center">
            <Edit3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input 
                value={project.title}
                onChange={(e) => setProject(prev => ({ ...prev, title: e.target.value }))}
                className="font-semibold text-lg bg-transparent border-none focus:ring-0 focus:outline-none w-80 p-0 text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-medium">v1.2 - Last saved moments ago</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPreview(!isPreview)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors rounded-md",
              isPreview ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {isPreview ? 'Back to Editor' : 'Preview'}
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => exportH5P('presentation')}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2"
              title="Export as H5P Course Presentation (Slides)"
            >
              <FileText className="w-4 h-4" />
              Save as Presentation
            </button>
            <button 
              onClick={() => exportH5P('video')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
              title="Export as H5P Interactive Video"
            >
              <Video className="w-4 h-4" />
              Save as Interactive Video
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: Slides */}
        <aside className="w-56 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Slides</h3>
            <button 
              onClick={addSlide}
              className="p-1 hover:bg-slate-50 rounded text-indigo-600"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {project.slides.map((slide, idx) => (
              <div 
                key={slide.id}
                onClick={() => setActiveSlideIndex(idx)}
                className="group relative cursor-pointer"
              >
                {activeSlideIndex === idx && (
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-r" />
                )}
                <div className={cn(
                  "aspect-video bg-slate-50 border rounded-md overflow-hidden relative transition-all",
                  activeSlideIndex === idx ? "border-indigo-600 border-2 shadow-sm" : "border-slate-200 hover:border-slate-300"
                )}>
                  {/* Miniature Content */}
                  <div className="absolute inset-0 scale-[0.25] origin-top-left pointer-events-none">
                    {slide.elements.map(el => (
                      <div 
                        key={el.id}
                        style={{
                          position: 'absolute',
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          width: `${el.width}%`,
                          height: `${el.height}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundImage: el.type === 'image' ? `url(${el.content})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        className={cn(
                          el.type !== 'image' && "bg-indigo-600 rounded-sm flex items-center justify-center p-1 shadow-sm",
                          el.type === 'image' && "bg-slate-200"
                        )}
                      >
                         {el.type === 'quiz' && <CheckSquare className="w-full h-full text-white" />}
                         {el.type === 'true-false' && <Check className="w-full h-full text-white" />}
                         {el.type === 'video' && <Video className="w-full h-full text-white" />}
                         {el.type === 'drag-words' && <MousePointer2 className="w-full h-full text-white" />}
                         {el.type === 'fill-blanks' && <FileText className="w-full h-full text-white" />}
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className={cn(
                       "font-mono text-[10px]",
                       activeSlideIndex === idx ? "text-indigo-600 font-bold" : "text-slate-400"
                     )}>{idx + 1}</span>
                  </div>
                </div>
                <span className={cn(
                  "block mt-1 text-[9px] font-bold uppercase tracking-wider",
                  activeSlideIndex === idx ? "text-indigo-600" : "text-slate-500"
                )}>
                  {slide.elements.find(e => e.type === 'text')?.content.substring(0, 15) || `Slide ${idx + 1}`}
                </span>
                
                {/* Actions Overlay */}
                <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); duplicateSlide(idx); }} className="p-1 bg-white ring-1 ring-slate-200 rounded text-slate-400 hover:text-indigo-600 shadow-sm"><Copy className="w-2.5 h-2.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteSlide(idx); }} className="p-1 bg-white ring-1 ring-slate-200 rounded text-slate-400 hover:text-red-500 shadow-sm"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
            <button 
              onClick={addSlide}
              className="flex-1 py-2 bg-white border border-slate-200 rounded text-[11px] font-bold uppercase tracking-tight text-slate-600 hover:bg-slate-50 transition-colors"
            >
              + Add Slide
            </button>
            <button className="p-2 bg-white border border-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 flex flex-col bg-[#F1F5F9] relative overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="h-12 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-center gap-2 sticky top-0 z-40 px-4">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
              <button onClick={() => addElement('text')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><Type className="w-3.5 h-3.5" /> Text</button>
              <button onClick={() => addElement('image')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><ImageIcon className="w-3.5 h-3.5" /> Image</button>
            </div>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
              <button onClick={() => addElement('quiz')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><CheckSquare className="w-3.5 h-3.5" /> Quiz</button>
              <button onClick={() => addElement('true-false')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><Check className="w-3.5 h-3.5" /> T/F</button>
              <button onClick={() => addElement('drag-words')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><MousePointer2 className="w-3.5 h-3.5" /> Drag</button>
              <button onClick={() => addElement('fill-blanks')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><FileText className="w-3.5 h-3.5" /> Blanks</button>
              <button onClick={() => addElement('video')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-xs font-semibold text-slate-600 transition-all"><Video className="w-3.5 h-3.5" /> Video</button>
            </div>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <label className="flex flex-col items-center">
              <div className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-md text-xs font-bold text-indigo-600 cursor-pointer transition-colors uppercase tracking-widest border border-indigo-100">
                <Upload className="w-3.5 h-3.5" /> Import Media
                <input type="file" className="hidden" accept=".pptx,image/*" multiple onChange={handleFileUpload} />
              </div>
              <span className="text-[8px] text-slate-400 mt-1 font-bold">PPTX or Bulk Images</span>
            </label>
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex items-center justify-center p-12 overflow-auto relative">
            {/* Rulers */}
            <div className="absolute top-0 left-0 w-full h-6 border-b border-slate-200 flex items-end px-2 text-[9px] text-slate-400 font-mono opacity-50">0...10...20...30...40...50...60...70...80...90...100%</div>
            <div className="absolute top-0 left-0 h-full w-6 border-r border-slate-200 flex flex-col py-8 text-[9px] text-slate-400 font-mono items-center opacity-50"><span>0</span><span className="mt-12">25</span><span className="mt-24">50</span><span className="mt-24">75</span><span className="mt-24">100</span></div>

              <div 
                ref={canvasRef}
                className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative overflow-hidden rounded-sm border border-slate-200"
                style={{
                  width: '100%',
                  maxWidth: '900px',
                  aspectRatio: CANVAS_ASPECT_RATIO,
                }}
                onClick={() => setSelectedElementId(null)}
              >
                {/* Grid Background */}
                <div className="absolute inset-0 canvas-grid opacity-[0.03] pointer-events-none" />

                {[...(activeSlide?.elements || [])].sort((a, b) => (a.isBackground ? -1 : 1)).map(el => (
                  <div 
                    key={el.id}
                    onMouseDown={(e) => !el.isBackground && handleDragStart(e, el.id)}
                    onClick={(e) => {
                      if (!el.isBackground && !isPreview) {
                        e.stopPropagation(); // CRITICAL: Stop bubbling to canvas onClick
                        setSelectedElementId(el.id);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                      transform: 'translate(-50%, -50%)', 
                      cursor: el.isBackground ? 'default' : (isPreview ? 'default' : 'move'),
                      zIndex: el.isBackground ? 0 : 10,
                      pointerEvents: el.isBackground && !isPreview ? 'none' : 'auto',
                    }}
                    className={cn(
                      "group",
                      !el.isBackground && selectedElementId === el.id && "ring-2 ring-indigo-500",
                      !el.isBackground && !isPreview && "hover:ring-1 hover:ring-indigo-300"
                    )}
                  >
                  {el.type === 'text' && (
                    <div className="w-full h-full p-2 flex items-center justify-center text-center">
                      <p className="w-full break-words outline-none" contentEditable={!isPreview}>
                        {el.content}
                      </p>
                    </div>
                  )}
                  {el.type === 'image' && (
                    <div className="w-full h-full overflow-hidden">
                      {el.content ? (
                        <img src={el.content} className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center gap-2 text-zinc-400">
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-[10px] uppercase font-bold">Image Placeholder</span>
                        </div>
                      )}
                    </div>
                  )}
                  {el.type === 'video' && (
                    <div className="w-full h-full overflow-hidden group/vid relative">
                      {isPreview ? (
                        <VideoPlayer 
                          element={el}
                          onCheckpointReached={(cp) => {
                            setActiveCheckpoint(cp);
                            setActivePopupElementId(el.id);
                          }}
                          completedCheckpoints={completedCheckpoints}
                          setPlayerRefs={setPlayerRefs}
                          setSelectedQuizOption={setSelectedQuizOption}
                          setFillBlanksAnswers={setFillBlanksAnswers}
                          setInteractionStatus={setInteractionStatus}
                          activeCheckpointId={activeCheckpoint?.id || null}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center gap-3 text-white">
                          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                            <Video className="w-8 h-8 text-white" />
                          </div>
                          <div className="text-center px-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-white/60 block mb-1">Video Component</span>
                            <span className="text-xs font-medium text-white/90 truncate max-w-full block">
                              {el.config?.videoUrl?.split('/').pop() || "dQu4w9WgXcQ"}
                            </span>
                          </div>
                          {selectedElementId !== el.id && (
                            <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover/vid:opacity-100 transition-opacity pointer-events-none" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(el.type === 'quiz' || el.type === 'true-false' || el.type === 'drag-words' || el.type === 'fill-blanks') && (
                    <div className="w-full h-full flex items-center justify-center">
                      {(el.config?.showAsIcon && !isPreview) || (el.config?.showAsIcon && isPreview) ? (
                        <motion.button 
                          whileHover={isPreview ? { scale: 1.1 } : {}}
                          whileTap={isPreview ? { scale: 0.9 } : {}}
                          onClick={(e) => {
                            if (isPreview) {
                              e.stopPropagation();
                              openPopup(el.id);
                            }
                          }}
                          className={cn(
                            "bg-indigo-600 text-white rounded-full p-2 shadow-lg scale-150 transition-all",
                            isPreview && "hover:bg-indigo-500 cursor-pointer"
                          )}
                        >
                          {el.type === 'quiz' && <CheckSquare className="w-6 h-6" />}
                          {el.type === 'true-false' && <Check className="w-6 h-6" />}
                          {el.type === 'drag-words' && <MousePointer2 className="w-6 h-6" />}
                          {el.type === 'fill-blanks' && <FileText className="w-6 h-6" />}
                        </motion.button>
                      ) : (
                        <motion.div 
                          layout
                          className={cn(
                            "bg-white border-2 border-indigo-500 p-4 rounded-xl shadow-xl w-full",
                            isPreview && "animate-in fade-in zoom-in duration-300 h-full overflow-y-auto"
                          )}
                        >
                          <h4 className="font-bold text-lg mb-2">{el.config?.question}</h4>
                          
                          {el.type === 'quiz' && (
                            <div className="space-y-2">
                              {el.config?.options?.map(opt => (
                                <button key={opt} className="w-full text-left p-2 rounded bg-zinc-50 border hover:border-indigo-300 transition-colors">
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {el.type === 'true-false' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center gap-1">
                                <Check className="w-6 h-6 text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">True</span>
                              </div>
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center gap-1">
                                <X className="w-6 h-6 text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">False</span>
                              </div>
                            </div>
                          )}

                          {el.type === 'drag-words' && (
                            isPreview ? (
                              <InteractiveDragWords 
                                content={el.content || ""} 
                                options={el.config?.options || []} 
                              />
                            ) : (
                              <div className="space-y-4">
                                <p className="text-sm text-zinc-600 italic">Drag the words into the correct boxes:</p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {el.config?.options?.map(opt => (
                                    <div key={opt} className="px-3 py-1 bg-zinc-100 border rounded cursor-grab active:cursor-grabbing text-xs font-semibold">
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                                <div className="p-4 bg-zinc-50 rounded-lg border-2 border-dashed border-zinc-200 min-h-[100px] flex items-center justify-center text-zinc-400 text-xs text-center">
                                  {el.content || "Sentence with *words* to be dragged here..."}
                                </div>
                              </div>
                            )
                          )}

                          {el.type === 'fill-blanks' && (
                            <div className="space-y-4">
                              <div className="p-2 text-sm leading-relaxed">
                                {el.content ? (
                                  el.content.split('*').map((part, i) => (
                                    <React.Fragment key={i}>
                                      {part}
                                      {i < el.content.split('*').length - 1 && (
                                        <input 
                                          type="text" 
                                          className="mx-1 px-2 py-0.5 border-b-2 border-zinc-300 focus:border-indigo-500 outline-none w-20 text-center"
                                          placeholder="..."
                                        />
                                      )}
                                    </React.Fragment>
                                  ))
                                ) : (
                                  "The quick *brown* fox jumps over the *lazy* dog."
                                )}
                              </div>
                              <button className="px-4 py-2 bg-indigo-600 text-white rounded text-sm w-full font-medium">Check Answer</button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Sidebar: Properties */}
        <AnimatePresence>
          {selectedElement && !isPreview && (
            <motion.aside 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-72 border-l border-slate-200 bg-white flex flex-col z-50 shadow-2xl"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> Properties
                </h3>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase">
                  {selectedElement.type}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Pos & Size */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dimensions</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-2 rounded-md border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500">
                      <span className="text-[9px] text-slate-400 block font-bold">X Position (%)</span>
                      <input type="number" value={Math.round(selectedElement.x)} onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })} className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 outline-none" />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-md border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500">
                      <span className="text-[9px] text-slate-400 block font-bold">Y Position (%)</span>
                      <input type="number" value={Math.round(selectedElement.y)} onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })} className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 outline-none" />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-md border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500">
                      <span className="text-[9px] text-slate-400 block font-bold">Width (%)</span>
                      <input type="number" value={Math.round(selectedElement.width)} onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })} className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 outline-none" />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-md border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500">
                      <span className="text-[9px] text-slate-400 block font-bold">Height (%)</span>
                      <input type="number" value={Math.round(selectedElement.height)} onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })} className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Content/Interaction */}
                {(selectedElement.type === 'text' || selectedElement.type === 'drag-words' || selectedElement.type === 'fill-blanks') && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {selectedElement.type === 'text' ? 'Content' : 'Sentence Logic'}
                    </label>
                    <p className="text-[9px] text-slate-400 mb-2 italic">
                      {selectedElement.type !== 'text' && "Use *word* to mark target answers."}
                    </p>
                    <textarea 
                      value={selectedElement.content}
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      className="w-full h-32 p-3 bg-slate-50 border-none rounded-lg text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 resize-none font-medium"
                      placeholder={selectedElement.type === 'text' ? "Enter text here..." : "The *sky* is *blue*..."}
                    />
                  </div>
                )}

                {selectedElement.type === 'image' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Library</label>
                    <label className="block w-full text-center p-6 border-2 border-dashed border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <ImageIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Replace Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => updateElement(selectedElement.id, { content: ev.target?.result as string });
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  </div>
                )}

                {selectedElement.config && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Logic Configuration</label>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Prompt / Question</span>
                        <input value={selectedElement.config.question} onChange={(e) => updateElement(selectedElement.id, { config: { ...selectedElement.config!, question: e.target.value } })} className="w-full p-2 bg-slate-50 border-none rounded text-xs focus:ring-1 focus:ring-indigo-500 font-medium" />
                      </div>
                      
                      {selectedElement.type === 'quiz' && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase text-wrap">Options (Comma separated)</span>
                            <input value={selectedElement.config.options?.join(', ')} onChange={(e) => updateElement(selectedElement.id, { config: { ...selectedElement.config!, options: e.target.value.split(',').map(s => s.trim()) } })} className="w-full p-2 bg-slate-50 border-none rounded text-xs focus:ring-1 focus:ring-indigo-500 font-medium" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Correct Answer</span>
                            <select 
                              value={selectedElement.config.correctAnswer} 
                              onChange={(e) => updateElement(selectedElement.id, { config: { ...selectedElement.config!, correctAnswer: e.target.value } })}
                              className="w-full p-2 bg-slate-50 border-none rounded text-xs focus:ring-1 focus:ring-indigo-500 font-medium outline-none cursor-pointer"
                            >
                              <option value="">Select correct answer</option>
                              {selectedElement.config.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {selectedElement.type === 'true-false' && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Correct Answer</span>
                          <div className="flex gap-2">
                             {['True', 'False'].map(opt => (
                               <button 
                                 key={opt}
                                 onClick={() => updateElement(selectedElement.id, { config: { ...selectedElement.config!, correctAnswer: opt } })}
                                 className={cn(
                                   "flex-1 py-2 rounded text-xs font-bold transition-all",
                                   selectedElement.config?.correctAnswer === opt ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                 )}
                               >
                                 {opt}
                               </button>
                             ))}
                          </div>
                        </div>
                      )}

                      {selectedElement.type === 'video' && (
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-wrap">YouTube URL</span>
                            <input 
                              value={selectedElement.config.videoUrl} 
                              onChange={(e) => {
                                const val = e.target.value;
                                updateElement(selectedElement.id, { config: { ...selectedElement.config!, videoUrl: val } });
                              }} 
                              placeholder="Paste YouTube URL"
                              className="w-full p-2 bg-slate-50 border-none rounded text-xs focus:ring-1 focus:ring-indigo-500 font-medium font-mono" 
                            />
                            <button 
                              onClick={() => {
                                const url = selectedElement.config?.videoUrl;
                                if (url) {
                                  const id = getYouTubeId(url);
                                  if (id) {
                                    updateElement(selectedElement.id, { 
                                      config: { ...selectedElement.config!, videoUrl: `https://www.youtube.com/watch?v=${id}` } 
                                    });
                                  } else {
                                    alert("Could not extract YouTube ID. Please check the URL.");
                                  }
                                }
                              }}
                              className="w-full mt-2 text-[10px] py-1.5 bg-indigo-50 text-indigo-600 rounded font-bold uppercase hover:bg-indigo-100 transition-colors"
                            >
                              Fix & Validate URL
                            </button>
                          </div>

                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-md">
                            <span className="text-xs text-slate-600 font-medium">Auto Full Slide</span>
                            <button 
                              onClick={() => {
                                const isFull = !selectedElement.config?.isFullScreen;
                                updateElement(selectedElement.id, { 
                                  config: { ...selectedElement.config!, isFullScreen: isFull },
                                  ...(isFull ? { x:50, y:50, width:100, height:100 } : {})
                                });
                              }}
                              className={cn(
                                "w-8 h-4 rounded-full relative transition-colors",
                                selectedElement.config.isFullScreen ? "bg-indigo-600" : "bg-slate-300"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                                selectedElement.config.isFullScreen ? "right-1" : "left-1"
                              )} />
                            </button>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-slate-100">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Interactions</span>
                               <button onClick={() => addCheckpoint(selectedElement.id)} className="p-1 px-2 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold uppercase hover:bg-indigo-100">+ Add</button>
                             </div>
                             
                             <div className="space-y-2">
                               {selectedElement.config.checkpoints?.map((cp, idx) => (
                                 <div key={cp.id} className="p-2 bg-slate-50 rounded border border-slate-100 space-y-2">
                                   <div className="flex items-center justify-between">
                                     <span className="text-[9px] font-bold text-slate-400">#{idx + 1} at {cp.time}s</span>
                                     <button onClick={() => deleteCheckpoint(selectedElement.id, cp.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                   </div>
                                   <div className="grid grid-cols-2 gap-2">
                                     <div className="space-y-0.5">
                                       <span className="text-[8px] text-slate-400 uppercase">Time (s)</span>
                                       <input type="number" value={cp.time} onChange={(e) => updateCheckpoint(selectedElement.id, cp.id, { time: Number(e.target.value) })} className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] outline-none" />
                                     </div>
                                     <div className="space-y-0.5">
                                       <span className="text-[8px] text-slate-400 uppercase">Type</span>
                                       <select value={cp.type} onChange={(e) => updateCheckpoint(selectedElement.id, cp.id, { type: e.target.value as any })} className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] outline-none">
                                         <option value="quiz">Quiz</option>
                                         <option value="true-false">T/F</option>
                                         <option value="drag-words">Drag</option>
                                         <option value="fill-blanks">Blanks</option>
                                       </select>
                                     </div>
                                   </div>
                                   <div className="space-y-0.5">
                                     <span className="text-[8px] text-slate-400 uppercase">Question/Prompt</span>
                                     <input value={cp.question} onChange={(e) => updateCheckpoint(selectedElement.id, cp.id, { question: e.target.value })} className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] outline-none" placeholder="Question?" />
                                   </div>
                                   {(cp.type === 'drag-words' || cp.type === 'fill-blanks') && (
                                     <div className="space-y-0.5">
                                       <span className="text-[8px] text-slate-400 uppercase">Content (*answer*)</span>
                                       <input value={cp.content} onChange={(e) => updateCheckpoint(selectedElement.id, cp.id, { content: e.target.value })} className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] outline-none" placeholder="The *sky* is *blue*" />
                                     </div>
                                   )}
                                   {(cp.type === 'quiz' || cp.type === 'drag-words') && (
                                     <div className="space-y-0.5">
                                       <span className="text-[8px] text-slate-400 uppercase">Options (comma sep)</span>
                                       <input value={cp.options?.join(', ')} onChange={(e) => updateCheckpoint(selectedElement.id, cp.id, { options: e.target.value.split(',').map(s => s.trim()) })} className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] outline-none" placeholder="Opt1, Opt2" />
                                     </div>
                                   )}
                                   {(cp.type === 'quiz' || cp.type === 'true-false') && (
                                     <div className="space-y-0.5">
                                       <span className="text-[8px] text-slate-400 uppercase">Correct Answer</span>
                                       <input value={cp.correctAnswer as string} onChange={(e) => updateCheckpoint(selectedElement.id, cp.id, { correctAnswer: e.target.value })} className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] outline-none" placeholder="Correct Answer" />
                                     </div>
                                   )}
                                 </div>
                               ))}
                             </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-md">
                        <span className="text-xs text-slate-600 font-medium">Display as Button Icon</span>
                        <button 
                          onClick={() => updateElement(selectedElement.id, { config: { ...selectedElement.config!, showAsIcon: !selectedElement.config?.showAsIcon } })}
                          className={cn(
                            "w-8 h-4 rounded-full relative transition-colors",
                            selectedElement.config.showAsIcon ? "bg-indigo-600" : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                            selectedElement.config.showAsIcon ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100">
                <button 
                  onClick={() => updateActiveSlide({ elements: activeSlide.elements.filter(el => el.id !== selectedElementId) })}
                  className="w-full py-2 bg-red-50 text-red-600 border border-red-100 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-colors"
                >
                  Delete Element
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="h-8 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[10px] text-slate-400 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Connected to Engine</span>
          <span className="font-medium">Slide {activeSlideIndex + 1} of {project.slides.length}</span>
        </div>
        <div className="flex items-center gap-4 uppercase font-bold tracking-tight">
          <span>Canvas: 16:9 Responsive</span>
          <span>Zoom: 95%</span>
        </div>
      </footer>
    </div>
  );
}
