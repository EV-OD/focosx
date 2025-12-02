
export type BrushType = 'pencil' | 'pen' | 'marker';

export interface BrushConfig {
  id: BrushType;
  label: string;
  baseWidth: number;
  opacity: number;
  color: string;
  heightClass: string;
  tipColor: string;
}

export const BRUSHES: Record<BrushType, BrushConfig> = {
  pencil: {
    id: 'pencil',
    label: 'Pencil',
    baseWidth: 2,
    opacity: 0.9,
    color: '#a1a1aa', // Zinc 400
    heightClass: 'h-24',
    tipColor: '#e4e4e7'
  },
  pen: {
    id: 'pen',
    label: 'Fountain Pen',
    baseWidth: 4,
    opacity: 1,
    color: '#e4e4e7', // Zinc 200
    heightClass: 'h-20',
    tipColor: '#18181b'
  },
  marker: {
    id: 'marker',
    label: 'Marker',
    baseWidth: 12,
    opacity: 0.5,
    color: '#3b82f6', // Blue
    heightClass: 'h-20',
    tipColor: '#3b82f6'
  }
};

export const COLORS = [
  '#e4e4e7', // White/Zinc
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
];
