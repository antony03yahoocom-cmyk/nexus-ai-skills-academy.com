// AI proposal assistant — generates a tailored cover proposal for a marketplace opportunity.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { opportunityTitle, opportunityDescription, requiredSkills, studentHeadline, studentBio, studentSkills } =
      await req.json();

    if (!opportunityTitle || !opportunityDescription) {
      return new Response(JSON.stringify({ error: 'Missing opportunity fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a career coach helping a Kenyan digital-skills student write a concise, confident, personalized proposal (140-220 words) for a marketplace opportunity. Tone: warm, professional, specific. No emojis. No filler. End with a clear next step.`;

    const userPrompt = `OPPORTUNITY
Title: ${opportunityTitle}
Description: ${opportunityDescription}
Required skills: ${(requiredSkills || []).join(', ') || 'unspecified'}

STUDENT
Headline: ${studentHeadline || 'Aspiring professional'}
Bio: ${studentBio || 'n/a'}
Skills: ${(studentSkills || []).join(', ') || 'n/a'}

Write the proposal now.`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: 'AI request failed', detail: text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const proposal = data.choices?.[0]?.message?.content?.trim() ?? '';

    return new Response(JSON.stringify({ proposal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
