const AZURE_TTS_URL = 'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1';
const DEFAULT_VOICE = 'es-AR-TomasNeural';

export const runtime = 'nodejs';

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export async function POST(request: Request) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const voice = process.env.AZURE_SPEECH_VOICE || DEFAULT_VOICE;

  if (!key || !region) {
    return Response.json({ error: 'TTS is not configured' }, { status: 503 });
  }

  let text = '';
  try {
    const body = await request.json();
    text = typeof body.text === 'string' ? body.text.trim() : '';
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: 'Missing text' }, { status: 400 });
  }

  if (text.length > 700) {
    return Response.json({ error: 'Text is too long' }, { status: 413 });
  }

  const ssml = [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-AR">',
    `<voice name="${escapeXml(voice)}">`,
    '<prosody rate="-8%" pitch="-4%">',
    escapeXml(text),
    '</prosody>',
    '</voice>',
    '</speak>',
  ].join('');

  const response = await fetch(AZURE_TTS_URL.replace('{region}', region), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': key,
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'origin-vercel-game',
    },
    body: ssml,
  });

  if (!response.ok) {
    return Response.json({ error: 'TTS provider failed' }, { status: 502 });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      'Cache-Control': 'private, max-age=86400',
      'Content-Type': 'audio/mpeg',
    },
  });
}
