import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';
import { UploadProgressBar } from '../components/UploadProgressBar.jsx';

describe('UploadProgressBar Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders progress bar with correct aria attributes and percentage', () => {
    render(<UploadProgressBar progress={45} stage="Otimizando imagem para WebP..." />);
    
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeDefined();
    expect(bar.getAttribute('aria-valuenow')).toBe('45');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    
    expect(screen.getByText('45%')).toBeDefined();
    expect(screen.getByText('Otimizando imagem para WebP...')).toBeDefined();
  });

  it('clamps values below 0 to 0 and above 100 to 100', () => {
    const { unmount } = render(<UploadProgressBar progress={-15} stage="Iniciando..." />);
    expect(screen.getByText('0%')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    unmount();

    render(<UploadProgressBar progress={135} stage="Concluído!" />);
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('renders private styling when isPrivate is true', () => {
    render(<UploadProgressBar progress={70} stage="Enviando foto secreta..." isPrivate={true} />);
    
    const bar = screen.getByRole('progressbar');
    expect(bar.className).toContain('border-rose-500/40');
    expect(screen.getByText('Enviando foto secreta...')).toBeDefined();
    expect(screen.getByText('70%')).toBeDefined();
  });

  it('renders default emerald styling when isPrivate is false', () => {
    render(<UploadProgressBar progress={80} stage="Enviando flyer..." isPrivate={false} />);
    
    const bar = screen.getByRole('progressbar');
    expect(bar.className).toContain('border-emerald-500/40');
    expect(screen.getByText('Enviando flyer...')).toBeDefined();
  });
});
