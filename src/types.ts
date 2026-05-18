import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ElementType = 'text' | 'image' | 'quiz' | 'drag-words' | 'fill-blanks' | 'true-false' | 'video';

export interface VideoCheckpoint {
  id: string;
  time: number;
  type: 'quiz' | 'true-false' | 'drag-words' | 'fill-blanks';
  question: string;
  content?: string;
  options?: string[];
  correctAnswer: string | number | string[];
}

export interface InteractionConfig {
  question?: string;
  options?: string[];
  correctAnswer?: string | number | string[];
  placeholder?: string;
  showAsIcon?: boolean;
  videoUrl?: string;
  isFullScreen?: boolean;
  checkpoints?: VideoCheckpoint[];
}

export interface SlideElement {
  id: string;
  type: ElementType;
  x: number; // 0-100
  y: number; // 0-100
  width: number; // 0-100
  height: number; // 0-100
  content: string; // text or image source
  config?: InteractionConfig;
  isBackground?: boolean;
}

export interface Slide {
  id: string;
  elements: SlideElement[];
}

export interface Project {
  id: string;
  title: string;
  slides: Slide[];
}
