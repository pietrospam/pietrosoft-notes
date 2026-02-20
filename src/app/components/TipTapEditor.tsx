'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { useEffect, useRef, useCallback } from 'react';
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

interface TipTapEditorProps {
  content: object | null;
  onChange: (json: object) => void;
  placeholder?: string;
  noteId?: string; // Required for image uploads
}

export function TipTapEditor({ content, onChange, placeholder = 'Start writing...', noteId }: TipTapEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload image file to attachments API
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!noteId) {
      console.error('No noteId provided for image upload');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', noteId);

    try {
      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      return null;
    }
  }, [noteId]);

  const editor = useEditor({
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
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px]',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file && noteId) {
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
          if (noteId) {
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
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getJSON());
    },
  });

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
      
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
