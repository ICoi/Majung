export function validatePassword(password, demo = false) {
  if (typeof password !== 'string' || !password.trim()) throw new Error('비밀번호를 입력해 주세요.');
  if (!demo && !/^[0-9]{6}$/.test(password)) throw new Error('실제 배포용 비밀번호는 숫자 6자리로 설정해 주세요.');
}
