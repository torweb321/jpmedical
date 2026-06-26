const FALLBACK_RATE = 0.0465;

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
  };

  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/JPY', {
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    const cnyRate = data.rates?.CNY;
    if (!cnyRate) throw new Error('No CNY rate');
    return new Response(JSON.stringify({
      jpyCny: cnyRate,
      updatedAt: new Date().toISOString(),
      source: 'live',
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      jpyCny: FALLBACK_RATE,
      updatedAt: new Date().toISOString(),
      source: 'fallback',
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders,
      },
    });
  }
}
