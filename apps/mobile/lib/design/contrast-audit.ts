import { theme } from './theme';

export type ContrastAuditPair = {
  background: string;
  foreground: string;
  minimumRatio: number;
  name: string;
};

export type ContrastAuditEntry = ContrastAuditPair & {
  ratio: number;
};

export type ContrastAuditResult = {
  failures: ContrastAuditEntry[];
  passes: ContrastAuditEntry[];
};

export const auditedContrastPairs: ContrastAuditPair[] = [
  {
    background: theme.color.surface,
    foreground: theme.color.textStrong,
    minimumRatio: 4.5,
    name: 'primary text on surface',
  },
  {
    background: theme.color.surface,
    foreground: theme.color.textBody,
    minimumRatio: 4.5,
    name: 'body text on surface',
  },
  {
    background: theme.color.surface,
    foreground: theme.color.textMuted,
    minimumRatio: 3,
    name: 'secondary text on surface',
  },
  {
    background: theme.color.shell,
    foreground: theme.color.textOnShell,
    minimumRatio: 4.5,
    name: 'primary text on shell',
  },
  {
    background: theme.color.shell,
    foreground: theme.color.textOnShellMuted,
    minimumRatio: 3,
    name: 'secondary text on shell',
  },
  {
    background: theme.color.actionPrimary,
    foreground: theme.color.onActionPrimary,
    minimumRatio: 4.5,
    name: 'Action Coral primary CTA text',
  },
  {
    background: theme.color.primarySoft,
    foreground: theme.color.primaryTextOnLight,
    minimumRatio: 4.5,
    name: 'Coral soft selected text',
  },
];

export function runContrastAudit(pairs: readonly ContrastAuditPair[]): ContrastAuditResult {
  const entries = pairs.map((pair) => ({ ...pair, ratio: contrastRatio(pair.foreground, pair.background) }));

  return {
    failures: entries.filter((entry) => entry.ratio < entry.minimumRatio),
    passes: entries.filter((entry) => entry.ratio >= entry.minimumRatio),
  };
}

export function contrastRatio(foreground: string, background: string): number {
  const backgroundRgb = parseColor(background, [255, 255, 255]);
  const foregroundRgb = parseColor(foreground, backgroundRgb);
  const foregroundLuminance = relativeLuminance(foregroundRgb);
  const backgroundLuminance = relativeLuminance(backgroundRgb);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

type Rgb = [number, number, number];

function parseColor(value: string, background: Rgb): Rgb {
  const normalized = value.trim();
  if (normalized.startsWith('#')) {
    return parseHexColor(normalized);
  }

  const rgbaMatch = normalized.match(/^rgba\((\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d?(?:\.\d+)?)\)$/);
  if (rgbaMatch) {
    const red = Number(rgbaMatch[1]);
    const green = Number(rgbaMatch[2]);
    const blue = Number(rgbaMatch[3]);
    const alpha = clamp(Number(rgbaMatch[4]), 0, 1);
    return [
      compositeChannel(red, background[0], alpha),
      compositeChannel(green, background[1], alpha),
      compositeChannel(blue, background[2], alpha),
    ];
  }

  throw new Error(`Unsupported color format for contrast audit: ${value}`);
}

function parseHexColor(value: string): Rgb {
  const hex = value.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Unsupported hex color for contrast audit: ${value}`);
  }

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function compositeChannel(foreground: number, background: number, alpha: number): number {
  return Math.round(foreground * alpha + background * (1 - alpha));
}

function relativeLuminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = clamp(channel, 0, 255) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
