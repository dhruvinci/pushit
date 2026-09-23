// Markdown shorthand for dropping footage between paragraphs:
//
//   ::clip DaVcpQwj-3d/03
//   ::clip DaVcpQwj-3d/03 "Drummers geeking out backstage"
//
// A paragraph that is exactly one such line becomes a <figure> with the clip.
import { clipHtml } from './media.mjs';

const CLIP = /^::clip\s+(\S+)(?:\s+"([^"]*)")?\s*$/;

export default function remarkClip() {
  return (tree, file) => {
    const visit = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'paragraph' && child.children.length === 1 && child.children[0].type === 'text') {
          const m = child.children[0].value.match(CLIP);
          if (m) {
            try {
              return { type: 'html', value: clipHtml(m[1], m[2] ?? ''), clip: true };
            } catch (err) {
              file.fail(err.message, child);
            }
          }
        }
        visit(child);
        return child;
      });
      // Consecutive clips become a contact sheet
      const grouped = [];
      for (const child of node.children) {
        const prev = grouped.at(-1);
        if (child.clip && prev?.clip) {
          prev.items.push(child.value);
          prev.value = `<div class="clip-sheet">${prev.items.join('')}</div>`;
        } else if (child.clip) {
          grouped.push({ ...child, items: [child.value] });
        } else grouped.push(child);
      }
      node.children = grouped;
    };
    visit(tree);
  };
}
