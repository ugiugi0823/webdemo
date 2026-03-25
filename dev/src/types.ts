export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  image?: { base64: string; mimeType: string; name: string }
  timestamp: Date
  streaming?: boolean
}

export interface ChatParams {
  thinking: boolean
  temperature: number
  sampling: boolean
}

export type TaskType =
  | 'free'
  | 'qa'
  | 'keyword'
  | 'summary'
  | 'query'

export interface TaskExample {
  id: TaskType
  label: string
  icon: string
  prompt: string
  systemPrompt?: string
}

export const TASK_EXAMPLES: TaskExample[] = [
  {
    id: 'free',
    label: 'Free (Multi turn dialogue)',
    icon: 'MessageCircle',
    prompt: '',
    systemPrompt: '',
  },
  {
    id: 'qa',
    label: 'Question Answering',
    icon: 'HelpCircle',
    prompt: '다음 내용을 바탕으로 질문에 답해주세요.\n\n[내용]: \n\n[질문]: ',
    systemPrompt: '당신은 정확하고 간결한 답변을 제공하는 AI 어시스턴트입니다. 주어진 내용을 바탕으로 질문에 답하세요.',
  },
  {
    id: 'keyword',
    label: 'Keyword Extraction',
    icon: 'Tag',
    prompt: '다음 텍스트에서 핵심 키워드를 추출해주세요.\n\n[텍스트]: ',
    systemPrompt: '당신은 텍스트에서 핵심 키워드를 추출하는 AI입니다. 중요도 순으로 키워드를 나열하고 각 키워드의 중요성을 간단히 설명하세요.',
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: 'FileText',
    prompt: '다음 내용을 요약해주세요.\n\n[내용]: ',
    systemPrompt: '당신은 텍스트를 명확하고 간결하게 요약하는 AI입니다. 핵심 내용을 빠짐없이 담아 간략하게 요약하세요.',
  },
  {
    id: 'query',
    label: 'Query Complete',
    icon: 'Search',
    prompt: '다음 쿼리를 완성하거나 개선해주세요.\n\n[쿼리]: ',
    systemPrompt: '당신은 쿼리 작성 및 개선을 도와주는 AI입니다. 주어진 쿼리를 분석하고 더 효과적으로 완성하거나 개선하세요.',
  },
]
