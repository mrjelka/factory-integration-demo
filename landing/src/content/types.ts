export interface ArchNode {
  name: string;
  tech: string;
  port: string | null;
}

export interface StackItem {
  name: string;
  desc: string;
}

export interface FeatureItem {
  title: string;
  desc: string;
}

export interface Content {
  htmlLang: string;
  meta: {
    title: string;
    description: string;
  };
  header: {
    langEn: string;
    langDe: string;
    linkedin: string;
    github: string;
    contact: string;
    contactEmail: string;
  };
  hero: {
    label: string;
    titleLine1: string;
    titleLine2: string;
    description: string;
    buttons: {
      control: string;
      grafana: string;
      source: string;
    };
  };
  architecture: {
    label: string;
    nodes: ArchNode[];
  };
  stack: {
    label: string;
    items: StackItem[];
  };
  features: {
    label: string;
    items: FeatureItem[];
  };
  footer: {
    name: string;
    title: string;
    email: string;
  };
}
