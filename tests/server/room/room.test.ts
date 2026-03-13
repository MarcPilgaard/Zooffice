import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Room } from '../../../src/server/room/room.js';

describe('Room', () => {
  let room: Room;
  const onEvent = vi.fn();

  beforeEach(() => {
    onEvent.mockClear();
    room = new Room('lobby', onEvent);
  });

  describe('join/leave', () => {
    it('allows an agent to join', () => {
      expect(room.join('a1')).toBe(true);
      expect(room.getMembers()).toContain('a1');
    });

    it('prevents double join', () => {
      room.join('a1');
      expect(room.join('a1')).toBe(false);
    });

    it('allows leaving', () => {
      room.join('a1');
      expect(room.leave('a1')).toBe(true);
      expect(room.getMembers()).not.toContain('a1');
    });

    it('fails to leave if not a member', () => {
      expect(room.leave('a1')).toBe(false);
    });

    it('emits join/leave events', () => {
      room.join('a1');
      expect(onEvent).toHaveBeenCalledWith('lobby', 'join', 'a1');
      room.leave('a1');
      expect(onEvent).toHaveBeenCalledWith('lobby', 'leave', 'a1');
    });
  });

  describe('post', () => {
    it('posts a message from a member', () => {
      room.join('a1');
      expect(room.post('a1', 'Rex', 'hello')).toBe(true);
      expect(onEvent).toHaveBeenCalledWith('lobby', 'message', 'a1', 'hello');
    });

    it('rejects post from non-member', () => {
      expect(room.post('a1', 'Rex', 'hello')).toBe(false);
    });
  });

  describe('join-point visibility', () => {
    it('only shows messages after join', () => {
      room.join('a1');
      room.post('a1', 'Rex', 'msg1');
      room.post('a1', 'Rex', 'msg2');

      room.join('a2');
      room.post('a1', 'Rex', 'msg3');

      const visible = room.getVisibleMessages('a2');
      expect(visible).toHaveLength(1);
      expect(visible[0].text).toBe('msg3');
    });

    it('returns empty for non-member', () => {
      expect(room.getVisibleMessages('nobody')).toHaveLength(0);
    });
  });

  describe('hasMember', () => {
    it('returns true for member', () => {
      room.join('a1');
      expect(room.hasMember('a1')).toBe(true);
    });

    it('returns false for non-member', () => {
      expect(room.hasMember('a1')).toBe(false);
    });
  });
});
