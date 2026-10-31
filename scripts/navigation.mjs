export function validateNavigation(destination, required = false) {
  if (!destination && !required) return;
  if (!destination || typeof destination.name !== 'string' || !destination.name.trim() ||
      !Number.isFinite(destination.latitude) || destination.latitude < 31.43 || destination.latitude > 44.35 ||
      !Number.isFinite(destination.longitude) || destination.longitude < 122.37 || destination.longitude > 132) {
    throw new Error('내비게이션 목적지 이름과 WGS84 위도·경도를 확인해 주세요.');
  }
}

export function navigationLinks(destination) {
  validateNavigation(destination);
  if (!destination) return [];
  const name=encodeURIComponent(destination.name);
  const {latitude,longitude}=destination;
  return [
    {id:'kakao',label:'카카오맵',url:`kakaomap://route?ep=${latitude},${longitude}&by=car`},
    {id:'tmap',label:'T맵',url:`tmap://route?rGoName=${name}&rGoX=${longitude}&rGoY=${latitude}`},
    {id:'naver',label:'네이버지도',url:`nmap://navigation?dlat=${latitude}&dlng=${longitude}&dname=${name}&appname=majung-invitation`}
  ];
}
