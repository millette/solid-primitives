import { createSignal, onCleanup, createEffect, untrack, Accessor } from "solid-js";
import type { SignalOptions } from "solid-js/types/reactive/signal";

export type PolledOptions<T> = SignalOptions<T> & { initial?: T };

/**
 * Creates an self-cleaning {@link setInterval}/ {@link setTimeout} that runs a callback after a delay repeatedly or once.
 *
 * @param callback - Function that will be called after {@link delay} ms
 * @param delay - Number representing the delay in ms
 * @param scheduler - Function to schedule the timer with. Accepts
 * setTimeout and setInterval, defaulting to setTimeout.
 * @return Provides a manual clear function.
 *
 * @example
 * ```ts
 * let [count, setCount] = createSignal(0);
 * setTimer(() => setCount(count() + 1), 500, setInterval);
 * return <h1>Counting up: {count()}</h1>;
 * ```
 */
export const setTimer = (
  callback: VoidFunction,
  delay: number,
  scheduler: typeof setTimeout | typeof setInterval = setTimeout
): VoidFunction => {
  const intervalId = scheduler(callback, delay);
  const clear = () => clearInterval(intervalId as number);
  onCleanup(clear);
  return clear;
};

/**
 * Creates an self-cleaning {@link setInterval}/ {@link setNewTimeout} that runs a callback after a delay repeatedly or once.
 *
 * @param callback - Function that will be called after {@link delay} ms
 * @param delay - Accessor returning a `Number` representing a delay in ms, or `false` to pause the timer.
 * @param scheduler - Optional function to schedule the timer with. Accepts
 * {@link setNewTimeout} and {@link setInterval}, defaulting to setTimeout.
 *
 * @example
 * ```tsx
 * let [enabled, setEnabled] = createSignal(false)
 * let [speed, setSpeed] = createSignal(500)
 * let [count, setCount] = createSignal(0);
 * createTimer(() => setCount(p => ++p), () => enabled() && speed(), setInterval);
 * <h1>Current count: {count()}</h1>
 * ```
 */
export function createTimer(
  callback: VoidFunction,
  delay: Accessor<number | false>,
  scheduler: typeof setTimeout | typeof setInterval = setTimeout
): void {
  let prev = performance.now();
  let fractionDone = 0;
  let clear: VoidFunction | undefined;

  const callHandlerAndSetPrev = () => {
    untrack(callback);
    prev = performance.now();
  };

  createEffect((prevDelay?: number) => {
    if (clear) clear(), (clear = undefined);
    const currDelay = delay();
    if (currDelay === false) return;

    if (prevDelay) {
      fractionDone = (performance.now() - prev) / currDelay;
      if (fractionDone < 1) {
        setTimer(() => {
          callHandlerAndSetPrev();
          if (scheduler === setInterval) {
            clear = setTimer(callHandlerAndSetPrev, currDelay, scheduler);
          }
        }, (1 - fractionDone) * currDelay);
        return;
      }
      callHandlerAndSetPrev();
    }

    setTimer(callHandlerAndSetPrev, currDelay, scheduler);
    return currDelay;
  });
}

/**
 * Polls a function periodically. Returns an {@link Accessor} containing the latest polled value.
 *
 * @param timeout Number or {@link Accessor} containing a number representing
 * the time between executions of {@link fn} in ms.
 * @returns An {@link Accessor} containing the latest polled value.
 */
export function createPolled<T>(
  fn: (prev: T) => T,
  timeout: Accessor<number | false> | number,
  options: PolledOptions<T> & { initial: T }
): Accessor<T>;
export function createPolled<T>(
  fn: (prev?: T) => T,
  timeout: Accessor<number | false> | number,
  options?: PolledOptions<T>
): Accessor<T>;
export function createPolled<T>(
  fn: (prev?: T) => T,
  timeout: Accessor<number | false> | number,
  options: PolledOptions<T> = {}
): Accessor<T> {
  const [polled, setPolled] = createSignal(
    "initial" in options ? (options.initial as T) : untrack(fn),
    options
  );
  const update = () => setPolled(fn);
  if (typeof timeout === "number") setTimer(update, timeout, setInterval);
  else createTimer(update, timeout, setInterval);
  return polled;
}

/**
 * Creates a counter which increments periodically.
 *
 * @param timeout Number or {@link Accessor} containing a number representing
 * the time between increments in ms.
 * @returns An {@link Accessor} containing the current count.
 */
export const createIntervalCounter = (
  timeout: number | Accessor<number | false>,
  options: SignalOptions<number>
): Accessor<number> => {
  return createPolled(prev => (prev === undefined ? 0 : prev + 1), timeout, options);
};
