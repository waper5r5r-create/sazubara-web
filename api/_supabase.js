// 서버(Vercel 서버리스 함수)에서만 쓰는 Supabase 연결 헬퍼.
// SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트로 내려가지 않고, 이 파일을 통해서만 쓰입니다.
// npm 의존성 없이(zero-dependency) PostgREST(Supabase가 자동 제공하는 REST API)를 fetch로 직접 호출합니다.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restHeaders(extra) {
  return Object.assign(
    {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    extra || {}
  );
}

async function sbFetch(path, options) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('NO_SUPABASE_ENV');
  }
  options = options || {};
  return fetch(SUPABASE_URL + '/rest/v1' + path, {
    method: options.method || 'GET',
    headers: restHeaders(options.headers),
    body: options.body
  });
}

// device_id를 devices 테이블에 멱등하게(이미 있으면 무시) 기록해둔다 — 외래키 제약 때문에 필요.
async function ensureDevice(deviceId) {
  await sbFetch('/devices', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ device_id: deviceId })
  });
}

// 크레딧 장부에 한 줄 기록. orderId가 있으면 DB의 unique 제약으로 같은 주문번호가 중복 적립되지 않는다(멱등 처리).
// 이미 같은 orderId가 있으면 409가 오는데, 이것도 "정상"(이미 지급됨)으로 처리한다.
async function insertLedger({ deviceId, amount, reason, orderId }) {
  const res = await sbFetch('/credit_ledger', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      device_id: deviceId,
      amount: amount,
      reason: reason,
      order_id: orderId || null
    })
  });
  if (res.status === 409) {
    return { ok: true, duplicate: true };
  }
  if (!res.ok) {
    const text = await res.text().catch(function () {
      return '';
    });
    throw new Error('LEDGER_INSERT_FAILED: ' + res.status + ' ' + text);
  }
  const rows = await res.json();
  return { ok: true, duplicate: false, row: rows[0] };
}

// Supabase Storage에 이미지(Buffer)를 업로드하고 공개 URL을 돌려준다 (서비스 롤 키로 — 버킷 RLS 우회).
// x-upsert:true라서 같은 path로 다시 올리면 덮어쓴다(이미지 교체 시 재사용).
async function uploadStorageImage(bucket, path, buffer, mime) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('NO_SUPABASE_ENV');
  }
  const res = await fetch(
    SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': mime || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: buffer
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(function () {
      return '';
    });
    throw new Error('STORAGE_UPLOAD_FAILED: ' + res.status + ' ' + text);
  }
  return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
}

// 관리자 전용 API에서 공통으로 쓰는 비밀번호 체크. ADMIN_SECRET이 설정 안 돼있으면(아직 Vercel에 등록 전)
// 안전하게 "항상 거부"한다 — 실수로 누구나 쓸 수 있게 열리는 사고를 막기 위해.
function checkAdminSecret(req) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  const given = req.headers['x-admin-secret'];
  return typeof given === 'string' && given === expected;
}

// 쿼리스트링을 req.query에 의존하지 않고 안전하게 직접 파싱(런타임마다 req.query 지원이 다를 수 있어서).
function getQuery(req) {
  try {
    return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  } catch (e) {
    return (req && req.query) || {};
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

module.exports = {
  sbFetch,
  ensureDevice,
  insertLedger,
  getQuery,
  readJsonBody,
  uploadStorageImage,
  checkAdminSecret,
  SUPABASE_URL,
  SERVICE_KEY
};
