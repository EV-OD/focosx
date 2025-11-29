import React from 'react';

interface SimpleMarkdownProps {
    content: string;
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content }) => {
    if (!content) return null;

    const lines = content.split('\n');

    return (
        <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
            {lines.map((line, idx) => {
                // Headers
                if (line.startsWith('#### ')) {
                    return <h4 key={idx} className="text-base font-bold text-zinc-200 mt-4 mb-2">{line.replace('#### ', '')}</h4>;
                }
                if (line.startsWith('### ')) {
                    return <h3 key={idx} className="text-lg font-bold text-zinc-100 mt-6 mb-2">{line.replace('### ', '')}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-xl font-bold text-zinc-100 mt-8 mb-3 pb-2 border-b border-zinc-800">{line.replace('## ', '')}</h2>;
                }
                if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-2xl font-bold text-white mt-8 mb-4">{line.replace('# ', '')}</h1>;
                }

                // List Items
                if (line.trim().startsWith('- ')) {
                    return (
                        <div key={idx} className="flex gap-2 ml-4">
                            <span className="text-blue-500">•</span>
                            <span>{parseInline(line.replace('- ', ''))}</span>
                        </div>
                    );
                }

                // Numbered Lists
                if (/^\d+\.\s/.test(line.trim())) {
                     return (
                        <div key={idx} className="flex gap-2 ml-4">
                            <span className="text-blue-500 font-mono text-xs pt-1">{line.split('.')[0]}.</span>
                            <span>{parseInline(line.replace(/^\d+\.\s/, ''))}</span>
                        </div>
                     );
                }

                // Blockquotes
                if (line.startsWith('> ')) {
                    return (
                        <div key={idx} className="border-l-2 border-zinc-600 pl-4 py-1 italic text-zinc-400">
                            {parseInline(line.replace('> ', ''))}
                        </div>
                    );
                }

                // Empty lines
                if (line.trim() === '') {
                    return <div key={idx} className="h-2" />;
                }

                // Paragraphs
                return <p key={idx}>{parseInline(line)}</p>;
            })}
        </div>
    );
};

// Helper to parse **bold** and `code`
const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-zinc-100 font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-zinc-800 text-blue-300 px-1 py-0.5 rounded text-xs font-mono border border-zinc-700">{part.slice(1, -1)}</code>;
        }
        return part;
    });
};