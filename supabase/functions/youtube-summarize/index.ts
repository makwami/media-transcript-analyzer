import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract YouTube video ID
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Helper function to fetch YouTube transcript using youtube-transcript-api approach
async function getTranscript(videoId: string): Promise<string> {
  try {
    console.log('Fetching transcript for video:', videoId);
    
    // Fetch the video page
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video page: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Fetched video page, size:', html.length);
    
    // Extract the player response JSON from the page
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
    if (!playerResponseMatch) {
      throw new Error('Could not find player response data in video page');
    }
    
    let playerResponse;
    try {
      playerResponse = JSON.parse(playerResponseMatch[1]);
    } catch (e) {
      throw new Error('Failed to parse player response JSON');
    }
    
    // Get captions data
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks) {
      throw new Error('No captions available for this video. The video may not have subtitles or captions enabled.');
    }
    
    console.log('Found caption tracks:', captions.captionTracks.length);
    
    // Find English captions
    let captionTrack = captions.captionTracks.find((track: any) => 
      track.languageCode?.startsWith('en')
    );
    
    if (!captionTrack) {
      captionTrack = captions.captionTracks[0]; // Fallback to first available
    }
    
    console.log('Using caption track:', captionTrack.languageCode);
    
    // Fetch the caption data
    const captionUrl = captionTrack.baseUrl;
    const captionResponse = await fetch(captionUrl);
    
    if (!captionResponse.ok) {
      throw new Error(`Failed to fetch captions: ${captionResponse.status}`);
    }
    
    const captionXml = await captionResponse.text();
    console.log('Fetched caption XML, size:', captionXml.length);
    
    // Parse the XML to extract text
    const transcript = parseTranscriptXML(captionXml);
    
    if (!transcript || transcript.length < 10) {
      throw new Error('Failed to extract meaningful transcript from captions');
    }
    
    console.log('Successfully extracted transcript, length:', transcript.length);
    return transcript;
    
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

// Helper function to parse transcript XML
function parseTranscriptXML(xml: string): string {
  try {
    const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
    let transcript = '';
    
    for (const match of textMatches) {
      const text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\n/g, ' ')
        .trim();
      
      if (text) {
        transcript += text + ' ';
      }
    }
    
    return transcript.trim();
  } catch (error) {
    console.error('Error parsing XML:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { youtubeUrl, customPrompt } = await req.json();
    console.log('Received request for URL:', youtubeUrl);
    
    if (!youtubeUrl) {
      return new Response(
        JSON.stringify({ error: 'YouTube URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted video ID:', videoId);

    const transcript = await getTranscript(videoId);
    
    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Could not extract transcript from this video' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcript length:', transcript.length);

    const userPrompt = customPrompt || 'Summarize this video';
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Calling OpenAI API...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant that analyzes YouTube video transcripts. Provide clear, concise, and well-structured responses.'
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
        JSON.stringify({ error: `OpenAI API error: ${openAIResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await openAIResponse.json();
    const result = aiData.choices[0].message.content;

    console.log('Successfully generated AI response');

    return new Response(
      JSON.stringify({ result, transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in youtube-summarize function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

