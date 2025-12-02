import { FileSystemNode, FileType } from "../../types";

// Returns a default tree and any default file contents that should be created
// alongside the tree. This avoids circular dependencies by not performing any
// persistence here — callers should persist `defaultContents` using their
// adapter's `saveFileContent`.
export const ensureDefaultStructure = (
  tree: FileSystemNode[],
): { tree: FileSystemNode[]; defaultContents: { id: string; content: any }[] } => {
  const defaults = ["Notes", "Canvases", "assets"];
  let newTree = [...tree];
  const defaultContents: { id: string; content: any }[] = [];

  defaults.forEach((name) => {
    const exists = newTree.find((n) => n.name === name && n.type === FileType.FOLDER);
    if (!exists) {
      newTree.push({
        id: name === "assets" ? "assets-folder" : crypto.randomUUID(),
        name,
        type: FileType.FOLDER,
        parentId: null,
        children: [],
      } as FileSystemNode);
    }
  });

  // Add a default canvas file if no canvases exist
  const hasCanvas = newTree.some((n) => n.type === FileType.CANVAS);
  if (!hasCanvas) {
    const canvasId = crypto.randomUUID();
    newTree.push({
      id: canvasId,
      name: "Welcome.canvas",
      type: FileType.CANVAS,
      parentId: null,
    } as FileSystemNode);

    const defaultContent = {
      id: canvasId,
      name: "Welcome",
      frames: [
        {
          id: "welcome-note",
          type: "sticky-note",
          x: 100,
          y: 100,
          width: 300,
          height: 200,
          content: "Welcome to FocosX!\n\nTry using the toolbar at the bottom to draw on the canvas or add new frames.",
          strokes: [],
        },
      ],
      globalStrokes: [],
    };
    defaultContents.push({ id: canvasId, content: defaultContent });
  }

  // Add a default CSV file if missing
  const hasCSV = newTree.some((n) => n.name && n.name.endsWith(".csv"));
  if (!hasCSV) {
    const csvId = crypto.randomUUID();
    newTree.push({
      id: csvId,
      name: "Data.csv",
      type: FileType.FILE,
      parentId: null,
    } as FileSystemNode);

    const defaultCSVContent =
      "Name,Role,Department\nAlice,Engineer,Product\nBob,Designer,Product\nCharlie,Manager,Sales";
    defaultContents.push({ id: csvId, content: defaultCSVContent });
  }

  return { tree: newTree, defaultContents };
};

export default ensureDefaultStructure;
