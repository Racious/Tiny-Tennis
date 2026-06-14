// 小型數學工具
import type { Vec2 } from './types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 三角分布隨機值，範圍 [-1, 1]、集中在 0 附近 */
export function tri(): number {
  return Math.random() + Math.random() - 1;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
