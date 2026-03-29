import os
import httpx

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech"


def generate_speech(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID")
    model_id = os.getenv("ELEVENLABS_MODEL_ID")

    response = httpx.post(
        f"{ELEVENLABS_BASE_URL}/{voice_id}",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "model_id": model_id,
        },
        timeout=30.0,
    )

    response.raise_for_status()
    return response.content
