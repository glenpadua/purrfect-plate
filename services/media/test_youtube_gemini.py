import json
import unittest
from unittest.mock import patch
from unittest.mock import MagicMock
from types import SimpleNamespace
from youtube_gemini import parse_evidence, youtube_fallback, analyze_youtube


def interaction(**changes):
    evidence = {'videoAccessible': True, 'title': 'Bowl',
                'spokenPassages': [{'seconds': 1, 'text': 'Add 2 eggs.'}],
                'visibleText': [{'seconds': 4, 'text': '180 C'}],
                'visualObservations': [{'seconds': 2, 'text': 'A red powder is added.'}],
                'missingInformation': ['Cooking duration is not stated.']}
    evidence.update(changes)
    return {'status': 'completed', 'steps': [{'type': 'model_output', 'content': [
        {'type': 'text', 'text': json.dumps(evidence)}]}],
        'usage': {'total_input_tokens': 10, 'total_output_tokens': 20}}


class YouTubeEvidenceTests(unittest.TestCase):
    def test_speech_and_printed_text_remain_separate_from_visual_guesses(self):
        result = parse_evidence(interaction(), 'gemini-3.8-flash')
        self.assertEqual(result['transcript'], 'Add 2 eggs.')
        self.assertEqual(result['videoText'], [{'seconds': 4, 'text': '180 C'}])
        self.assertEqual(result['visualObservations'], [{'seconds': 2, 'text': 'A red powder is added.'}])
        self.assertIn('Gemini', result['transcriptVia'])
        self.assertNotIn('red powder', result['transcript'])

    def test_music_only_clip_does_not_become_a_recipe_transcript(self):
        result = parse_evidence(interaction(spokenPassages=[], visibleText=[]), 'gemini-3.8-flash')
        self.assertEqual(result['transcript'], '')
        self.assertTrue(any('no readable' in text.lower() for text in result['warnings']))

    def test_visual_ingredient_guesses_cannot_leak_through_missing_information_warnings(self):
        result = parse_evidence(interaction(missingInformation=['Exact amount of the visually guessed saffron.']), 'gemini-3.6-flash')
        self.assertNotIn('saffron', ' '.join(result['warnings']))
        self.assertTrue(any('not clearly stated' in warning for warning in result['warnings']))

    def test_inaccessible_incomplete_and_malformed_results_are_rejected(self):
        for response in [interaction(videoAccessible=False), interaction(spokenPassages=[{'seconds': -1, 'text': 'Bad'}]),
                         interaction(visibleText=[{'seconds': 1, 'text': 'x' * 3001}]),
                         {'status': 'incomplete', 'steps': []}, interaction(missingInformation='not a list')]:
            with self.subTest(response=response), self.assertRaises(ValueError):
                parse_evidence(response, 'gemini-3.8-flash')

    def test_full_passage_lengths_are_bounded_before_storage(self):
        response = interaction(spokenPassages=[{'seconds': index, 'text': 'x' * 3000} for index in range(30)])
        with self.assertRaises(ValueError):
            parse_evidence(response, 'gemini-3.8-flash')

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    @patch('youtube_gemini.analyze_youtube')
    def test_fallback_runs_only_for_missing_youtube_media_and_preserves_native_speech(self, adapter):
        url = 'https://www.youtube.com/watch?v=_qFZJjnN73o'
        self.assertIsNone(youtube_fallback(url, {'videoUrl': 'available', 'transcript': 'Native'}))
        self.assertIsNone(youtube_fallback('https://www.instagram.com/p/DdJyDKhKk1i/', {}))
        adapter.assert_not_called()
        adapter.return_value = parse_evidence(interaction(), 'gemini-3.8-flash')
        result = youtube_fallback(url, {'transcript': 'Native transcript', 'duration': 62})
        adapter.assert_called_once_with(url, 62)
        self.assertEqual(result['transcript'], 'Native transcript')
        self.assertEqual(result['transcriptVia'], 'Existing video subtitles')
        self.assertTrue(result['videoText'])

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    def test_long_video_is_rejected_before_provider_request(self):
        # requests is imported lazily; the production runtime has it installed.
        with patch.dict('sys.modules', {'requests': object()}):
            with self.assertRaisesRegex(ValueError, 'ten minutes'):
                analyze_youtube('https://www.youtube.com/watch?v=_qFZJjnN73o', 601)

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    def test_unknown_duration_is_clipped_at_api_boundary_and_warning_is_retained(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status_code = 200
        response.iter_content.return_value = [json.dumps(interaction()).encode()]
        post = MagicMock(return_value=response)
        with patch.dict('sys.modules', {'requests': SimpleNamespace(post=post, RequestException=ConnectionError)}):
            result = analyze_youtube('https://www.youtube.com/watch?v=_qFZJjnN73o')
        payload = post.call_args.kwargs['json']
        self.assertEqual(payload['input'][1]['processing']['end_offset'], '600s')
        self.assertFalse(payload['store'])
        self.assertTrue(any('first ten minutes' in warning for warning in result['warnings']))

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    def test_rate_limit_without_retry_after_does_not_trigger_another_paid_request(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status_code = 429
        post = MagicMock(return_value=response)
        with patch.dict('sys.modules', {'requests': SimpleNamespace(post=post, RequestException=ConnectionError)}):
            with self.assertRaisesRegex(ValueError, 'rate limit'):
                analyze_youtube('https://www.youtube.com/watch?v=_qFZJjnN73o')
        self.assertEqual(post.call_count, 1)


if __name__ == '__main__':
    unittest.main()
