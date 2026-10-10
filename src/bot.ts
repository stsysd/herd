import { isInPen, setDogTarget, type World } from "./sim";
import { dist, vec } from "./vec";

/**
 * 簡単な牧羊の自動操作(Strömbom et al. 2014 に近いもの)。
 * はぐれた羊がいれば群れの外側から集め、まとまっていれば後ろから囲いへ押す
 */
export const herdingBot = (world: World) => {
  const out = world.sheep.filter((s) => !isInPen(world, s.pos));
  if (out.length === 0) return;
  const c = {
    x: out.reduce((a, s) => a + s.pos.x, 0) / out.length,
    y: out.reduce((a, s) => a + s.pos.y, 0) / out.length,
  };
  const f = 20 * Math.sqrt(out.length) + 20;
  const far = out.reduce((a, b) => (dist(a.pos, c) > dist(b.pos, c) ? a : b));
  const fd = dist(far.pos, c);
  if (fd > f) {
    const u = { x: (far.pos.x - c.x) / fd, y: (far.pos.y - c.y) / fd };
    setDogTarget(world, vec(far.pos.x + u.x * 70, far.pos.y + u.y * 70));
    return;
  }
  const gate = vec(world.pen.x + 40, world.pen.y + world.pen.h / 2);
  const l = dist(gate, c) || 1;
  const u = { x: (gate.x - c.x) / l, y: (gate.y - c.y) / l };
  const rear = Math.min(...out.map((s) => (s.pos.x - c.x) * u.x + (s.pos.y - c.y) * u.y));
  setDogTarget(world, vec(c.x + u.x * (rear - 115), c.y + u.y * (rear - 115)));
};
