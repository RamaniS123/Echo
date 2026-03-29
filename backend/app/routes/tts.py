import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.schemas import TTSRequest
from app.services.elevenlabs_service import generate_speech

router = APIRouter()


@router.post("/speak")
async def speak(body: TTSRequest):
    try:
        audio_bytes = generate_speech(body.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ElevenLabs error: {str(e)}")

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
    )
