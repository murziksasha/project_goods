import { describe, expect, it } from 'vitest';
import {
  addPhoneRow,
  removePhoneAtIndex,
  setPrimaryPhoneAtIndex,
  updatePhoneAtIndex,
} from './phones';

describe('phone field helpers', () => {
  it('updatePhoneAtIndex updates primary and phones together', () => {
    const next = updatePhoneAtIndex(
      '+380501111111',
      ['+380501111111', '+380502222222'],
      0,
      '+380509999999',
    );

    expect(next).toEqual({
      phone: '+380509999999',
      phones: ['+380509999999', '+380502222222'],
    });
  });

  it('updatePhoneAtIndex updates additional phone without changing primary', () => {
    const next = updatePhoneAtIndex(
      '+380501111111',
      ['+380501111111', '+380502222222'],
      1,
      '+380503333333',
    );

    expect(next).toEqual({
      phone: '+380501111111',
      phones: ['+380501111111', '+380503333333'],
    });
  });

  it('setPrimaryPhoneAtIndex moves selected phone to front', () => {
    const next = setPrimaryPhoneAtIndex(
      '+380501111111',
      ['+380501111111', '+380502222222', '+380503333333'],
      2,
    );

    expect(next).toEqual({
      phone: '+380503333333',
      phones: ['+380503333333', '+380501111111', '+380502222222'],
    });
  });

  it('removePhoneAtIndex removes additional phone', () => {
    const next = removePhoneAtIndex(
      '+380501111111',
      ['+380501111111', '+380502222222'],
      1,
    );

    expect(next).toEqual({
      phone: '+380501111111',
      phones: ['+380501111111'],
    });
  });

  it('removePhoneAtIndex promotes next phone when removing primary', () => {
    const next = removePhoneAtIndex(
      '+380501111111',
      ['+380501111111', '+380502222222'],
      0,
    );

    expect(next).toEqual({
      phone: '+380502222222',
      phones: ['+380502222222'],
    });
  });

  it('addPhoneRow appends default phone', () => {
    const next = addPhoneRow('+380501111111', ['+380501111111']);

    expect(next).toEqual({
      phone: '+380501111111',
      phones: ['+380501111111', '+380'],
    });
  });
});