'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote,
  Code,
  Heading1,
  Heading2,
  Undo,
  Redo,
  ImagePlus,
} from 'lucide-react';
import { copyHtmlWithEmbeddedImages } from '@/lib/clipboard';
import { Toast } from './Toast';

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
}

export interface TipTapEditorHandle {
  focus: () => void;
  getHTML: () => string;
  getText: () => string;
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(function TipTapEditor({ content, onChange, placeholder = 'Start writing...', noteId, onPersistNote, onAttachmentAdded, readOnly = false, compact = false, copyWithImagesOnCopy }, ref) {
  const { copyWithImagesOnCopy: globalCopyWithImagesOnCopy } = useApp();
  const effectiveCopyWithImagesOnCopy = copyWithImagesOnCopy ?? globalCopyWithImagesOnCopy;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
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
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
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
            if (file && noteIdRef.current) {
              event.preventDefault();
              uploadImage(file).then(url => {
                if (url && view.state.selection) {
                  const { state, dispatch } = view;
                  const node = state.schema.nodes.image.create({ src: url });
                  const tr = state.tr.replaceSelectionWith(node);
                  dispatch(tr);
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
          return true;
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
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(content);
      if (currentContent !== newContent) {
        editor.commands.setContent(content);
      }
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

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode 
  }) => (
    <button
      type="button"
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

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 pb-3 mb-3 border-b border-gray-800 flex-wrap">
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
      )}
      
      {/* Editor */}
      <EditorContent editor={editor} />

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
});
