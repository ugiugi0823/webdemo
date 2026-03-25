export interface AttachedDocument {
  name: string
  type: string   // file extension
  text: string   // extracted text content
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  image?: { base64: string; mimeType: string; name: string }
  document?: AttachedDocument
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

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  timestamp: Date
  params: ChatParams
}

export const TASK_EXAMPLES: TaskExample[] = [
  {
    id: 'qa',
    label: '🔍 질문 답변',
    icon: 'HelpCircle',
    prompt: '문서\n\n생성 인공지능(AI)을 둘러싼 경쟁이 2라운드에 접어들고 있다. 1라운드가 오픈AI의 챗GPT, 구글 바드와 같이 누구나 접속해 이용할 수 있는 퍼블릭 서비스라면 2라운드는 기업 대상 프라이빗 서비스다. 기업용 생성 AI 시장이 별도로 형성되는 것은 보안 이슈 때문이다. 대다수 생성 AI는 이용자가 입력한 정보를 AI 모델 개선을 위한 데이터로 활용한다. 생성 AI에 기업의 내부 정보를 입력했다가 다른 사람의 답변에 노출될 수 있다는 얘기다. 이 때문에 삼성전자, 애플 등 국내외 주요 기업이 내부 기밀 정보가 유출되는 일을 막기 위해 사내 챗GPT 금지령을 내렸다.\n\n조건\n\n문서를 읽고 질문에 대답하시오. 답이 없는 경우 알 수 없다고 하시오.\n\n질문\n\n인공지능 경쟁이 2라운드에 접어든 이유는?',
    systemPrompt: '당신은 정확하고 간결한 답변을 제공하는 AI 어시스턴트입니다. 주어진 내용을 바탕으로 질문에 답하세요.',
  },
  {
    id: 'keyword',
    label: '🏷️ 키워드 추출',
    icon: 'Tag',
    prompt: '쉬는 날 운동하던 소방관이 심정지로 쓰러진 시민의 생명을 구했습니다. 대구소방본부 등에 따르면 북부소방서 119 구조대 소속 박문규 소방위는 5월 10일 오후 7시 반쯤, 경북 경산시의 한 배드민턴장에서 지인과 운동하던 중 30대 여성이 쿵 소리와 함께 갑자기 쓰러지는 걸 목격했습니다. 박 소방위는 곧바로 심폐소생술을 하며 119에 신고했고, 여성은 호흡과 의식을 회복한 뒤 병원으로 옮겨졌습니다. 박 소방위는 "우리 가족과 이웃의 생명을 살리기 위해 시민 모두가 심폐소생술을 익혔으면 좋겠다"라고 말했습니다.\n\n위의 뉴스에서 키워드 5개를 찾으시오.',
    systemPrompt: '당신은 텍스트에서 핵심 키워드를 추출하는 AI입니다. 중요도 순으로 키워드를 나열하고 각 키워드의 중요성을 간단히 설명하세요.',
  },
  {
    id: 'summary',
    label: '📄 요약',
    icon: 'FileText',
    prompt: "뉴스 시작\n\n(서울=연합뉴스) 권수현 기자 = 미국과 유럽, 아시아 등 세계 곳곳에서 때 이른 폭염으로 역대 최고 기온을 경신하는 등 이상고온 현상이 이어지고 있다. 기후변화가 이상고온의 주범으로 지목된 가운데, 올 하반기와 내년엔 '엘니뇨' 현상으로 인해 폭염 등이 더욱 극심해질 것이라는 우려가 커지고 있다.\n\n뉴스 끝\n\n해당 뉴스를 간단히 요약하시오.",
    systemPrompt: '당신은 텍스트를 명확하고 간결하게 요약하는 AI입니다. 핵심 내용을 빠짐없이 담아 간략하게 요약하세요.',
  },
  {
    id: 'query',
    label: '✏️ 쿼리 완성',
    icon: 'Search',
    prompt: '###\nquery1: "집에서 쉽게 만들 수 있는 간단한 요리가 뭐가 있을까요?"\nanswer: "파스타를 추천드립니다. 간단한 재료로도 금방 만들 수 있고 맛있게 즐길 수 있습니다."\nquery2: "그걸 만들 때 필요한 재료가 뭐에요?"\nresponse:',
    systemPrompt: '당신은 쿼리 작성 및 개선을 도와주는 AI입니다. 주어진 쿼리를 분석하고 더 효과적으로 완성하거나 개선하세요.',
  },
]
