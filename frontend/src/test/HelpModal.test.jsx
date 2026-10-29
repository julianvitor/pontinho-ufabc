import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { HelpModal } from '../components/HelpModal.jsx';

describe('HelpModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText('Central de Ajuda & Segurança')).toBeNull();
  });

  it('renders all sections, badges and fields identical to help-modal.html', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Central de Ajuda & Segurança')).toBeTruthy();
    expect(screen.getByText('Sobre o Pontinho e Canal de Ouvidoria')).toBeTruthy();
    expect(screen.getByText(/O que é o Pontinho\?/i)).toBeTruthy();
    expect(screen.getByText(/Aberto a todos/i)).toBeTruthy();
    expect(screen.getByText(/Tipo da Ocorrência/i)).toBeTruthy();
    expect(screen.getByText(/Quem está envolvido\?/i)).toBeTruthy();
    expect(screen.getByText(/O que aconteceu\?/i)).toBeTruthy();
    expect(screen.getByText(/Seu Contato \(E-mail ou WhatsApp\)/i)).toBeTruthy();
    expect(screen.getByText(/Seu Nome \(opcional\)/i)).toBeTruthy();
    expect(screen.getByText(/Termos & LGPD/i)).toBeTruthy();
    expect(screen.getByText(/Enviar Reclamação/i)).toBeTruthy();
  });

  it('submits complaint with matching backend payload and calls onClose on success', async () => {
    const handleClose = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Denúncia registrada com sucesso!' })
    });

    render(<HelpModal isOpen={true} onClose={handleClose} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fake_profile' } });
    fireEvent.input(screen.getByPlaceholderText(/Nome, e-mail institucional/i), {
      target: { value: 'Fulano Fake' }
    });
    fireEvent.input(screen.getByPlaceholderText(/Descreva os fatos detalhadamente/i), {
      target: { value: 'Usando minhas fotos sem autorização' }
    });
    fireEvent.input(screen.getByPlaceholderText(/contato@exemplo.com ou telefone/i), {
      target: { value: 'eu@ufabc.edu.br' }
    });

    fireEvent.submit(screen.getByText(/Enviar Reclamação/i).closest('form'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/help/complaint'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            complaint_type: 'fake_profile',
            target_description: 'Fulano Fake',
            details: 'Usando minhas fotos sem autorização',
            reporter_contact: 'eu@ufabc.edu.br',
            reporter_name: ''
          })
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
