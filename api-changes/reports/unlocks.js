// 이 기기(device_id)가 실제로 결제해서 보유 중인 리포트 concept_id 목록 — 누구나 조회 가능한
// 공개 엔드포인트(device_id 자체가 추측 불가능한 무작위 문자열이라 안전).
// credit_ledger처럼 "아직 안 받은 줄만" 증분으로 주지 않고 매번 전체 목록을 돌려준다 —
// 리포트는 가짓수가 적고(기기당 결제 건수가 많아야 수십 건) 한 번 사면 영구 보유라 가볍다.

const { sbFetch, getQuery } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const q = getQuery(req);
  const deviceId = q.device_id || '';
  if (!deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_DEVICE_ID' });
    return;
  }

  try {
    const r = await sbFetch(
      '/report_unlocks?device_id=eq.' + encodeURIComponent(deviceId) + '&select=concept_id'
    );
    if (!r.ok) {
      res.status(500).json({ ok: false, error: 'QUERY_FAILED' });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows.map(function (row) { return row.concept_id; }) });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
