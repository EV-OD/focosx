
import React from 'react';
import { Stroke } from '../../../types';

interface StrokeLayerProps {
    strokes: Stroke[];
    currentStroke: Stroke | null;
    isDrawingGlobal: boolean;
    isFront: boolean;
    isFrontDrawing: boolean;
    brushOpacity: number;
}

export const StrokeLayer: React.FC<StrokeLayerProps> = React.memo(({ strokes, currentStroke, isDrawingGlobal, isFront, isFrontDrawing, brushOpacity }) => {
    return (
        <g>
            {strokes.map(stroke => {
                const opacity = stroke.width > 8 ? 0.5 : 1;
                return (
                    <polyline
                        key={stroke.id}
                        points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={opacity}
                    />
                );
            })}
            {isDrawingGlobal && currentStroke && (isFront ? isFrontDrawing : !isFrontDrawing) && (
                <polyline
                    points={currentStroke.points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={currentStroke.color}
                    strokeWidth={currentStroke.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={brushOpacity}
                />
            )}
        </g>
    );
});
