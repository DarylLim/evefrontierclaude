import MiniSearch from 'minisearch';
import { KnowledgeChunk } from '../types';

const index = new MiniSearch<{ id: number; text: string; keywords: string }>({
  fields: ['text', 'keywords'],
  searchOptions: {
    boost: { keywords: 2 },
    fuzzy: 0.2,
  },
});

const chunks: KnowledgeChunk[] = [];
let nextId = 1;

export class KnowledgeBase {
  static search(query: string, limit = 5): KnowledgeChunk[] {
    if (chunks.length === 0) return [];
    const chunkById = new Map(chunks.map((c) => [c.id, c]));
    return index.search(query)
      .slice(0, limit)
      .map((r) => chunkById.get(r.id as number))
      .filter((c): c is KnowledgeChunk => c !== undefined);
  }

  static insert(chunk: Omit<KnowledgeChunk, 'id'>): void {
    const doc: KnowledgeChunk = { ...chunk, id: nextId++ };
    chunks.push(doc);
    index.add({ ...doc, keywords: doc.keywords.join(' ') });
  }

  static count(): number {
    return chunks.length;
  }
}
