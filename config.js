// 클라이언트에 노출해도 안전한 "공개 키"만 돌려줍니다. (시크릿 키는 절대 여기 넣지 않습니다)
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    clientKey: process.env.TOSS_CLIENT_KEY || ''
  });
};
