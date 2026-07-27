export interface ConfigFile {
  name: string;
  path: string;
  description: string;
  content: string;
  language: 'json' | 'typescript' | 'ignore' | 'bash';
}

export interface CheckItem {
  id: string;
  title: string;
  category: 'config' | 'routing' | 'env' | 'api' | 'build';
  status: 'passed' | 'warning' | 'info';
  details: string;
  recommendation?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  iconName: string;
  prompt: string;
}

export interface ApiHealthResponse {
  status: string;
  environment: string;
  timestamp: string;
  hasGeminiKey: boolean;
}
