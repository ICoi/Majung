document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const status = document.querySelector('.copy-status');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(button.dataset.copy);
      status.textContent = `${button.dataset.copyLabel}를 복사했습니다.`;
    } catch {
      status.textContent = `자동 복사를 사용할 수 없습니다. 아래 내용을 길게 눌러 복사해 주세요: ${button.dataset.copy}`;
    }
    // Keep the result beside the control so magnified-screen users can see it.
    button.after(status);
  });
});
document.querySelectorAll('[data-navigation]').forEach((link) => {
  if (link.dataset.navigation === 'naver') {
    const url=new URL(link.href);
    url.searchParams.set('appname', window.location.origin);
    link.href=url.toString();
  }
  link.addEventListener('click', (event) => {
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const status=document.querySelector('.navigation-status');
    if (!mobile) {
      event.preventDefault();
      status.textContent=`${link.dataset.appLabel} 길 안내는 휴대폰에서 이용해 주세요. 아래 주소를 복사하거나 웹 지도를 열 수 있습니다.`;
    } else {
      status.textContent=`${link.dataset.appLabel}로 연결합니다.`;
    }
    document.querySelector('.navigation-install').hidden=false;
  });
});
const mapExpand=document.querySelector('[data-map-expand]');
if(mapExpand) mapExpand.addEventListener('click',()=>{
  const dialog=document.getElementById('map-dialog');
  document.getElementById('map-zoom-image').src=document.querySelector('.map img').src;
  dialog.showModal();
  const mapScroll=document.querySelector('.map-dialog-scroll');
  mapScroll.scrollLeft=Math.max(0,(mapScroll.scrollWidth-mapScroll.clientWidth)/2);
});
document.querySelector('main').focus({ preventScroll: true });
