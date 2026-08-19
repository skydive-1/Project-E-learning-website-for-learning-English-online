import { describe, it, expect, vi, beforeEach } from 'vitest';
import { askChatbotAudio } from '../src/modules/chatbot/services/chatbot.service';
import apiClient from '../src/config/api.config';

vi.mock('../src/config/api.config', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('Frontend Chatbot Audio Service (askChatbotAudio)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send correct mode and targetText for Read Aloud request (V2)', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          version: 'speaking-v2',
          mode: 'read_aloud',
          overallScore: 92,
          components: { pronunciation: 90, contentAccuracy: 95, fluency: 90, completeness: 95 }
        }
      }
    });

    const mockBlob = new Blob(['audio content'], { type: 'audio/webm' });
    const res = await askChatbotAudio({
      audioBlob: mockBlob,
      lessonId: 10,
      mode: 'read_aloud',
      targetText: 'Welcome to the course'
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [endpoint, formData] = apiClient.post.mock.calls[0];
    expect(endpoint).toBe('/chatbot/audio');
    expect(formData.get('mode')).toBe('read_aloud');
    expect(formData.get('targetText')).toBe('Welcome to the course');
    expect(formData.get('lessonId')).toBe('10');
    expect(res.overallScore).toBe(92);
  });

  it('should send correct mode, questionText and questionId for Q&A request (V2)', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          version: 'speaking-v2',
          mode: 'qa',
          overallScore: 85,
          components: { relevance: 90, grammar: 85, vocabulary: 80, pronunciation: 85, fluency: 85 }
        }
      }
    });

    const mockBlob = new Blob(['audio content'], { type: 'audio/webm' });
    const res = await askChatbotAudio({
      audioBlob: mockBlob,
      lessonId: 15,
      mode: 'qa',
      questionText: 'How do you practice English?',
      questionId: 'q-101'
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [, formData] = apiClient.post.mock.calls[0];
    expect(formData.get('mode')).toBe('qa');
    expect(formData.get('questionText')).toBe('How do you practice English?');
    expect(formData.get('questionId')).toBe('q-101');
    expect(res.overallScore).toBe(85);
  });

  it('LEGACY CHATBOX SUPPORT: calling askChatbotAudio(audioBlob, lessonId) should auto-map mode=chat and return reply', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          mode: 'chat',
          transcription: 'What is lesson 1 about?',
          reply: 'Lesson 1 introduces basic conversation skills.'
        }
      }
    });

    const mockBlob = new Blob(['audio content'], { type: 'audio/webm' });
    const res = await askChatbotAudio(mockBlob, 1);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [, formData] = apiClient.post.mock.calls[0];
    expect(formData.get('mode')).toBe('chat');
    expect(res.reply).toBe('Lesson 1 introduces basic conversation skills.');
  });

  it('should throw an error on API network failure rather than returning score 0', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Network Error: Failed to fetch'));

    const mockBlob = new Blob(['audio content'], { type: 'audio/webm' });
    
    await expect(askChatbotAudio({
      audioBlob: mockBlob,
      lessonId: 1,
      mode: 'read_aloud',
      targetText: 'Test sentence'
    })).rejects.toThrow('Network Error: Failed to fetch');
  });
});
