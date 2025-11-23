export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isAudioPlaying?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  isAI: boolean;
  isActive: boolean; // Is currently speaking
  avatarUrl?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  SHARING = 'SHARING',
  GITHUB_MODE = 'GITHUB_MODE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  SPEAKING = 'SPEAKING',
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
}

export interface ToolCallResponse {
  functionCalls: {
    name: string;
    args: any;
  }[];
  text?: string;
}