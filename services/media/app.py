"""Private media adapter. Never expose social session cookies to app clients."""
import contextlib
import hmac
import io
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from retrieval import retrieve, canonical_source
from processing import analyze
from youtube_gemini import youtube_fallback

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class SourceRequest(BaseModel):
    url: str = Field(max_length=2048)
    includeTranscript: bool = True
    includeFrames: bool = True


def authenticate(authorization):
    secret = os.environ.get('MEDIA_WORKER_SECRET', '')
    if not secret or not hmac.compare_digest(authorization or '', 'Bearer ' + secret):
        raise HTTPException(status_code=401, detail='Unauthorized')


@app.get('/health')
def health():
    return {'service': 'recipe-media', 'version': 1}


@app.post('/metadata')
def metadata(body: SourceRequest, authorization: str | None = Header(default=None)):
    authenticate(authorization)
    try:
        canonical_source(body.url)
    except ValueError:
        raise HTTPException(status_code=422, detail='Use a supported public social link.')
    # Third-party diagnostics may contain signed media URLs. Keep them private.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        return retrieve(body.url, body.includeTranscript)


@app.post('/analyze')
def analyze_source(body: SourceRequest, authorization: str | None = Header(default=None)):
    data = metadata(body, authorization)
    processed = None
    fallback_failed = False
    try:
        processed = youtube_fallback(body.url, data, body.includeTranscript, body.includeFrames)
        if processed and (processed.get('transcript') or processed.get('videoText')):
            unavailable_native = {'Existing subtitle retrieval unavailable; audio transcription may still work.',
                                  'Anonymous video adapter could not retrieve this public post.'}
            data['warnings'] = [warning for warning in data.get('warnings', []) if warning not in unavailable_native]
    except ValueError as error:
        fallback_failed = True
        # Preserve any native caption evidence when the optional provider fails.
        data.setdefault('warnings', []).append(str(error))
    try:
        if processed is None:
            processed = analyze(data, body.includeTranscript, body.includeFrames)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    # Do not send session cookies or signed video URLs beyond the media adapter.
    return {key: data.get(key) for key in ('title', 'author', 'caption', 'images', 'transcriptLanguage')} | {
        **processed, 'warnings': data.get('warnings', []) + processed['warnings'],
        'analysisUnavailable': fallback_failed and not any(processed.get(key) for key in ('transcript', 'frames', 'videoText'))
    }
