const { createHash } = require('node:crypto');
const { sbFetch, getQuery } = require('../_supabase');
const { reportAccess, rowsAt } = require('../_report-access');
module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
  const body=req.method==='POST'?(req.body||{}):getQuery(req);
  const conceptId=typeof body.conceptId==='string'?body.conceptId:'';
  if(!/^[\p{L}\p{N}_-]{1,100}$/u.test(conceptId))return res.status(400).json({ok:false,message:'이야기를 확인해주세요.'});
  try {
    const concepts=await rowsAt('/report_concepts?id=eq.'+encodeURIComponent(conceptId)+'&active=eq.true&select=id');
    if(!concepts.length)return res.status(404).json({ok:false});
    if(req.method==='GET') {
      const rows=await rowsAt('/report_reviews?concept_id=eq.'+encodeURIComponent(conceptId)+'&select=text,created_at&order=created_at.desc&limit=6');
      return res.status(200).json({ok:true,rows:rows.map(r=>({text:r.text,createdAt:r.created_at,displayName:'이야기를 읽은 분',verified:true}))});
    }
    const text=typeof body.text==='string'?body.text.trim():'';
    const deviceId=typeof body.deviceId==='string'?body.deviceId:'';
    if(text.length<10||text.length>500||deviceId.length<8||deviceId.length>150||body.publishConsent!==true)return res.status(400).json({ok:false,message:'10~500자의 감상과 후기 공개 동의를 확인해주세요.'});
    const access=await reportAccess(deviceId,conceptId);
    if(!access.story)return res.status(403).json({ok:false,message:'이 이야기를 구매한 뒤 감상을 남길 수 있어요.'});
    const reviewerHash=createHash('sha256').update(conceptId+'\0'+deviceId).digest('hex');
    const response=await sbFetch('/report_reviews',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({concept_id:conceptId,reviewer_hash:reviewerHash,text})});
    if(response.status===409)return res.status(409).json({ok:false,message:'이 이야기에 이미 감상을 남겼어요.'});
    if(!response.ok)throw new Error('WRITE_FAILED');
    return res.status(201).json({ok:true});
  } catch(error) {return res.status(503).json({ok:false,message:'후기를 불러오거나 저장하지 못했어요. 잠시 후 다시 시도해주세요.'});}
};
