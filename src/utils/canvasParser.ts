/**
 * Converts an Obsidian Canvas JSON file to a human-readable text description
 * that Claude can understand without needing to parse raw JSON coordinates.
 */

interface CanvasNode {
  id: string;
  type: 'text' | 'file' | 'group' | 'link';
  // text node
  text?: string;
  // file node
  file?: string;
  // group node
  label?: string;
  // link node
  url?: string;
  // layout (ignored in readable output)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
  fromSide?: string;
  toSide?: string;
}

interface CanvasData {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

function nodeLabel(node: CanvasNode): string {
  switch (node.type) {
    case 'text':  return node.text ? `"${node.text.replace(/\n/g, ' ').slice(0, 80)}${node.text.length > 80 ? '…' : ''}"` : '(empty text card)';
    case 'file':  return node.file ?? '(unknown file)';
    case 'group': return node.label ? `[Group: ${node.label}]` : '[Unnamed group]';
    case 'link':  return node.url ?? '(unknown link)';
    default:      return '(unknown node)';
  }
}

export function canvasToText(filename: string, json: string, maxChars = 0): string {
  let data: CanvasData;
  try {
    data = JSON.parse(json) as CanvasData;
  } catch {
    return `[Canvas file "${filename}" could not be parsed — invalid JSON]`;
  }

  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];

  if (nodes.length === 0 && edges.length === 0) {
    return `[Canvas: "${filename}" — empty board]`;
  }

  const lines: string[] = [`Canvas: ${filename}`];

  // Build an id → node map for edge resolution
  const nodeMap = new Map<string, CanvasNode>(nodes.map(n => [n.id, n]));

  // Groups
  const groups = nodes.filter(n => n.type === 'group');
  if (groups.length > 0) {
    lines.push('', 'Groups:');
    for (const g of groups) {
      lines.push(`  - ${g.label ?? '(unnamed)'}`);
    }
  }

  // Text cards
  const textNodes = nodes.filter(n => n.type === 'text');
  if (textNodes.length > 0) {
    lines.push('', 'Text cards:');
    for (const n of textNodes) {
      const preview = (n.text ?? '').replace(/\n/g, ' ').slice(0, 120);
      lines.push(`  - ${preview}${(n.text ?? '').length > 120 ? '…' : ''}`);
    }
  }

  // File cards
  const fileNodes = nodes.filter(n => n.type === 'file');
  if (fileNodes.length > 0) {
    lines.push('', 'File cards:');
    for (const n of fileNodes) {
      lines.push(`  - ${n.file}`);
    }
  }

  // Link cards
  const linkNodes = nodes.filter(n => n.type === 'link');
  if (linkNodes.length > 0) {
    lines.push('', 'Link cards:');
    for (const n of linkNodes) {
      lines.push(`  - ${n.url}`);
    }
  }

  // Connections
  if (edges.length > 0) {
    lines.push('', 'Connections:');
    for (const e of edges) {
      const from = nodeMap.get(e.fromNode);
      const to = nodeMap.get(e.toNode);
      const fromLabel = from ? nodeLabel(from) : e.fromNode;
      const toLabel = to ? nodeLabel(to) : e.toNode;
      const edgeLabel = e.label ? ` [${e.label}]` : '';
      lines.push(`  - ${fromLabel} →${edgeLabel} ${toLabel}`);
    }
  }

  lines.push('', `(${nodes.length} node${nodes.length !== 1 ? 's' : ''}, ${edges.length} connection${edges.length !== 1 ? 's' : ''})`);

  const result = lines.join('\n');
  if (maxChars > 0 && result.length > maxChars) {
    return result.substring(0, maxChars) + `\n\n[Canvas truncated — ${nodes.length} nodes exceeded the ${maxChars}-character limit. Adjust "Max canvas size" in ObsidiBot settings to see more.]`;
  }
  return result;
}
