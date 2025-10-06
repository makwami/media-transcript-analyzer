import { YoutubeTranscript } from 'youtube-transcript';

export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

export const analyzeYoutubeVideo = async (
  youtubeUrl: string,
  customPrompt: string = "Summarize this video"
): Promise<string> => {
  const videoId = extractVideoId(youtubeUrl);
  
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  // Fetch transcript
  const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
  const transcript = transcriptData.map(item => item.text).join(' ');

  if (!transcript) {
    throw new Error("Could not fetch transcript. Make sure the video has captions enabled.");
  }

  // Call OpenAI API
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env.local file");
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes YouTube video transcripts.',
        },
        {
          role: 'user',
          content: `${customPrompt}\n\nTranscript:\n${transcript}`,
        },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to analyze video');
  }

  const data = await response.json();
  return data.choices[0].message.content;
};
