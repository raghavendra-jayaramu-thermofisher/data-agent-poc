import json

import httpx
import pytest

from app.models.client import ModelMessage, ModelStreamingUnsupportedError, OpenAICompatibleClient
from app.models.errors import ModelProviderError

MESSAGES = [ModelMessage(role="user", content="Public question")]


def frame(text=None, *, finish=None, **extra):
    return (
        "data: "
        + json.dumps(
            {
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": text, "reasoning_content": "PRIVATE"},
                        "finish_reason": finish,
                    }
                ],
                **extra,
            },
            ensure_ascii=False,
        )
        + "\r\n\r\n"
    )


class ByteStream(httpx.AsyncByteStream):
    def __init__(self, body):
        self.body, self.closed = body.encode(), False

    async def __aiter__(self):
        for byte in self.body:
            yield bytes([byte])

    async def aclose(self):
        self.closed = True


def client(handler):
    return OpenAICompatibleClient(
        base_url="https://models.example/v1",
        api_key="secret",
        transport=httpx.MockTransport(handler),
    )


async def test_decodes_fragmented_utf8_frames_and_final_usage_without_private_fields():
    stream = ByteStream(
        ": heartbeat\r\n\r\n"
        + frame("Hello 🌍", model="writer")
        + frame("!", finish="stop")
        + 'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}\n\n'
        + "data: [DONE]\n\n"
    )

    def handler(request):
        payload = json.loads(request.content)
        assert payload["stream"] is True
        assert payload["stream_options"] == {"include_usage": True}
        assert request.headers["accept"] == "text/event-stream"
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=stream)

    chunks = [
        chunk
        async for chunk in client(handler).stream_chat_completion(model="writer", messages=MESSAGES)
    ]
    assert "".join(chunk.text for chunk in chunks) == "Hello 🌍!"
    assert chunks[-1].usage.total_tokens == 14
    assert chunks[0].model == "writer"
    assert stream.closed


async def test_eof_without_completion_marker_is_an_interrupted_answer():
    received = []
    with pytest.raises(ModelProviderError, match="before it finished"):
        async for chunk in client(
            lambda _: httpx.Response(200, text=frame("Partial"))
        ).stream_chat_completion(
            model="writer",
            messages=MESSAGES,
        ):
            received.append(chunk.text)
    assert received == ["Partial"]


async def test_unsupported_optional_usage_retries_only_the_rejected_request():
    requests = []

    def handler(request):
        payload = json.loads(request.content)
        requests.append(payload)
        if "stream_options" in payload:
            return httpx.Response(
                400,
                json={
                    "error": {
                        "message": "Unknown parameter stream_options",
                        "param": "stream_options",
                    }
                },
            )
        return httpx.Response(200, text=frame("Answer", finish="stop") + "data: [DONE]\n\n")

    chunks = [
        chunk
        async for chunk in client(handler).stream_chat_completion(model="writer", messages=MESSAGES)
    ]
    assert len(requests) == 2
    assert chunks[0].text == "Answer"
    assert chunks[0].usage is None


async def test_explicit_stream_rejection_is_distinct_from_other_provider_errors():
    provider = client(
        lambda _: httpx.Response(
            422,
            json={
                "error": {
                    "message": "Streaming is not supported",
                    "param": "stream",
                }
            },
        )
    )
    with pytest.raises(ModelStreamingUnsupportedError):
        _ = [
            chunk
            async for chunk in provider.stream_chat_completion(model="writer", messages=MESSAGES)
        ]


async def test_gateway_that_ignores_streaming_returns_its_single_completion():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "Complete"}}]})

    chunks = [
        chunk
        async for chunk in client(handler).stream_chat_completion(model="writer", messages=MESSAGES)
    ]
    assert [chunk.text for chunk in chunks] == ["Complete"]
    assert len(calls) == 1


@pytest.mark.parametrize(
    "body",
    [
        "data: {bad}\n\n",
        'data: {"error":{"message":"PRIVATE"}}\n\n',
        frame("Cut off", finish="length"),
    ],
)
async def test_malformed_or_incomplete_provider_stream_is_not_success(body):
    with pytest.raises(ModelProviderError) as failure:
        _ = [
            chunk
            async for chunk in client(
                lambda _: httpx.Response(200, text=body)
            ).stream_chat_completion(model="writer", messages=MESSAGES)
        ]
    assert "PRIVATE" not in failure.value.public_message


async def test_closing_consumer_closes_the_provider_connection():
    stream = ByteStream(frame("First") + frame("Second", finish="stop"))
    provider = client(lambda _: httpx.Response(200, stream=stream))
    chunks = provider.stream_chat_completion(model="writer", messages=MESSAGES)
    assert (await anext(chunks)).text == "First"
    await chunks.aclose()
    assert stream.closed
