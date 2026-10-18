import { useCallback, useRef, useState } from 'react';

/** Простая очередь всплывающих уведомлений. */
export function useToasts(limit = 5) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (toast) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-(limit - 1)), { id, kind: 'info', ...toast }]);
      setTimeout(() => dismiss(id), toast.duration ?? 3500);
      return id;
    },
    [dismiss, limit],
  );

  return { toasts, push, dismiss };
}
