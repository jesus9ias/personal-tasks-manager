import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface UseLabelsResult {
  allLabelNames: string[];
  registerLabel: (name: string) => void;
}

export function useLabels(authenticated: boolean): UseLabelsResult {
  const [allLabelNames, setAllLabelNames] = useState<string[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    api.getAllLabelNames().then(setAllLabelNames).catch(() => {});
  }, [authenticated]);

  function registerLabel(name: string) {
    setAllLabelNames((prev) => prev.includes(name) ? prev : [...prev, name]);
  }

  return { allLabelNames, registerLabel };
}
