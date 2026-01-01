"use client";

import { useRef, useEffect, useCallback } from "react";

type FrameCallback = (deltaTime: number) => void;

export function useGameLoop(callback: FrameCallback, isActive: boolean = true) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const callbackRef = useRef<FrameCallback>(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== null) {
      const deltaTime = time - previousTimeRef.current;
      // Cap delta time to prevent huge jumps (e.g., when tab is inactive)
      const cappedDelta = Math.min(deltaTime, 100);
      callbackRef.current(cappedDelta);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isActive) {
      previousTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isActive, animate]);

  const stop = useCallback(() => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
      previousTimeRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (requestRef.current === null) {
      previousTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  return { start, stop };
}
