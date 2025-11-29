import { FileSystemNode, FileType } from './types';

export const MOCK_FILE_SYSTEM: FileSystemNode[] = [
  {
    id: 'root-1',
    name: 'Project Alpha',
    type: FileType.FOLDER,
    parentId: null,
    children: [
      {
        id: 'doc-1',
        name: 'Research Notes.md',
        type: FileType.FILE,
        content: 'Initial thoughts on the architecture...',
        parentId: 'root-1'
      },
      {
        id: 'canvas-1',
        name: 'Architecture Diagram.canvas',
        type: FileType.CANVAS,
        parentId: 'root-1',
        content: {
          id: 'canvas-1',
          name: 'Architecture Diagram',
          frames: [
            {
              id: 'frame-1',
              type: 'sticky-note',
              x: 100,
              y: 100,
              width: 300,
              height: 200,
              content: 'Remember to check the asset pipeline!',
              strokes: []
            }
          ],
          globalStrokes: []
        }
      }
    ]
  },
  {
    id: 'assets-folder',
    name: 'assets',
    type: FileType.FOLDER,
    parentId: null,
    children: [
      {
        id: 'pdf-1',
        name: 'spec-v1.pdf',
        type: FileType.FILE,
        parentId: 'assets-folder',
        content: 'MOCK_PDF_BINARY_DATA'
      }
    ]
  }
];

export const GRID_SIZE = 20;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
