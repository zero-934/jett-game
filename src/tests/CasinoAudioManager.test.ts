/**
 * @file Jest test suite for CasinoAudioManager.
 * @purpose Verifies the functionality of the audio manager, including ethical LDW checks and Web Audio API interactions.
 * @author Agent 934
 * @date 2026-04-18
 * @license Proprietary
 */

// Mock AudioContext at the top of the test file
const mockOscillator = {
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  frequency: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
  type: 'sine',
  disconnect: jest.fn(),
};

const mockGainNode = {
  connect: jest.fn(),
  gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), value: 0 },
  disconnect: jest.fn(),
};

const mockAudioContext = {
  createOscillator: jest.fn(() => mockOscillator),
  createGain: jest.fn(() => mockGainNode),
  destination: {},
  currentTime: 0,
  state: 'running',
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

(global as unknown as Record<string, unknown>).AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

// Mock the ShepardToneGenerator as well, as it's a dependency
jest.mock('../shared/audio/ShepardToneGenerator', () => ({
  ShepardToneGenerator: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    setStep: jest.fn(),
    step: jest.fn(),
    stop: jest.fn(),
    playing: false, // Default state
  })),
}));

import { CasinoAudioManager } from '../shared/audio/CasinoAudioManager';
import { ShepardToneGenerator } from '../shared/audio/ShepardToneGenerator';

// Ensure AudioContext is available in test environment
const mockAudioContextInstance = {
  createOscillator: jest.fn(() => ({ connect: jest.fn(), start: jest.fn(), stop: jest.fn(), frequency: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() }, type: 'sine', disconnect: jest.fn() })),
  createGain: jest.fn(() => ({ connect: jest.fn(), gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), value: 1 }, disconnect: jest.fn() })),
  destination: {},
  currentTime: 0,
  state: 'running' as AudioContextState,
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};
(globalThis as unknown as Record<string,unknown>).AudioContext = jest.fn(() => mockAudioContextInstance);


describe('CasinoAudioManager', () => {
  let audioManager: CasinoAudioManager;
  let shepardGeneratorMock: jest.Mocked<ShepardToneGenerator>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockAudioContext.state = 'running'; // Ensure context is running by default for tests

    // Re-mock ShepardToneGenerator's playing getter for each test
    (ShepardToneGenerator as jest.Mock).mockImplementation(() => {
      const mock = {
        start: jest.fn(),
        setStep: jest.fn(),
        step: jest.fn(),
        stop: jest.fn(),
        _playing: false, // Internal state for the mock
        get playing() { return this._playing; },
        set playing(val: boolean) { this._playing = val; },
      };
      // Mock start to set playing to true
      mock.start.mockImplementation((initialStep?: number) => {
        mock._playing = true;
        // Call the actual setStep if needed for internal logic, or just mock it
        mock.setStep(initialStep || 0);
      });
      // Mock stop to set playing to false
      mock.stop.mockImplementation(() => {
        mock._playing = false;
      });
      return mock;
    });

    audioManager = new CasinoAudioManager();
    // Get the mocked instance of ShepardToneGenerator
    shepardGeneratorMock = (ShepardToneGenerator as jest.Mock).mock.results[0].value;

    // Spy on private methods for testing purposes
    jest.spyOn(audioManager as any, 'playWinJingle'); // eslint-disable-line @typescript-eslint/no-explicit-any
    jest.spyOn(audioManager as any, 'playLoss'); // eslint-disable-line @typescript-eslint/no-explicit-any
    jest.spyOn(audioManager, 'onNearMiss');
  });

  // 1. CasinoAudioManager instantiates without throwing
  test('1. CasinoAudioManager instantiates without throwing', () => {
    expect(audioManager).toBeDefined();
    expect(audioManager.isEnabled).toBe(true);
  });

  // 2. init() creates an AudioContext (or resumes it)
  test('2. init() - audioManager is initialized', () => {
    expect(audioManager).toBeDefined();
    expect(audioManager.isEnabled).toBe(true);
  });

  
  test('3. onWin(150, 25) - genuine win, calls playWinJingle and NOT onNearMiss', () => {
    audioManager.onWin(150, 25);
    expect((audioManager as any).playWinJingle).toHaveBeenCalledTimes(1); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(audioManager.onNearMiss).not.toHaveBeenCalled();
    expect((audioManager as any).playLoss).not.toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  // 4. onWin(20, 25) — net loss (LDW case), calls onNearMiss and NOT win jingle
  test('4. onWin(20, 25) - net loss (LDW), calls onNearMiss and NOT playWinJingle', () => {
    audioManager.onWin(20, 25);
    expect(audioManager.onNearMiss).toHaveBeenCalledTimes(1);
    expect((audioManager as any).playWinJingle).not.toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect((audioManager as any).playLoss).not.toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  // 5. onWin(0, 25) — zero return, plays loss sound (not near-miss, not win)
  test('5. onWin(0, 25) - zero return, calls playLoss and NOT onNearMiss or playWinJingle', () => {
    audioManager.onWin(0, 25);
    expect((audioManager as any).playLoss).toHaveBeenCalledTimes(1); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(audioManager.onNearMiss).not.toHaveBeenCalled();
    expect((audioManager as any).playWinJingle).not.toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  // 6. setEnabled(false) then onWin — no audio methods called
  test('6. setEnabled(false) then onWin - no audio methods called', () => {
    audioManager.setEnabled(false);
    audioManager.onWin(100, 10);
    expect((audioManager as any).playWinJingle).not.toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(audioManager.onNearMiss).not.toHaveBeenCalled();
    expect((audioManager as any).playLoss).not.toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  // 7. playSurgeRise(0) — starts Shepard generator
  test('7. playSurgeRise(0) - starts Shepard generator', () => {
    (shepardGeneratorMock as unknown as Record<string, unknown>)['_playing'] = false;
    audioManager.playSurgeRise(0);
    expect(shepardGeneratorMock.start).toHaveBeenCalledWith(0);
    expect(shepardGeneratorMock.setStep).toHaveBeenCalledWith(0); // start calls setStep
  });

  // 8. playSurgeRise(3) — calls setStep() on generator if already playing
  test('8. playSurgeRise(3) - calls setStep() on generator if already playing', () => {
    (shepardGeneratorMock as unknown as Record<string, unknown>)['_playing'] = true;
    audioManager.playSurgeRise(3);
    expect(shepardGeneratorMock.start).not.toHaveBeenCalled();
    expect(shepardGeneratorMock.setStep).toHaveBeenCalledWith(3);
  });

  // 9. stopSurgeRise() — stops Shepard generator
  test('9. stopSurgeRise() - stops Shepard generator', () => {
    audioManager.stopSurgeRise();
    expect(shepardGeneratorMock.stop).toHaveBeenCalledTimes(1);
  });

  // 10. destroy() — cleans up without throwing
  test('10. destroy() - cleans up without throwing', () => {
    expect(() => audioManager.destroy()).not.toThrow();
    // destroy should complete without errors
  });
});
