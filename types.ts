
export type QuestionType = 'SENTENCE' | 'NOTE' | 'MCQ' | 'MIXED';

export type TestPart = 'PART_1' | 'PART_2' | 'PART_3' | 'PART_4';

export type LevelType = 'A1-A2' | 'B1-B2' | 'C1-C2' | 'OFFICIAL';

export type TopicType = 
  | 'Booking & Reservations' 
  | 'Memberships & Enrolment' 
  | 'Service Inquiries' 
  | 'Accommodation & Housing' 
  | 'Lost or Damaged Items' 
  | 'Volunteering & Charities' 
  | 'Surveys & Interviews' 
  | 'Random'
  | 'Local Facilities & Community Services' 
  | 'Tourist Attractions & Site Tours' 
  | 'Events & Festivals' 
  | 'Improvements & Renovations' 
  | 'The Assignment Discussion' 
  | 'The Tutor Tutorial' 
  | 'Research Project Planning' 
  | 'Course Feedback or Selection' 
  | 'The Natural World & Biology' 
  | 'History and Archaeology' 
  | 'Business and Management' 
  | 'Psychology and Human Behavior' 
  | 'Physical Sciences & Technology';

export interface Speaker {
  name: string;
  gender: 'male' | 'female';
  role: 'clerk' | 'customer' | 'guide' | 'official' | 'student' | 'tutor' | 'professor' | 'lecturer';
}

export interface ScriptSegment {
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface Question {
  id: number;
  type: 'SENTENCE' | 'NOTE' | 'MCQ'; // These are the atomic types
  label: string; 
  prefix?: string;
  suffix?: string;
  options?: string[]; 
  answer: string;
  answerSentence: string;
  timestampSeconds: number;
  proofStart: number;
  proofEnd: number;
}

export interface TestData {
  title: string;
  part: TestPart;
  level: LevelType;
  instruction: string;
  script: string;
  scriptSegments: ScriptSegment[];
  speakers: Speaker[];
  questions: Question[];
}

export interface UserAnswer {
  questionId: number;
  value: string;
}

export interface PlaybackEvent {
  time: number; 
  audioTime: number; 
  type: 'pause' | 'seek_forward' | 'seek_backward' | 'replay';
}

export interface TestAnalytics {
  replays: number;
  events: PlaybackEvent[];
  questionAssistance: Record<number, { lifeline: boolean; script: boolean }>;
}

export enum TestStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  SUBMITTED = 'SUBMITTED'
}
