interface CardData {
  wasCorrect: boolean;
  actualPartner: 'HUMAN' | 'AI';
  score: number;
  currentStreak: number;
  fooledPartner: boolean;
  title: string;
  subtitle: string;
  streakLabel: string;
  scoreLabel: string;
}

const W = 1080;
const H = 1080;

function draw(canvas: HTMLCanvasElement, data: CardData): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = '#0f172a'; // slate-900, matches the app
  ctx.fillRect(0, 0, W, H);

  const accent = data.wasCorrect ? '#4ade80' : '#f87171';
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 16);

  ctx.textAlign = 'center';

  ctx.font = 'bold 200px system-ui, sans-serif';
  ctx.fillText(data.actualPartner === 'AI' ? '🤖' : '👤', W / 2, 320);

  ctx.fillStyle = accent;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(data.title, W / 2, 460);

  ctx.fillStyle = '#cbd5e1'; // slate-300
  ctx.font = '44px system-ui, sans-serif';
  wrap(ctx, data.subtitle, W / 2, 550, W - 160, 60);

  if (data.fooledPartner) {
    ctx.fillStyle = '#22d3ee'; // cyan-400
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('🎭 ' + data.streakLabel, W / 2, 720);
  }

  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 120px system-ui, sans-serif';
  ctx.fillText(String(data.score), W / 2, 880);

  ctx.fillStyle = '#64748b'; // slate-500
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(data.scoreLabel, W / 2, 940);
  ctx.fillText('Turing Test Challenge', W / 2, 1020);
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(' ');
  let line = '';
  let offset = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + offset);
      line = word;
      offset += lineHeight;
    } else {
      line = candidate;
    }
  }
  ctx.fillText(line, x, y + offset);
}

/**
 * Renders the result as an image and hands it to the OS share sheet, falling
 * back to a download when the browser has no share support (desktop, mostly).
 */
export async function shareResult(data: CardData): Promise<void> {
  const canvas = document.createElement('canvas');
  draw(canvas, data);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the share image');

  const file = new File([blob], 'turing-test-result.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: data.title });
      return;
    } catch (error) {
      // The user dismissed the sheet - not an error worth surfacing.
      if ((error as Error).name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'turing-test-result.png';
  link.click();
  URL.revokeObjectURL(url);
}
