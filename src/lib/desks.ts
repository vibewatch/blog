/*
 * Desk system — each post is filed under one of five "desks", and assigned
 * a permanent section identifier (e.g. "B07") within that desk. The letter
 * is the desk; the number is the chronological slot inside the desk
 * (oldest = 01), so a piece keeps its identifier as new ones land.
 */

export type DeskKey = 'front' | 'networks' | 'cloud-native' | 'field' | 'casebook';

export type Desk = {
  key: DeskKey;
  letter: string;
  name: string;
  tagline: string;
};

export const desks: Record<DeskKey, Desk> = {
  front: {
    key: 'front',
    letter: 'A',
    name: 'Front',
    tagline: 'Editorials, surveys, and strategy from the desk.'
  },
  networks: {
    key: 'networks',
    letter: 'B',
    name: 'Networks',
    tagline: 'How packets traverse Azure plumbing — SNAT, NSG, BGP, and the unhappy edges in between.'
  },
  'cloud-native': {
    key: 'cloud-native',
    letter: 'C',
    name: 'Cloud Native',
    tagline: 'Kubernetes from the inside out — services, networking, scaling, observability.'
  },
  field: {
    key: 'field',
    letter: 'D',
    name: 'Field Notes',
    tagline: 'Short dispatches from the workbench — utilities, gotchas, fixes.'
  },
  casebook: {
    key: 'casebook',
    letter: 'E',
    name: 'Casebook',
    tagline: 'Long-form investigations and case studies, written as they were lived.'
  }
};

export const deskOrder: DeskKey[] = ['front', 'networks', 'cloud-native', 'field', 'casebook'];

export function classifyDesk(slug: string, tags: string[], title: string): DeskKey {
  const haystack = `${slug} ${title} ${tags.join(' ')}`.toLowerCase();

  if (/kusto-detective|dspy|harness-engineering|react-agents|english-dictionary|copilot-cli/.test(haystack)) {
    return 'casebook';
  }

  if (/articles-i-collected|business-architecture|architectural-characteristics|migration-checklist|advancements-in-ai|vibe.coding/.test(haystack)) {
    return 'front';
  }

  if (/load.?balancer|snat|\bnsg\b|\bwaf\b|hub-spoke|openvpn|\bvpn\b|tunnel|backbone|iperf|macvlan|flannel-network|accelerated.?network|\bnic\b|active-active|persistent-ssh/.test(haystack)) {
    return 'networks';
  }

  if (/kubernetes|\bk8s\b|wasm|keda|kafka|podsecurity|ingress|nginx|traefik|prometheus|monitoring|kubeadm|calico|ipvs|\baks\b|host this website|host-this-website|verbose-logging|hpa\b|horizontal-pod/.test(haystack)) {
    return 'cloud-native';
  }

  return 'field';
}

export type DeskAssignment = {
  deskKey: DeskKey;
  desk: Desk;
  index: number;
  sectionId: string;
};

export function buildAssignments<T extends { slug: string; date: Date; title: string; tags: string[] }>(items: T[]) {
  const tagged = items.map((item) => ({ item, deskKey: classifyDesk(item.slug, item.tags, item.title) }));
  const map = new Map<string, DeskAssignment>();
  for (const key of deskOrder) {
    const inDesk = tagged
      .filter((t) => t.deskKey === key)
      .sort((a, b) => a.item.date.getTime() - b.item.date.getTime());
    inDesk.forEach((t, i) => {
      const index = i + 1;
      const sectionId = `${desks[key].letter}${String(index).padStart(2, '0')}`;
      map.set(t.item.slug, { deskKey: key, desk: desks[key], index, sectionId });
    });
  }
  return map;
}
