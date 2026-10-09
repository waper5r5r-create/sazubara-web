// 초대 관련 3개 엔드포인트(list/received/redeem)를 ?action= 으로 묶은 파일입니다.
// Vercel Hobby 플랜의 서버리스 함수 12개 제한 때문에 api/invite/list.js, api/invite/received.js,
// api/invite/redeem.js 3개였던 걸 이 파일 하나로 합쳤습니다 — 각 action의 동작 자체는 그대로입니다.
//
// GET  /api/invite?action=list&device_id=...     "내가 초대해서 실제로 사주를 등록한 친구" 목록(마이룸).
//   궁합 점수 자체는 계산하지 않고(이 기기는 초대한 사람의 사주를 모르므로) 친구의 입력값(invitee_saju)만
//   내려주면, 요청한 브라우저(초대한 사람)가 자기 사주와 비교해서 직접 계산합니다.
// GET  /api/invite?action=received&device_id=...  "나를 초대한 친구" 목록 — list의 반대 방향.
//   invite_redemptions에서 내가 invitee인 행을 찾아 inviter_device_id를 모으고,
//   각 inviter가 /api/device/save-saju 로 올려둔 자신의 사주(devices.saju_opts)를 가져와 합쳐 돌려줍니다.
//   inviter가 saju_opts를 아직 올리지 않았으면 그 카드는 내려주지 않습니다.
// POST /api/invite?action=redeem  body:{code, inviteeDeviceId, inviteeName, sajuOpts}
//   친구가 초대 링크로 들어와서 "자기 사주를 직접 입력"했을 때 호출됩니다.
//   - 이 기기(invitee)가 과거에 이미 어떤 초대로든 보너스를 적립해준 적이 있으면(=invitee_device_id unique 제약),
//     다시 호출돼도 또 적립되지 않습니다.
//   - 자기 자신의 초대코드로는 적립되지 않습니다(자기 초대 방지).
//   - 실제로 친구가 사주를 등록한 경우에만 초대한 사람(inviter)에게 +3 크레딧이 적립됩니다.

const { ensureDevice, insertLedger, sbFetch, getQuery, readJsonBody } = require('./_supabase');

const INVITE_BONUS = 3;

async function handleList(req, res) {
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
      '/invite_redemptions?inviter_device_id=eq.' +
        encodeURIComponent(deviceId) +
        '&select=invitee_device_id,invitee_name,invitee_saju,created_at&order=created_at.desc&limit=60',
      { method: 'GET' }
    );
    if (!r.ok) {
      const text = await r.text().catch(function () { return ''; });
      res.status(500).json({ ok: false, error: 'QUERY_FAILED', message: text });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
}

async function handleReceived(req, res) {
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
      const text = await r.text().catch(function () { return ''; });
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
}

async function handleRedeem(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const body = await readJsonBody(req);
  const { code, inviteeDeviceId, inviteeName, sajuOpts } = body || {};
  if (!code || !inviteeDeviceId || !sajuOpts || typeof sajuOpts !== 'object') {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }
  if (code === inviteeDeviceId) {
    res.status(400).json({ ok: false, error: 'SELF_INVITE' });
    return;
  }

  try {
    await ensureDevice(code);
    await ensureDevice(inviteeDeviceId);

    const insRes = await sbFetch('/invite_redemptions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        invite_code: code,
        inviter_device_id: code,
        invitee_device_id: inviteeDeviceId,
        invitee_name: String(inviteeName || '').slice(0, 40),
        invitee_saju: sajuOpts
      })
    });

    if (insRes.status === 409) {
      // 이 기기는 이미 예전에 (이 초대든 다른 초대든) 등록 보너스를 적립해줬음 — 정상, 중복 지급만 막음.
      res.status(200).json({ ok: true, credited: false, already: true });
      return;
    }
    if (!insRes.ok) {
      const text = await insRes.text().catch(function () { return ''; });
      res.status(500).json({ ok: false, error: 'INSERT_FAILED', message: text });
      return;
    }

    await insertLedger({ deviceId: code, amount: INVITE_BONUS, reason: '친구 초대 등록 보너스' });

    res.status(200).json({ ok: true, credited: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const q = getQuery(req);
  const action = q.action || '';
  if (action === 'list') return handleList(req, res);
  if (action === 'received') return handleReceived(req, res);
  if (action === 'redeem') return handleRedeem(req, res);
  res.status(400).json({ ok: false, error: 'UNKNOWN_ACTION' });
};
