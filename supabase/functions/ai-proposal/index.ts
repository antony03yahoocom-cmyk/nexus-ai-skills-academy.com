// AI proposal assistant — generates a tailored cover proposal for a marketplace opportunity.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_TEXT = 4000;
const MAX_LIST = 30;
const clip = (s: unknown, n = MAX_TEXT) => String(s ?? '').slice(0, n);
const clipList = (arr: unknown) =>
  Array.isArray(arr) ? arr.slice(0, MAX_LIST).map((x) => clip(x, 80)) : [];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const opportunityTitle = clip(body.opportunityTitle, 200);
    const opportunityDescription = clip(body.opportunityDescription, MAX_TEXT);
    const requiredSkills = clipList(body.requiredSkills);
    const studentHeadline = clip(body.studentHeadline, 200);
    const studentBio = clip(body.studentBio, MAX_TEXT);
    const studentSkills = clipList(body.studentSkills);

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
Required skills: ${requiredSkills.join(', ') || 'unspecified'}

STUDENT
Headline: ${studentHeadline || 'Aspiring professional'}
Bio: ${studentBio || 'n/a'}
Skills: ${studentSkills.join(', ') || 'n/a'}

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
      console.error('AI request failed', res.status, await res.text());
      return new Response(JSON.stringify({ error: 'AI request failed' }), {
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
    console.error('ai-proposal error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
