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

// Helper function to fetch YouTube transcript
async function getTranscript(videoId: string): Promise<string> {
  try {
    console.log('Attempting to fetch transcript for video:', videoId);
    
    // Use YouTube's timedtext API directly
    const langs = ['en', 'en-US', 'en-GB'];
    
    for (const lang of langs) {
      try {
        const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
        console.log('Trying URL:', timedTextUrl);
        
        const response = await fetch(timedTextUrl);
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const xmlText = await response.text();
          console.log('Got XML response, length:', xmlText.length);
          
          if (xmlText && xmlText.includes('<text')) {
            const transcript = parseTranscriptXML(xmlText);
            if (transcript) {
              console.log('Successfully parsed transcript, length:', transcript.length);
              return transcript;
            }
          }
        }
      } catch (langError) {
        console.log(`Failed for lang ${lang}:`, langError);
        continue;
      }
    }
    
    // If direct API fails, try scraping the video page
    console.log('Direct API failed, trying video page scraping...');
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoPageResponse = await fetch(videoPageUrl);
    const html = await videoPageResponse.text();
    
    console.log('Got video page HTML');
    
    // Extract caption tracks from the page
    const captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/);
    
    if (captionTracksMatch) {
      console.log('Found captionTracks in HTML');
      const captionTracks = JSON.parse(captionTracksMatch[1]);
      
      if (captionTracks && captionTracks.length > 0) {
        // Get English caption or first available
        let captionTrack = captionTracks.find((track: any) => 
          track.languageCode === 'en' || track.languageCode === 'en-US'
        );
        
        if (!captionTrack) {
          captionTrack = captionTracks[0];
        }
        
        console.log('Using caption track:', captionTrack.languageCode);
        const captionUrl = captionTrack.baseUrl;
        
        const captionResponse = await fetch(captionUrl);
        const captionXml = await captionResponse.text();
        
        const transcript = parseTranscriptXML(captionXml);
        if (transcript) {
          console.log('Successfully got transcript from page scraping');
          return transcript;
        }
      }
    }
    
    throw new Error("No captions available for this video. Please ensure the video has English captions or auto-generated subtitles enabled.");
    
  } catch (error) {
    console.error('Error in getTranscript:', error);
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

