
export interface User {
  id: string;
  name: string;
  isPremium?: boolean;
  avatar: string;
  banner?: string; // NEW: Profile Banner
  country?: string; // NEW: User Location
  email?: string;
  username?: string;
  bio?: string;
  skills?: string[];
  isOnboarded?: boolean;
  isAuthenticated?: boolean; // Added for login flow
  isCertified?: boolean; // NEW: Global Certification Badge
  history?: TrialSession[];
  interviews?: InterviewSession[]; // New: Interview History
  exams?: ExamSession[]; // New: Competitive Exams History
  stats?: {
    trialsCompleted: number;
    arenaWins: number;
    globalRank: number;
    topPercentile: number;
    examsPassed: number;
  };
}

export enum SkillDomain {
  // Legacy / Web
  FRONTEND = "Frontend Engineering",
  BACKEND = "Backend Architecture",
  FULLSTACK = "Full Stack Development",
  ALGORITHMS = "Algorithms & Data Structures",
  MOBILE = "Mobile App Development",
  DEVOPS = "DevOps",
  CLOUD = "Cloud Infrastructure",
  QA = "QA & Automation",
  DATABASE = "Database Engineering",
  NETWORK = "Network Engineering",
  UI_UX = "UI/UX Design",
  PRODUCT = "Product Management",
  SECURITY = "Cybersecurity & InfoSec",
  BLOCKCHAIN = "Blockchain & Web3",

  // Tier 1: Core Systems & Data
  SYSTEMS_PROG = "Systems Programming",
  DISTRIBUTED_SYS = "Distributed Systems",
  SW_ARCH = "Software Architecture",
  API_DESIGN = "API Design & Integration",
  PLATFORM_ENG = "Platform Engineering",
  SRE = "Site Reliability Engineering",
  DATA_ENG = "Data Engineering",
  DECISION_SCI = "Decision Science / OR",
  ML_ENG = "Machine Learning Engineering",
  MLOPS = "AI Infrastructure / MLOps",

  // Tier 2: Specialized & Real-Time
  ROBOTICS = "Robotics Software",
  EDGE_COMP = "Real-Time / Edge Computing",
  AUTONOMOUS_SYS = "Autonomous Systems",
  GAME_DEV = "Game Engine & Graphics", // Renamed from Game Development for specificity
  CONTROL_SYS = "Control Systems / Embedded", // Merged with Embedded
  
  // Tier 3: Physical & Specialized Engineering
  CIVIL = "Civil Engineering",
  MECHANICAL = "Mechanical Engineering",
  CHEMICAL = "Chemical Engineering",
  BIOMEDICAL = "Biomedical Engineering",
  AEROSPACE = "Aerospace Engineering",
  ELECTRICAL = "Electrical Engineering",
  ENERGY = "Energy Engineering",
  POWER = "Power Systems",
  RENEWABLE = "Renewable / Environmental",
  MATERIALS = "Materials Engineering",
  STRUCTURAL = "Structural Engineering",
  INDUSTRIAL = "Industrial Engineering",
  SAFETY = "Safety Engineering",
  LOGISTICS = "Logistics & Supply Chain",
  
  // Niche Fields
  QUANTUM = "Quantum Engineering",
  NANO = "Nanotechnology",
  MARINE = "Marine Engineering",
  MINING = "Mining Engineering",
  FOOD = "Food Engineering",
  TEXTILE = "Textile Engineering",
  SPORTS = "Sports Engineering"
}

export interface SkillDNAScore {
  problemSolving: number;
  executionSpeed: number;
  conceptualDepth: number;
  aiLeverage: number;
  riskAwareness: number;
  average: number;
}

export interface TrialSession {
  id: string;
  domain: SkillDomain;
  status: 'idle' | 'generating' | 'setup' | 'active' | 'analyzing' | 'completed';
  startTime?: number;
  endTime?: number;
  taskDescription?: string;
  constraints?: string[];
  userSolution?: string;
  userReasoning?: string;
  score?: SkillDNAScore;
  feedback?: string;
}

export interface AntiCheatLog {
  tabSwitchCount: number;
  pasteCount: number;
  focusLostTime: number; // in ms
  environmentViolations?: string[];
}

// --- INTERVIEW TYPES ---
export interface InterviewQuestion {
  id: number;
  text: string;
  timeLimit: number; // seconds
}

export interface InterviewSession {
  id: string;
  domain: SkillDomain;
  status: 'active' | 'completed';
  startTime: number;
  questions: InterviewQuestion[];
  responses: {
    questionId: number;
    transcript: string;
    score: number;
    feedback: string;
  }[];
  overallScore: number;
  feedback: string;
}

// --- COMPETITIVE EXAM TYPES ---
export interface ExamMCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number; // Hidden from client
  userAnswer?: number;
}

export interface ExamTheory {
  id: number;
  question: string;
  userAnswer?: string;
}

export interface ExamPractical {
  id: number;
  task: string;
  constraints: string[];
  userAnswer?: string;
}

export interface ExamSession {
  id: string;
  domain: SkillDomain;
  status: 'setup' | 'mcq' | 'theory' | 'practical' | 'grading' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  
  mcqData: ExamMCQ[];
  theoryData: ExamTheory[];
  practicalData: ExamPractical[];
  
  sectionScores: {
    mcq: number;
    theory: number;
    practical: number;
  };
  overallScore: number;
  feedback: string;
  
  antiCheat: AntiCheatLog;
}

// --- NEW TYPES FOR CHALLENGE MODE ---
export interface ChallengeParticipant {
  id: string;
  name: string;
  avatar?: string; // initial or url
  progress: number; // 0 to 100
  score: number;
  status: 'coding' | 'validating' | 'finished';
  isBot: boolean;
}

export interface ChallengeCheckpoint {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface LiveChallenge {
  id: string;
  domain: SkillDomain;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  participants: ChallengeParticipant[];
  checkpoints: ChallengeCheckpoint[];
  taskDescription: string;
  startTime: number;
  durationSeconds: number;
}

// --- NEW TYPES FOR LEADERBOARD ---
export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  avatar: string;
  domainSpecialty: string;
  score: number; // The primary metric being sorted by (e.g. Skill DNA or Win Count)
  secondaryScore?: number; // e.g. Trials count
  change: number; // Rank change (positive or negative)
  isCurrentUser: boolean;
  isCertified?: boolean; // NEW: Display badge on leaderboard
}

export type LeaderboardTimeframe = 'weekly' | 'monthly' | 'all-time';
export type LeaderboardMetric = 'skill_dna' | 'arena_wins' | 'trials_completed';
