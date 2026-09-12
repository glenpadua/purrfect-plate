"""Bounded anonymous metadata/subtitle adapter. Media downloads happen in Node's
DNS-pinned public URL client. No browser cookies, saved sessions or user config.
"""
import contextlib
import io
import json
import os
import re
import sys
from urllib.parse import parse_qs, urlparse


def canonical_source(value):
    u = urlparse(value)
    if u.scheme != 'https' or u.username or u.password or u.port not in (None, 443):
        raise ValueError('Unsupported social URL')
    host = (u.hostname or '').lower()
    if host in ('instagram.com', 'www.instagram.com'):
        match = re.fullmatch(r'/(?:p|reel|tv)/([A-Za-z0-9_-]+)/?', u.path)
        if match:
            return 'instagram', match[1], 'https://www.instagram.com/p/' + match[1] + '/'
    if host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'):
        video_id = u.path.strip('/') if host == 'youtu.be' else (u.path.split('/')[-1] if u.path.startswith(('/shorts/', '/embed/')) else parse_qs(u.query).get('v', [''])[0])
        if re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
            return 'youtube', video_id, 'https://www.youtube.com/watch?v=' + video_id
    if host in ('tiktok.com', 'www.tiktok.com'):
        match = re.fullmatch(r'/(@[A-Za-z0-9_.]+)/video/(\d+)/?', u.path)
        if match:
            return 'tiktok', match[2], 'https://www.tiktok.com/' + match[1] + '/video/' + match[2]
    raise ValueError('Use a full public Instagram post, YouTube video, or TikTok video URL.')


class QuietLogger:
    def debug(self, message): pass
    def warning(self, message): pass
    def error(self, message): pass


def select_video(formats):
    # Portrait 540p clips are often 576x1024: resolution uses the short side.
    known = [f for f in formats if f.get('vcodec') not in (None, 'none')
             and 0 < min(f.get('width') or 0, f.get('height') or 0) <= 720]
    combined = [f for f in known if f.get('acodec') not in (None, 'none')]
    if combined:
        return min(combined, key=lambda f: f.get('tbr') or float('inf'))
    if known:
        return max(known, key=lambda f: min(f['width'], f['height']))
    return next((f for f in formats if f.get('vcodec') not in (None, 'none')), None)


def retrieve(value, include_transcript):
    import yt_dlp
    from js_runtime import node_path
    platform, source_id, url = canonical_source(value)
    result = {'caption': '', 'images': [], 'warnings': [], 'transcript': ''}
    # Photo-aware retrieval first: yt-dlp rejects still-only carousels.
    if platform == 'instagram':
        try:
            import instaloader
            loader = instaloader.Instaloader(max_connection_attempts=1, request_timeout=10, quiet=True)
            post = instaloader.Post.from_shortcode(loader.context, source_id)
            result.update(caption=post.caption or '', author=post.owner_username)
            if post.typename == 'GraphSidecar':
                nodes = list(post.get_sidecar_nodes())
                result['images'] = [{'url': n.display_url, 'index': i + 1} for i, n in enumerate(nodes[:10]) if not n.is_video]
                videos = [n.video_url for n in nodes if n.is_video]
                if videos:
                    result['videoUrl'] = videos[0]
                    result['warnings'].append('Only the first video in this mixed carousel is processed.')
                if len(nodes) > 10:
                    result['warnings'].append('Only the first ten carousel items are processed.')
                return result
            if not post.is_video:
                result['images'] = [{'url': post.url, 'index': 1}]
                return result
            result['videoUrl'] = post.video_url
            return result
        except Exception:
            result['warnings'].append('Anonymous Instagram photo adapter unavailable; trying video adapter.')

    options = {'quiet': True, 'no_warnings': True, 'logger': QuietLogger(), 'socket_timeout': 10,
               'retries': 0, 'extractor_retries': 0, 'skip_download': True, 'noplaylist': True,
               'cachedir': False, 'js_runtimes': {'node': {'path': node_path()}},
               'ignore_no_formats_error': platform == 'youtube'}
    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            data = downloader.extract_info(url, download=False)
            # Only cookies created by this fresh anonymous extraction session.
            cookies = [{'name': c.name, 'value': c.value, 'domain': c.domain,
                        'path': c.path or '/', 'secure': c.secure,
                        'hostOnly': not c.domain_specified, 'expires': c.expires}
                       for c in downloader.cookiejar]
        result.update(caption=data.get('description') or '', title=data.get('title'), author=data.get('uploader'), duration=data.get('duration'))
        formats = data.get('formats') or []
        direct = [f for f in formats if f.get('protocol') == 'https' and f.get('url', '').startswith('https:')]
        video = select_video(direct)
        audio = [f for f in direct if f.get('vcodec') == 'none' and f.get('ext') in ('m4a', 'webm')]
        if video:
            result['videoUrl'] = video['url']
            result['videoHasAudio'] = video.get('acodec') not in (None, 'none')
            headers = video.get('http_headers') or data.get('http_headers') or {}
            result['mediaSession'] = {'cookies': cookies, 'userAgent': headers.get('User-Agent'), 'referer': url}
        if audio:
            result['audioUrl'] = min(audio, key=lambda f: f.get('abr') or 100)['url']
    except Exception as error:
        result['warnings'].append('Anonymous video adapter could not retrieve this public post.')
        result.setdefault('diagnostics', []).append(re.sub(r'https?://\S+', '[URL]', str(error))[:500])

    if platform == 'youtube' and include_transcript:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            tracks = list(YouTubeTranscriptApi().list(source_id))
            track = next((t for t in tracks if t.language_code.startswith('en')), tracks[0])
            chunks = track.fetch().to_raw_data()
            result['transcript'] = '\n'.join(c['text'] for c in chunks)
            result['transcriptLanguage'] = track.language_code
        except Exception as error:
            result['warnings'].append('Existing subtitle retrieval unavailable; audio transcription may still work.')
            result.setdefault('diagnostics', []).append(re.sub(r'https?://\S+', '[URL]', str(error))[:500])
    return result


if __name__ == '__main__':
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            if sys.argv[1] == '--ffmpeg':
                import imageio_ffmpeg
                result = {'ffmpeg': imageio_ffmpeg.get_ffmpeg_exe()}
            else:
                result = retrieve(sys.argv[1], '--transcript' in sys.argv[2:])
        print(json.dumps(result))
    except Exception as error:
        # Library errors may include signed URLs; expose only a bounded generic failure.
        print(json.dumps({'error': 'Local social retrieval failed (' + type(error).__name__ + ').'}))
        sys.exit(1)
