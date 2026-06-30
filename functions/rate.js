const FALLBACK_RATE = 0.2080;
const HISTORICAL_BASELINE = 0.2260;

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function daysAgoDate(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

async function fetchSinaRate() {
  var resp = await fetch('https://hq.sinajs.cn/list=fx_sjpycny', {
    headers: { 'Referer': 'https://finance.sina.com.cn' },
    cf: { cacheTtl: 600, cacheEverything: true },
  });
  if (!resp.ok) throw new Error('Sina API error');
  var text = await resp.text();
  var m = text.match(/"([^"]+)"/);
  if (!m) throw new Error('Sina parse error');
  var parts = m[1].split(',');
  var rateCny = parseFloat(parts[1]);
  if (isNaN(rateCny) || rateCny <= 0) throw new Error('Invalid rate: ' + parts[1]);
  // 新浪 JPY/CNY → 转换为 JPY/TWD（约 ÷0.22 ×1 ≈ ×4.8）
  // 1 CNY ≈ 4.8 TWD，固定参考央行汇率
  var rate = rateCny * 4.8;
  return rate;
}

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
  };

  try {
    var currentRate, histRate;

    try {
      currentRate = await fetchSinaRate();
    } catch (e) {
      currentRate = null;
    }
    if (!currentRate) {
      try {
        var r = await fetch('https://open.er-api.com/v6/latest/JPY', { cf: { cacheTtl: 3600, cacheEverything: true } });
        if (r.ok) { var d = await r.json(); currentRate = d.rates?.TWD; }
      } catch (e) {}
    }
    if (!currentRate) currentRate = FALLBACK_RATE;

    try {
      var histDate = daysAgoDate(10);
      var hr = await fetch('https://api.frankfurter.app/' + histDate + '?from=JPY&to=TWD', { cf: { cacheTtl: 86400, cacheEverything: true } });
      if (hr.ok) { var hd = await hr.json(); histRate = hd.rates?.TWD; }
    } catch (e) {}
    if (!histRate) histRate = HISTORICAL_BASELINE;

    return new Response(JSON.stringify({
      jpyTwd: currentRate,
      jpyTwd10dAgo: histRate,
      updatedAt: new Date().toISOString(),
      source: 'live',
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600',
        ...corsHeaders,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      jpyTwd: FALLBACK_RATE,
      jpyTwd10dAgo: HISTORICAL_BASELINE,
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
