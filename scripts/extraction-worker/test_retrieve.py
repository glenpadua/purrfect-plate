import unittest
from retrieve import canonical_source, select_video


class SourceBoundaryTests(unittest.TestCase):
    def test_portrait_combined_video_is_preferred_to_unknown_download_or_music(self):
        formats = [
            {'url': 'music', 'vcodec': 'none', 'acodec': 'aac'},
            {'url': 'download', 'vcodec': 'h264', 'acodec': 'aac'},
            {'url': 'portrait', 'vcodec': 'h264', 'acodec': 'aac', 'width': 576, 'height': 1024, 'tbr': 642},
            {'url': 'larger', 'vcodec': 'h264', 'acodec': 'aac', 'width': 576, 'height': 1024, 'tbr': 921},
        ]
        self.assertEqual(select_video(formats)['url'], 'portrait')

    def test_supported_links_are_canonicalized_without_tracking(self):
        self.assertEqual(canonical_source('https://youtube.com/shorts/_qFZJjnN73o?si=tracking')[2], 'https://www.youtube.com/watch?v=_qFZJjnN73o')
        self.assertEqual(canonical_source('https://www.instagram.com/reel/DdJyDKhKk1i/?utm_source=x')[2], 'https://www.instagram.com/p/DdJyDKhKk1i/')

    def test_untrusted_hosts_paths_and_credentials_never_reach_extractors(self):
        for url in [
            'https://www.instagram.com.attacker.example/p/DdJyDKhKk1i/',
            'https://user:pass@www.instagram.com/p/DdJyDKhKk1i/',
            'https://127.0.0.1/video/7351594254663159083',
            'file:///etc/passwd',
            'https://www.youtube.com/redirect?q=https://127.0.0.1',
            'https://www.instagram.com/p/../../private/',
            'https://www.tiktok.com/@user/video/not-a-number',
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                canonical_source(url)


if __name__ == '__main__':
    unittest.main()
