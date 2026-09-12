"""Bounded download/FFmpeg/speech processing on the same host as retrieval."""
import base64
import ipaddress
import math
import os
from pathlib import Path
import socket
import subprocess
import tempfile
from urllib.parse import urlparse

import imageio_ffmpeg
import requests

MEDIA_DOMAINS = ('googlevideo.com', 'youtube.com', 'tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'ibytedtos.com', 'byteoversea.com', 'cdninstagram.com', 'fbcdn.net')


def media_url(value):
    u = urlparse(value)
    host = u.hostname or ''
    if u.scheme != 'https' or u.username or u.password or u.port not in (None, 443) or not any(host == d or host.endswith('.' + d) for d in MEDIA_DOMAINS):
        raise ValueError('Unsupported media host')
    if any(not ipaddress.ip_address(a[4][0]).is_global for a in socket.getaddrinfo(host, 443)):
        raise ValueError('Non-public media address')
    return value


def download(url, filename, metadata):
    session = requests.Session()
    context = metadata.get('mediaSession') or {}
    session.headers.update({'User-Agent': context.get('userAgent') or 'Mozilla/5.0', 'Referer': context.get('referer') or 'https://www.instagram.com/'})
    for c in context.get('cookies', []):
        session.cookies.set(c['name'], c['value'], domain=c['domain'], path=c['path'], secure=c['secure'])
    try:
        for _ in range(5):
            response = session.get(media_url(url), timeout=(10, 30), stream=True, allow_redirects=False)
            if response.is_redirect:
                from urllib.parse import urljoin
                url = urljoin(url, response.headers['Location'])
                response.close()
                continue
            response.raise_for_status()
            size = 0
            with response, open(filename, 'wb') as output:
                for chunk in response.iter_content(128 * 1024):
                    size += len(chunk)
                    if size > 75_000_000:
                        raise ValueError('Video exceeds 75 MB')
                    output.write(chunk)
            return filename
        raise ValueError('Too many media redirects')
    finally:
        session.close()


def analyze(metadata, include_audio=True, include_frames=True):
    duration = metadata.get('duration') or 600
    if duration > 600:
        raise ValueError('Videos longer than ten minutes are not supported yet')
    result = {'transcript': metadata.get('transcript', ''), 'frames': [], 'warnings': []}
    needs_audio = include_audio and not result['transcript']
    with tempfile.TemporaryDirectory(prefix='recipe-media-') as directory:
        root = Path(directory)
        video = None
        if metadata.get('videoUrl') and (include_frames or needs_audio):
            try:
                video = download(metadata['videoUrl'], root / 'video.mp4', metadata)
            except Exception:
                result['warnings'].append('The source video could not be downloaded from the hosting network.')
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

        def convert(args):
            subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-protocol_whitelist', 'file,pipe', *map(str, args)], check=True, timeout=35, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if needs_audio:
            audio_source = video if metadata.get('videoHasAudio', True) else None
            if not audio_source and metadata.get('audioUrl'):
                try:
                    audio_source = download(metadata['audioUrl'], root / 'audio-source', metadata)
                except Exception:
                    result['warnings'].append('The source audio could not be downloaded.')
            if audio_source:
                try:
                    wav = root / 'audio.wav'
                    convert(['-i', audio_source, '-t', duration, '-vn', '-ac', 1, '-ar', 16000, wav])
                    with wav.open('rb') as audio:
                        response = requests.post('https://api.openai.com/v1/audio/transcriptions', headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']}, data={'model': 'gpt-4o-mini-transcribe'}, files={'file': ('audio.wav', audio, 'audio/wav')}, timeout=(10, 90))
                    response.raise_for_status()
                    result['transcript'] = response.json().get('text', '')
                    result['transcriptVia'] = 'gpt-4o-mini-transcribe'
                except Exception:
                    result['warnings'].append('Speech transcription was unavailable. Caption and image evidence are still retained.')
        if video and include_frames:
            interval = max(4, math.ceil(duration / 20))
            try:
                convert(['-i', video, '-t', duration, '-vf', f'fps=1/{interval},scale=640:-2', '-frames:v', 20, root / 'frame-%03d.jpg'])
                total = 0
                for index, frame in enumerate(sorted(root.glob('frame-*.jpg'))):
                    data = frame.read_bytes()
                    total += len(data)
                    if total > 2_000_000:
                        result['warnings'].append('Frame sampling was limited by image size.')
                        break
                    result['frames'].append({'label': f'Near {index * interval + interval / 2}s', 'imageUrl': 'data:image/jpeg;base64,' + base64.b64encode(data).decode()})
            except Exception:
                result['warnings'].append('Video frames could not be decoded.')
    return result
