import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { LoginPage } from '../pages/LoginPage.jsx';

describe('LoginPage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders login tab by default with email and password inputs', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('nome@aluno.ufabc.edu.br')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Entrar' }).length).toBeGreaterThanOrEqual(1);
  });

  it('switches to register tab when clicking Cadastrar-se', async () => {
    render(<LoginPage />);
    const registerTabBtn = screen.getByRole('button', { name: 'Cadastrar-se' });
    fireEvent.click(registerTabBtn);

    expect(screen.getByPlaceholderText('Ex: Ana Clara')).toBeTruthy();
    expect(screen.getByText('Criar Conta')).toBeTruthy();
  });

  it('loads and displays demo accounts pills', async () => {
    const mockAccounts = [
      { id: 2, name: 'Eren Jaeger', email: 'eren.jaeger@pontinho.app' },
      { id: 3, name: 'Sabrina Carpenter', email: 'sabrina.carpenter@pontinho.app' }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAccounts
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Eren')).toBeTruthy();
      expect(screen.getByText('Sabrina')).toBeTruthy();
    });

    // Clica no botão demo Eren
    fireEvent.click(screen.getByText('Eren'));
    const emailInput = screen.getByPlaceholderText('nome@aluno.ufabc.edu.br');
    expect(emailInput.value).toBe('eren.jaeger@pontinho.app');
  });
});
