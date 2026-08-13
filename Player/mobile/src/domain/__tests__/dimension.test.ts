import { DIMENSIONS, narrowDimension } from '../dimension';

describe('narrowDimension', () => {
  it.each([...DIMENSIONS])(
    'returns the recognised name "%s" unchanged and un-re-cased',
    name => {
      expect(narrowDimension(name)).toBe(name);
    },
  );

  it('narrows an unrecognised string to intensity and logs it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(narrowDimension('galaxyBrain')).toBe('intensity');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('galaxyBrain');

    warn.mockRestore();
  });

  it('does not treat a differently-cased name as recognised — only byte-identical strings pass', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // `HeartRate`/`heartrate` are not the contract string `heartRate`.
    expect(narrowDimension('HeartRate')).toBe('intensity');
    expect(narrowDimension('heartrate')).toBe('intensity');

    warn.mockRestore();
  });

  it.each([undefined, null, 42, {}, []])(
    'narrows the non-string value %p to intensity rather than throwing',
    value => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(narrowDimension(value)).toBe('intensity');

      warn.mockRestore();
    },
  );
});
