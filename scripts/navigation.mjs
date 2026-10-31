export function validateNavigation(destination, required = false) {
  if (!destination && !required) return;
  if (!destination || typeof destination.name !== 'string' || !destination.name.trim() ||
      !Number.isFinite(destination.latitude) || destination.latitude < 31.43 || destination.latitude > 44.35 ||
      !Number.isFinite(destination.longitude) || destination.longitude < 122.37 || destination.longitude > 132) {
    throw new Error('내비게이션 목적지 이름과 WGS84 위도·경도를 확인해 주세요.');
  }
  if (!destination.kakaoNaviUrl) {
    if (required) throw new Error('카카오내비 앱에서 복사한 목적지 공유 링크를 입력해 주세요.');
    return;
  }
  let url;
  try { url = new URL(destination.kakaoNaviUrl); } catch { throw new Error('카카오내비 공유 링크를 확인해 주세요.'); }
  if (url.protocol !== 'https:' || !['kakaonavi.kakao.com','kakaonavi-wguide.kakao.com','kko.to'].includes(url.hostname) || url.username || url.password) {
    throw new Error('카카오내비의 공식 HTTPS 목적지 공유 링크가 필요합니다.');
  }
}

export function navigationLinks(destination) {
  validateNavigation(destination);
  if (!destination) return [];
  const name=encodeURIComponent(destination.name);
  const {latitude,longitude}=destination;
  return [
    {id:'kakao',label:'카카오내비',url:destination.kakaoNaviUrl || ''},
    {id:'tmap',label:'T맵',url:`tmap://route?rGoName=${name}&rGoX=${longitude}&rGoY=${latitude}`},
    {id:'naver',label:'네이버지도',url:`nmap://navigation?dlat=${latitude}&dlng=${longitude}&dname=${name}&appname=majung-invitation`}
  ];
}
