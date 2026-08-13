// Shared leaderboard client for the game hub.
// Storage: public jsonbin.io bin (hobby-grade — see README: no anti-cheat by design).
(() => {
  const BIN = '6a7d9d9ada38895dfedf1073';
  const KEY = '$2a$10$oKFWqQ8ZGkuyH8WRUJdjvuk4W8ntFKe5Dbg/bIoAHfVQ5EmR9Wj/.';
  const URL = 'https://api.jsonbin.io/v3/b/' + BIN;
  const H = { 'X-Master-Key': KEY };
  const MAX = 50;
  function name() {
    const n = String(localStorage.getItem('player-name') || '').trim().slice(0, 12);
    return n || 'anon';
  }
  async function fetchTop() {
    const r = await fetch(URL + '/latest', { headers: H });
    if (!r.ok) throw new Error('board HTTP ' + r.status);
    const j = await r.json();
    return ((j.record && j.record.scores) || []).slice(0, 10);
  }
  async function submit(game, score) {
    if (!score || score < 1 || score > 99999999) return false;
    try {
      const cur = await (await fetch(URL + '/latest', { headers: H })).json();
      const list = ((cur.record && cur.record.scores) || []).slice(0, MAX - 1);
      list.push({ n: name(), s: Math.floor(score), g: game, t: Date.now() });
      list.sort((a, b) => b.s - a.s);
      const r = await fetch(URL, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, H),
        body: JSON.stringify({ scores: list })
      });
      return r.ok;
    } catch (e) {
      console.warn('leaderboard submit failed:', e);
      return false;
    }
  }
  window.LB = {
    fetchTop, submit,
    name,
    setName: (n) => localStorage.setItem('player-name', String(n || '').slice(0, 12))
  };
})();
