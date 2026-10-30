import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { Navbar } from '../components/Navbar.jsx';
import { setCurrentUserId } from '../services/api.js';
import { applyTheme } from '../services/theme.js';

describe('Navbar Component', () => {
  beforeEach(() => {
    localStorage.clear();
    applyTheme('ufabc');
  });

  it('renders Pontinho brand title and Beta badge', () => {
    render(<Navbar onOpenTheme={() => {}} onOpenHelp={() => {}} />);
    expect(screen.getByText('Pontinho')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('renders Entrar button when user is not authenticated', () => {
    render(<Navbar onOpenTheme={() => {}} onOpenHelp={() => {}} />);
    expect(screen.getByText('Entrar')).toBeTruthy();
  });

  it('renders Sair button when user is authenticated', () => {
    setCurrentUserId(10, 'mock_token');
    render(<Navbar onOpenTheme={() => {}} onOpenHelp={() => {}} />);
    expect(screen.getByText('Sair')).toBeTruthy();
  });

  it('renders PRIDE badge when theme is pride', () => {
    applyTheme('pride');
    render(<Navbar onOpenTheme={() => {}} onOpenHelp={() => {}} />);
    expect(screen.getByText('PRIDE 🏳️‍🌈')).toBeTruthy();
  });

  it('renders HALLOWEEN badge when theme is halloween', () => {
    applyTheme('halloween');
    render(<Navbar onOpenTheme={() => {}} onOpenHelp={() => {}} />);
    expect(screen.getByText('HALLOWEEN 🎃')).toBeTruthy();
  });

  it('renders desktop navigation links', () => {
    render(<Navbar onOpenTheme={() => {}} onOpenHelp={() => {}} />);
    expect(screen.getByText('Swipes')).toBeTruthy();
    expect(screen.getByText('Festas')).toBeTruthy();
    expect(screen.getByText('Conversas')).toBeTruthy();
    expect(screen.getByText('Meu Perfil')).toBeTruthy();
  });
});
