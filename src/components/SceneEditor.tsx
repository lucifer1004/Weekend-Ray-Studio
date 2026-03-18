import Editor, { type OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface SceneEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: string[];
}

export interface SceneEditorHandle {
  scrollToTag: (lineNumber: number) => void;
}

export const SceneEditor = forwardRef<SceneEditorHandle, SceneEditorProps>(
  ({ value, onChange, errors }, ref) => {
    const [localValue, setLocalValue] = useState(value);
    const editorInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = useCallback(
      (v: string | undefined) => {
        const val = v || '';
        setLocalValue(val);
        onChange(val);
      },
      [onChange]
    );

    const handleEditorMount: OnMount = (editor) => {
      editorInstance.current = editor;
    };

    useImperativeHandle(ref, () => ({
      scrollToTag(lineNumber: number) {
        const editor = editorInstance.current;
        if (!editor) return;
        editor.revealLineInCenter(lineNumber);
        editor.setPosition({ lineNumber, column: 1 });
        editor.focus();
      },
    }));

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-[var(--border-color-base)]">
          <Editor
            height="100%"
            language="xml"
            theme="vs-dark"
            value={localValue}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12 },
              tabSize: 2,
            }}
          />
        </div>
        {errors.length > 0 && (
          <div className="mt-2 p-2 rounded bg-[var(--background-color-status-danger)] text-[var(--text-color-primary)] text-xs">
            {errors.map((e, i) => (
              <div key={i}>⚠ {e}</div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

SceneEditor.displayName = 'SceneEditor';
