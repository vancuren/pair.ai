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
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  SPEAKING = 'SPEAKING',
}
