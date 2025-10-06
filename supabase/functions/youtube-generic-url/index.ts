import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to detect platform from URL
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('vimeo.com')) return 'vimeo';
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
  if (urlLower.includes('dailymotion.com')) return 'dailymotion';
  if (urlLower.includes('twitch.tv')) return 'twitch';
  return 'generic';
}

// Helper function to get video info using a working RapidAPI service
async function getVideoInfo(videoUrl: string, platform: string): Promise<{ downloadUrl?: string; transcript?: string; title?: string }> {
  try {
    console.log('Getting video info for:', videoUrl, 'Platform:', platform);
    
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      throw new Error('RAPIDAPI_KEY is not configured');
    }

    // Use a simple and reliable video info extractor
    const response = await fetch('https://ytstream-download-youtube-videos.p.rapidapi.com/dl', {
      method: 'POST',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        id: videoUrl
      })
    });

    if (!response.ok) {
      // If the primary API fails, try an alternative approach
      console.log('Primary API failed, trying alternative...');
      return await tryAlternativeExtraction(videoUrl, platform, rapidApiKey);
    }

    const data = await response.json();
    console.log('Video info retrieved successfully');

    // Extract relevant information
    const title = data.title || 'Unknown Video';
    
    // Look for audio or video URLs in the response
    let downloadUrl = '';
    if (data.link && Array.isArray(data.link)) {
      // Find the best quality audio/video link
      const audioLink = data.link.find((l: any) => l.type === 'audio' || l.mime?.includes('audio'));
      const videoLink = data.link.find((l: any) => l.type === 'video' || l.mime?.includes('video'));
      downloadUrl = audioLink?.link || videoLink?.link || data.link[0]?.link || '';
    }

    return { downloadUrl, title };

  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
}

// Alternative extraction method using a different API
async function tryAlternativeExtraction(videoUrl: string, platform: string, rapidApiKey: string): Promise<{ downloadUrl?: string; transcript?: string; title?: string }> {
  try {
    // Use a more generic social media downloader
    const response = await fetch('https://social-media-video-downloader.p.rapidapi.com/smvd/get/all', {
      method: 'POST',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        url: videoUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Alternative API failed: ${response.status}`);
    }

    const data = await response.json();
    
    const title = data.title || `${platform} video`;
    let downloadUrl = '';
    
    if (data.links && data.links.length > 0) {
      downloadUrl = data.links[0].link;
    }

    return { downloadUrl, title };

  } catch (error) {
    console.error('Alternative extraction failed:', error);
    throw new Error(`Could not extract video from ${platform}. The video might be private or geo-restricted.`);
  }
}

// Helper function to transcribe audio using OpenAI Whisper API
async function transcribeFromUrl(audioUrl: string, title: string): Promise<string> {
  try {
    console.log('Downloading audio for transcription...');
    
    // Download the audio/video file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    console.log('Audio downloaded, size:', audioBuffer.byteLength);

    // Check file size (25MB limit for Whisper)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBuffer.byteLength > maxSize) {
      throw new Error('Audio file is too large for transcription (max 25MB)');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Create File object for Whisper API
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    const audioFile = new File([audioBuffer], fileName, { type: 'video/mp4' });

    // Create FormData for Whisper API
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    console.log('Calling OpenAI Whisper API...');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', whisperResponse.status, errorText);
      throw new Error(`Transcription failed: ${whisperResponse.status}`);
    }

    const transcript = await whisperResponse.text();
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcript generated - the video might not contain speech');
    }

    console.log('Transcription successful, length:', transcript.length);
    return transcript.trim();

  } catch (error) {
    console.error('Error during transcription:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generic URL function invoked...');
    
    const { videoUrl, customPrompt } = await req.json();
    
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Video URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect platform
    const platform = detectPlatform(videoUrl);
    console.log('Detected platform:', platform);

    // Redirect YouTube URLs to the dedicated function
    if (platform === 'youtube') {
      return new Response(
        JSON.stringify({ 
          error: 'Please use the YouTube tab for YouTube videos - it\'s faster and more reliable for YouTube content.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video information and download URL
    const { downloadUrl, title } = await getVideoInfo(videoUrl, platform);
    
    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ 
          error: `Unable to process this ${platform} video. It might be private, geo-restricted, or in an unsupported format.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transcribe the audio
    const transcript = await transcribeFromUrl(downloadUrl, title || 'video');
    
    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Could not transcribe the video audio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcript length:', transcript.length);

    // Generate AI summary using the transcript
    const userPrompt = customPrompt || `Summarize this ${platform} video content`;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Calling OpenAI API for summarization...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a helpful assistant that analyzes video transcripts from ${platform}. Provide clear, concise, and well-structured responses.`
          },
          { 
            role: 'user', 
            content: `${userPrompt}\n\nTranscript:\n${transcript}`
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', openAIResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI analysis failed: ${openAIResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await openAIResponse.json();
    const result = aiData.choices[0].message.content;

    console.log('Successfully generated AI response');

    return new Response(
      JSON.stringify({ result, transcript, platform, title }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in youtube-generic-url function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    // Provide helpful error messages
    let userFriendlyError = errorMessage;
    if (errorMessage.includes('RAPIDAPI_KEY')) {
      userFriendlyError = 'Video processing service is not configured properly.';
    } else if (errorMessage.includes('private') || errorMessage.includes('geo-restricted')) {
      userFriendlyError = 'This video cannot be accessed. It might be private, geo-restricted, or require authentication.';
    } else if (errorMessage.includes('too large')) {
      userFriendlyError = 'The video file is too large for processing (maximum 25MB).';
    } else if (errorMessage.includes('no speech')) {
      userFriendlyError = 'No speech was detected in this video.';
    }
    
    return new Response(
      JSON.stringify({ error: userFriendlyError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});