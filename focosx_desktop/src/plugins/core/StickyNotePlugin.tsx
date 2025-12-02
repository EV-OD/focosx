import React from 'react';
import { PluginDefinition, PluginFrameProps } from '../api/types';
import { StickyNote, Palette } from 'lucide-react';

type NoteColor = 'yellow' | 'blue' | 'green' | 'pink';

interface NoteContent {
    text: string;
    color: NoteColor;
}

const COLORS: Record<NoteColor, string> = {
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100 placeholder-yellow-100/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-100 placeholder-blue-100/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]',
    green: 'bg-green-500/10 border-green-500/30 text-green-100 placeholder-green-100/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]',
    pink: 'bg-pink-500/10 border-pink-500/30 text-pink-100 placeholder-pink-100/30 shadow-[0_0_30px_rgba(236,72,153,0.1)]'
};

const parseContent = (content: any): NoteContent => {
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object') {
                return {
                    text: parsed.text || '',
                    color: parsed.color || 'yellow'
                };
            }
        } catch (e) {
            // Fallback for plain string content
            return { text: content, color: 'yellow' };
        }
        return { text: content, color: 'yellow' };
    }
    if (typeof content === 'object' && content !== null) {
        return {
            text: content.text || '',
            color: content.color || 'yellow'
        };
    }
    return { text: '', color: 'yellow' };
};

const StickyNoteFrame: React.FC<PluginFrameProps> = ({ frame, onUpdate, mode }) => {
  const { text, color } = parseContent(frame.content);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({
          content: JSON.stringify({
              text: e.target.value,
              color: color
          })
      });
  };

  return (
    <div className={`w-full h-full border p-4 flex flex-col backdrop-blur-sm transition-colors duration-300 ${COLORS[color]}`}>
      <textarea
        className={`w-full h-full bg-transparent resize-none outline-none font-handwriting ${mode === 'draw' ? 'pointer-events-none' : 'pointer-events-auto'}`}
        value={text}
        onChange={handleChange}
        placeholder="Write something..."
        style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}
      />
    </div>
  );
};

export const StickyNotePlugin: PluginDefinition = {
  id: 'core-sticky-note',
  name: 'Sticky Note',
  version: '1.1.0',
  description: 'A simple sticky note for jotting down quick ideas. Supports multiple colors.',
  frameTypes: {
    'sticky-note': {
      label: 'Note',
      icon: <StickyNote className="w-4 h-4" />,
      component: StickyNoteFrame,
      defaultDimensions: { width: 300, height: 200 },
      handledExtensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx'],
      interaction: {
          captureWheel: true // Prevent canvas scroll when scrolling long text
      },
      customTools: [
        {
            id: 'change-color',
            label: 'Change Color',
            icon: <Palette className="w-4 h-4" />,
            onClick: (frame, updateFrame) => {
                const current = parseContent(frame.content);
                const colors: NoteColor[] = ['yellow', 'blue', 'green', 'pink'];
                const nextIdx = (colors.indexOf(current.color) + 1) % colors.length;
                const nextColor = colors[nextIdx];
                
                updateFrame({
                    content: JSON.stringify({
                        text: current.text,
                        color: nextColor
                    })
                });
            }
        }
      ]
    }
  }
};