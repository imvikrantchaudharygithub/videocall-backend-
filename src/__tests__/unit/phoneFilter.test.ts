import { filterSensitiveContent } from '../../utils/phoneFilter';

describe('phoneFilter', () => {
  it('masks a contiguous 10-digit Indian number', () => {
    const r = filterSensitiveContent('call me on 9876543210 ok');
    expect(r.wasFiltered).toBe(true);
    expect(r.filtered).not.toContain('9876543210');
  });

  it('masks an instagram handle', () => {
    expect(filterSensitiveContent('insta: john_doe').wasFiltered).toBe(true);
  });

  it('masks an email address', () => {
    expect(filterSensitiveContent('mail me at a@b.com').wasFiltered).toBe(true);
  });

  it('leaves clean text untouched', () => {
    const r = filterSensitiveContent('hello how are you');
    expect(r.wasFiltered).toBe(false);
    expect(r.filtered).toBe('hello how are you');
  });

  // QC-15 (fixed): digits split by separators must no longer bypass the filter.
  it('QC-15: masks 10 digits split by spaces', () => {
    const r = filterSensitiveContent('9 8 7 6 5 4 3 2 1 0');
    expect(r.wasFiltered).toBe(true);
    expect(r.filtered).not.toContain('9 8 7 6 5 4 3 2 1 0');
  });

  it('QC-15: masks digits split by dots and dashes', () => {
    expect(filterSensitiveContent('reach me 9.8.7.6.5.4.3.2.1.0').wasFiltered).toBe(true);
    expect(filterSensitiveContent('9-8-7-6-5-4-3-2-1-0').wasFiltered).toBe(true);
  });

  it('QC-15: does not over-mask a few small numbers in normal chat', () => {
    expect(filterSensitiveContent('i have 2 cats and 3 dogs').wasFiltered).toBe(false);
  });
});
