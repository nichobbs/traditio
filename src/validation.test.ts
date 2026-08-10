import { describe, it, expect } from 'vitest';
import { validateLanguageResponse } from './validation.js';
import { parseLanguageResponse } from './prompt.js';

describe('validation', () => {
  it('accepts valid language response', () => {
    const data = [
      { meaningId: 'm000', form: 'papa' },
      { meaningId: 'm001', form: 'titi' },
    ];
    expect(() => validateLanguageResponse(data)).not.toThrow();
  });

  it('rejects forms with uppercase', () => {
    const data = [
      { meaningId: 'm000', form: 'Papa' },
    ];
    expect(() => validateLanguageResponse(data)).toThrow();
  });

  it('rejects forms with non-alphabetic characters', () => {
    const data = [
      { meaningId: 'm000', form: 'pa-pa' },
    ];
    expect(() => validateLanguageResponse(data)).toThrow();
  });

  it('rejects forms exceeding max length', () => {
    const data = [
      { meaningId: 'm000', form: 'a'.repeat(41) },
    ];
    expect(() => validateLanguageResponse(data)).toThrow();
  });

  it('rejects empty forms', () => {
    const data = [
      { meaningId: 'm000', form: '' },
    ];
    expect(() => validateLanguageResponse(data)).toThrow();
  });

  it('rejects empty meaningId', () => {
    const data = [
      { meaningId: '', form: 'papa' },
    ];
    expect(() => validateLanguageResponse(data)).toThrow();
  });
});

describe('parseLanguageResponse', () => {
  it('parses plain JSON', () => {
    const json = '[{"meaningId":"m000","form":"papa"}]';
    const result = parseLanguageResponse(json);
    expect(result).toEqual([{ meaningId: 'm000', form: 'papa' }]);
  });

  it('strips markdown fences with json tag', () => {
    const json = '```json\n[{"meaningId":"m000","form":"papa"}]\n```';
    const result = parseLanguageResponse(json);
    expect(result).toEqual([{ meaningId: 'm000', form: 'papa' }]);
  });

  it('strips markdown fences without tag', () => {
    const json = '```\n[{"meaningId":"m000","form":"papa"}]\n```';
    const result = parseLanguageResponse(json);
    expect(result).toEqual([{ meaningId: 'm000', form: 'papa' }]);
  });

  it('handles whitespace', () => {
    const json = '  \n  [{"meaningId":"m000","form":"papa"}]  \n  ';
    const result = parseLanguageResponse(json);
    expect(result).toEqual([{ meaningId: 'm000', form: 'papa' }]);
  });

  it('rejects non-array JSON', () => {
    const json = '{"meaningId":"m000","form":"papa"}';
    expect(() => parseLanguageResponse(json)).toThrow();
  });
});
