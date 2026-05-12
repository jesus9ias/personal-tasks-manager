import { forwardRef, useCallback } from 'react';
import type { TextareaHTMLAttributes, MutableRefObject, FormEvent } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
}

function applyResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ autoResize, onInput, style, ...props }, ref) => {
    // On mount: resize to fit pre-filled content (edit mode). Also forwards the ref.
    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        if (el && autoResize) applyResize(el);
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as MutableRefObject<HTMLTextAreaElement | null>).current = el;
      },
      [autoResize, ref],
    );

    function handleInput(e: FormEvent<HTMLTextAreaElement>) {
      if (autoResize) applyResize(e.currentTarget);
      onInput?.(e);
    }

    return (
      <textarea
        ref={setRef}
        onInput={handleInput}
        style={autoResize ? { resize: 'none', overflow: 'hidden', ...style } : style}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
