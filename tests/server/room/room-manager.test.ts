import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../../../src/server/room/room-manager.js';

describe('RoomManager', () => {
  let mgr: RoomManager;

  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('creates a room', () => {
    const room = mgr.create('lobby');
    expect(room.name).toBe('lobby');
    expect(mgr.list()).toContain('lobby');
  });

  it('returns existing room on duplicate create', () => {
    const r1 = mgr.create('lobby');
    const r2 = mgr.create('lobby');
    expect(r1).toBe(r2);
  });

  it('gets a room by name', () => {
    mgr.create('lobby');
    expect(mgr.get('lobby')).toBeDefined();
    expect(mgr.get('nope')).toBeUndefined();
  });

  it('getOrCreate creates if missing', () => {
    const room = mgr.getOrCreate('kitchen');
    expect(room.name).toBe('kitchen');
  });

  it('deletes a room', () => {
    mgr.create('lobby');
    expect(mgr.delete('lobby')).toBe(true);
    expect(mgr.list()).not.toContain('lobby');
  });

  it('finds rooms by agent', () => {
    const lobby = mgr.create('lobby');
    const kitchen = mgr.create('kitchen');
    lobby.join('a1');
    kitchen.join('a1');
    expect(mgr.findByAgent('a1')).toHaveLength(2);
  });
});
