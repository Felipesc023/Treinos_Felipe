import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isValidISODate, weekdayName, weekdayOf, weekStartSunday } from '../dates';

describe('datas (T1: dia da semana é derivado, nunca digitado)', () => {
  it('2026-10-20 é terça-feira', () => {
    expect(weekdayName('2026-10-20')).toBe('Terça');
    expect(weekdayOf('2026-10-20')).toBe(2);
  });
  it('datas-chave da conversa batem com o calendário real', () => {
    expect(weekdayName('2026-09-04')).toBe('Sexta');
    expect(weekdayName('2026-09-20')).toBe('Domingo');
    expect(weekdayName('2026-11-15')).toBe('Domingo');
    expect(weekdayName('2026-08-04')).toBe('Terça'); // não era sexta
  });
  it('aritmética de datas', () => {
    expect(addDays('2026-09-28', 3)).toBe('2026-10-01');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(diffDays('2026-11-15', '2026-09-21')).toBe(55);
  });
  it('domingo da semana', () => {
    expect(weekStartSunday('2026-10-21')).toBe('2026-10-18');
    expect(weekStartSunday('2026-10-18')).toBe('2026-10-18');
  });
  it('rejeita datas inválidas', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('04/09/2026')).toBe(false);
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});
