export type DocEntry = {
  id: 'screenplay' | 'novel' | 'outline';
  title: string;
  pathFromRoot: string;
};

export const docs: DocEntry[] = [
  { id: 'screenplay', title: 'Screenplay', pathFromRoot: 'temporal_wake_screenplay.md' },
  { id: 'novel', title: 'Novel', pathFromRoot: 'temporal_wake_novel.md' },
  { id: 'outline', title: 'Outline', pathFromRoot: 'temporal_wake_outline.md' },
];

