// "나를 초대한 친구" 목록 — list.js(내가 초대해서 등록한 친구)의 반대 방향입니다.
// invite_redemptions에서 내가 invitee인 행을 찾아 inviter_device_id를 모으고,
// 각 inviter가 /api/device/save-saju 로 올려둔 자신의 사주(devices.saju_opts)를 가져와 합쳐 돌려줍니다.
// inviter가 (이 기능이 생기기 전에 초대했거나, 아직 한 번도 자기 사주를 다시 제출하지 않아서)
// saju_opts가 비어 있으면 그 카드는 내려주지 않습니다 — 보여줄 사주 데이터가 없기 때문입니다.

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
      '/invite_redemptions?invitee_device_id=eq.' +
        encodeURIComponent(deviceId) +
        '&select=inviter_device_id,created_at&order=created_at.desc&limit=60',
      { method: 'GET' }
    );
    if (!r.ok) {
      const text = await r.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'QUERY_FAILED', message: text });
      return;
    }
    const rows = await r.json();
    if (!rows.length) {
      res.status(200).json({ ok: true, rows: [] });
      return;
    }

    const ids = Array.from(new Set(rows.map(function (row) { return row.inviter_device_id; })));
    const idList = ids.map(encodeURIComponent).join(',');
    const dr = await sbFetch('/devices?device_id=in.(' + idList + ')&select=device_id,saju_opts', {
      method: 'GET'
    });
    const devices = dr.ok ? await dr.json() : [];
    const sajuById = {};
    devices.forEach(function (d) {
      if (d.saju_opts) sajuById[d.device_id] = d.saju_opts;
    });

    const out = rows
      .map(function (row) {
        const saju = sajuById[row.inviter_device_id];
        if (!saju) return null;
        return { inviter_device_id: row.inviter_device_id, inviter_saju: saju, created_at: row.created_at };
      })
      .filter(Boolean);

    res.status(200).json({ ok: true, rows: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
