# Reasoning effort

Users choose how much an OpenAI reasoning model reasons for each question, in the composer. The first question can use Low and the next one High. This document describes what was built and why.

## Behaviour

- The composer shows an **Effort** chip next to the model chip, but only when the model the question will run on accepts an effort. That model is the selected profile, else the conversation's profile, else the workspace default. Models without a known effort list get no chip, for example `gpt-4o`, `gpt-4.1`, `*-chat-latest` and `*-pro`.
- The chip's list contains **Model default** plus only the values that model accepts. Model default sends nothing, so OpenAI applies the model's own default. The list shows that default when it is documented.
- The choice stays in place for later questions until the user changes it. On the Ask page it carries over into the new conversation's follow-up composer. If the user picks a model that does not accept the chosen effort, the choice resets to Model default.
- Both halves of a question use the same effort:
  - the agent loop (LangChain `ChatOpenAI`, which sends `reasoning.effort` on the Responses API when it uses it)
  - the final-answer client (raw Chat Completions `reasoning_effort`)
- Clarification answers continue with the effort of the question they answer. A paused analysis resumes the same job, so it keeps the effort too.
- The trace's model-call card shows the effort, for example "high effort".

## Which values each model accepts

OpenAI has no capability endpoint (`/v1/models` returns only id, created, object, owned_by and shutdown_date), and models reject values they do not support. So `app/models/reasoning.py` holds a catalog taken from OpenAI's model pages on 2026-10-25:

| Family (matches `id` and `id-*`) | Efforts | Default |
| --- | --- | --- |
| `gpt-6.1-sol` | low, medium, high, xhigh, max | medium |
| `gpt-6-astra` | low, medium, high, xhigh, max | not documented |
| `gpt-6-sol`, `gpt-6-luna` | none, low, medium, high, xhigh, max | medium |
| `gpt-5.6` (terra, luna, sol) | none, low, medium, high, xhigh, max | medium |
| `gpt-5.5` | none, low, medium, high, xhigh | medium |
| `gpt-5.4`, `gpt-5.2` | none, low, medium, high, xhigh | none |
| `gpt-5.1` | none, low, medium, high | none |
| `gpt-5` (mini, nano) | minimal, low, medium, high | medium |
| `o3`, `o4-mini` | low, medium, high | medium |

How models are matched:

- A family matches its own id and ids that continue with `-`. So `gpt-5` covers `gpt-5-mini` and dated snapshots, but not `gpt-5.3-codex`.
- Gateway prefixes such as `openai/` are ignored.
- Ids with a `chat`, `pro`, `codex`, `search`, `audio`, `realtime` or `preview` segment are left out, because their effort lists differ from their family's.
- The o-series values come from third-party sources, since OpenAI's o3/o4-mini pages do not list them. Those models are also being retired.

When OpenAI ships a new model, add a row to `_FAMILIES` and a case to `tests/unit/test_reasoning_effort.py`.

## Sampling options while reasoning

OpenAI rejects `temperature`, `top_p`, `logprobs` and `top_logprobs` whenever a model reasons, meaning any effort other than `none`. This includes a model whose default effort reasons. `reasoning.request_settings()` builds what both call paths send: the profile settings plus the question's effort, with those options removed while the model reasons. `ChatOpenAI` already did this for `gpt-5*`, but the final-answer client did not, so profiles saved with `temperature: 0.2` used to fail on the final answer.

## Errors

- **Before the job starts**: the API rejects an effort the profile's model does not list. The code is `REASONING_EFFORT_UNSUPPORTED` (HTTP 422).
- **When the provider still rejects it** (HTTP 400 or 422 naming `reasoning_effort` or `reasoning.effort`): both paths record `MODEL_PARAMETER_UNSUPPORTED` with the message "The model does not accept this reasoning effort. Choose another effort or Model default.". That error now fails the job with the same code and message instead of the generic `AGENT_EXECUTION_FAILED` / `FINAL_ANSWER_PROVIDER_FAILED`. Rejected `temperature` / `max_tokens` settings share the helper `unsupported_parameter_message` in `app/models/errors.py`.

## Data and API

- `POST /conversations/{id}/messages` accepts `reasoning_effort` (`none | minimal | low | medium | high | xhigh | max | null`). The value is stored in the user message's `metadata.reasoning_effort` and in the job input.
- `ModelProfileResponse` has two computed, read-only fields that drive the composer: `reasoning_efforts` (empty means no control) and `default_reasoning_effort`.
- `model_executions.reasoning_effort` (migration `0021_reasoning_effort`, nullable `VARCHAR(20)`) records the effort sent on each call; null means the model's default. There is no check constraint, because OpenAI keeps adding values and the API already validates them.
- Effort is no longer a profile setting. Profile validation rejects `reasoning_effort` and `reasoning` in `settings`, and the migration removes them from existing profiles.

## Code map

| Area | Files |
| --- | --- |
| Catalog and request settings | `app/models/reasoning.py`, `ModelRuntimeConfiguration.request_settings()` in `app/models/client.py` |
| Agent loop | `_build_chat_model`, `AgentAuditContext`, `model_failure_details` in `app/agent/deep_agent.py` |
| Final answer | `app/agent/final_answer.py` |
| Job | `run_chat_query_job` in `app/agent/jobs.py`, `get_runtime_configuration` in `app/models/service.py` |
| Message submit and clarification carry-over | `app/conversations/service.py`, `MessageCreate` in `app/conversations/schemas.py` |
| Composer | `frontend/src/conversations/components/ChatComposer.tsx`, `frontend/src/conversations/reasoning-effort.ts`, `AskPage.tsx`, `ConversationPage.tsx` |
| Trace | `frontend/src/agent/components/ModelExecutionCard.tsx` |

## Not covered

- Other providers. Mistral's OpenAI-compatible API also takes `reasoning_effort`, but its reasoning models return `content` as a list of thinking and text chunks. `OpenAICompatibleClient` does not parse that yet, and the catalog lists no Mistral models.
- Effort through the Responses API's `configuration_update` mid-conversation, and `reasoning.mode` (pro).
