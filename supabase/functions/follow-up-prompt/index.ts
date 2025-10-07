import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Follow-up prompt function invoked');
    const { prompt, context } = await req.json();
    
    console.log('Received follow-up prompt:', prompt);
    console.log('Context length:', context?.length || 0);
    
    if (!prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build the system message with context
    let systemMessage = 'You are a helpful assistant that analyzes and answers questions about media transcripts and previous analyses. ';
    systemMessage += 'Provide clear, concise, and well-structured responses based on the conversation history provided.';

    // Build the user message with context and new prompt
    let userMessage = '';
    if (context && context.trim()) {
      userMessage += context + '\n\n';
      userMessage += `Based on the above conversation history, please answer this follow-up question:\n\n`;
    } else {
      userMessage += 'Please answer this question:\n\n';
    }
    userMessage += prompt;

    console.log('Calling OpenAI API for follow-up analysis...');

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
            content: systemMessage
          },
          { 
            role: 'user', 
            content: userMessage
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.7,
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

    console.log('Successfully generated follow-up response');

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in follow-up-prompt function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});