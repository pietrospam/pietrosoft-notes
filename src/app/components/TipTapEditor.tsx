'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import HardBreak from '@tiptap/extension-hard-break';
import TiptapUnderline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import Strike from '@tiptap/extension-strike';

const COLOR_PALETTE = [
  '#000000', '#202020', '#404040', '#606060', '#808080', '#a0a0a0', '#c0c0c0', '#ffffff',
  '#f8d7da', '#f5c2c7', '#f1a1a8', '#ec7f80', '#e75d58', '#dc473d', '#c53030', '#9b1f24',
  '#fff4e5', '#ffddb3', '#ffc880', '#ffb14d', '#ff9a1a', '#e07a00', '#b85d00', '#8d4600',
  '#fff8d3', '#fff1a8', '#ffe87d', '#ffde52', '#ffd526', '#eca400', '#b67c00', '#886000',
  '#e8f7dd', '#c8edb1', '#a7e384', '#85d957', '#63ce2b', '#3da20c', '#2f7d09', '#215b07',
  '#d8ecff', '#b2d9ff', '#8ac5ff', '#63b1ff', '#3c9cff', '#136ef0', '#0d54b1', '#083d78',
  '#eee5ff', '#d5c2ff', '#bc9fff', '#a37bff', '#8a57ff', '#6d2de9', '#5522b0', '#3d1878',
  '#ffe8f2', '#ffccde', '#ffafca', '#ff91b6', '#ff73a2', '#ff4080', '#d62569', '#a31a4e',
];
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import DOMPurify from 'dompurify';
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List, 
  ListOrdered, 
  Quote,
  Code,
  Heading1,
  Heading2,
  Link2,
  Table as TableIcon,
  Palette,
  Highlighter,
  Strikethrough,
  Undo,
  Redo,
  ImagePlus,
  Eraser,
} from 'lucide-react';
import { copyHtmlWithEmbeddedImages } from '@/lib/clipboard';
import { Toast } from './Toast';

const ToolbarButton = ({ 
  onClick, 
  isActive = false, 
  children 
}: { 
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void; 
  isActive?: boolean; 
  children: React.ReactNode 
}) => (
  <button
    type="button"
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`
      p-1.5 rounded transition-colors
      ${isActive 
        ? 'bg-gray-700 text-white' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
    `}
  >
    {children}
  </button>
);

interface TipTapEditorProps {
  content: object | null;
  onChange: (json: object) => void;
  placeholder?: string;
  noteId?: string; // Required for image uploads
  onPersistNote?: () => Promise<string | null>; // Called to persist temp notes before upload
  onAttachmentAdded?: () => void; // Called when an image/attachment is added (for refreshing comments)
  readOnly?: boolean; // disable editing and hide toolbar
  compact?: boolean; // reduce height for inline comment inputs
  copyWithImagesOnCopy?: boolean; // If enabled, intercept Ctrl+C and embed images
  showStaticToolbar?: boolean; // Show the sticky toolbar at the top of the editor
}

export interface TipTapEditorHandle {
  focus: () => void;
  getHTML: () => string;
  getText: () => string;
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(function TipTapEditor({ content, onChange, placeholder = 'Start writing...', noteId, onPersistNote, onAttachmentAdded, readOnly = false, compact = false, copyWithImagesOnCopy, showStaticToolbar = true }, ref) {
  const { copyWithImagesOnCopy: globalCopyWithImagesOnCopy } = useApp();
  const effectiveCopyWithImagesOnCopy = copyWithImagesOnCopy ?? globalCopyWithImagesOnCopy;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [floatingToolbarStyle, setFloatingToolbarStyle] = useState<{ top: number; left: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(null);
  
  // Use ref for noteId to avoid stale closure in editor handlers
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;
  
  // Use ref for onPersistNote callback
  const onPersistNoteRef = useRef(onPersistNote);
  onPersistNoteRef.current = onPersistNote;
  
  // Use ref for onAttachmentAdded callback
  const onAttachmentAddedRef = useRef(onAttachmentAdded);
  onAttachmentAddedRef.current = onAttachmentAdded;

  // Get a valid noteId, persisting if necessary
  const getValidNoteId = useCallback(async (): Promise<string | null> => {
    const currentNoteId = noteIdRef.current;
    if (!currentNoteId) return null;
    
    // If it's a temp note, persist it first
    if (currentNoteId.startsWith('temp-') && onPersistNoteRef.current) {
      const newNoteId = await onPersistNoteRef.current();
      if (newNoteId) {
        noteIdRef.current = newNoteId;
        return newNoteId;
      }
      return null;
    }
    
    return currentNoteId;
  }, []);

  // Upload image file to attachments API
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const validNoteId = await getValidNoteId();
    if (!validNoteId) {
      console.error('No valid noteId for image upload');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', validNoteId);

    try {
      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      // Notify parent that an attachment was added (for refreshing comments)
      onAttachmentAddedRef.current?.();
      return data.url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      return null;
    }
  }, [getValidNoteId]); // Uses getValidNoteId

  const isRawHTML = content && typeof content === 'object' && (content as { type?: string }).type === 'html' && typeof (content as { html?: unknown }).html === 'string';

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      HardBreak,
      TextStyle,
      Color,
      TiptapUnderline,
      Strike,
      Highlight,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: true,
        HTMLAttributes: {
          class: 'max-w-full rounded-lg',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 underline cursor-pointer',
        },
      }),
    ],
    content: content || undefined,
    editorProps: {
      attributes: {
        class: readOnly 
          ? 'prose prose-invert prose-sm prose-compact max-w-none' 
          : compact
            ? 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[60px]'
            : 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px]',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              event.stopPropagation();
              uploadImage(file).then(url => {
                if (url && view.state.selection) {
                  const { state, dispatch } = view;
                  const node = state.schema.nodes.image.create({ src: url });
                  const tr = state.tr.replaceSelectionWith(node).scrollIntoView();
                  dispatch(tr);
                  view.focus();
                }
              });
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;

        event.preventDefault();
        
        imageFiles.forEach(file => {
          if (noteIdRef.current) {
            uploadImage(file).then(url => {
              if (url) {
                const { state, dispatch } = view;
                const node = state.schema.nodes.image.create({ src: url });
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (pos) {
                  const tr = state.tr.insert(pos.pos, node);
                  dispatch(tr);
                }
              }
            });
          }
        });
        
        return true;
      },
      handleKeyDown: (view, event) => {
        // Standard rich text behavior:
        // Enter -> new paragraph
        // Shift+Enter -> soft line break
        // Ctrl+Enter / Cmd+Enter -> no special action
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          return false;
        }

        if (!effectiveCopyWithImagesOnCopy) return false;
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') return false;

        const selection = getSelectionHtml();
        if (!selection) return false;

        event.preventDefault();
        const htmlToCopy = selection.html || editor?.getHTML() || '';
        const textToCopy = selection.text || editor?.getText() || '';
        copyHtmlWithEmbeddedImages(htmlToCopy, textToCopy)
          .then(() => setToastMessage('Copiado con imágenes al portapapeles'))
          .catch((err) => {
            console.error('Copy with images failed:', err);
            setToastMessage('Error al copiar con imágenes');
          });
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getJSON());
    },
  });

  const getSelectionHtml = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const anchor = selection.anchorNode;
    if (!anchor || !editor?.view.dom.contains(anchor)) return null;

    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    return { html: container.innerHTML, text: selection.toString() };
  }, [editor]);

  const updateFloatingToolbar = useCallback(() => {
    if (!editor || !editorWrapperRef.current) {
      setShowFloatingToolbar(false);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setShowFloatingToolbar(false);
      return;
    }

    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    if (!anchor || !focus || !editorWrapperRef.current.contains(anchor) || !editorWrapperRef.current.contains(focus)) {
      setShowFloatingToolbar(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const wrapperRect = editorWrapperRef.current.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
      setShowFloatingToolbar(false);
      return;
    }

    const toolbarWidth = 260;
    const horizontalMargin = 16;
    const rawLeft = rect.left - wrapperRect.left + rect.width * 0.75;
    const clampedLeft = Math.min(
      Math.max(rawLeft, horizontalMargin),
      wrapperRect.width - toolbarWidth - horizontalMargin,
    );

    setFloatingToolbarStyle({
      top: Math.max(0, rect.top - wrapperRect.top - 44),
      left: clampedLeft,
    });
    setShowFloatingToolbar(true);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const selectionChangeHandler = () => {
      updateFloatingToolbar();
    };

    document.addEventListener('selectionchange', selectionChangeHandler);
    return () => {
      document.removeEventListener('selectionchange', selectionChangeHandler);
    };
  }, [editor, updateFloatingToolbar]);

  const promptForLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt('Insert URL');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const openColorPicker = useCallback((target: HTMLElement) => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = targetRect.bottom - wrapperRect.top + 6;
    const left = Math.min(
      Math.max(targetRect.left - wrapperRect.left, 8),
      wrapperRect.width - 276,
    );

    setColorPickerPosition({ top, left });
    setShowColorPicker(true);
  }, []);

  const promptForColor = useCallback((event?: ReactMouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.stopPropagation();
      const target = event.currentTarget;
      if (showColorPicker) {
        setShowColorPicker(false);
        setColorPickerPosition(null);
        return;
      }
      openColorPicker(target);
      return;
    }

    if (!editor) return;
    const color = window.prompt('Ingrese color de texto (hex o nombre)', '#2563eb');
    if (color) {
      editor.chain().focus().setColor(color).run();
    }
  }, [editor, openColorPicker, showColorPicker]);

  const applyColor = useCallback((color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
    setShowColorPicker(false);
    setColorPickerPosition(null);
  }, [editor]);

  const removeFormatting = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  }, [editor]);

  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const wrapper = editorWrapperRef.current;
      if (!wrapper) return;
      if (!wrapper.contains(event.target as Node)) {
        setShowColorPicker(false);
        setColorPickerPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
  }, [editor]);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      editor?.chain().focus().run();
    },
    getHTML: () => editor?.getHTML() ?? '',
    getText: () => editor?.getText() ?? '',
  }), [editor]);

  // Sync editable state with readOnly prop
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
      if (!readOnly) {
        // Focus editor when switching to edit mode
        setTimeout(() => editor.chain().focus().run(), 50);
      }
    }
  }, [editor, readOnly]);

  // Update content when it changes externally
  useEffect(() => {
    if (!editor || content == null) return;

    const currentContent = JSON.stringify(editor.getJSON());
    const newContent = JSON.stringify(content);
    if (currentContent !== newContent) {
      if (editor.isFocused) {
        return;
      }
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (isRawHTML) {
    const html = (content as { html?: string }).html ?? '';
    const clean = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'style', 'span', 'div', 'font'],
      ADD_ATTR: [
        'allow', 'allowfullscreen', 'frameborder', 'scrolling',
        'style', 'class', 'id', 'dir', 'cellpadding', 'cellspacing', 'valign', 'align', 'border',
      ],
      FORBID_TAGS: ['meta', 'link', 'base'],
    });
    return (
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  if (!editor) {
    return <div className="animate-pulse bg-gray-800 h-48 rounded" />;
  }

  return (
    <div
      ref={editorWrapperRef}
      className="relative"
    >
      <div className="rounded-xl border border-gray-800 bg-slate-950/95 overflow-hidden">
        {/* Toolbar */}
        {!readOnly && showStaticToolbar && (
          <div className="sticky top-0 z-10 border-b border-gray-800 bg-slate-950 px-2 py-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
              >
                <Bold size={16} />
              </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
            >
              <Italic size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
            >
              <UnderlineIcon size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              isActive={editor.isActive('highlight')}
            >
              <Highlighter size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={promptForColor}
              isActive={editor.isActive('textStyle') || editor.isActive('color') }
            >
              <Palette size={16} />
            </ToolbarButton>

            <ToolbarButton onClick={removeFormatting}>
              <Eraser size={16} />
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-700 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
            >
              <Heading1 size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
            >
              <Heading2 size={16} />
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-700 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
            >
              <List size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
            >
              <ListOrdered size={16} />
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-700 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
            >
              <Quote size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
            >
              <Code size={16} />
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-700 mx-1" />

            <ToolbarButton
              onClick={promptForLink}
              isActive={editor.isActive('link')}
            >
              <Link2 size={16} />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertTable}
            >
              <TableIcon size={16} />
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-700 mx-1" />

            <ToolbarButton onClick={() => editor.chain().focus().undo().run()}>
              <Undo size={16} />
            </ToolbarButton>

            <ToolbarButton onClick={() => editor.chain().focus().redo().run()}>
              <Redo size={16} />
            </ToolbarButton>

                  {noteId && (
              <>
                <div className="w-px h-5 bg-gray-700 mx-1" />
                <ToolbarButton onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={16} />
                </ToolbarButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = await uploadImage(file);
                      if (url) {
                        editor.chain().focus().setImage({ src: url }).run();
                      }
                    }
                    // Reset input so same file can be selected again
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-950 px-3 py-3">
        <EditorContent editor={editor} />
      </div>

      {showColorPicker && colorPickerPosition && (
        <div
          className="pointer-events-auto absolute z-50 rounded-xl border border-gray-700 bg-slate-950 p-3 shadow-2xl"
          style={{
            top: colorPickerPosition.top,
            left: colorPickerPosition.left,
            width: 240,
          }}
        >
          <div className="grid grid-cols-8 gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyColor(color)}
                className="h-6 w-6 rounded-md border border-slate-700 transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>

      {!readOnly && showFloatingToolbar && floatingToolbarStyle && (
        <div
          className="pointer-events-auto absolute z-50 rounded-xl bg-slate-950/95 backdrop-blur border border-gray-700 p-2 shadow-2xl transition-opacity duration-150"
          style={{
            top: floatingToolbarStyle.top,
            left: floatingToolbarStyle.left,
            minWidth: 260,
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <div className="flex flex-wrap items-center gap-1">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
              <Bold size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
              <Italic size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}>
              <UnderlineIcon size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}>
              <Strikethrough size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')}>
              <Highlighter size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={promptForColor} isActive={editor.isActive('textStyle') || editor.isActive('color')}>
              <Palette size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={removeFormatting}>
              <Eraser size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}>
              <Heading1 size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}>
              <Heading2 size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}>
              <List size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}>
              <ListOrdered size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>
              <Quote size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')}>
              <Code size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={promptForLink} isActive={editor.isActive('link')}>
              <Link2 size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={insertTable}>
              <TableIcon size={16} />
            </ToolbarButton>
            {noteId && (
              <ToolbarButton onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={16} />
              </ToolbarButton>
            )}
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()}>
              <Undo size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()}>
              <Redo size={16} />
            </ToolbarButton>
          </div>
        </div>
      )}

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
});
