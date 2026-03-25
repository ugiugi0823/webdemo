# LLM42 웹 개선 프로젝트

**대상:** [http://llm42.42maru.com/](http://llm42.42maru.com/)

---

## 목표

| # | 항목 | 설명 |
|---|------|------|
| 0 | **기능 유지** | 기존 동작은 모두 유지한다. |
| 1 | **디자인** | `original_design.jpg`보다 눈에 띄게 나아진 UI/UX. |
| 2 | **이미지 추론** | 이미지 입력·추론 흐름을 지원한다. |

---

## 개발·배포 구조

| 경로 | 방식 |
|------|------|
| `dev/` | npm 기반으로 빠르게 개발 |
| `prod/` | Docker 기반 배포 예정 |

**작업 기록**

- `work_<현재시간>.log` — 작업 로그를 남긴다.
- `task_<현재시간>.md` — 태스크 문서를 갱신한다.

---

## API 호출

**Base URL:** `http://192.168.0.234`

### vLLM — Chat Completions

**URL:** `http://192.168.0.234:9015/v1/chat/completions`

**vllm 인증 key** /home/rex/workspace/dev/WEBDEMO/vllm_api.key

**Body 예시 (thinking 활성화):**

```json
{
  "model": "LLM42",
  "messages": [
    {
      "role": "user",
      "content": "너는 누구야"
    }
  ],
  "chat_template_kwargs": {
    "thinking": true
  }
}
```

thinking을 끄려면 `chat_template_kwargs.thinking`을 `false`로 바꾼다.

---

### FastAPI — Predict

**URL:** `http://192.168.0.234:9016/predict`

**Body 예시 (thinking 비활성화):**

```json
{
  "model": "LLM42",
  "messages": [
    {
      "role": "user",
      "content": "너는 누구야"
    }
  ],
  "extra_body": {
    "chat_template_kwargs": {
      "thinking": false
    }
  }
}
```

thinking을 켜려면 `extra_body.chat_template_kwargs.thinking`을 `true`로 바꾼다.

---

## 엔드포인트 요약

| 구분 | 포트·경로 | 비고 |
|------|-----------|------|
| vLLM | `:9015/v1/chat/completions` | `chat_template_kwargs`를 최상위에 둠 |
| FastAPI | `:9016/predict` | 동일 옵션을 `extra_body` 안에 둠 |
