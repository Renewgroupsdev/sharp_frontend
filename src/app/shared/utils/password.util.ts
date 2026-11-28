/** A random 12-character password with upper and lower case, digits and a symbol (no look-alike characters). */
export function generatePassword(length = 12): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '@#$%&*!?'];
  const all = sets.join('');
  const rnd = (n: number): number => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map(s => s[rnd(s.length)]);
  while (chars.length < length) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
