# vLLM에서 이미지(비전) 추론 사용하기

이 문서는 **OpenAI 호환 Chat Completions API** (`/v1/chat/completions`)로 vLLM에 이미지를 넣어 추론하는 방법을 정리한다. 레포 기준 모델 예는 **HCX-SEED-Think-32B** (`HCXVisionV2ForCausalLM`) 다.

---

## 1. 전제

- 엔드포인트: `POST {BASE_URL}/v1/chat/completions`
- 인증: `Authorization: Bearer {LLM_API_KEY}` (Docker `.env`의 `LLM_API_KEY`와 동일)
- `model`: 서버에 등록된 이름과 일치 (예: `HCX-SEED-Think-32B`, `BASE_MODEL_NAME`과 맞출 것)
- 이미지는 보통 **`data:image/jpeg;base64,...`** 형태의 data URL 또는 공개 `https://` URL

---

## 2. 가장 중요한 규칙: `content` 블록 순서

HCX 계열 비전은 vLLM 멀티모달 치환과 맞추려면 **`user` 메시지의 `content` 배열에서**:

1. **먼저** `type: "text"` — 아래 **플레이스홀더 토큰**이 포함된 문자열  
2. **그다음** `type: "image_url"` — 실제 픽셀 데이터(data URL 등)

순서를 바꾸면 `Failed to apply prompt replacement for mm_items['image'][0]` 같은 오류가 나기 쉽다.

`content`를 단순 문자열만 쓰는 텍스트 전용 요청과 달리, 비전은 **리스트 형태** `content: [...]` 를 쓴다.

---

## 3. HCX용 텍스트 플레이스홀더

이미지 한 장을 `image_00`에 대응시킬 때, 텍스트 블록에 아래 문자열을 **그대로** 넣는다 (JSON 이스케이프 주의).

```text
<|mime_start|>{"id": "image_00", "type": "image/jpeg", "filename": "input.jpg"}<|mime_end|><|image_start|><|IMAGE_PAD|><|image_end|>
```

그 다음 줄에 사용자 질문을 이어 쓴다. 예:

```text
<|mime_start|>{"id": "image_00", "type": "image/jpeg", "filename": "input.jpg"}<|mime_end|><|image_start|><|IMAGE_PAD|><|image_end|>
이미지에 대해 설명해줘.
```

---

## 4. 요청 JSON 예시

`{{BASE64}}` 는 실제 JPEG/PNG 바이너리의 Base64 문자열로 바꾼다.

```json
{
  "model": "HCX-SEED-Think-32B",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<|mime_start|>{\"id\": \"image_00\", \"type\": \"image/jpeg\", \"filename\": \"input.jpg\"}<|mime_end|><|image_start|><|IMAGE_PAD|><|image_end|>\n이미지에 대해 설명해줘."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,{{BASE64}}"
          }
        }
      ]
    }
  ],
  "max_tokens": 4096,
  "chat_template_kwargs": {
    "thinking": false
  }
}
```

- **이미지 추론**에서는 보통 `thinking: false` 로 두는 편이 안전하다 (모델·템플릿 정책에 맞게 조정).
- 게이트웨이가 `extra_body`만 vLLM으로 전달한다면, 동일 필드를 `extra_body.chat_template_kwargs` 아래로 옮긴다.

---

## 5. 로컬에서 빠르게 검증

레포의 `chat_completion_test.py`가 위 순서·플레이스홀더를 반영한다.

```bash
cd /path/to/vLLM_v44
python3 chat_completion_test.py \
  --url "http://<호스트>:<포트>/v1/chat/completions" \
  --token-file bearer_token.key \
  --image-path test.jpg \
  --image-placeholder \
  --message "이미지에 대해 설명해줘." \
  --no-thinking \
  --max-tokens 4096 \
  --quiet \
  --timeout 300
```

`--token-file` 안의 값은 `Bearer ` 접두사 없이 API 키만 넣는다.

---

## 6. 서버(Docker) 설정 참고

vLLM V1에서 멀티모달 캐시와 관련해 `mm_hash` / `MultiModalReceiverCache` 오류(HTTP 500)가 나는 경우가 있다. `docker/.env`에서 아래를 시도한다.

```env
MM_PROCESSOR_CACHE_GB=0
MM_PROCESSOR_CACHE_TYPE=lru
```

`oot_models/vllm_openai_server_wrapper.py`가 vLLM 빌드가 해당 CLI를 지원할 때만 `--mm-processor-cache-gb` 등으로 넘긴다. 변경 후 **vLLM 컨테이너 재기동**이 필요하다.

---

## 7. 자주 나는 문제

| 증상 | 점검 |
|------|------|
| `Failed to apply prompt replacement for mm_items['image'][0]` | 텍스트(플레이스홀더) 블록을 **이미지 앞**에 두었는지, `IMAGE_PAD` 등 토큰 누락 없는지 |
| `Expected a cached item for mm_hash=...` | `MM_PROCESSOR_CACHE_GB=0` 후 재기동, 또는 vLLM 버전 업 |
| 401 | `Authorization: Bearer` 와 `LLM_API_KEY` 일치 여부 |
| 텍스트만 됨 / 400 `str` vs `list` | `CHAT_TEMPLATE_CONTENT_FORMAT`·템플릿과 `content` 형식 불일치 — 멀티모달은 보통 `list` 유지 |

---

## 8. 관련 파일

- `task.md` — 엔드포인트·샘플 페이로드 요약  
- `chat_completion_test.py` — 요청 조립 로직 (`build_payload`)  
- `docker/.env` / `docker/.env.example` — API 키, MM 캐시 옵션  
- `logs/vllm/vllm.log` — 서버 측 오류 추적  
