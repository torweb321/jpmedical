const FALLBACK_RATE = 0.0465;
const HISTORICAL_BASELINE = 0.050;

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function daysAgoDate(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
  };

  async function fetchRate(url) {
    var resp = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!resp.ok) throw new Error('API error');
    var data = await resp.json();
    return data.rates?.CNY;
  }

  try {
    var currentRate, histRate;

    // Current rate from frankfurter (free, no key, supports historical)
    try {
      currentRate = await fetchRate('https://api.frankfurter.app/latest?from=JPY&to=CNY');
    } catch (e) {
      currentRate = null;
    }
    // Fallback to open.er-api.com
    if (!currentRate) {
      try {
        var r = await fetch('https://open.er-api.com/v6/latest/JPY', { cf: { cacheTtl: 3600, cacheEverything: true } });
        if (r.ok) { var d = await r.json(); currentRate = d.rates?.CNY; }
      } catch (e) {}
    }
    if (!currentRate) currentRate = FALLBACK_RATE;

    // Historical rate from 10 days ago
    try {
      var histDate = daysAgoDate(10);
      histRate = await fetchRate('https://api.frankfurter.app/' + histDate + '?from=JPY&to=CNY');
    } catch (e) {
      histRate = null;
    }
    if (!histRate) histRate = HISTORICAL_BASELINE;

    return new Response(JSON.stringify({
      jpyCny: currentRate,
      jpyCny10dAgo: histRate,
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
      jpyCny10dAgo: HISTORICAL_BASELINE,
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
