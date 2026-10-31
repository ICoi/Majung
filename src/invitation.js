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
document.querySelector('main').focus({ preventScroll: true });
